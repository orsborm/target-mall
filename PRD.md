# 靶机商城 PRD v6.0

> 全量审计报告 | 2026-05-19 | 78 项问题 (P0=13, P1=26, P2=22, P3=17)

---

## 一、审计概览

| 层级 | 路径 | 文件数 | 本次发现问题 |
|------|------|--------|-------------|
| C端商城 | `h5-app/` | ~44 | 29 |
| 管理后台 | `admin-app/` | ~28 | 25 |
| 共享层 | `shared/` | ~18 | 24 |

### 严重性分布

| 级别 | 数量 | 关键主题 |
|------|------|----------|
| **P0** 致命 | 13 | 用户数据归属错乱、并发竞态、Token刷新Promise泄漏、运行时崩溃 |
| **P1** 高危 | 26 | 输入验证缺失、类型安全绕过、数据持久化不一致、静默错误吞没 |
| **P2** 中等 | 22 | 空catch块、功能遗漏、代码重复、性能问题 |
| **P3** 低优 | 17 | 体验细节、设计不一致、死代码 |

---

## 二、P0 致命缺陷（13项）

### 2.1 业务逻辑

#### P0-1 — h5-app 多处 `user_id` 硬编码回退到 1
**文件**: `OrderConfirmView.vue:53,104` `HomeView.vue:63` `CouponCenterView.vue:28`
```ts
user_id: userStore.userInfo?.id || 1  // userInfo=null → user_id=1（错误用户）
```
`userInfo` 为空时回退到 `user_id=1`，导致领券/下单/核销挂到错误用户。应直接阻止操作而非静默回退。
**修复**: 改为 `if (!userStore.userInfo?.id) { ElMessage.warning('请先登录'); return }`

#### P0-2 — GoodsDetailView 非空断言崩溃
**文件**: `h5-app/src/views/goods/GoodsDetailView.vue:60`
```ts
const res = await toggleFavoriteApi(userStore.userInfo!.id, goods.value.id)
```
`userInfo` 类型为 `UserInfo | null`，`!` 断言绕过了安全检查。Token 有效但 userInfo 加载失败时直接崩溃。

#### P0-3 — App.vue 过于激进的登出
**文件**: `h5-app/src/App.vue:21-23`
```ts
} catch { userStore.logout() }  // 任何 transient 错误都登出
```
临时断网或 500 错误就登出用户。应只对 401 做登出。

#### P0-4 — admin-app Token 刷新 Promise 泄漏
**文件**: `admin-app/src/api/request.ts:85-92`
刷新失败时 `refreshSubscribers = []` 清空数组但未 resolve/reject pending Promise，所有等待请求永久挂起（内存泄漏+UI 冻结）。

#### P0-5 — Banner 排序状态不一致
**文件**: `admin-app/src/views/marketing/BannerManage.vue:54-68`
`moveUp/moveDown` 发送两个 API，一个成功一个失败时本地列表与服务端不一致，刷新后数据回退。

### 2.2 并发竞态（8个 shared/mock 存储）

所有 JSON 持久化存储均使用 `load()-mutate-save()` 模式，**无文件锁**。admin-app + h5-app 双进程同时运行时：
- 两个进程读取同一份 JSON
- 各自修改内存中的数据
- 第二个 `save()` 覆盖第一个的写入
- **结果**: 数据丢失、ID 冲突

| # | 存储 | 风险操作 |
|---|------|---------|
| P0-6 | goods-store.ts | addGoods/addSkus/updateGoods 并发写 |
| P0-7 | coupon-store.ts | claimCoupon 超发/useCoupon 重复 |
| P0-8 | favorite-store.ts | toggleFavorite ID 冲突 |
| P0-9 | order-store.ts | createOrder 同毫秒 `Date.now()` order_no 重复 |
| P0-10 | page-config-store.ts | addPageConfig/updatePageConfig 覆盖 |
| P0-11 | feedback-store.ts | addFeedback 丢失 |
| P0-12 | comment-store.ts | addComment 丢失 |

**修复方案**: 
- 短期：为每个 store 的写操作添加简单的排他标记（`_writing` flag）
- 长期：引入 `proper-lockfile` 或改为单进程模拟所有 API

#### P0-13 — parseBody JSON 解析失败静默返回 {}
**文件**: `shared/mock/helpers.ts:28`
```ts
try { resolve(JSON.parse(body)) } catch { resolve({}) }
```
请求体 JSON 格式错误时返回空对象 `{}`，调用者无法区分"body 为空"和"JSON 损坏"，下游可能意外创建空数据。

