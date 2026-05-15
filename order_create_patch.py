"""
订单创建补丁 — 替换 order 服务(8003) 创建订单逻辑
修复: POST /order/orders/create 从购物车创建订单 500 错误
原因: 原实现未正确处理 cart_item_ids 与 SPU/SKU 的关联查询
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, Field
from typing import Optional
import uuid
from datetime import datetime, timezone

from app.models.order import Cart, Order, OrderItem
from app.models.goods import Spu, Sku
from common.database.session import get_db
from common.auth.jwt import get_current_user

router = APIRouter(prefix="/order", tags=["订单"])


class CreateOrderBody(BaseModel):
    cart_item_ids: list[int] = Field(min_length=1)
    address_id: int
    pay_method: Optional[str] = "wechat"
    remark: Optional[str] = ""


def _build_order_no() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"ORD{ts}{uuid.uuid4().hex[:6].upper()}"


@router.post("/orders/create")
async def create_order_from_cart(
    body: CreateOrderBody,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """从购物车创建订单 — JOIN SPU/SKU 获取完整商品信息"""
    user_id = int(current_user.get("sub", 0))

    # 1. 查询购物车项（仅当前用户 + 指定 ID）
    result = await db.execute(
        select(Cart).where(
            Cart.id.in_(body.cart_item_ids),
            Cart.user_id == user_id,
        )
    )
    cart_items = result.scalars().all()

    if not cart_items:
        raise HTTPException(status_code=400, detail="购物车项不存在")

    # 2. 获取 SPU/SKU 信息
    sku_ids = list({c.sku_id for c in cart_items})
    spu_ids = list({c.spu_id for c in cart_items})

    sku_result = await db.execute(select(Sku).where(Sku.id.in_(sku_ids)))
    sku_map = {s.id: s for s in sku_result.scalars().all()}

    spu_result = await db.execute(select(Spu).where(Spu.id.in_(spu_ids)))
    spu_map = {s.id: s for s in spu_result.scalars().all()}

    # 3. 校验库存
    for c in cart_items:
        sku = sku_map.get(c.sku_id)
        if not sku:
            raise HTTPException(status_code=400, detail=f"SKU {c.sku_id} 不存在")
        if sku.stock < c.quantity:
            raise HTTPException(status_code=400,
                detail=f"「{spu_map.get(c.spu_id, Spu()).name}」库存不足，剩余 {sku.stock} 件")

    # 4. 计算金额并创建订单
    total_amount = 0
    for c in cart_items:
        sku = sku_map[c.sku_id]
        total_amount += sku.price * c.quantity

    freight = 0 if total_amount >= 9900 else 800
    order_no = _build_order_no()

    order = Order(
        order_no=order_no,
        user_id=user_id,
        status="pending_payment",
        total_amount=total_amount,
        pay_amount=total_amount + freight,
        freight_amount=freight,
        discount_amount=0,
        address_id=body.address_id,
        remark=body.remark or "",
    )
    db.add(order)
    await db.flush()

    # 5. 创建订单项
    for c in cart_items:
        sku = sku_map[c.sku_id]
        spu = spu_map.get(c.spu_id)
        item = OrderItem(
            order_id=order.id,
            sku_id=c.sku_id,
            spu_name=spu.name if spu else "",
            main_image=spu.main_image if spu else "",
            price=sku.price,
            quantity=c.quantity,
            total_amount=sku.price * c.quantity,
        )
        db.add(item)

        # 扣减库存
        sku.stock -= c.quantity

    # 6. 清除购物车
    for c in cart_items:
        await db.delete(c)

    await db.commit()
    return {"order_no": order_no, "order_id": order.id}
