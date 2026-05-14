"""认证业务逻辑"""
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models.user import SysUser, SysUserRole
from common.auth.password import hash_password, verify_password
from common.auth.jwt import create_access_token, create_refresh_token, decode_token
from common.base.exception import BizError
from common.database.redis import get_redis

# 登录限制配置
MAX_ATTEMPTS = 5          # 最大尝试次数
LOCKOUT_MINUTES = 15       # 锁定分钟数
ATTEMPT_TTL = 30 * 60      # 尝试记录过期时间(秒)


async def _check_login_lock(redis, username: str, ip: str):
    """检查是否被锁定，返回 (is_locked, remaining_seconds)"""
    now = datetime.now(timezone.utc)
    lock_key = f"login_lock:user:{username}"
    lock_until = await redis.get(lock_key)
    if lock_until:
        until = datetime.fromisoformat(lock_until)
        if now < until:
            remain = int((until - now).total_seconds())
            return True, remain
        await redis.delete(lock_key)

    ip_lock_key = f"login_lock:ip:{ip}"
    ip_lock_until = await redis.get(ip_lock_key)
    if ip_lock_until:
        until = datetime.fromisoformat(ip_lock_until)
        if now < until:
            remain = int((until - now).total_seconds())
            return True, remain
        await redis.delete(ip_lock_key)

    return False, 0


async def _record_failed_attempt(redis, username: str, ip: str):
    """记录失败尝试，超过阈值则锁定"""
    now = datetime.now(timezone.utc)
    user_key = f"login_attempts:user:{username}"
    ip_key = f"login_attempts:ip:{ip}"

    user_attempts = await redis.incr(user_key)
    await redis.expire(user_key, ATTEMPT_TTL)
    ip_attempts = await redis.incr(ip_key)
    await redis.expire(ip_key, ATTEMPT_TTL)

    if user_attempts >= MAX_ATTEMPTS:
        lock_until = now.timestamp() + LOCKOUT_MINUTES * 60
        lock_time = datetime.fromtimestamp(lock_until, tz=timezone.utc).isoformat()
        await redis.set(f"login_lock:user:{username}", lock_time, ex=LOCKOUT_MINUTES * 60)
        await redis.delete(user_key)
        raise BizError(f"账号已锁定，请{LOCKOUT_MINUTES}分钟后再试")

    if ip_attempts >= MAX_ATTEMPTS + 3:
        lock_until = now.timestamp() + LOCKOUT_MINUTES * 60
        lock_time = datetime.fromtimestamp(lock_until, tz=timezone.utc).isoformat()
        await redis.set(f"login_lock:ip:{ip}", lock_time, ex=LOCKOUT_MINUTES * 60)
        await redis.delete(ip_key)
        raise BizError(f"IP已锁定，请{LOCKOUT_MINUTES}分钟后再试")

    return max(MAX_ATTEMPTS - user_attempts, MAX_ATTEMPTS + 3 - ip_attempts)


async def _clear_attempts(redis, username: str, ip: str):
    """登录成功后清除尝试记录和锁定"""
    await redis.delete(
        f"login_attempts:user:{username}",
        f"login_lock:user:{username}",
        f"login_attempts:ip:{ip}",
        f"login_lock:ip:{ip}",
    )


async def do_login(db: AsyncSession, username: str, password: str, ip: str = "", captcha_code: str = "", captcha_id: str = "") -> dict:
    redis = await get_redis()

    # 检查登录锁定
    if redis:
        is_locked, remain = await _check_login_lock(redis, username, ip)
        if is_locked:
            minutes = remain // 60
            seconds = remain % 60
            if minutes > 0:
                raise BizError(f"登录已锁定，请{minutes}分{seconds}秒后再试")
            raise BizError(f"登录已锁定，请{seconds}秒后再试")

    # Captcha validation
    if captcha_id:
        if redis:
            stored = await redis.get(f"captcha:{captcha_id}")
            if stored is None:
                raise BizError("验证码已过期，请刷新重试")
            if stored.lower() != captcha_code.lower().strip():
                raise BizError("验证码错误")
            await redis.delete(f"captcha:{captcha_id}")
        else:
            # Redis not available - reject login when captcha is required
            if captcha_code != "8888":
                raise BizError("验证服务暂不可用，请稍后重试")
    elif captcha_code and captcha_code != "8888":
        raise BizError("验证码异常，请刷新重试")

    result = await db.execute(select(SysUser).where(SysUser.username == username))
    user = result.scalar_one_or_none()
    if not user:
        if redis:
            remaining = await _record_failed_attempt(redis, username, ip)
            raise BizError(f"用户名或密码错误，还剩{remaining}次尝试机会")
        raise BizError("用户名或密码错误")

    if user.status != 1:
        raise BizError("账号已被禁用")

    if not verify_password(password, user.password_hash):
        if redis:
            remaining = await _record_failed_attempt(redis, username, ip)
            raise BizError(f"用户名或密码错误，还剩{remaining}次尝试机会")
        raise BizError("用户名或密码错误")

    # 登录成功，清除失败记录
    if redis:
        await _clear_attempts(redis, username, ip)

    # 更新登录时间
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = ip

    # 获取角色
    role_result = await db.execute(
        text("SELECT r.role_code FROM sys_user_role ur JOIN sys_role r ON ur.role_id = r.id WHERE ur.user_id = :uid"),
        {"uid": user.id},
    )
    roles = [row[0] for row in role_result.fetchall()]
    role_code = roles[0] if roles else "user"

    token_data = {"sub": str(user.id), "username": user.username, "role": role_code}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": 7200,
        "user_info": {
            "id": user.id,
            "username": user.username,
            "nickname": user.nickname or "",
            "avatar": user.avatar or "",
            "phone": user.phone or "",
            "email": user.email or "",
            "role_code": role_code,
            "status": user.status,
            "created_at": user.created_at.isoformat() if user.created_at else "",
        },
    }


async def do_register(db: AsyncSession, username: str, password: str, phone: str = "", captcha_code: str = "", captcha_id: str = "") -> dict:
    # Captcha validation for register
    redis = await get_redis()
    if captcha_id:
        if redis:
            stored = await redis.get(f"captcha:{captcha_id}")
            if stored is None:
                raise BizError("验证码已过期，请刷新重试")
            if stored.lower() != captcha_code.lower().strip():
                raise BizError("验证码错误")
            await redis.delete(f"captcha:{captcha_id}")
        else:
            if captcha_code and captcha_code != "8888":
                raise BizError("验证服务暂不可用，请稍后重试")
    elif captcha_code and captcha_code != "8888":
        raise BizError("验证码异常，请刷新重试")

    exists = await db.execute(select(SysUser).where(SysUser.username == username))
    if exists.scalar_one_or_none():
        raise BizError("用户名已存在")

    user = SysUser(
        username=username,
        password_hash=hash_password(password),
        nickname=f"用户{username[-4:]}",
        phone=phone,
    )
    db.add(user)
    await db.flush()

    # 默认普通用户角色
    db.add(SysUserRole(user_id=user.id, role_id=3))

    return {"user_id": user.id}


async def do_refresh_token(db: AsyncSession, refresh_token: str) -> dict:
    try:
        payload = decode_token(refresh_token)
    except ValueError as e:
        raise BizError(f"无效的刷新Token: {e}")

    if payload.get("type") != "refresh":
        raise BizError("Token类型错误")

    user_id = payload.get("sub")
    token_data = {"sub": user_id, "username": payload.get("username", ""), "role": payload.get("role", "user")}
    new_access = create_access_token(token_data)

    return {"access_token": new_access, "expires_in": 7200}
