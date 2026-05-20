# 靶机商城 — Bug 跟踪 & 迭代路线图

> 生成日期: 2026-05-20 | 基于 7 轮代码审查 + 三 agent 并行审计
> 背景: 历经 7 次提交修复 P0/P1，当前项目已可正常运行，剩余问题集中在健壮性和功能补全。

---

## 一、项目健康度总览

| 维度 | 状态 | 说明 |
|------|------|------|
| 编译 | 通过 | 两个 app vue-tsc --noEmit 均无错误 |
| h5-app 运行 | 正常 | 首页/商品/购物车/订单/登录均可正常使用 |
| admin-app 运行 | 正常 | 仪表盘/商品/订单/用户/优惠券管理可用 |
| Mock API | 正常 | 验证码校验、订单数据共享、auth 鉴权已修复 |
| 类型安全 | 待改善 | 仍有 ~12 处 `as any` / `ref<any>` (从原始 16 处下降) |
| 错误处理 | 待改善 | ~8 处空 catch 块，部分页面无错误状态展示 |
| 测试覆盖 | 无 | 无单元测试、E2E 测试 |

---

## 二、待修复 Bug

### P0 — 致命缺陷（4 项剩余）

| # | 位置 | 描述 | 状态 |
|---|------|------|------|
| P0-1 | `shared/mock/*-store.ts` (8文件) | **并发写入竞态**: `load()-mutate-save()` 模式无文件锁，admin + h5 双进程同时写同一 JSON 文件会互相覆盖，导致数据丢失 | 未修 |
| P0-2 | `shared/mock/order-store.ts:145` | `order_no = ORD${Date.now()}${s.nextId}` — 同毫秒并发请求生成相同订单号 | 未修 |
| P0-3 | `h5-app/src/views/order/OrderConfirmView.vue:88-91` | checkout_items 和 checkout_cart_ids 从 sessionStorage 分两次读取——如果 sessionStorage 在两次读取间被其他标签页修改，提交的 cart IDs 与显示的商品不一致 | 未修 |
| P0-4 | `h5-app mock/server.ts:70-76` | 创建订单时从购物车构建 items，但先读 cart 再 remove——如果 remove 在 getCart 和 createOrder 之间被其他请求修改，order 可能包含已删除的商品 | 未修 |

### P1 — 高危问题（16 项剩余）

#### 数据一致性

| # | 位置 | 描述 |
|---|------|------|
| P1-1 | `shared/mock/comment-store.ts` | reload() seed 不会立即持久化到磁盘 |
| P1-2 | `shared/mock/coupon-store.ts` | getAvailableCoupons 无 TTL 缓存，每次访问读磁盘 |
| P1-3 | `shared/mock/order-store.ts` | createOrder 接收 coupon_id 参数但不存储、不计算折扣 |
| P1-4 | `admin-app mock/server.ts` | 发货/退款操作只更新状态，shipping_company/tracking_no 未写入 order-store |

#### 显示/逻辑

| # | 位置 | 描述 |
|---|------|------|
| P1-5 | `h5-app GoodsDetailView.vue:211` | detail_html 用 v-text 渲染——若内容含 HTML 展示错误；若用 v-html 则有 XSS 风险。需明确数据格式 |
| P1-6 | `h5-app OrderConfirmView.vue:216` | 运费文案写死 "满 ¥99.00 免运费"，但阈值已从 page-config 动态加载——文案与实际不符 |
| P1-7 | `admin-app GoodsManage.vue:193-201` | handleSave 先 updateGoods 成功再 updateSkus 失败后不回滚——SPU 已更新但 SKU 价格未保存 |
| P1-8 | `admin-app DashboardView.vue` | getDashboardOverview 返回类型声明为 `DashboardOverview` 但实际用 `const data: any` 接收，绕过类型检查 |
| P1-9 | `h5-app OrderDetailView.vue:128` | 快递查询链接跳转第三方 `kuaidi100.com`，快递单号暴露在 Referer 和浏览器历史中 |

