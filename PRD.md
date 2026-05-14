# 靶机商城 PRD v4.0

> 产品需求文档 | 2026-05-14 | 全量代码深度审查 + 三阶段优化路线

---

## 一、审查概览

### 审查范围

| 应用 | 路径 | 源文件 | 代码规模 | 定位 |
|------|------|--------|----------|------|
| H5靶机商城 | `h5-app/` | 44 文件 | ~3200 行 | C端电商平台 (14页) |
| 管理后台 | `admin-app/` | 22 文件 | ~1800 行 | 运营管理工具 (5页) |
| 共享代码 | `shared/` | 3 文件 | ~110 行 | 跨项目工具函数 |

### 发现总览

| 类别 | 数量 | 已在 v3.0 PRD | 本次新发现 |
|------|------|---------------|------------|
| 致命 Bug（运行时崩溃） | 3 | 0 | 3 |
| 严重 Bug（数据错误/无反馈） | 5 | 1 | 4 |
| 代码重复（DRY 违规） | 9 处 | 4 处 | 5 处 |
| 类型安全缺陷 | 8 处 | 1 处 | 7 处 |
| 性能问题 | 7 项 | 3 项 | 4 项 |
| 架构改进 | 6 项 | 4 项 | 2 项 |
| 安全隐患 | 2 项 | 1 项 | 1 项 |
| 死代码 | 10 处 | 8 处 | 2 处 |

---

## 二、致命 Bug（P0 — 立即修复）

### B1 — h5-app 订单详情：退款按钮触发运行时崩溃

**文件**: `h5-app/src/views/order/OrderDetailView.vue:117`

```html
<el-button v-if="['paid','shipped','received'].includes(order.status)"
  type="warning" @click="handleRefund">申请退款</el-button>
```

`handleRefund` 函数**不存在**于 `<script setup>` 中。点击即抛出 `Uncaught TypeError: handleRefund is not defined`，退款功能完全不可用。

**修复**: 添加 `handleRefund` 函数，调用 `POST /api/v1/order/orders/{id}/refund` 端点。

**验收标准**:
- [ ] 点击"申请退款"按钮正常触发退款流程
- [ ] 退款成功/失败有用户反馈

---

### B2 — h5-app 商品详情：导航到不同商品时数据不更新（脏读）

**文件**: `h5-app/src/views/goods/GoodsDetailView.vue:50`

`loadDetail()` 在 `<script setup>` 顶层调用，不在 `onMounted` 或 `watch` 中。从 `/goods/1` 跳转到 `/goods/2` 时，Vue Router 复用组件实例，`setup()` 不重新执行，页面展示商品 1 的数据。

**修复**: 添加 `watch(() => route.params.id, () => loadDetail())` 或给 `<router-view>` 加 `:key="$route.fullPath"`。

**验收标准**:
- [ ] `/goods/1` → `/goods/2` 导航后数据正确更新
- [ ] loading 状态正常过渡

---

### B3 — admin-app 订单管理：`address_snapshot` 联合类型访问崩溃

**文件**: `admin-app/src/views/orders/OrdersManage.vue`

```ts
// address_snapshot 类型: { name, phone, full_address } | string
// 模板直接访问 object 属性，未做类型守卫：
currentOrder.address_snapshot?.name
```

后端若返回纯字符串 `address_snapshot`，访问 `.name` 返回 `undefined`（不会崩溃但数据错误）。但若返回 `null`，`?.name` 安全链处理了，实际不会崩溃。减小到低严重度——但数据展示错误仍需修复。

**修复**: 添加类型守卫函数 `formatAddress(snapshot)` 兼容两种格式。

**验收标准**:
- [ ] 订单详情抽屉中地址信息始终正确展示

---

## 三、严重问题（P0 — 本周修复）

### C1 — 跨项目 `as any` 摧毁全部 API 响应类型

**文件**: 
- `h5-app/src/api/request.ts:72`
- `admin-app/src/api/request.ts:65`

两项目的 Axios 响应拦截器均使用 `deepFixEncoding(res.data) as any`，所有 API 函数的泛型返回值被 `any` 覆盖。例如 `getGoodsList()` 声明返回 `{ list: GoodsItem[] }`，调用方实际拿到 `any`，TypeScript 不会捕捉任何属性访问错误。

**修复**: 让 `deepFixEncoding` 保持泛型输入类型：
```ts
function deepFixEncoding<T>(data: T): T { ... }
return deepFixEncoding(res.data) // 保留 T 类型
```