---

## 三、P1 高危问题（26项）

### 3.1 数据持久化不一致

| # | 文件 | 问题 |
|---|------|------|
| P1-1 | comment-store.ts, favorite-store.ts | reload() 文件不存在时返回种子但**不写入磁盘**（对比 goods/order/feedback 会自动创建文件） |
| P1-2 | coupon-store.ts, comment-store.ts, favorite-store.ts, page-config-store.ts | JSON 损坏时**静默丢弃所有数据**（对比 goods/order/feedback 会备份为 `.backup.timestamp`） |
| P1-3 | order-store.ts | reload() **无 TTL 缓存**，每次访问读磁盘（对比 goods-store 有 3s TTL） |
| P1-4 | coupon-store.ts | getAvailableCoupons 同样无 TTL，每次都 loadOrSeed() |
| P1-5 | cart-store.ts | **唯一纯内存存储**，dev server 重启丢失购物车 |

### 3.2 输入验证缺失

| # | 文件 | 问题 |
|---|------|------|
| P1-6 | goods-store.ts | updateGoods 无验证（min>max、负数价格均可写入） |
| P1-7 | goods-store.ts | updateSku 无 price/stock 验证（addSkus 已有） |
| P1-8 | coupon-store.ts | createCoupon/updateCoupon 无验证（负门槛、非法 type、start>end） |
| P1-9 | coupon-store.ts | getCouponDiscount 当 value>100 时产生**负折扣**（对百分比券） |
| P1-10 | comment-store.ts | addComment 无 rating 范围校验（可传 0 或 100） |
| P1-11 | order-store.ts | createOrder 无验证（空 items、负数价格均可创建） |

### 3.3 显示/逻辑错误

| # | 文件 | 问题 |
|---|------|------|
| P1-12 | GoodsDetailView.vue:211 | 字段名 `detail_html` 暗示 HTML 内容，但用 `v-text` 转义渲染——用户看到源码标记 |
| P1-13 | GoodsManage.vue:195-201 | handleSave 先 `updateGoods` 成功再 `updateSkus` 失败不抛异常 → 显示"商品更新成功"但 SKU 未保存 |
| P1-14 | OrderConfirmView.vue:216 | 模板写死"满 ¥99.00 免运费"，但阈值已动态化——文案与实际不符 |
| P1-15 | goods-store.ts:197 | deleteGoods 软删除（status=-1），但 `getGoods`/`getGoodsDetail` 不自动排除已删商品 |
| P1-16 | router/index.ts (h5) | 路由 title 设置在鉴权重定向**之前**——未登录用户短暂看到受保护页面标题 |
| P1-17 | format.ts:3 | `formatPrice(null)` 返回 `'0.00'`（暗示免费），应返回 `'--'` 表示未知 |
| P1-18 | order-store.ts | `createOrder` 接收 `coupon_id` 参数但**不存储、不计算折扣** |
| P1-19 | DashboardView.vue:21 | `const data: any = await getDashboardOverview()` 完全绕过类型检查 |

### 3.4 类型安全

| # | 文件 | 数量 |
|---|------|------|
| P1-20 | h5-app 多处 | 8 处 `as any` 绕过类型检查（HomeView 4处、OrderConfirmView 3处、CouponCenterView 1处） |
| P1-21 | admin-app 多处 | 8 处 `ref<any>` / `as any`（LogsView 5个 ref、BannerManage 2处、GoodsManage 3处） |
| P1-22 | coupon-store.ts:82 | `s.coupons.find(c => c.id === uc.coupon_id)!` 非空断言——优惠券被删则崩溃 |

### 3.5 错误处理

| # | 文件 | 描述 |
|---|------|------|
| P1-23 | LoginView.vue, RegisterView.vue (h5) | 表单验证 `.catch(() => false)` 静默吞错，用户点击登录无任何反馈 |
| P1-24 | LoginView.vue, RegisterView.vue (admin) | 同上模式 |
| P1-25 | LogsView.vue:41,48,54 | 3 处空 catch 块注释"interceptor handles"——但非 HTTP 错误（网络断开等）不会被拦截器处理 |
| P1-26 | helpers.ts:45 | `cachedRead` 内部用 `require('fs')` 动态导入，与项目统一的 ES module import 不一致 |

---

