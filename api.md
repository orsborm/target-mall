# 靶机商城 — API 接口文档

> 完整接口清单 | 2026-05-14 | 从 h5-app + admin-app 源码提取 + 后端实调验证
>
> ✅=后端已实现  🔧=需部署补丁  ⚠️=字段不匹配

## 通用规范

- **Base URL**: `/api/v1`
- **响应格式**: `{"code": 0, "msg": "ok", "data": {...}}`
- **鉴权**: `Authorization: Bearer <access_token>`（除标注"公开"外均需登录）
- **分页响应**: `{"list": [...], "total": N, "page": 1, "page_size": 20}`
- **价格单位**: 分（整数），前端用 `formatPrice()` 转为元显示

## 服务拓扑

| 服务 | 容器 | 端口 | App |
|------|------|------|-----|
| 用户服务 | h5-user-service | 8001 | h5 + admin |
| 商品服务 | h5-goods-service | 8002 | h5 + admin |
| 订单服务 | h5-order-service | 8003 | h5 + admin |
| 消息服务 | h5-msg-service | 8004 | h5 |
| 系统服务 | h5-sys-service | 8005 | h5 + admin |

---

## 1. 用户服务 `GET/POST/PUT/DELETE /api/v1/user/*`

### 1.1 认证（公开）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| POST | `/user/auth/login` | 登录 `{username, password, captcha_code?, captcha_id?}` | ✅ |
| POST | `/user/auth/register` | 注册 `{username, password, confirm_password, phone?}` | ✅ |
| POST | `/user/auth/refresh-token` | 刷新Token `{refresh_token}` | ✅ |

### 1.2 个人中心（需登录）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/user/profile/` | 获取个人信息 | ✅ |
| PUT | `/user/profile/` | 修改信息 `{nickname?, avatar?, phone?, email?}` | ✅ |
| PUT | `/user/profile/password` | 修改密码 `{old_password, new_password}` | ✅ |
| POST | `/user/profile/logout` | 登出 | ✅ |

### 1.3 收货地址（需登录）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/user/address/` | 地址列表 | ✅ |
| POST | `/user/address/` | 新增地址 | ✅ |
| PUT | `/user/address/{id}` | 修改地址 | ✅ |
| DELETE | `/user/address/{id}` | 删除地址 | ✅ |

### 1.4 管理端（需 admin 角色）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/user/list` | 用户列表 `?page=&page_size=&keyword=` | 🔧 |
| PUT | `/user/{id}/status` | 启用/禁用 `{status: 0\|1}` | 🔧 |

---

## 2. 商品服务 `GET/POST /api/v1/goods/*`

### 2.1 分类和商品（公开）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/goods/category/tree` | 分类树 | ✅ |
| GET | `/goods/spu/list` | 商品列表 `?page=&page_size=&keyword=&sort=` | ✅ |
| GET | `/goods/spu/{id}` | 商品详情（含SKU+规格） | ✅ |
| GET | `/goods/spu/recommend` | 推荐商品 `?page_size=10` | ✅ |
| GET | `/goods/spu/{id}/comments` | 商品评论 | ✅ |
| POST | `/goods/comment/` | 提交评论 | ✅ |

### 2.2 管理端（需 admin 角色）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| PUT | `/goods/spu/{id}/status` | 上架/下架 `{status: 0\|1}` | 🔧 |
| PUT | `/goods/spu/{id}` | 编辑商品 `{name?, subtitle?, brand?, ...}` | 🔧 |

---

## 3. 订单服务 `GET/POST/PUT/DELETE /api/v1/order/*`

### 3.1 购物车（需登录）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/order/cart/` | 购物车列表 | ⚠️ |
| POST | `/order/cart/` | 加入购物车 `{sku_id, quantity}` | ✅ |
| PUT | `/order/cart/{id}` | 修改数量 `{quantity}` | ✅ |
| PUT | `/order/cart/checked` | 选中/取消 `{ids, checked}` | ✅ |
| PUT | `/order/cart/check-all` | 全选/全不选 `{checked}` | ✅ |
| DELETE | `/order/cart/` | 删除商品 `{ids}` | ✅ |

> ⚠️ `GET /order/cart/` 返回缺少 spu_name / price / stock / main_image 字段，需部署 cart_service_patch.py 修复。