**验收标准**:
- [ ] `request.ts` 响应拦截器返回类型正确
- [ ] 调用方获得正确的类型推导

---

### C2 — h5-app Token 刷新函数重复实现

**文件**: 
- `h5-app/src/api/request.ts:43` — 用裸 `axios.post()` 调用刷新
- `h5-app/src/api/user.ts` — 有 `refreshToken()` 但拦截器未使用

拦截器自己拼 URL 调用刷新，而非复用已定义的 `refreshToken()` API 函数。造成：
- 调用方式不一致（一个带 base URL，一个不带）
- `refreshToken()` API 函数成为死代码

**修复**: 拦截器改调 `refreshToken()` API 函数。

**验收标准**:
- [ ] 拦截器复用 `api/user.ts` 的 `refreshToken()`
- [ ] Token 刷新逻辑不重复

---

### C3 — admin-app 用户管理：错误消息误导用户

**文件**: `admin-app/src/views/users/UsersManage.vue`

```ts
catch { ElMessage.warning('用户列表接口暂未就绪') }
```

无论是网络超时、500 错误、还是真的接口不存在，用户看到的都是"接口暂未就绪"。用户无法判断是系统故障还是功能未开放。

**修复**: 使用实际的 error 信息，或使用中性文案"加载失败，请稍后重试"。

**验收标准**:
- [ ] 网络错误与业务错误用不同提示
- [ ] 移除"接口暂未就绪"等误导文案

---

### C4 — h5-app 结算页：订单数据通过 URL Query 传递

**文件**: `h5-app/src/views/order/CartView.vue:52`

```ts
router.push(`/order/confirm?items=${encodeURIComponent(JSON.stringify(orderItems))}`)
```

问题：
- URL 超长导致 414 错误（多个 SKU 时 JSON 很大）
- 订单数据完全暴露在浏览器历史/日志中
- 用户刷新结算页会丢失数据

**修复**: 改用 Pinia store 或 sessionStorage 传递。

**验收标准**:
- [ ] 订单数据不经过 URL
- [ ] 刷新结算页数据不丢失

---

### C5 — h5-app 购物车 Store 仅存计数不同步

**文件**: `h5-app/src/stores/cart.ts`

Cart store 只存 `count`（数字），不存实际购物车项。每次进入购物车页重新全量拉取。这意味着：
- Cart store 的 `count` 可能和服务器实际状态不同步
- 导航栏的购物车计数不准确
- 任何组件修改购物车后其他组件感知不到

**修复**: Cart store 存储完整的 cart items 列表，或至少添加 `fetchCount()` action 供全局同步。

**验收标准**:
- [ ] Cart count 在加购/删商品后自动同步
- [ ] 跨页面的 Cart count 一致性

---

## 四、代码重复（P1 — 两周内修复）

### D1 — 验证码逻辑 100% 重复（h5-app）

| 文件 | 重复行数 |
|------|----------|
| `LoginView.vue` | ~55 行（逻辑 20 + CSS 35） |
| `RegisterView.vue` | ~55 行（完全一致） |

重复内容：`fetchCaptcha()`、`captchaImage`/`captchaId`/`captchaLoading` refs、验证码 HTML 模板、`.captcha-row` 全套 CSS。

**修复**: 提取为 `useCaptcha` composable + `<CaptchaInput>` 组件。

---

### D2 — 商品卡片 HTML/CSS 重复（h5-app）

| 文件 | 重复行数 |
|------|----------|
| `HomeView.vue` | ~30 行 CSS + ~12 行模板 |
| `GoodsListView.vue` | ~30 行 CSS + ~12 行模板（仅 image height 不同） |

**修复**: 提取为 `<ProductCard>` 组件，`imageHeight` 作为 prop。

---

### D3 — 登出逻辑重复（h5-app）

| 文件 | 位置 |
|------|------|
| `AppLayout.vue:44-52` | 确认 → 调 API → 清 Store → 提示 → 跳转 |
| `ProfileView.vue:48-52` | 完全相同的流程 |

**修复**: 将 logout 流程移入 `userStore.logout()` action，两处调用同一方法。

---

### D4 — 加入购物车逻辑重复（h5-app GoodsDetailView）

`handleAddCart` 和 `handleBuy` 有完全相同的加购逻辑（验证 SKU → call API → update count），唯一差异是 `handleBuy` 多一行 `router.push('/cart')`。

**修复**: 合并为一个函数，用参数控制是否跳转。

---