## 四、P2 中等问题（22项）

### 4.1 错误处理不完整

| # | 文件 | 描述 |
|---|------|------|
| P2-1 | h5-app 全局 | **11 处空 catch 块**（GoodsDetailView 3处、OrderConfirmView 2处、HomeView 2处、CartView 等） |
| P2-2 | admin-app | 3 处空 catch 块（LogsView 3处） |

### 4.2 功能遗漏

| # | 文件 | 描述 |
|---|------|------|
| P2-3 | GoodsDetailView.vue:160-172 | SKU 选择器对零库存 SKU 无视觉禁用——用户选中后看到按钮 disabled 但不理解原因 |
| P2-4 | GoodsDetailView.vue:77-86 | loadComments 只展示第一页，缺少"加载更多"翻页 |
| P2-5 | GoodsDetailView.vue:83 | `avgRating` 从 API 返回但模板未展示评分统计 |
| P2-6 | admin-app | 路由守卫只检查 `isLoggedIn`，无角色权限区分（admin/editor 权限相同） |
| P2-7 | admin-app router | 404 捕获直接 redirect 到 `/`，用户不知道 URL 无效 |
| P2-8 | storage.ts | 只封装字符串存取，缺少 `getJSON<T>` / `setJSON<T>` |

### 4.3 数据质量

| # | 文件 | 描述 |
|---|------|------|
| P2-9 | goods-store.ts:33 | seedGoods `spu_code` 填充不一致：SPU001-SPU009 是 6 字符，SPU0010+ 因 `00` 前缀变成 SPU0010 |
| P2-10 | goods-store.ts:226 | `filter(Boolean)` 过滤 SKU 规格值会把数字 `0` 错误移除 |
| P2-11 | cart-store.ts:61-74 | addCartItem 返回原始 CartEntry（无 spu_name/main_image/price），与 getCart 返回格式不一致 |
| P2-12 | encoding.ts:17 | CP1252 映射表缺失 0x8D 字节（U+2025） |
| P2-13 | goods-store.ts | seedGoods `images` 数组永远为空，种子商品无详情图集 |

### 4.4 代码质量

| # | 文件 | 描述 |
|---|------|------|
| P2-14 | GoodsManage.vue | ¥/分转换分布 10+ 处，`Math.round()` 和 `+().toFixed(2)` 混用，精度不一致 |
| P2-15 | admin-app 5 个列表页 | 均硬编码 `const pageSize = 20` |
| P2-16 | h5-app 3 个列表页 | 不同 pageSize (10/20) 无统一 |
| P2-17 | request.ts (admin) | `timeout: 15000` 硬编码，不可配置 |
| P2-18 | CommentsManage, FeedbackManage | 用 `slice(0,16).replace('T',' ')` 格式化日期——其他页面用 `formatDate()` 不统一 |
| P2-19 | SafeImage.vue:38,45 | 回退尺寸 200 硬编码，SVG 拼接未转义 XML 特殊字符 |
| P2-20 | coupon-store.ts | 折扣显示 `(row.value/10).toFixed(1)折`——中文电商"9折"指 90%，若 value=10 显示"1.0折"语义可能反转 |

### 4.5 性能

| # | 文件 | 描述 |
|---|------|------|
| P2-21 | helpers.ts:31-37 | `enrichWithStock` 每次 O(N*M) 遍历 goods×skus，数据增长后性能退化 |
| P2-22 | encoding.ts | `deepFixEncoding` 无最大深度/循环引用保护，深层嵌套可能栈溢出 |

---

## 五、P3 低优先级（17项）

### 5.1 健壮性

| # | 文件 | 描述 |
|---|------|------|
| P3-1 | 所有 store | save() 静默吞掉写入错误（磁盘满/权限变更），调用者以为成功 |
| P3-2 | encoding.ts:47 | CJK 检测正则只匹配 U+4E00-U+9FFF 基本汉字区，不匹配扩展区/日韩文字 |
| P3-3 | format.ts:10 | formatDate 对无效日期返回原始字符串而非标记错误 |
| P3-4 | getComments/paginated | page/pageSize 为 0 或负数时无校验/钳位 |

### 5.2 UI/UX