#### 错误处理

| # | 位置 | 描述 |
|---|------|------|
| P1-10 | `h5-app` 全局 | ~5 处空 catch 块——GoodsDetailView toggleFav、CartView removeCart 等操作失败无用户反馈 |
| P1-11 | `h5-app RegistrationView.vue` | 表单验证 `.catch(() => false)` 静默吞错 |
| P1-12 | `h5-app ProfileView.vue:62` | 个人信息加载失败用 `window.location.reload()` 整页刷新——应改为重新请求 |

#### 类型安全

| # | 位置 | 描述 |
|---|------|------|
| P1-13 | `h5-app HomeView.vue:45` | `a.sort_order` 用 `(a as any).sort_order` 绕过——PageConfig 接口缺少 sort_order 字段 |
| P1-14 | `h5-app CouponCenterView.vue:30` | `available.value = avail as any` — API 类型不匹配时运行时才能发现 |
| P1-15 | `admin-app LogsView.vue` | `status`、`size` 等 ref 声明为 `ref<any>(null)` — 应使用 API 导出的 LogStatus/LogSize 类型 |
| P1-16 | `admin-app user-mgmt.ts:8` | `getUserList(params?: any)` — params 缺少明确的查询参数接口 |

#### 新增 P1（本轮 agent 审计发现）

| # | 位置 | 描述 |
|---|------|------|
| P1-17 | `admin-app CouponManage.vue` | **percent 优惠券 threshold 翻倍 Bug**: openEdit 对满减券做 `threshold/100`（分转元），对折扣券保留原值。但 handleSave 统一做 `Math.round(threshold * 100)`（元转分）。编辑折扣券后 threshold 被放大 100 倍，优惠券门槛从 0 → 0，或 500 → 50000 |
| P1-18 | `admin-app OrdersManage.vue:95-98` | `handleRefund('reject')` 从不提示输入拒绝原因——processRefund 接受 `reason` 参数但 UI 未收集，所有拒绝退款记录的拒绝原因为空 |
| P1-19 | `admin-app DashboardView.vue` | `stats.total_orders ?? '-'` 把合法的 0 渲染成横杠——0 个订单是有意义的业务数据，不应隐藏 |
| P1-20 | `h5-app ProfileView.vue:62` | `info = i` 而非 `info.value = i`——Vue 模板事件处理中 ref 不会自动解包，赋值到裸变量而非 `.value`，**reactivity 静默断裂** |
| P1-21 | `h5-app OrderDetailView.vue:18-27` | `onMounted(loadOrder)` 只读一次 `route.params.id`——从订单 1 导航到订单 2 不会重新加载。与已修复的 GoodsDetail B2 是同一模式，需加 `watch(() => route.params.id)` |
| P1-22 | `h5-app RegisterView.vue:102-103` | 注册失败 catch 块只刷新验证码不显示错误消息——用户完全不知道注册为什么失败 |
| P1-23 | `h5-app LogView.vue:91` | `getLogErrors()` 返回类型 `LogErrorResult` (字段 `errors`) 但赋值给 `LogContent` 类型变量 (字段 `lines`)——模板访问 `.lines` 可能导致运行时崩溃 |
| P1-24 | `shared/mock/coupon-store.ts:115,126` | `claimCoupon` 和 `useCoupon` 都对 `used_qty` +1——同一张优惠券领取后使用时被**双倍计数**。领取已减少可用数，使用时不应再增加 |
| P1-25 | `shared/mock/goods-store.ts:264` | `saveCategories` 用裸 `writeFileSync`——其他所有 save 函数都用 `atomicWrite`（先写临时文件再 rename），此处缺失可能导致分类数据损坏 |


### P2 — 中等问题（10 项）