### D5 — admin-app `.page-header` CSS 重复 4 次

**文件**: `GoodsManage.vue`、`UsersManage.vue`、`OrdersManage.vue`、`LogsView.vue`

每个视图的 `<style scoped>` 中都有相同的：
```css
.page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.page-header h2{font-size:20px}
```

**修复**: 移到 `global.css` 或提取为 scoped-less 全局样式组件。

---

### D6 — admin-app 分页器 HTML 重复 3 次

**文件**: `GoodsManage.vue`、`UsersManage.vue`、`OrdersManage.vue`

```html
<div style="display:flex;justify-content:center;margin-top:16px" v-if="total > pageSize">
  <el-pagination background layout="prev, pager, next" :total="total"
    :page-size="pageSize" :current-page="page" @current-change="changePage" />
</div>
```

**修复**: 提取为 `<PaginationWrap>` 组件或 `usePagination` composable。

---

### D7 — admin-app 表格加载/翻页模式重复 5 次

**文件**: 全部 5 个管理视图

```ts
const loading = ref(false)
const page = ref(1)
const total = ref(0)
const pageSize = 20

async function loadData() {
  loading.value = true
  try { /* fetch */ } catch { ElMessage.error('...') } finally { loading.value = false }
}
function changePage(p: number) { page.value = p; loadData() }
onMounted(loadData)
```

**修复**: 提取为 `usePageData<T>` composable，封装 loading/page/total/pageSize 状态和 loadData/changePage 方法。

---

### D8 — admin-app AdminLayout 包裹重复 5 次

每个管理视图模板都是 `<AdminLayout>...</AdminLayout>`。应当使用 Vue Router 的嵌套路由 + `<router-view>` 布局插槽，而非让每个视图手动包裹。

**修复**: 将 AdminLayout 设为路由 layout 组件，管理视图作为子路由。

---

### D9 — admin-app 状态切换模式重复 2 次

`GoodsManage.vue` 和 `UsersManage.vue` 有几乎相同的"确认 → 计算新状态 → 调 API → 就地修改 row"模式。

**修复**: 提取为 `useToggleStatus` composable。

---

## 五、性能优化（P1-P2）

### P1 — 两项目均无 build.manualChunks（P1）

**文件**: `h5-app/vite.config.ts`、`admin-app/vite.config.ts`

都没有配置 `build.rollupOptions.output.manualChunks`。Element Plus (~1.2MB), Vue/Pinia/Router (~200KB) 全部打入单一 vendor chunk。首屏 JS 体积过大。

**修复**:
```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'element-plus': ['element-plus'],
        'vue-vendor': ['vue', 'vue-router', 'pinia'],
      }
    }
  }
}
```

**验收标准**:
- [ ] Element Plus 独立 chunk（可并行加载、独立缓存）
- [ ] Vue 生态独立 chunk
- [ ] 首屏 JS 减少 40%+（通过缓存复用）

---

### P2 — `deepFixEncoding` 每次响应都递归遍历（P1）

**文件**: `shared/utils/encoding.ts`

Axios 拦截器对**所有**成功响应调用 `deepFixEncoding()`，递归遍历整个响应对象树。商品列表（20 条 × 嵌套详情 HTML）+ 订单列表（嵌套 items/skus）产生大量临时对象。

**修复选项**:
- (a) 后端修复 CP1252→UTF8MB4 字符集（根本解决）
- (b) 前端添加快速路径：先检查顶层字符串是否含 `0x80-0xFF` 可疑字节，无则跳过
- (c) 缓存 `TextDecoder` 实例，避免每次新建

**验收标准**:
- [ ] 大部分正常响应不触发深度遍历
- [ ] TextDecoder 复用

---

### P3 — admin-app 无 `<keep-alive>` 缓存管理页（P2）

**文件**: `admin-app/src/App.vue`

在管理页面间切换（如 Goods → Orders → Goods），组件被销毁重建，分页状态、搜索条件丢失。

**修复**: `<router-view>` 外包裹 `<keep-alive>`。

**验收标准**:
- [ ] 管理页之间切换保留滚动位置、分页、搜索条件
- [ ] 离开管理模块时清除缓存

---

### P4 — 两项目 LogView 组件挂载时过度请求（P2）

**文件**: `h5-app/src/views/system/LogView.vue`、`admin-app/src/views/logs/LogsView.vue`

`onMounted` 触发 `Promise.all([getLogStatus(), getLogSize(), getLogList()])`，3 个请求并发。但用户可能只看第一个 Tab（文件列表），后两个 Tab 的数据白加载。