### 3.2 订单（需登录）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| POST | `/order/orders/create` | 创建订单 `{address_id, cart_item_ids, remark?}` | ⚠️ |
| GET | `/order/orders/list` | 订单列表 `?status=&page=&page_size=` | ✅ |
| GET | `/order/orders/{id}` | 订单详情 | ✅ |
| PUT | `/order/orders/{id}/cancel` | 取消订单 `{reason?}` | ✅ |
| PUT | `/order/orders/{id}/confirm` | 确认收货 | ✅ |
| POST | `/order/orders/{id}/refund` | 申请退款 `{reason}` | ✅ |
| POST | `/order/pay/` | 发起支付 `{order_no, pay_method}` | ✅ |

### 3.3 管理端（需 admin 角色）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| PUT | `/order/admin/orders/{id}/refund` | 退款审核 `{action, reason?}` | 🔧 |
| PUT | `/order/admin/orders/{id}/shipping` | 录入物流 `{company, tracking_no}` | 🔧 |
| PUT | `/order/admin/orders/{id}/remark` | 编辑备注 `{remark}` | 🔧 |

---

## 4. 消息服务 `GET/POST /api/v1/msg/*`

### 4.1 通知（需登录）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/msg/notifications/` | 通知列表 `?page=&page_size=` | ✅ |
| GET | `/msg/notifications/unread-count` | 未读数 | ✅ |
| POST | `/msg/notifications/read` | 标记已读 `{id}` | ✅ |
| POST | `/msg/notifications/read-all` | 全部已读 | ⚠️ |

> ⚠️ `read-all` 返回 405，可能应为 PUT。

### 4.2 反馈（需登录）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| POST | `/msg/feedback/` | 提交反馈 `{type, content, contact?, images?}` | ✅ |

---

## 5. 系统服务 `GET/POST/DELETE /api/v1/sys/*`

### 5.1 公共

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/sys/common/captcha` | 图形验证码 | ✅ |
| GET | `/sys/dict/{type}` | 字典数据 | ✅ |
| GET | `/sys/page-config/{key}` | 页面配置 | ✅ |

> 前端调用 `/sys/common/dict/{type}`，实际路径是 `/sys/dict/{type}`。前端已修正。

### 5.2 仪表盘（需 admin 角色）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/sys/dashboard/overview` | 管理端统计 | 🔧 |

### 5.3 日志管理（需 admin 角色）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/sys/log/status` | 日志状态概览 | ✅ |
| GET | `/sys/log/size` | 日志大小统计 | ✅ |
| GET | `/sys/log/list` | 日志文件列表 | ✅ |
| GET | `/sys/log/read` | 读取日志 `?lines=&offset=&service=` | ✅ |
| GET | `/sys/log/search` | 搜索日志 `?keyword=&level=&limit=&service=` | ✅ |
| GET | `/sys/log/errors` | 最近错误 `?lines=&service=` | ✅ |
| GET | `/sys/log/download` | 下载日志 `?service=` | ✅ |
| POST | `/sys/log/clear` | 清除全部日志 | ✅ |
| DELETE | `/sys/log/service/{name}` | 清除某服务日志 | ✅ |

---

## 汇总

| 服务 | 端口 | ✅已实现 | 🔧需补丁 | ⚠️有问题 | 总计 |
|------|------|---------|---------|---------|------|
| user | 8001 | 11 | 2 | 0 | 13 |
| goods | 8002 | 6 | 2 | 0 | 8 |
| order | 8003 | 14 | 3 | 1 | 18 |
| msg | 8004 | 4 | 0 | 1 | 5 |
| sys | 8005 | 11 | 1 | 0 | 12 |
| **合计** | | **46** | **8** | **2** | **56** |

## 后端补丁清单

| 补丁文件 | 部署目标 | 修复内容 |
|---------|---------|---------|
| `cart_service_patch.py` | h5-order-service (8003) | 购物车 JOIN SPU/SKU → 返回 spu_name/price/stock/main_image |
| `goods_service_patch.py` | h5-goods-service (8002) | PUT 上下架 + 编辑商品 |
| `order_service_patch.py` | h5-order-service (8003) | 管理端订单列表 / 退款审核 / 发货 / 备注 |
| `user_service_patch.py` | h5-user-service (8001) | 用户列表 / 启用禁用 |
| `sys_service_patch.py` | h5-sys-service (8005) | 仪表盘聚合 / 日志管理 |

部署方式：`docker cp {patch}.py h5-{service}:/app/app/api/` → 注册 router → `docker restart h5-{service}`