| # | 位置 | 描述 |
|---|------|------|
| P2-1 | `shared/utils/encoding.ts:63-81` | deepFixEncoding 无最大递归深度/循环引用保护 |
| P2-2 | `shared/utils/encoding.ts:47` | CJK 检测正则只涵盖 U+4E00-U+9FFF 基本汉字区——扩展区 B-F、日韩文字不识别 |
| P2-3 | `h5-app OrderConfirmView.vue:216` | 运费阈值文字写死但实际已动态化（同 P1-6） |
| P2-4 | `h5-app GoodsDetailView.vue:160` | SKU 选择器对零库存 SKU 无禁用态——用户选中后才看到按钮 disabled，不理解原因 |
| P2-5 | `h5-app GoodsDetailView.vue:77` | loadComments 只展示第一页，缺少"加载更多"分页 |
| P2-6 | `admin-app` 路由 | 路由守卫只检查 isLoggedIn，无角色权限区分（admin/editor 权限相同） |
| P2-7 | `admin-app` 5 个列表页 | 均硬编码 `const pageSize = 20`——应提取为常量 |
| P2-8 | `admin-app CommentsManage/FeedbackManage` | 日期格式化用 `slice(0,16).replace('T',' ')`——其他页面用 formatDate()，不一致 |
| P2-9 | `h5-app CartView.vue:64-68` | sessionStorage 作为组件间传参通道——脆弱，无 schema 版本管理 |
| P2-10 | `shared/mock/helpers.ts:57-63` | enrichWithStock 每次 O(N*M) 遍历 goods×skus——数据增长后性能退化 |
| P2-11 | `h5-app api/cart.ts:73-76` | `getCartCount()` 调用 `getCartList()` → 对每个 SPU 调 `getGoodsDetailFull()`——50 件商品触发 50+ 个 HTTP 请求仅为了显示购物车角标数字 |
| P2-12 | `h5-app api/user.ts:5` | `refreshToken` 用裸 `axios.post` 绕过 request 拦截器——base URL、auth header、错误处理在此处分叉 |
| P2-13 | `admin-app BannerManage.vue` | `getBanners('home')` 写死——函数签名已接受 pageKey 参数但 UI 不暴露，其他页面轮播图无法管理 |

### P3 — 低优先级（8 项）

| # | 位置 | 描述 |
|---|------|------|
| P3-1 | 所有 mock store | save() 静默吞掉写入错误（磁盘满/权限变更）——调用者以为成功 |
| P3-2 | `h5-app FeedbackView.vue` | 手机号正则 `/^1[3-9]\d{9}$/` 不支持新号段 (16x, 19x) |
| P3-3 | `admin-app AdminLayout.vue:15` | 退出登录 API 失败静默忽略——服务端 session 可能残留 |
| P3-4 | `h5-app` 404 路由 | 无 `meta.title` |
| P3-5 | `shared/mock/order-store.ts` | payOrder 返回 `null` 表示失败，updateOrderStatus 返回 `false`——返回约定不统一 |
| P3-6 | `shared/mock/cart-store.ts` | 唯一纯内存 store，所有其他 store 已 JSON 持久化——dev server 重启丢失购物车 |
| P3-7 | `admin-app` | 大量行内 `style="..."` 属性，主题化困难 |
| P3-8 | `h5-app OrderDetailView.vue` | 取消/确认操作后只改本地 status 不从服务端重载——服务端额外字段变更无法同步 |
| P3-9 | `h5-app` 4 个文件 | 手机号正则 `/^1[3-9]\d{9}$/` 在 AddressView/RegisterView/ProfileView/FeedbackView 中重复 4 次——应提取到 `shared/utils/validation.ts` |
| P3-10 | `admin-app AdminLayout.vue:43,55` | 订单管理和优惠券管理共用 `Tickets` 图标，侧边栏视觉无法区分 |
| P3-11 | `admin-app OrdersManage.vue` | detail 弹窗中 `formatAddress()` 对同一 address_snapshot 调用 3 次——重复 JSON.parse 浪费 |
| P3-12 | `admin-app CommentsManage/UsersManage/FeedbackManage` | 三个页面无搜索/筛选——表格数据加载后无法过滤，功能完整性落后于 OrdersManage |
| P3-13 | `h5-app NotificationView.vue:28` | 消息点击后只标记已读，不跳转到关联订单——`related_order_no` 字段未被利用 |
| P3-14 | `h5-app ProfileView.vue:80` | 编辑资料支持 avatar 参数但表单无头像上传 UI |
| P3-15 | `h5-app FeedbackView.vue` | `submitFeedback` 接受 images 参数但表单无图片上传 UI |

