# QA 参考文件

## 项目地址

| 项目 | 地址 | 端口 |
|------|------|------|
| **H5靶机商城(前端)** | http://localhost:3000 | 3000 |
| **管理后台(前端)** | http://localhost:3001 | 3001 |
| **后端网关(APISIX)** | http://localhost:9080 | 9080 |

## 后端服务

| 服务 | 端口 | 职责 |
|------|------|------|
| 用户服务 (user-service) | 8001 | 注册/登录/个人中心/地址 |
| 商品服务 (goods-service) | 8002 | 商品列表/详情/分类/评论 |
| 订单服务 (order-service) | 8003 | 购物车/订单/支付 |
| 消息服务 (msg-service) | 8004 | 通知/反馈 |
| 系统服务 (sys-service) | 8005 | 配置/字典/页面配置/日志/验证码 |

## 测试账号

| 账号 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | 超级管理员 |

## 主要接口清单

### 用户模块 (user-service :8001)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/user/auth/login | 登录获取JWT |
| POST | /api/v1/user/auth/register | 用户注册 |
| POST | /api/v1/user/auth/refresh-token | 刷新Token |
| GET | /api/v1/user/profile/ | 获取个人信息 |
| PUT | /api/v1/user/profile/ | 更新个人信息 |
| PUT | /api/v1/user/profile/password | 修改密码 |
| POST | /api/v1/user/profile/logout | 退出登录 |
| GET | /api/v1/user/address/ | 收货地址列表 |
| POST | /api/v1/user/address/ | 新增地址 |
| PUT | /api/v1/user/address/{id} | 更新地址 |
| DELETE | /api/v1/user/address/{id} | 删除地址 |

### 商品模块 (goods-service :8002)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/goods/spu/list | 商品列表(分页/筛选/排序) |
| GET | /api/v1/goods/spu/{id} | 商品详情 |
| GET | /api/v1/goods/category/tree | 分类树 |
| GET | /api/v1/goods/spu/recommend | 推荐商品 |

### 订单模块 (order-service :8003)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/order/cart/ | 购物车列表 |
| POST | /api/v1/order/cart/ | 加入购物车 |
| PUT | /api/v1/order/cart/{id} | 更新购物车项 |
| DELETE | /api/v1/order/cart/{id} | 删除购物车项 |
| POST | /api/v1/order/cart/check-all | 全选/取消全选 |
| DELETE | /api/v1/order/cart/checked | 清理已选 |
| POST | /api/v1/order/orders/create | 创建订单 |
| GET | /api/v1/order/orders/list | 订单列表 |
| GET | /api/v1/order/orders/{id} | 订单详情 |
| PUT | /api/v1/order/orders/{id}/cancel | 取消订单 |
| PUT | /api/v1/order/orders/{id}/confirm | 确认收货 |
| POST | /api/v1/order/pay/ | 发起支付 |

### 消息模块 (msg-service :8004)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/msg/notifications/ | 通知列表 |
| GET | /api/v1/msg/notifications/unread-count | 未读计数 |
| POST | /api/v1/msg/notifications/read | 标记已读 |
| POST | /api/v1/msg/notifications/read-all | 全部已读 |
| POST | /api/v1/msg/feedback/ | 提交反馈 |

### 系统模块 (sys-service :8005)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/sys/common/captcha | 图形验证码 |
| POST | /api/v1/sys/common/upload | 文件上传 |
| GET | /api/v1/sys/dict/{type} | 字典数据 |
| GET | /api/v1/sys/page-config/{code} | 页面配置 |
| GET | /api/v1/sys/config/list | 系统配置列表 |
| GET | /api/v1/sys/log/status | 日志状态概览 |
| GET | /api/v1/sys/log/list | 日志文件列表 |
| GET | /api/v1/sys/log/read | 读取日志内容 |
| GET | /api/v1/sys/log/search | 搜索日志 |
| GET | /api/v1/sys/log/errors | 最近错误日志 |
| GET | /api/v1/sys/log/download | 下载日志文件 |
| POST | /api/v1/sys/log/clear | 清除所有日志 |
| DELETE | /api/v1/sys/log/service/{name} | 删除服务日志 |

## 启动命令

```bash
# === H5靶机商城(前端) ===
cd e:\target\h5-app
npm run dev
# → http://localhost:3000

# === 管理后台 ===
cd e:\target\admin-app
npm run dev
# → http://localhost:3001

# === 后端（WSL 内）===
cd ~/h5-target-machine
docker compose up -d
```

## 技术栈

- **前端 (H5)**: Vue 3 + TypeScript + Vite + Element Plus + Pinia + Axios
- **前端 (Admin)**: Vue 3 + TypeScript + Vite + Element Plus + Pinia + Axios
- **后端**: FastAPI + SQLAlchemy + MySQL 8.0 + Redis 7 + RabbitMQ + MinIO
- **部署**: WSL2 + Docker Compose (17容器)
- **编码修复**: axios 拦截器内置 UTF-8 双编码自动恢复 (Latin-1→UTF-8)

## 变更记录

### 2026-05-09
1. **UI框架迁移**: Vant (移动端) → Element Plus (桌面端)
2. **编码修复**: 新增 `encoding.ts` 自动修复 MySQL 双编码乱码 (如 `æ•°ç ` → `数码`)
3. **API路径修正**: 所有接口路径同步至后端实际路由
   - 验证码: `/common/captcha` → `/sys/common/captcha`
   - 购物车: `/cart/*` → `/order/cart/*`
   - 订单: `/order/*` → `/order/orders/*`
   - 通知: `/msg/*` → `/msg/notifications/*`
4. **注册校验加强**: 用户名/密码正则 + 弱密码黑名单
5. **图片组件**: SafeImage 带 SVG 占位图自动降级
6. **日志管理模块**: 新增 9 个日志接口的完整 UI
7. **管理后台**: 新建 `admin-app` 项目 (仪表盘 + 商品管理 + 用户管理 + 日志管理)
8. **文档**: 增量更新 QA.md
