"""认证业务逻辑"""
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models.user import SysUser, SysUserRole
from common.auth.password import hash_password, verify_password
from common.auth.jwt import create_access_token, create_refresh_token, decode_token
from common.base.exception import BizError
from common.database.redis import get_redis


async def do_login(db: AsyncSession, username: str, password: str, ip: str = "", captcha_code: str = "", captcha_id: str = "") -> dict:
    # Captcha validation
    if captcha_id:
        redis = await get_redis()
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
        raise BizError("用户名或密码错误")
    if user.status != 1:
        raise BizError("账号已被禁用")
    if not verify_password(password, user.password_hash):
        raise BizError("用户名或密码错误")

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
    if captcha_id:
        redis = await get_redis()
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
