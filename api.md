所有接口已确认全部可调 ✅ 现在出文档。
H5 靶场商城 — API 接口文档
基础地址（从 Windows 访问 WSL）：http://localhost/api/v1
通用响应格式：
{"code": 0, "msg": "ok", "data": {...}}
登录态通过 Authorization: Bearer <access_token> 传递。
1️⃣ 用户服务 — GET/POST/PUT/DELETE /api/v1/user/*
认证（无需登录）
方法	路径	说明	请求体
POST	/user/auth/login	登录	{username, password, captcha_code?, captcha_id?}
POST	/user/auth/register	注册	{username, password, confirm_password, phone?, captcha_code?, captcha_id?}
POST	/user/auth/refresh-token	刷新Token	{refresh_token}
登录响应 data：
{"access_token": "eyJ...", "refresh_token": "eyJ...", "expires_in": 86400, "user_info": {"id":1, "username":"admin", "nickname":"超级管理员", "avatar":"", "role_code":"admin"}}
个人中心（需登录）
方法	路径	说明
GET	/user/profile/	获取个人信息
PUT	/user/profile/	修改信息：{nickname?, avatar?, phone?, email?}
PUT	/user/profile/password	改密：{old_password, new_password}
POST	/user/profile/logout	登出
收货地址（需登录）
方法	路径	说明
GET	/user/address/	地址列表
POST	/user/address/	新增：{name, phone, province, city, district, detail, is_default?}
PUT	/user/address/{addr_id}	修改
DELETE	/user/address/{addr_id}	删除
2️⃣ 商品服务 — GET/POST /api/v1/goods/*
分类（公开）
方法	路径	说明
GET	/goods/category/tree	分类树（4个一级）
商品 SPU（公开）
方法	路径	说明
GET	/goods/spu/list	商品列表（分页）✅ 20个商品
GET	/goods/spu/recommend	推荐商品 ✅ 10个
GET	/goods/spu/{spu_id}	商品详情（含SKU+规格）✅ 3个SKU
GET	/goods/spu/{spu_id}/comments	商品评论（分页）
spu/list 查询参数：keyword?, category_id?, min_price?, max_price?, sort(default/price_asc/price_desc/sales_desc/newest), page, page_size
spu/{id} 响应结构：
{
  "data": {
    "spu": {"id", "name", "subtitle", "brand", "main_image", "images": [...], "min_price", "max_price", "sales", "detail_html"},
    "skus": [{"id", "sku_code", "price", "original_price", "stock", "specs": {"颜色":"黑色"}, "main_image"}],
    "specs": [{"name":"颜色", "values":[{"value":"黑色"},{"value":"白色"}]}]
  }
}
评论（需登录）
方法	路径	说明
POST	/goods/comment/	提交：{spu_id, sku_id?, order_id?, content, rating?, images?, is_anonymous?}
3️⃣ 订单服务 — GET/POST/PUT/DELETE /api/v1/order/*
购物车（需登录）
方法	路径	说明
GET	/order/cart/	购物车列表
POST	/order/cart/	加入：{sku_id, quantity}
PUT	/order/cart/{cart_id}	改数量：{quantity}
PUT	/order/cart/checked	选中/取消：{ids: [1,2], checked: true}
PUT	/order/cart/check-all	全选/全不选：{checked: true}
DELETE	/order/cart/	删除：{ids: [1,2]}
订单（需登录）
方法	路径	说明
POST	/order/orders/create	从购物车创建：{address_id, cart_item_ids, remark?}
POST	/order/orders/direct-buy	直接购买：{sku_id, quantity, address_id, remark?}
GET	/order/orders/list	订单列表：status?(pending_payment/paid/shipped/received/cancelled/refunding/refunded/completed), page, page_size
GET	/order/orders/{order_id}	订单详情
PUT	/order/orders/{order_id}/cancel	取消：{reason?}
PUT	/order/orders/{order_id}/confirm	确认收货
POST	/order/orders/{order_id}/refund	申请退款：{reason, amount?, description?, images?}
支付（需登录）
方法	路径	说明
POST	/order/pay/	支付：{order_id, pay_method}(balance/wechat/alipay)
GET	/order/pay/{order_id}/status	支付状态
4️⃣ 消息服务 — GET/POST/PUT /api/v1/msg/*
通知（需登录）