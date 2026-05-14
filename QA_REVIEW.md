# 靶机系统 代码审查 & QA 文档

> 审查日期: 2026-05-09 | 范围: h5-app (33 文件) + admin-app (18 文件) | 总计: 51 源文件

---

## 一、项目地址

| 项目 | 地址 | 端口 | 技术栈 |
|------|------|------|--------|
| H5靶机商城 | http://localhost:3000 | 3000 | Vue3 + Vite + Element Plus + Pinia |
| 管理后台 | http://localhost:3001 | 3001 | Vue3 + Vite + Element Plus + Pinia |
| 用户服务 | http://localhost:8001 | 8001 | FastAPI |
| 商品服务 | http://localhost:8002 | 8002 | FastAPI |
| 订单服务 | http://localhost:8003 | 8003 | FastAPI |
| 消息服务 | http://localhost:8004 | 8004 | FastAPI |
| 系统服务 | http://localhost:8005 | 8005 | FastAPI |
| 后端网关 | http://localhost:9080 | 9080 | APISIX |

## 二、测试账号

| 账号 | 密码 | 角色 | 适用 |
|------|------|------|------|
| admin | admin123 | super_admin | H5商城 + 管理后台 |

## 三、启动命令

```bash
# H5靶机商城
cd e:\target\h5-app && npm run dev     # → :3000

# 管理后台
cd e:\target\admin-app && npm run dev  # → :3001

# 后端 (WSL内)
cd ~/h5-target-machine && docker compose up -d
```

---

## 四、代码审查结果

### A. 关键缺陷 (Bugs)

| # | 项目 | 文件 | 问题 | 严重度 |
|---|------|------|------|--------|
| A1 | h5 | `views/order/CartView.vue:16` | `error` ref 已声明但从未赋值，`<el-result>` 永不渲染 | 🔴 高 |
| A2 | h5 | `views/user/ProfileView.vue:15` | `error` ref 已声明但模板从未使用 | 🔴 高 |
| A3 | h5 | `router/index.ts` | `/system/logs` 无 `role_code` 校验，任意登录用户可访问 | 🔴 高 |
| A4 | h5 | `stores/user.ts:8` | `refreshToken` 已存储但从未调用 `/auth/refresh-token`，Token 过期即强制登出 | 🔴 高 |
| A5 | admin | `router/index.ts:17` | 登录后未保留原始目标路径，总是跳回 `/` | 🔴 高 |
| A6 | admin | `api/goods-mgmt.ts:15-19` | 4 个 Stub 端点被 `GoodsManage.vue` 调用，点击"上架/下架"会报错 | 🔴 高 |
| A7 | admin | `api/user-mgmt.ts` | 3 个 Stub 端点被 `UsersManage.vue` 调用，用户管理完全不可用 | 🔴 高 |

### B. 静默异常吞噬 (catch { /\* ignore \*/ })

| 项目 | 文件 | 数量 |
|------|------|------|
| h5 | `views/order/CartView.vue` | 6 |
| h5 | `views/system/LogView.vue` | 3 |
| h5 | `views/user/NotificationView.vue` | 3 |
| h5 | `views/user/AddressView.vue` | 3 |
| h5 | `views/order/OrderDetailView.vue` | 3 |
| h5 | `views/goods/GoodsDetailView.vue` | 2 |
| h5 | `views/order/OrderConfirmView.vue` | 2 |
| h5 | `views/user/ProfileView.vue` | 2 |
| h5 | 其余 5 个文件 | 各 1 |
| admin | `views/goods/GoodsManage.vue` | 4 |
| admin | `views/users/UsersManage.vue` | 3 |
| admin | `views/logs/LogsView.vue` | 3 |
| admin | `views/login/LoginView.vue` | 2 |
| admin | `views/dashboard/DashboardView.vue` | 1 |
| **合计** | **h5: 27 + admin: 13 = 40 处** | |

### C. 视图缺少错误状态

**h5-app** (8 个视图无 `<el-result>` 错误状态):
`LoginView`, `RegisterView`, `FeedbackView`, `OrderConfirmView`, `NotificationView`, `AddressView`, `ProfileView`, `LogView`

