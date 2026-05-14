"""
购物车补丁 — 替换 order 服务(8003) 的 app/api/cart.py
修复: GET /order/cart/ 返回 spu_name / price / stock / main_image
使用方法: 复制到容器 /app/app/api/cart.py 并重启 h5-order-service
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from pydantic import BaseModel, Field

from app.models.order import Cart
from app.models.goods import Spu, Sku
from common.database.session import get_db
from common.auth.jwt import get_current_user

router = APIRouter(prefix="/order", tags=["购物车"])


class AddCartBody(BaseModel):
    sku_id: int
    quantity: int = Field(ge=1, default=1)

class UpdateCartBody(BaseModel):
    quantity: int = Field(ge=1)

class ToggleCheckedBody(BaseModel):
    ids: list[int]
    checked: bool

class ToggleAllBody(BaseModel):
    checked: bool

class DeleteCartBody(BaseModel):
    ids: list[int]


def _enrich_cart_items(cart_items, spu_map: dict, sku_map: dict) -> list[dict]:
    """补全购物车项的商品信息"""
    items = []
    for c in cart_items:
        spu = spu_map.get(c.spu_id)
        sku = sku_map.get(c.sku_id)
        items.append({
            "id": c.id,
            "spu_id": c.spu_id,
            "sku_id": c.sku_id,
            "spu_name": spu.name if spu else "",
            "main_image": spu.main_image if spu else (sku.main_image if sku else ""),
            "price": sku.price if sku else 0,
            "quantity": c.quantity,
            "stock": sku.stock if sku else 0,
            "checked": c.checked,
            "created_at": c.created_at.isoformat() if c.created_at else "",
        })
    return items


async def _get_sku_stock(db: AsyncSession, sku_id: int) -> int:
    result = await db.execute(select(Sku.stock).where(Sku.id == sku_id))
    row = result.scalar_one_or_none()
    return row if row is not None else 0


@router.get("/cart/")
async def get_cart_list(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """获取购物车列表（含完整商品信息）"""
    user_id = int(current_user.get("sub", 0))
    result = await db.execute(select(Cart).where(Cart.user_id == user_id))
    cart_items = result.scalars().all()

    if not cart_items:
        return []

    spu_ids = list({c.spu_id for c in cart_items})
    sku_ids = list({c.sku_id for c in cart_items})

    spu_map, sku_map = {}, {}
    if spu_ids:
        spu_rows = await db.execute(select(Spu).where(Spu.id.in_(spu_ids)))
        spu_map = {s.id: s for s in spu_rows.scalars().all()}
    if sku_ids:
        sku_rows = await db.execute(select(Sku).where(Sku.id.in_(sku_ids)))
        sku_map = {s.id: s for s in sku_rows.scalars().all()}

    return _enrich_cart_items(cart_items, spu_map, sku_map)


@router.post("/cart/")
async def add_to_cart(
    body: AddCartBody,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """加入购物车"""
    user_id = int(current_user.get("sub", 0))

    # validate SKU exists
    sku_result = await db.execute(select(Sku).where(Sku.id == body.sku_id))
    sku = sku_result.scalar_one_or_none()
    if not sku:
        raise HTTPException(status_code=404, detail="商品SKU不存在")
    if sku.stock <= 0:
        raise HTTPException(status_code=400, detail="商品已售罄")

    # check existing
    existing = await db.execute(
        select(Cart).where(Cart.user_id == user_id, Cart.sku_id == body.sku_id)
    )
    cart_item = existing.scalar_one_or_none()

    if cart_item:
        new_qty = cart_item.quantity + body.quantity
        if new_qty > sku.stock:
            raise HTTPException(status_code=400, detail=f"库存不足，最多可购买 {sku.stock} 件")
        cart_item.quantity = new_qty
    else:
        cart_item = Cart(
            user_id=user_id, spu_id=sku.spu_id, sku_id=body.sku_id,
            quantity=body.quantity, checked=True,
        )
        db.add(cart_item)

    await db.commit()
    return {"msg": "已加入购物车"}


@router.put("/cart/{cart_id}")
async def update_cart_item(
    cart_id: int, body: UpdateCartBody,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """修改购物车数量"""
    user_id = int(current_user.get("sub", 0))
    result = await db.execute(
        select(Cart).where(Cart.id == cart_id, Cart.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="购物车项不存在")

    stock = await _get_sku_stock(db, item.sku_id)
    if stock > 0 and body.quantity > stock:
        raise HTTPException(status_code=400, detail=f"库存不足，最多可购买 {stock} 件")

    item.quantity = body.quantity
    await db.commit()
    return {"msg": "ok"}


@router.put("/cart/checked")
async def toggle_checked(
    body: ToggleCheckedBody,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """选中/取消选中"""
    user_id = int(current_user.get("sub", 0))
    await db.execute(
        update(Cart).where(Cart.id.in_(body.ids), Cart.user_id == user_id).values(checked=body.checked)
    )
    await db.commit()
    return {"msg": "ok"}


@router.put("/cart/check-all")
async def toggle_all(
    body: ToggleAllBody,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """全选/全不选"""
    user_id = int(current_user.get("sub", 0))
    await db.execute(
        update(Cart).where(Cart.user_id == user_id).values(checked=body.checked)
    )
    await db.commit()
    return {"msg": "ok"}


@router.delete("/cart/")
async def delete_cart_items(
    body: DeleteCartBody,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """批量删除"""
    user_id = int(current_user.get("sub", 0))
    await db.execute(
        delete(Cart).where(Cart.id.in_(body.ids), Cart.user_id == user_id)
    )
    await db.commit()
    return {"msg": "ok"}