---

## 三、功能缺口（6 项）

按优先级从高到低排列：

### F1 — 消息通知中心（高优先级）

**当前状态**: h5-app 有 NotificationView 页面框架（空壳），API 模块 msg.ts 已定义接口但无 mock 数据。admin-app 无对应管理端。

**需要实现**:
- Mock: 生成种子消息（系统通知、订单状态变更、促销活动）
- h5-app: 未读红点、消息列表、已读/未读状态切换、消息详情
- admin-app: 消息推送管理（创建/发送系统通知）
- 存储: 新增 shared/mock/notification-store.ts

### F2 — admin 个人设置页

**当前状态**: admin-app 无个人设置页。管理员无法修改密码或个人资料。

**需要实现**:
- 新增 `admin-app/src/views/system/ProfileView.vue`
- 修改密码表单（旧密码 + 新密码 + 确认）
- 个人资料编辑（昵称、头像）
- 路由注册 + 侧边栏入口

### F3 — SKU 矩阵选择器

**当前状态**: h5-app GoodsDetailView 中 SKU 以列表形式展示，无规格联动（如选"颜色:黑色"后"尺寸"自动过滤对应选项）。

**需要实现**:
- 规格维度解析（从 SKU specs 提取）
- 联动禁用逻辑（选中某规格值后，过滤不匹配的 SKU 并禁用无库存项）
- UI: 矩阵式选择器（规格维度 × 可选值表格）

### F4 — 搜索建议 + 搜索历史

**当前状态**: 搜索框只支持关键词直接搜索，无下拉建议、无历史记录。

**需要实现**:
- h5-app: 搜索建议下拉（热门搜索词、自动补全）
- 搜索历史存储在 localStorage
- 热门搜索词从 mock/page-config 加载

### F5 — 批量操作

**当前状态**: admin-app 所有列表页都是逐行操作。

**需要实现**:
- 商品管理: 批量上架/下架、批量删除
- 订单管理: 批量发货（快递单号 CSV 导入）
- 表格多选 checkbox + 批量操作按钮

### F6 — 数据导出

**当前状态**: 无任何导出功能。

**需要实现**:
- 订单 CSV 导出（含筛选条件）
- 用户列表导出
- mock: 生成 CSV 文件流并触发下载

---

## 四、技术债务

| # | 类型 | 描述 | 工作量 |
|---|------|------|--------|
| T1 | 测试 | 无单元测试——vue-tsc 只能检查类型，无法验证业务逻辑 | 高 |
| T2 | 测试 | 无 E2E 测试——回归依赖手工点击 | 高 |
| T3 | 并发 | 8 个 mock store 无文件锁——双进程运行必触发数据竞争 | 中 |
| T4 | 类型 | ~12 处 `as any` / `ref<any>` 绕过类型检查 | 中 |
| T5 | 存储 | cart-store 纯内存 vs 其他 store JSON 持久化——策略不一致 | 低 |
| T6 | Mock | admin mock 的 users 数组独立于 h5 后端——管理员无法看到 h5 侧注册的用户 | 中 |
| T7 | UI | 大量行内 style——主题切换困难 | 低 |
| T8 | 安全 | orderDetail 快递单号泄露到第三方 | 低 |

---

## 五、迭代路线图

### 迭代 1 — 紧急修复（本周）2-3h