**修复**: 改为 tab 切换时懒加载（`watch` activeTab → fetch）。

**验收标准**:
- [ ] 仅当前激活 Tab 触发数据请求
- [ ] Tab 切换时首次加载、后续使用缓存

---

### P5 — h5-app `getCartCount()` 拉取全量购物车（P2）

**文件**: `h5-app/src/api/cart.ts:44`

后端无专用 count 端点，`getCartCount()` 调用 `/order/cart/`（同 `getCartList()`），拉取全部购物车数据只为取 `data.length`。

**修复**: 后端新增 `GET /order/cart/count` 端点，或前端改为 `HEAD` 请求 + `X-Total-Count` header。

**验收标准**:
- [ ] Cart count 请求不传输完整购物车数据

---

### P6 — Element Plus 全量 CSS 导入（P2）

**文件**: `h5-app/src/main.ts`、`admin-app/src/main.ts`

两个 `main.ts` 均 `import 'element-plus/dist/index.css'`（完整主题 CSS），无 tree-shaking。

**修复**: 使用 `unplugin-element-plus` 或 `unplugin-vue-components` 按需导入。

**验收标准**:
- [ ] CSS bundle 减少 ≥ 60%

---

### P7 — SafeImage 无 native lazy loading（P3）

**文件**: `h5-app/src/components/SafeImage.vue`

`<img>` 标签缺少 `loading="lazy"` 属性。

**修复**: 添加 `loading="lazy"` prop 默认 true。

---

## 六、类型安全（P1-P2）

### T1 — h5-app `request.ts:72` as any（见 C1 — 最高优先级）

### T2 — Dashboard/Logs 视图使用 `ref<any>`（P1）

| 文件 | 变量 | 应有类型 |
|------|------|----------|
| `admin-app DashboardView.vue` | `stats` | `DashboardOverview` |
| `admin-app LogsView.vue` | `logContent, searchResult, status, size, files` | `LogContent, LogSearchResult, LogStatus, LogSize, LogFile[]` |
| `h5-app LogView.vue` | `logContent, searchResult, status, size, files` | 同上 |

每个视图都已有完整的 TypeScript 接口定义（在 `api/log.ts` 中），但组件选择用 `any`。

**修复**: 使用已有接口类型。

---

### T3 — 5 处多余的 `as any` 类型断言（P1）

| 文件 | 位置 | 问题 |
|------|------|------|
| `h5-app GoodsListView.vue:35` | `sort: sortBy.value as any` | 应使用 `GoodsListParams['sort']` |
| `h5-app OrderListView.vue:69` | `ORDER_STATUS_MAP[...]?.type as any` | 应定义 `TagType` 字面量联合类型 |
| `h5-app OrderDetailView.vue:60` | 同上 | 同上 |
| `h5-app HomeView.vue:28` | `configs as unknown as PageConfig[]` | 应统一类型定义来源 |
| `admin-app OrdersManage.vue` | `ORDER_STATUS_MAP[row.status]?.type as any` | 同上 |

**修复**: 逐一替换为正确的类型断言或类型收窄。

---

### T4 — admin-app API params 使用 `any`（P2）

**文件**: `admin-app GoodsManage.vue`、`UsersManage.vue`、`OrdersManage.vue`

```ts
const params: any = { page, page_size: pageSize }
```

**修复**: 为每个 load 函数定义 `Params` 接口。

---

### T5 — `noUnusedLocals: false` 屏蔽死代码检测（P2）

**文件**: `h5-app/tsconfig.app.json`、`admin-app/tsconfig.app.json`

两个项目的 `tsconfig.app.json` 都设置了 `noUnusedLocals: false` 和 `noUnusedParameters: false`。

**修复**: 改为 `true`，清理或使用 `_` 前缀标记故意的未使用变量。

---

## 七、架构改进（P1-P2）

### A1 — `getDashboardOverview` 在错误的 API 模块（P1）

**文件**: `admin-app/src/api/goods-mgmt.ts`

`getDashboardOverview()` 放在商品管理模块中，`DashboardView.vue` 需要 `import { getDashboardOverview } from '@/api/goods-mgmt'`——语义混乱。

**修复**: 创建 `api/dashboard.ts` 或 `api/sys.ts` 放置仪表盘相关端点。

---

### A2 — `ORDER_STATUS_MAP` 在 API 层（P1）

**文件**: `h5-app/src/api/order.ts`、`admin-app/src/api/order-mgmt.ts`