| # | 文件 | 描述 |
|---|------|------|
| P3-5 | ProfileView.vue:62 | 个人信息加载失败用 `window.location.reload()` 整页刷新 |
| P3-6 | LoginView.vue:64-66 (h5) | 登录失败仅刷新验证码，无错误消息告知原因 |
| P3-7 | OrderDetailView.vue:128 | 快递查询链接跳转第三方，单号暴露在 Referer 和浏览器历史 |
| P3-8 | admin-app | 大量行内 `style="..."` 属性，主题化困难 |
| P3-9 | h5-app router | 404 路由无 `meta.title` |

### 5.3 设计不一致

| # | 文件 | 描述 |
|---|------|------|
| P3-10 | order-store.ts | `payOrder` 返回 `null` 表示失败，`updateOrderStatus` 返回 `false`，返回约定不统一 |
| P3-11 | favorite-store.ts | `getFavorites` 返回 `number[]`（仅 spu_id），函数名暗示返回完整对象 |
| P3-12 | coupon-store.ts | `claimCoupon` 有"已领取"检查但 `createCoupon` 无 validation——防御深度不一致 |
| P3-13 | cart-store.ts | 唯一纯内存存储，所有其他 store 已 JSON 持久化 |
| P3-14 | FeedbackView.vue | 手机号正则 `/^1[3-9]\d{9}$/` 不支持新号段 (16x, 19x) |
| P3-15 | AdminLayout.vue:15 | 退出登录 API 失败静默忽略，服务端 session 可能残留 |
| P3-16 | storage.ts | `getItem` 无法区分"key 不存在"和"storage 不可用"，均返回 null |

### 5.4 缺失功能

| # | 描述 |
|---|------|
| P3-17 | admin-app 无 admin profile/settings 页面（修改密码、个人设置） |

---

## 六、跨领域问题

### 6.1 并发安全（覆盖所有 8 个 store）

```
当前模式：load() → mutate(data) → save(data)
                    ↑ 竞态窗口 ↑
进程A: load() → modify → save()  ← 数据被覆盖
进程B:    load() → modify → save()
```

**影响**: admin-app 和 h5-app 两个 dev server 同时运行即触发。

### 6.2 存储策略不一致

| 维度 | goods | coupon | comment | favorite | order | page-config | feedback | cart |
|------|-------|--------|---------|----------|-------|-------------|----------|------|
| 持久化 | JSON | JSON | JSON | JSON | JSON | JSON | JSON | **内存** |
| TTL缓存 | 3s | **无** | **无** | **无** | **无** | **无** | 3s | N/A |
| 损坏备份 | ✅ | **无** | **无** | **无** | ✅ | **无** | ✅ | N/A |
| 种子持久化 | ✅ | ✅ | **无** | **无** | ✅ | ✅ | ✅ | N/A |
| 写验证 | 部分 | **无** | **无** | N/A | **无** | **无** | 部分 | N/A |

### 6.3 类型安全热力图

```
h5-app:  ████████░░  8 处 as any
admin-app: ████████░░  8 处 ref<any> / as any
shared:   ██░░░░░░░░  2 处非空断言
```

---

## 七、功能矩阵

| 功能 | h5-app | admin-app | Mock | 状态 |
|------|--------|-----------|------|------|
| 用户登录/注册 | ✅ | ✅ | ✅ | 完成 |
| 商品浏览/搜索 | ✅ | - | ✅ | 完成 |
| 商品详情/SKU | ✅ | - | ✅ | 完成 |
| 商品CRUD | - | ✅ | ✅ | 完成 |
| 分类管理 | - | ✅ | ✅ | 完成 |
| 购物车 | ✅ | - | ✅ | 完成 |
| 下单结算 | ✅ | - | ✅ | 完成 |
| 支付 | ✅ | - | ✅ | 完成 |
| 订单列表/详情 | ✅ | ✅ | ✅ | 完成 |
| 退款 | ✅ | ✅ | ✅ | 完成 |
| 发货/物流 | - | ✅ | ✅ | 完成 |
| 优惠券领取 | ✅ | - | ✅ | 完成 |
| 优惠券管理 | - | ✅ | ✅ | 完成 |
| 评论/评价 | ✅ | ✅ | ✅ | 完成 |
| 收藏 | ✅ | - | ✅ | 完成 |
| 收货地址 | ✅ | - | ✅ | 完成 |
| 轮播图/首页配置 | ✅ | ✅ | ✅ | 完成 |
| 意见反馈 | ✅ | ✅ | ✅ | **本次新增** |
| 仪表盘 | - | ✅ | ✅ | 完成 |
| 用户管理 | - | ✅ | ✅ | 完成 |
| 日志管理 | - | ✅ | ✅ | 完成 |
| 消息通知 | - | - | ❌ | **未实现** |
| 个人设置 | ✅ | ❌ | - | **未实现** |
| SKU矩阵选择器 | ❌ | - | - | **未实现** |
| 搜索建议/历史 | ❌ | - | - | **未实现** |
| 批量操作 | - | ❌ | - | **未实现** |
| 数据导出 | - | ❌ | - | **未实现** |

