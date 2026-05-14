"""
用户服务管理补丁 — 部署到端口 8001 的用户服务
提供 GET /api/v1/user/list 和 PUT /api/v1/user/{id}/status
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, or_
from pydantic import BaseModel, Field

from app.models.user import SysUser, SysUserRole
from common.database.session import get_db
from common.auth.jwt import get_current_admin_user

router = APIRouter(prefix="/user", tags=["用户管理"])

class UpdateUserStatusBody(BaseModel):
    status: int = Field(ge=0, le=1)

@router.get("/list")
async def list_users(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user),
):
    q = select(SysUser)
    count_q = select(func.count(SysUser.id))
    if keyword:
        q = q.where(or_(SysUser.username.ilike(f"%{keyword}%"), SysUser.nickname.ilike(f"%{keyword}%")))
        count_q = count_q.where(or_(SysUser.username.ilike(f"%{keyword}%"), SysUser.nickname.ilike(f"%{keyword}%")))

    total = (await db.execute(count_q)).scalar() or 0
    users = (await db.execute(q.order_by(SysUser.id.asc()).offset((page-1)*page_size).limit(page_size))).scalars().all()

    user_ids = [u.id for u in users]
    role_map = {}
    if user_ids:
        role_rows = (await db.execute(select(SysUserRole.user_id, SysUserRole.role_code).where(SysUserRole.user_id.in_(user_ids)))).all()
        role_map = {r.user_id: r.role_code for r in role_rows}

    return {
        "list": [_user_to_dict(u, role_map.get(u.id, "user")) for u in users],
        "total": total, "page": page, "page_size": page_size,
    }

@router.put("/{user_id}/status")
async def toggle_user_status(user_id: int, body: UpdateUserStatusBody,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    result = await db.execute(update(SysUser).where(SysUser.id == user_id).values(status=body.status))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="用户不存在")
    await db.commit()
    return {"msg": "ok"}


def _user_to_dict(user: SysUser, role_code: str = "user") -> dict:
    return {
        "id": user.id, "username": user.username or "",
        "nickname": user.nickname or "", "phone": user.phone or "",
        "email": user.email or "", "role_code": role_code,
        "status": user.status if user.status is not None else 1,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