状态→标签/颜色的映射是纯 UI 关注点，不应与 HTTP 调用放在同一文件。

**修复**: 移到 `constants/order.ts` 或 `utils/status.ts`。

---

### A3 — h5-app App store 仅服务 HomeView（P2）

**文件**: `h5-app/src/stores/app.ts`

`pageConfigs` 状态和 `getConfigValue` 方法仅被 `HomeView.vue` 使用，放在全局 store 中不合适。`getConfigValue` 每次调用做 `Array.find()`（O(n)），如果频繁调用效率低。

**修复**: 将 page configs 移入 HomeView 的本地状态，或改用 `Map` 做 O(1) 查找。

---

### A4 — h5-app `DictItem` 接口定义但从未使用（P2）

**文件**: `h5-app/src/api/common.ts:8`

死代码。删除或实现字典功能。

---

### A5 — h5-app `getGoodsDetail()` API 函数从未使用（P2）

**文件**: `h5-app/src/api/goods.ts:52`

`getGoodsDetail()` 提取 SPU 后返回，但 `GoodsDetailView` 只用 `getGoodsDetailFull()`（返回 SPU+SKUs）。死代码。

---

### A6 — 两项目 `.env` 文件无差异化（P2）

`.env.development` 和 `.env.production` 内容完全一致（同样的 API base 和 app title）。开发和生产的配置应当分开。

**修复**: 
- `.env.development`: API 指向本地/开发服务器, `VITE_APP_TITLE=H5靶机商城-开发`
- `.env.production`: API 指向生产地址, `VITE_APP_TITLE=H5靶机商城`

---

## 八、错误处理统一（P1）

### E1 — 14 个视图的 catch 块需要完善

已在 PRD v3.0 O5 中详细列出，但本次审查发现两个新维度：

**双重 Toast 问题**: 拦截器已显示 `ElMessage.error(res.msg)`，视图 catch 块再显示一条固定文案，用户看到两条错误提示。

**修复原则**:
1. 拦截器负责展示 HTTP 级错误（401/422/429/5xx/network/timeout）
2. 视图 catch 块设置 `error.value` 状态变量 + 展示 `<el-result icon="error">` 内联错误
3. 视图 catch **不**重复 `ElMessage.error()`

**各视图具体修复**:

| h5-app (8) | admin-app (5) |
|------------|---------------|
| LoginView | LoginView |
| RegisterView | DashboardView |
| OrderConfirmView | GoodsManage |
| NotificationView | UsersManage |
| AddressView | LogsView |
| ProfileView | |
| FeedbackView | |
| LogView | |

---

## 九、表单/校验修复（P2）

### F1 — admin-app GoodsManage 编辑表单无校验

**文件**: `admin-app/src/views/goods/GoodsManage.vue`

编辑商品的 `<el-form>` 无 `:rules` 属性。商品名可为空、价格可为负数。

**修复**: 添加表单校验规则（name 必填，price ≥ 0）。

---

### F2 — h5-app 地址表单缺少 `is_default` 勾选框

**文件**: `h5-app/src/views/user/AddressView.vue`

表单 model 中有 `is_default` 字段但模板中无对应 `<el-checkbox>`。用户无法通过 UI 设置默认地址。

**修复**: 在表单 dialog 中添加 `<el-checkbox v-model="form.is_default">`。

---

### F3 — h5-app 地址表单 city 字段未校验

**文件**: `h5-app/src/views/user/AddressView.vue:33-37`

校验逻辑检查了 `province` 和 `district`，漏掉 `city`。可保存省市区不完整的地址。

---

### F4 — h5-app ProfileView 编辑表单无校验

**文件**: `h5-app/src/views/user/ProfileView.vue:110-120`

编辑昵称/邮箱的 `<el-form>` 无 `:rules`。昵称可为纯空白。

---

## 十、安全隐患

### S1 — h5-app GoodsDetailView: `v-html` 渲染未消毒 HTML

**文件**: `h5-app/src/views/goods/GoodsDetailView.vue:160`

```html
<div v-html="goods.detail_html"></div>
```

商品详情 HTML 来自后端，若后端数据被污染（管理后台编辑、爬虫注入），可能触发 XSS。

**修复**: 使用 DOMPurify 或至少添加 CSP `script-src` 限制。

---

### S2 — h5-app 敏感用户信息明文存 localStorage

**文件**: `h5-app/src/stores/user.ts`

