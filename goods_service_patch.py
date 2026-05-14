"""
商品服务管理补丁 — 部署到端口 8002 的商品服务
提供 PUT /api/v1/goods/spu/{id}/status 和 PUT /api/v1/goods/spu/{id}
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from pydantic import BaseModel, Field

from app.models.goods import Spu
from common.database.session import get_db
from common.auth.jwt import get_current_admin_user

router = APIRouter(prefix="/goods", tags=["商品管理"])

class UpdateGoodsStatusBody(BaseModel):
    status: int = Field(ge=0, le=1)

class UpdateGoodsBody(BaseModel):
    name: Optional[str] = None
    subtitle: Optional[str] = None
    brand: Optional[str] = None
    main_image: Optional[str] = None
    min_price: Optional[int] = None
    max_price: Optional[int] = None

@router.put("/spu/{goods_id}/status")
async def toggle_goods_status(goods_id: int, body: UpdateGoodsStatusBody,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    result = await db.execute(
        update(Spu).where(Spu.id == goods_id).values(status=body.status))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="商品不存在")
    await db.commit()
    return {"msg": "ok"}

@router.put("/spu/{goods_id}")
async def update_goods(goods_id: int, body: UpdateGoodsBody,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="无更新字段")
    result = await db.execute(
        update(Spu).where(Spu.id == goods_id).values(**updates))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="商品不存在")
    await db.commit()
    return {"msg": "ok"}