---

## 八、迭代执行计划

### 迭代 0 — 紧急修复（今天）

| 优先级 | 项目 | 预估 |
|--------|------|------|
| P0-1~3 | user_id 回退、非空断言、过度登出 | 1h |
| P0-4 | Token 刷新 Promise 泄漏 | 30min |
| P0-5 | Banner 排序状态不一致 | 30min |
| P0-6~12 | 所有 store 加 TTL 缓存 + corrupt 备份 | 2h |
| P0-13 | parseBody 返回错误状态 | 15min |

### 迭代 1 — 高危修复（本周）

| 优先级 | 项目 | 预估 |
|--------|------|------|
| P1-1~5 | 统一 store 持久化/备份/缓存策略 | 3h |
| P1-6~11 | 所有 store 输入验证补全 | 2h |
| P1-12~19 | 显示逻辑修复（detail_html、运费文案、软删除过滤等） | 3h |
| P1-20~22 | 消除 `as any` 和 `ref<any>` | 2h |
| P1-23~25 | 表单验证错误反馈 | 1h |
| P2-1~2 | 空 catch 块加错误日志 | 1h |

### 迭代 2 — 功能补全（下周）

| 优先级 | 项目 | 预估 |
|--------|------|------|
| P2-3~5 | 商品详情页完善（SKU禁用态、评论翻页、评分展示） | 3h |
| P2-8 | storage 加 JSON 序列化助手 | 1h |
| P2-14~16 | 提取 ¥/分转换、分页大小为共享常量 | 2h |
| P2-21 | enrichWithStock 性能优化（Map 索引） | 30min |
| P3-10~13 | store 返回约定统一、cart-store JSON 化 | 2h |
| P3-1 | store save() 错误告警 | 1h |
| 新功能 | 消息通知 mock + 页面 | 3h |
| 新功能 | admin 个人设置页 | 2h |

### 迭代 3 — 体验优化（两周内）

| 优先级 | 项目 | 预估 |
|--------|------|------|
| P2-6 | 角色权限控制 | 3h |
| P2-7 | 404 页面 | 1h |
| P2-9~13 | 数据质量修复（spu_code、filter、cart、CP1252） | 2h |
| P2-22 | deepFixEncoding 深度保护 | 1h |
| P3-2~4 | encoding/format 边界情况 | 1h |
| P3-5~9 | UI 体验优化（reload→refetch、登录反馈、404 title） | 2h |
| P3-14~16 | 手机号正则更新、登出API、storage区分 | 1h |
| 新功能 | SKU 矩阵选择器（规格联动） | 4h |
| 新功能 | 搜索建议 + 搜索历史 | 3h |
| 新功能 | 仪表盘图表（ECharts） | 4h |

### 远期（按需）

- 单元测试（vitest + @vue/test-utils）
- E2E 测试（playwright）
- CI/CD Pipeline
- 批量操作（批量下架、批量发货）
- 数据导出（订单 CSV）
- Element Plus 按需导入（减小 CSS bundle）

---

## 九、风险矩阵

```
                        高概率
                          │
  并发数据丢失 (P0-6~12)    │  类型安全退化 (P1-20~22)
  user_id 归属错误 (P0-1)   │  静默错误吞没 (P2-1~2)
  Token 泄漏 (P0-4)         │  输入验证缺失 (P1-6~11)
                          │
  ──────────────────────────────────────────
  低影响                    │              高影响
                          │
  代码风格不一致 (P3-8~9)    │  空catch导致排查困难 (P2-1~2)
  Magic numbers (P2-15~17) │  存储不一致导致困惑 (P3-13)
  SVG 边缘情况 (P3-7)       │  显示文案错误 (P1-12~17)
                          │
                        低概率
```

---

*审计范围: h5-app (44文件)、admin-app (28文件)、shared/mock (10文件)、shared/utils (3文件)*
*生成日期: 2026-05-19 | 三代理并行审计 + 全量合并*
