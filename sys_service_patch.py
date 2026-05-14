"""
系统管理服务 — 管理后台 API
提供 /api/v1/sys/* 端点的管理功能
部署到端口 8005 的系统服务
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, case, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from app.models.user import SysUser, SysUserRole
from app.models.goods import Spu, Sku, GoodsCategory
from app.models.order import Order, OrderItem, OrderRefund
from common.database.session import get_db
from common.auth.jwt import get_current_admin_user
from common.base.exception import BizError

router = APIRouter(prefix="/sys", tags=["系统管理"])

# ============================================================
# Pydantic schemas
# ============================================================

class PaginatedResponse(BaseModel):
    list: list
    total: int
    page: int
    page_size: int

class GoodsItem(BaseModel):
    id: int; spu_code: str = ""; name: str = ""; subtitle: str = ""
    category_id: int = 0; brand: str = ""; main_image: str = ""; images: list = []
    min_price: int = 0; max_price: int = 0; sales: int = 0
    status: int = 1; created_at: Optional[str] = None

class UpdateGoodsStatusBody(BaseModel):
    status: int = Field(ge=0, le=1)

class UpdateGoodsBody(BaseModel):
    name: Optional[str] = None
    subtitle: Optional[str] = None
    brand: Optional[str] = None
    main_image: Optional[str] = None
    min_price: Optional[int] = None
    max_price: Optional[int] = None

class AdminOrderItem(BaseModel):
    id: int; sku_id: int = 0; spu_name: str = ""
    price: int = 0; quantity: int = 0; total_amount: int = 0; main_image: str = ""

class AdminOrder(BaseModel):
    id: int; order_no: str = ""; status: str = ""
    total_amount: int = 0; pay_amount: int = 0; freight_amount: int = 0; discount_amount: int = 0
    address_snapshot: Optional[dict] = None
    remark: str = ""; user_id: int = 0; username: str = ""
    items: list[AdminOrderItem] = []
    created_at: Optional[str] = None; paid_at: Optional[str] = None
    shipping_company: str = ""; tracking_no: str = ""; shipped_at: Optional[str] = None
    refund: Optional[dict] = None

class UserItem(BaseModel):
    id: int; username: str = ""; nickname: str = ""
    phone: str = ""; email: str = ""; role_code: str = ""; status: int = 1
    created_at: Optional[str] = None

class UpdateUserStatusBody(BaseModel):
    status: int = Field(ge=0, le=1)

class DashboardOverview(BaseModel):
    total_goods: int = 0
    total_users: int = 0
    total_orders: int = 0
    today_orders: int = 0
    pending_orders: int = 0
    total_revenue: int = 0

class RefundBody(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")
    reason: Optional[str] = None

class ShippingBody(BaseModel):
    company: str
    tracking_no: str

class RemarkBody(BaseModel):
    remark: str

# ============================================================
# Dashboard
# ============================================================

@router.get("/dashboard/overview", response_model=DashboardOverview)
async def dashboard_overview(db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_goods = (await db.execute(select(func.count(Spu.id)).where(Spu.status == 1))).scalar() or 0
    total_users = (await db.execute(select(func.count(SysUser.id)))).scalar() or 0
    total_orders = (await db.execute(select(func.count(Order.id)))).scalar() or 0
    today_orders = (await db.execute(select(func.count(Order.id)).where(Order.created_at >= today))).scalar() or 0
    pending_orders = (await db.execute(select(func.count(Order.id)).where(Order.status.in_(["pending_payment", "paid"])))).scalar() or 0
    total_revenue = (await db.execute(select(func.coalesce(func.sum(Order.pay_amount), 0)).where(Order.status.in_(["paid", "shipped", "received", "completed"])))).scalar() or 0

    return DashboardOverview(
        total_goods=total_goods, total_users=total_users,
        total_orders=total_orders, today_orders=today_orders,
        pending_orders=pending_orders, total_revenue=total_revenue,
    )

# ============================================================
# Goods Management
# ============================================================

@router.get("/goods/list")
async def list_goods(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None, status: Optional[int] = None,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user),
):
    q = select(Spu)
    count_q = select(func.count(Spu.id))

    if keyword:
        q = q.where(Spu.name.ilike(f"%{keyword}%"))
        count_q = count_q.where(Spu.name.ilike(f"%{keyword}%"))
    if status is not None:
        q = q.where(Spu.status == status)
        count_q = count_q.where(Spu.status == status)

    total = (await db.execute(count_q)).scalar() or 0
    rows = (await db.execute(q.order_by(Spu.id.desc()).offset((page-1)*page_size).limit(page_size))).scalars().all()

    return {
        "list": [_spu_to_dict(r) for r in rows],
        "total": total, "page": page, "page_size": page_size,
    }

@router.put("/goods/{goods_id}/status")
async def toggle_goods_status(goods_id: int, body: UpdateGoodsStatusBody,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    result = await db.execute(update(Spu).where(Spu.id == goods_id).values(status=body.status))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="商品不存在")
    await db.commit()
    return {"msg": "ok"}

@router.put("/goods/{goods_id}")
async def update_goods(goods_id: int, body: UpdateGoodsBody,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="无更新字段")
    result = await db.execute(update(Spu).where(Spu.id == goods_id).values(**updates))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="商品不存在")
    await db.commit()
    return {"msg": "ok"}

# ============================================================
# Order Management
# ============================================================

@router.get("/order/list")
async def list_orders(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None, keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user),
):
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

    return {
        "list": [_order_to_dict(r) for r in rows],
        "total": total, "page": page, "page_size": page_size,
    }

@router.put("/order/{order_id}/refund")
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

@router.put("/order/{order_id}/shipping")
async def update_shipping(order_id: int, body: ShippingBody,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    result = await db.execute(update(Order).where(Order.id == order_id, Order.status == "paid").values(
        shipping_company=body.company, tracking_no=body.tracking_no,
        shipped_at=datetime.now(timezone.utc), status="shipped",
    ))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="订单不存在或状态不是已付款")
    await db.commit()
    return {"msg": "ok"}

@router.put("/order/{order_id}/remark")
async def update_remark(order_id: int, body: RemarkBody,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    result = await db.execute(update(Order).where(Order.id == order_id).values(remark=body.remark))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="订单不存在")
    await db.commit()
    return {"msg": "ok"}

# ============================================================
# User Management
# ============================================================

@router.get("/user/list")
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

@router.put("/user/{user_id}/status")
async def toggle_user_status(user_id: int, body: UpdateUserStatusBody,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_admin_user)):
    result = await db.execute(update(SysUser).where(SysUser.id == user_id).values(status=body.status))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="用户不存在")
    await db.commit()
    return {"msg": "ok"}

# ============================================================
# Log Management
# ============================================================

import os, glob, re
from fastapi.responses import FileResponse

LOG_BASE_DIR = os.environ.get("LOG_DIR", "/var/log/target-mall")
LOG_MAX_SIZE_MB = int(os.environ.get("LOG_MAX_SIZE_MB", "500"))
LOG_CLEANUP_THRESHOLD_MB = int(os.environ.get("LOG_CLEANUP_THRESHOLD_MB", "400"))

def _get_log_files() -> list[dict]:
    """Scan log directory and return file info list"""
    files = []
    if not os.path.isdir(LOG_BASE_DIR):
        return files
    for fpath in glob.glob(os.path.join(LOG_BASE_DIR, "**", "*.log"), recursive=True):
        try:
            stat = os.stat(fpath)
            rel = os.path.relpath(fpath, LOG_BASE_DIR)
            service = rel.split(os.sep)[0] if os.sep in rel else "default"
            files.append({
                "name": os.path.basename(fpath),
                "path": rel,
                "service": service,
                "size_bytes": stat.st_size,
                "size_mb": round(stat.st_size / (1024 * 1024), 3),
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })
        except OSError:
            continue
    files.sort(key=lambda f: f["modified_at"], reverse=True)
    return files

def _total_log_size_mb() -> float:
    files = _get_log_files()
    return round(sum(f["size_bytes"] for f in files) / (1024 * 1024), 3)

def _read_log_file(service: str = "", lines: int = 200, offset: int = 0) -> dict | None:
    files = _get_log_files()
    if service:
        files = [f for f in files if f["service"] == service]
    if not files:
        return None
    target = files[0]
    fpath = os.path.join(LOG_BASE_DIR, target["path"])
    try:
        with open(fpath, "r", encoding="utf-8", errors="replace") as fh:
            all_lines = fh.readlines()
        total = len(all_lines)
        start = max(0, total - lines - offset)
        chunk = all_lines[start:start + lines]
        return {
            "service": target["service"],
            "file": target["name"],
            "lines": [ln.rstrip("\n") for ln in chunk],
            "total_lines": total,
            "offset": start,
            "count": len(chunk),
        }
    except OSError:
        return None

class LogStatusOut(BaseModel):
    status: str = "ok"
    current_mb: float = 0
    max_mb: float = 0
    usage_percent: float = 0
    auto_cleanup_threshold_mb: float = 0
    file_count: int = 0
    files: list = []

class LogSizeOut(BaseModel):
    total_bytes: int = 0
    total_mb: float = 0
    max_mb: float = 0
    usage_percent: float = 0
    files: list = []

class LogSearchOut(BaseModel):
    service: str = ""
    keyword: str = ""
    level: str = ""
    matches: list = []
    total_matches: int = 0

class ClearResultOut(BaseModel):
    cleared_files: int = 0

@router.get("/log/status", response_model=LogStatusOut)
async def log_status(_=Depends(get_current_admin_user)):
    files = _get_log_files()
    current_mb = round(sum(f["size_bytes"] for f in files) / (1024 * 1024), 3)
    usage = round(current_mb / LOG_MAX_SIZE_MB * 100, 1) if LOG_MAX_SIZE_MB > 0 else 0
    return LogStatusOut(
        status="ok" if usage < 100 else "full",
        current_mb=current_mb, max_mb=float(LOG_MAX_SIZE_MB),
        usage_percent=usage, auto_cleanup_threshold_mb=float(LOG_CLEANUP_THRESHOLD_MB),
        file_count=len(files),
        files=[{"service": f["service"], "size_mb": f["size_mb"], "path": f["path"]} for f in files],
    )

@router.get("/log/size", response_model=LogSizeOut)
async def log_size(_=Depends(get_current_admin_user)):
    files = _get_log_files()
    total_bytes = sum(f["size_bytes"] for f in files)
    total_mb = round(total_bytes / (1024 * 1024), 3)
    usage = round(total_mb / LOG_MAX_SIZE_MB * 100, 1) if LOG_MAX_SIZE_MB > 0 else 0
    return LogSizeOut(
        total_bytes=total_bytes, total_mb=total_mb,
        max_mb=float(LOG_MAX_SIZE_MB), usage_percent=usage,
        files=[{"service": f["service"], "size_bytes": f["size_bytes"], "size_mb": f["size_mb"], "path": f["path"]} for f in files],
    )

@router.get("/log/list")
async def log_list(_=Depends(get_current_admin_user)):
    return _get_log_files()

@router.get("/log/read")
async def log_read(lines: int = Query(200, ge=1, le=2000), offset: int = Query(0, ge=0),
    service: Optional[str] = None, _=Depends(get_current_admin_user)):
    result = _read_log_file(service=service or "", lines=lines, offset=offset)
    if result is None:
        return {"service": service or "", "file": "", "lines": [], "total_lines": 0, "offset": 0, "count": 0}
    return result

@router.get("/log/search")
async def log_search(keyword: str = Query(...), level: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500), service: Optional[str] = None,
    _=Depends(get_current_admin_user)):
    files = _get_log_files()
    if service:
        files = [f for f in files if f["service"] == service]
    matches: list = []
    for f in files:
        fpath = os.path.join(LOG_BASE_DIR, f["path"])
        try:
            with open(fpath, "r", encoding="utf-8", errors="replace") as fh:
                for i, line in enumerate(fh, 1):
                    if keyword.lower() in line.lower():
                        if level and level.upper() not in line.upper():
                            continue
                        matches.append({
                            "line": i, "content": line.rstrip("\n")[:300],
                            "level": "ERROR" if "ERROR" in line.upper() else "WARNING" if "WARN" in line.upper() else "INFO",
                            "timestamp": "",
                        })
                        if len(matches) >= limit:
                            break
            if len(matches) >= limit:
                break
        except OSError:
            continue
    return LogSearchOut(
        service=service or "", keyword=keyword, level=level or "",
        matches=matches, total_matches=len(matches),
    )

@router.get("/log/errors")
async def log_errors(lines: int = Query(100, ge=1, le=500), service: Optional[str] = None,
    _=Depends(get_current_admin_user)):
    files = _get_log_files()
    if service:
        files = [f for f in files if f["service"] == service]
    error_lines: list = []
    for f in files:
        fpath = os.path.join(LOG_BASE_DIR, f["path"])
        try:
            with open(fpath, "r", encoding="utf-8", errors="replace") as fh:
                for line in fh:
                    if re.search(r'(ERROR|FATAL|CRITICAL|Traceback)', line, re.IGNORECASE):
                        error_lines.append(line.rstrip("\n")[:500])
                        if len(error_lines) >= lines:
                            break
            if len(error_lines) >= lines:
                break
        except OSError:
            continue
    return {"service": service or "", "file": "", "lines": error_lines,
            "total_lines": len(error_lines), "offset": 0, "count": len(error_lines)}

@router.get("/log/download")
async def log_download(service: Optional[str] = None, _=Depends(get_current_admin_user)):
    import tempfile, zipfile, io
    files = _get_log_files()
    if service:
        files = [f for f in files if f["service"] == service]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            fpath = os.path.join(LOG_BASE_DIR, f["path"])
            try:
                zf.write(fpath, f["path"])
            except OSError:
                continue
    buf.seek(0)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(buf, media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=logs-{service or 'all'}.zip"})

@router.post("/log/clear", response_model=ClearResultOut)
async def log_clear(_=Depends(get_current_admin_user)):
    files = _get_log_files()
    cleared = 0
    for f in files:
        fpath = os.path.join(LOG_BASE_DIR, f["path"])
        try:
            os.remove(fpath)
            cleared += 1
        except OSError:
            continue
    return ClearResultOut(cleared_files=cleared)

@router.delete("/log/service/{name}")
async def log_delete_service(name: str, _=Depends(get_current_admin_user)):
    files = _get_log_files()
    service_files = [f for f in files if f["service"] == name]
    for f in service_files:
        try:
            os.remove(os.path.join(LOG_BASE_DIR, f["path"]))
        except OSError:
            continue
    return {"msg": "ok", "deleted": len(service_files)}

# ============================================================
# Helpers
# ============================================================

def _spu_to_dict(spu: Spu) -> dict:
    return {
        "id": spu.id, "spu_code": spu.spu_code or "", "name": spu.name or "",
        "subtitle": spu.subtitle or "", "category_id": spu.category_id or 0,
        "brand": spu.brand or "", "main_image": spu.main_image or "",
        "images": spu.images or [], "min_price": spu.min_price or 0,
        "max_price": spu.max_price or 0, "sales": spu.sales or 0,
        "status": spu.status if spu.status is not None else 1,
        "created_at": spu.created_at.isoformat() if spu.created_at else None,
    }

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
        "username": order.username or "",
        "items": items,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        "shipping_company": order.shipping_company or "",
        "tracking_no": order.tracking_no or "", "shipped_at": order.shipped_at.isoformat() if order.shipped_at else None,
        "refund": refund,
    }

def _parse_address(snapshot) -> dict:
    """Parse address_snapshot which may be JSON string or dict"""
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

def _user_to_dict(user: SysUser, role_code: str = "user") -> dict:
    return {
        "id": user.id, "username": user.username or "",
        "nickname": user.nickname or "", "phone": user.phone or "",
        "email": user.email or "", "role_code": role_code,
        "status": user.status if user.status is not None else 1,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