**admin-app** (5 个视图无 `<el-result>` 错误状态):
`GoodsManage`, `UsersManage`, `DashboardView`, `LogsView`, `LoginView`

### D. 死代码 (Unused Exports)

| 项目 | 文件 | 导出 | 类型 |
|------|------|------|------|
| h5 | `api/goods.ts:52` | `getRecommendGoods` | 函数 |
| h5 | `api/common.ts:18` | `getDictByType` | 函数 |
| h5 | `api/common.ts:28` | `uploadFile` | 函数 |
| h5 | `api/msg.ts:32` | `deleteMsg` | 函数 |
| h5 | `utils/format.ts:18` | `formatShortDate` | 函数 |
| h5 | `utils/format.ts:24` | `formatSales` | 函数 |

### E. 类型安全 (`as any` 可消除)

| 项目 | 文件 | 行 | 问题 |
|------|------|-----|------|
| h5 | `api/request.ts` | 44 | `deepFixEncoding() as any` |
| h5 | `views/goods/GoodsListView.vue` | 35 | `sortBy.value as any` |
| h5 | `views/order/OrderListView.vue` | 67 | `ORDER_STATUS_MAP[].type as any` |
| h5 | `views/order/OrderDetailView.vue` | 60 | 同上 |
| admin | `api/log.ts` | 全文件 | 9 个函数全部返回 `any` |

### F. 重复代码 (Cross-Project)

| 文件 | h5-app | admin-app | 重复度 |
|------|--------|-----------|--------|
| `encoding.ts` | `src/utils/` | `src/utils/` | **100%** |
| `storage.ts` | `src/utils/` | `src/utils/` | **100%** |
| `format.ts` | `src/utils/` | `src/utils/` | 80% |
| `SafeImage.vue` | `src/components/` | **不存在** | 缺失 |
| `LogView` vs `LogsView` | 330 行 | 180 行 | 80% 逻辑相同 |

### G. 硬编码字符串 (h5-app)

`"H5靶机商城"` 在 5 个文件中各出现多次（logo、header、footer、login、register），而 `.env.development` 已定义 `VITE_APP_TITLE`。

`HomeView.vue` 快捷导航使用 `['数码产品','服饰鞋包','食品生鲜','家居日用']` 硬编码，但同文件已通过 `getCategoryTree()` 获取真实分类。

### H. admin-app 特有

| # | 问题 | 详情 |
|---|------|------|
| H1 | `log.ts` 零 TypeScript 接口 | 所有函数返回 `any`，h5-app 有 6 个完整接口可复用 |
| H2 | `AdminLayout.vue` 菜单硬编码 | 4 个 `<el-menu-item>` 无 `v-for`，增删页面需改模板 |
| H3 | `SafeImage.vue` 缺失 | `GoodsManage.vue` 使用裸 `<el-image>` + 内联 fallback |
| H4 | `DashboardView.vue` 图标未导入 | `Goods/User/Document` 未 import，按钮无图标 |
| H5 | `stores/user.ts` 无 role 字段 | 仅有 `token`+`username`，无权限控制基础 |
| H6 | 仪表盘在售数不准 | `page_size=1` 统计在售数，永远显示 0 或 1 |

---

## 五、优化建议 (按优先级)

### P0 — 立即修复
1. 修复 CartView `error` ref 未赋值，添加 `error.value = '...'` 到所有 catch 块
2. 为 admin-app 商品/用户 Stub 端点实现后端，或在 UI 禁用按钮 + 提示
3. 修复 admin-app 登录 redirect 保留
4. h5-app Router `/system/logs` 增加 role 校验

### P1 — 建议近期修复
5. 补充 13 个视图的错误状态（`<el-result>` + 重试按钮）
6. 消除 40 处静默 catch → 改为 `ElMessage.error` 或 `error.value = '...'`
7. 提取共享包 (`encoding`, `storage`, `format`, `SafeImage`) 到公共目录
8. 实现 Token 静默刷新（h5-app 已有 `refreshToken` API 和 store，仅需在拦截器中调用）