目标：修复本轮新发现的 P1 Bug（P1-17~P1-25）

| 项目 | 工作量 |
|------|--------|
| P1-17: CouponManage percent threshold 翻倍 Bug | 0.5h |
| P1-18: OrdersManage 退款拒绝原因 | 0.5h |
| P1-20: ProfileView `info = i` 非 `.value` Bug | 0.5h |
| P1-21: OrderDetailView 路由变化不重载 | 0.5h |
| P1-22~23: RegisterView/LogView 错误处理 | 0.5h |
| P1-24: useCoupon 双倍计数 | 0.5h |
| P1-25: saveCategories 缺 atomicWrite | 0.5h |

### 迭代 2 — 功能补全（下周）8-12h

目标：填补 6 个功能缺口

| 项目 | 优先级 | 工作量 |
|------|--------|--------|
| F1: 消息通知中心 | 高 | 3h |
| F2: admin 个人设置 | 中 | 2h |
| F3: SKU 矩阵选择器 | 高 | 4h |
| F4: 搜索建议 + 历史 | 中 | 2h |
| F5: admin 批量操作 | 低 | 2h |
| F6: 数据导出 | 低 | 1h |

### 迭代 3 — 健壮性加固（两周内）8-12h

| 项目 | 工作量 |
|------|--------|
| P2-1~13: P2 中等问题 | 3h |
| P3-1~15: P3 体验优化 | 2h |
| T1-T2: 最小测试覆盖（vitest 关键路径） | 4h |
| T3: mock store 并发写入保护（atomic write + lock） | 2h |
| T4: 消除剩余 as any / ref\<any\> | 1h |
| T6: admin-h5 用户数据共享 | 1h |

### 远期（按需）

- CI/CD Pipeline（GitHub Actions）
- Element Plus 按需导入（减小 CSS bundle）
- E2E 测试（Playwright）
- 主题系统（CSS 变量替换行内 style）
- 国际化 i18n

---

## 六、已完成修复记录

自 2026-05-19 起已完成的修复（7 次提交）：

| 提交 | 简述 |
|------|------|
| `ee36f7f` | P0/P1 批量修复 18 文件：App.vue init、token refresh timeout、deepFixEncoding、竞态保护、user_id 守卫、format/storage 加固 |
| `f99be0c` | HomeView HTML 注释导致的模板编译失败 |
| `93271b4` | admin dashboard "orders is not defined" — 共享 store 迁移遗留引用 |
| `692a93a` | admin login captcha 空 base64 裂图 |
| `9e224e4` | captcha 随机码 + 服务端校验（两个 mock server） |
| `b7c89a1` | 订单列表 mock handler 正则缺前导 / 导致穿透到后端触发 login-required 登出 |

**已修复 P0 (8项)**: P0-1(user_id 守卫), P0-2(非空断言+竞态保护), P0-3(过度登出→仅401登出), P0-4(Token刷新Promise泄漏), P0-5(Banner排序), P0-13(parseBody 返回 `{_parseError: true}`), P0-N1(admin App.vue 空壳→init), P0-N2~N6(admin mock shared orders, auth, captcha, order list regex)

**已修复 P1 (16项)**: P1-1~5(store 持久化一致性), P1-6~11(store 输入验证), P1-12(detail_html 渲染), P1-15(软删除过滤), P1-17(formatPrice null), P1-22(coupon find 非空断言), P2-8(getJSON/setJSON 已实现), P2-12(CP1252 0x8D 映射), admin store setUserInfo, token refresh setAuth, deepFixEncoding error msg, LogsView allSettled, updateSkus price type

**Mock store 已修复**: comment/favorite/page-config/coupon 均已实现 seed 持久化、TTL 缓存(3s)、corrupt 备份；cart-store 已从内存改为 JSON 文件持久化；goods-store 已过滤软删除商品

---

*审计范围: h5-app (33文件) + admin-app (28文件) + shared/mock (10文件) + shared/utils (3文件)*