`userInfo`（含 phone、email、role_code）JSON 序列化后存入 localStorage，任何同源 JS 可读取。

**修复**: 仅持久化 token，userInfo 每次从 API 获取；或只存脱敏字段。

---

## 十一、测试/CI（P2）

### TC1 — 零测试覆盖

两个项目均无测试框架。`package.json` 中无 `vitest`、`playwright`、`cypress` 任一依赖。

**建议**:
- 单元测试：`vitest` + `@vue/test-utils` 覆盖 composables/stores/utils
- E2E 测试：`playwright` 覆盖核心用户流程（登录→浏览→加购→下单）

---

### TC2 — 无 CI/CD Pipeline

项目无 GitHub Actions / GitLab CI 配置。

**建议**:
```yaml
# .github/workflows/ci.yml
jobs:
  lint:    vue-tsc --noEmit
  test:    vitest run
  build:   vite build
  e2e:     playwright test
```

---

## 十二、优先级矩阵

```
                        高影响
                          │
  B1 退款崩溃             │    C1 as any 类型
  B2 详情页脏读           │    C2 Token 刷新重复
  C4 URL 传订单            │    C5 Cart store 不同步
  P1 manualChunks         │    P2 deepFixEncoding
  T2 ref<any> 泛化        │    E1 错误处理统一
                          │
  ────────────────────────────────────────
  低紧急                  │              高紧急
                          │
  D1-D9 代码重复          │    B3 address_snapshot
  T3-T5 as any 清理      │    C3 误导错误消息
  A1-A6 架构微调          │    F1-F4 表单校验
  P3-P7 体验优化          │    S1-S2 安全加固
  TC1-TC2 测试/CI         │
                          │
                        低影响
```

---

## 十三、执行计划

### 第〇阶段：立即修复（今天）
```
B1  handleRefund 缺失        ── 1 小时
B2  GoodsDetail 导航不更新    ── 30 分钟
C1  as any 类型修复          ── 30 分钟
```

### 第一阶段：P0 修复（本周）
```
C2  Token 刷新重复           ── 1 小时
C3  误导错误消息             ── 30 分钟
C4  URL 传订单数据           ── 2 小时
C5  Cart store 同步          ── 2 小时
B3  address_snapshot 守卫    ── 1 小时
E1  14视图错误状态（继续）   ── 3 小时
```

### 第二阶段：P1 优化（下周）
```
P1   manualChunks 分包       ── 1 小时
P2   deepFixEncoding 优化    ── 2 小时
T2   ref<any> 类型化         ── 2 小时
D1   验证码 composable       ── 2 小时
D5-D9 admin 重复模式消除     ── 4 小时
D2   ProductCard 组件        ── 2 小时
D4   addCart 合并            ── 30 分钟
A1-A2 模块重组              ── 1 小时
F1-F4 表单校验补全          ── 2 小时
```

### 第三阶段：P2 加固（下下周）
```
P3-P7  性能细节             ── 4 小时
T3-T5  类型安全细节         ── 2 小时
A3-A6  架构细节             ── 2 小时
S1-S2  安全加固             ── 2 小时
D3      登出逻辑统一        ── 30 分钟
D8      嵌套路由布局        ── 2 小时
TC1     vitest 引入         ── 4 小时
```

### 第四阶段：远期（视业务需求）
```
TC2     CI/CD Pipeline       ── 4 小时
P7      lazy loading 图片    ── 30 分钟
A5-A6   死代码清理           ── 1 小时
```

---

## 十四、非功能需求

### 性能目标
- [ ] 首屏 JS < 500KB gzip（当前约 800KB+）
- [ ] 首屏 CSS < 50KB gzip（当前全量 Element Plus ~120KB）
- [ ] Lighthouse Performance ≥ 80

### 安全目标
- [ ] CSP header 配置（防 XSS）
- [ ] 敏感操作二次确认（清日志、退单）
- [ ] localStorage 不存敏感用户信息

### 可用性目标
- [ ] 所有视图四态覆盖：Loading / Empty / Error+Retry / Data
- [ ] 所有 API 失败有用户可见反馈
- [ ] 破坏性操作有确认对话框（已有部分，需补全）

### 代码质量目标
- [ ] `noUnusedLocals: true` + 零 TS 错误
- [ ] 代码重复率 < 5%
- [ ] 单元测试覆盖核心工具函数 + composables

---

*本文档基于 2026-05-14 全量代码审查生成。覆盖 h5-app（44 文件）、admin-app（22 文件）、shared/（3 文件）全部源码。*