### P2 — 长期优化
9. 提取 `ProductCard`、`PageHeader` 组件消除重复模板
10. 消除 `as any` 类型转换
11. 删除死代码（6 个未使用导出）
12. 硬编码字符串改用 `VITE_APP_TITLE` 环境变量
13. `HomeView` 快捷导航改用 API 分类数据
14. admin-app `log.ts` 补充 TypeScript 类型

---

## 六、接口清单 (60+ API)

### 用户服务 :8001
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/user/auth/login | 登录 |
| POST | /api/v1/user/auth/register | 注册 |
| POST | /api/v1/user/auth/refresh-token | 刷新Token |
| GET | /api/v1/user/profile/ | 个人信息 |
| PUT | /api/v1/user/profile/ | 更新资料 |
| PUT | /api/v1/user/profile/password | 改密码 |
| POST | /api/v1/user/profile/logout | 退出 |
| GET/POST | /api/v1/user/address/ | 地址列表/新增 |
| PUT/DELETE | /api/v1/user/address/{id} | 更新/删除地址 |

### 商品服务 :8002
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/goods/spu/list | 商品列表 |
| GET | /api/v1/goods/spu/{id} | 商品详情 |
| GET | /api/v1/goods/category/tree | 分类树 |
| GET | /api/v1/goods/spu/recommend | 推荐商品 |

### 订单服务 :8003
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | /api/v1/order/cart/ | 购物车列表/添加 |
| PUT/DELETE | /api/v1/order/cart/{id} | 更新/删除购物车 |
| POST | /api/v1/order/cart/check-all | 全选 |
| DELETE | /api/v1/order/cart/checked | 清理已选 |
| POST | /api/v1/order/orders/create | 创建订单 |
| GET | /api/v1/order/orders/list | 订单列表 |
| GET | /api/v1/order/orders/{id} | 订单详情 |
| PUT | /api/v1/order/orders/{id}/cancel | 取消 |
| PUT | /api/v1/order/orders/{id}/confirm | 确认收货 |
| POST | /api/v1/order/pay/ | 支付 |

### 消息服务 :8004
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/msg/notifications/ | 通知列表 |
| GET | /api/v1/msg/notifications/unread-count | 未读计数 |
| POST | /api/v1/msg/notifications/read | 标记已读 |
| POST | /api/v1/msg/notifications/read-all | 全部已读 |
| POST | /api/v1/msg/feedback/ | 提交反馈 |

### 系统服务 :8005
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/sys/common/captcha | 验证码 |
| POST | /api/v1/sys/common/upload | 文件上传 |
| GET | /api/v1/sys/dict/{type} | 字典 |
| GET | /api/v1/sys/page-config/{code} | 页面配置 |
| GET | /api/v1/sys/config/list | 系统配置 |
| GET | /api/v1/sys/log/status | 日志概览 |
| GET | /api/v1/sys/log/size | 日志大小 |
| GET | /api/v1/sys/log/list | 日志文件列表 |
| GET | /api/v1/sys/log/read | 读取日志 |
| GET | /api/v1/sys/log/search | 搜索日志 |
| GET | /api/v1/sys/log/errors | 错误日志 |
| GET | /api/v1/sys/log/download | 下载日志 |
| POST | /api/v1/sys/log/clear | 清除全部 |
| DELETE | /api/v1/sys/log/service/{name} | 删除服务日志 |

---

## 七、变更记录

| 日期 | 变更 |
|------|------|
| 2026-05-09 | Vant→Element Plus 桌面化 |
| 2026-05-09 | CP1252 双编码自动修复 (encoding.ts) |
| 2026-05-09 | API 路径全量同步实际后端路由 |
| 2026-05-09 | 注册校验加强 (正则+弱密码黑名单) |
| 2026-05-09 | SafeImage 组件 (SVG 占位图降级) |
| 2026-05-09 | 日志管理模块 (9 接口) |
| 2026-05-09 | admin-app 新建 (仪表盘+商品+用户+日志) |
| 2026-05-09 | P0: statusMap 统一 / userInfo 持久化 / admin Store 修复 |
| 2026-05-09 | P0: formatDate NaN 修复 / scrollBehavior / 6视图错误状态 |
