"""
订单服务管理补丁 — 部署到端口 8003 的订单服务
提供管理端订单列表 / 退款审核 / 发货 / 备注
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from app.models.order import Order, OrderItem, OrderRefund
from common.database.session import get_db
from common.auth.jwt import get_current_admin_user

router = APIRouter(prefix="/order/admin", tags=["订单管理"])

class RefundBody(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")
    reason: Optional[str] = None

class ShippingBody(BaseModel):
    company: str
    tracking_no: str

class RemarkBody(BaseModel):
    remark: str

@router.get("/orders/list")
async def list_orders_admin(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None, keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user),
):
    """Admin order list — returns ALL orders regardless of user"""
    q = select(Order).options(selectinload(Order.items), selectinload(Order.refund))
    count_q = select(func.count(Order.id))
    if status:
        q = q.where(Order.status == status)
        count_q = count_q.where(Order.status == status)
    if keyword:
        q = q.where(or_(Order.order_no.ilike(f"%{keyword}%"), Order.username.ilike(f"%{keyword}%")))
        count_q = count_q.where(or_(Order.order_no.ilike(f"%{keyword}%"), Order.username.ilike(f"%{keyword}%")))

    total = (await db.execute(count_q)).scalar() or 0
    rows = (await db.execute(q.order_by(Order.id.desc()).offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"list": [_order_to_dict(r) for r in rows], "total": total, "page": page, "page_size": page_size}

@router.put("/orders/{order_id}/refund")
async def process_refund(order_id: int, body: RefundBody,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    result = await db.execute(select(Order).where(Order.id == order_id).options(selectinload(Order.refund)))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status != "refunding" or not order.refund:
        raise HTTPException(status_code=400, detail="订单不在退款中状态")
    if body.action == "approve":
        order.refund.status = 1
        order.status = "refunded"
    else:
        order.refund.status = -1
        order.refund.reject_reason = body.reason or ""
        order.status = "completed"
    await db.commit()
    return {"msg": "ok"}

@router.put("/orders/{order_id}/shipping")
async def update_shipping(order_id: int, body: ShippingBody,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    result = await db.execute(update(Order).where(
        Order.id == order_id, Order.status == "paid").values(
        shipping_company=body.company, tracking_no=body.tracking_no,
        shipped_at=datetime.now(timezone.utc), status="shipped"))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="订单不存在或状态不是已付款")
    await db.commit()
    return {"msg": "ok"}

@router.put("/orders/{order_id}/remark")
async def update_remark(order_id: int, body: RemarkBody,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    result = await db.execute(update(Order).where(Order.id == order_id).values(remark=body.remark))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="订单不存在")
    await db.commit()
    return {"msg": "ok"}


def _order_to_dict(order: Order) -> dict:
    items = []
    for item in (order.items or []):
        items.append({
            "id": item.id, "sku_id": item.sku_id or 0,
            "spu_name": item.spu_name or "", "price": item.price or 0,
            "quantity": item.quantity or 0, "total_amount": item.total_amount or 0,
            "main_image": item.main_image or "",
        })
    refund = None
    if order.refund:
        refund = {
            "refund_amount": order.refund.refund_amount or 0,
            "reason": order.refund.reason or "",
            "description": order.refund.description or "",
            "status": order.refund.status if order.refund.status is not None else 0,
            "reject_reason": order.refund.reject_reason or "",
        }
    return {
        "id": order.id, "order_no": order.order_no or "",
        "status": order.status or "", "total_amount": order.total_amount or 0,
        "pay_amount": order.pay_amount or 0, "freight_amount": order.freight_amount or 0,
        "discount_amount": order.discount_amount or 0,
        "address_snapshot": _parse_address(order.address_snapshot),
        "remark": order.remark or "", "user_id": order.user_id or 0,
        "username": order.username or "", "items": items,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        "shipping_company": order.shipping_company or "",
        "tracking_no": order.tracking_no or "",
        "shipped_at": order.shipped_at.isoformat() if order.shipped_at else None,
        "refund": refund,
    }

def _parse_address(snapshot) -> dict:
    if snapshot is None:
        return {"name": "", "phone": "", "full_address": ""}
    if isinstance(snapshot, dict):
        return snapshot
    if isinstance(snapshot, str):
        try:
            import json
            return json.loads(snapshot)
        except (json.JSONDecodeError, TypeError):
            return {"name": "", "phone": "", "full_address": snapshot}
    return {"name": "", "phone": "", "full_address": str(snapshot)}
