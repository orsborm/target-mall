# 项目优化审查报告

> 生成时间: 2026-05-09 | 审查范围: `h5-app` + `admin-app` 全部源码

---

## P0 — 高优先级（影响用户体验/稳定性）

### 1. 全局静默错误吞噬（30+ 处）
**影响**: 所有 views 中 API 调用失败时用户无任何反馈，界面显示空白或假空态。
**文件**: 所有 `src/views/**/*.vue` 中 `catch { /* ignore */ }` 模式
**建议**: 每个 view 增加 `error` ref + `<el-alert type="error" :title="error" />` + 重试按钮

### 2. `statusMap` 重复定义
**文件**: `OrderListView.vue:25-34`, `OrderDetailView.vue:16-25`
**建议**: 提取至 `src/api/order.ts`，与 `OrderStatus` 类型并列导出，两处共用一份定义。

### 3. `userInfo` 刷新丢失
**文件**: `stores/user.ts:9` — `userInfo` 不持久化，页面刷新后必须重新请求
**建议**: 序列化 `userInfo` 至 localStorage

### 4. admin-app 请求拦截器绕过 Store
**文件**: `admin-app/src/api/request.ts:14` — 直接读 `localStorage.getItem('admin_token')`
**对比**: h5-app 正确使用 `useUserStore().token`
**建议**: 统一用 Store，避免状态不同步

---

## P1 — 中优先级（影响性能/可维护性）

### 5. 全局注册 280+ Element Plus 图标
**文件**: `main.ts:14-16`（两项目均存在）
**影响**: 打包体积 ~400KB gzip 浪费
**建议**: 仅在使用处按需导入（两项目实际各用 ~15 个图标）

### 6. refreshToken 存储但从未使用
**文件**: `stores/user.ts:8`, `api/user.ts:76`
**影响**: 401 直接强制登出，无静默刷新
**建议**: 拦截器 401 → 调用 `refreshToken()` → 重试原请求 → 失败再登出

### 7. 两项目 5+ 文件 100% 重复
| 文件 | h5-app | admin-app |
|------|--------|-----------|
| `encoding.ts` | `src/utils/encoding.ts` | `src/utils/encoding.ts` |
| `storage.ts` | `src/utils/storage.ts` | `src/utils/storage.ts` |
| `format.ts` | `src/utils/format.ts` | `src/utils/format.ts` |
| `main.ts` 95% | `src/main.ts` | `src/main.ts` |
| `LogView.vue` 80% | `src/views/system/LogView.vue` | `src/views/logs/LogsView.vue` |
| `request.ts` 80% | `src/api/request.ts` | `src/api/request.ts` |

**建议**: 提取至 `packages/shared/` 共享包，或至少添加路径别名指向共享文件

### 8. `fixGarbledUtf8` 性能损耗
**文件**: `utils/encoding.ts:29-52`
**影响**: 每个 API 响应的每个字符串都进行 CP1252 扫描+映射+TextDecoder 重建，商品列表 100 条时产生大量临时对象
**建议**: (a) 仅在含 `0x80-0xFF` 范围字符的字符串上执行解码 (已做); (b) 将 skip-key 的 regex 替换为 Set 查找; (c) 缓存 `TextDecoder` 实例

### 9. 6 个未使用的 API 函数
**文件**:
- `api/common.ts` — `getDictByType`, `uploadFile`
- `api/goods.ts` — `getRecommendGoods`
- `api/user.ts` — `changePassword`, `refreshToken`
- `api/msg.ts` — `deleteMsg`

**建议**: 删除或实现对应 UI 功能

### 10. admin-app `api/log.ts` 全部返回 `any`
**文件**: `admin-app/src/api/log.ts` (9 个函数)
**对比**: h5-app 有完整的 TypeScript 接口 (`LogStatus`, `LogSize`, `LogFile` 等)
**建议**: 从 h5-app 复制类型定义

---

## P2 — 低优先级（代码整洁/长期维护）

### 11. 重复 UI 模式可提取为组件
| 重复模式 | 出现位置 | 建议组件 |
|----------|---------|---------|
| 验证码行 | LoginView + RegisterView | `CaptchaInput.vue` |
| 商品卡片 | HomeView + GoodsListView | `GoodsCard.vue` |
| 分页器 | GoodsList + OrderList + Notifications | `PaginationWrap.vue` |
| .page-header | goods/users/logs (admin) | `PageHeader.vue` |
| 表格+分页 | goods/users (admin) | `useTableData` composable |

### 12. 验证码行 CSS 重复
**文件**: `LoginView.vue:143-164`, `RegisterView.vue:180-205`
**建议**: 和 CaptchaInput.vue 一起提取

### 13. Router 缺少 `scrollBehavior`
**文件**: `router/index.ts`（两项目均缺少）
**建议**: 添加 `scrollBehavior() { return { top: 0 } }`

### 14. 首页分类硬编码
**文件**: `HomeView.vue:55` — `['数码产品','服饰鞋包','食品生鲜','家居日用']`
**建议**: 使用 `getCategoryTree()` API 动态加载

### 15. 仪表盘商品在售数不准
**文件**: `admin-app DashboardView.vue:19` — 只取 `page_size=1` 统计在售数
**建议**: 后端新增 `/sys/dashboard/stats` 端点

### 16. 未使用的 CSS class
- `global.css` — `.goods-grid-5`, `.ellipsis-2`
- `format.ts` — `formatShortDate`, `formatSales`

### 17. `SafeImage` 的 `imgLoading` 未消费
**文件**: `components/SafeImage.vue:20-22` — loading 状态跟踪但模板未使用
**建议**: 添加 `<el-skeleton>` 加载态

### 18. GoodsDetailView 缺商品不存在空态
**文件**: `GoodsDetailView.vue:116` — goods 为 null 时无 `<el-empty>`

### 19. `formatDate` 不处理无效日期字符串
**文件**: `utils/format.ts:6` — `new Date("invalid")` 产生 "NaN-NaN-NaN NaN:NaN"

### 20. `formatPrice` 参数名歧义
**文件**: `utils/format.ts:1` — 参数名 `cents` 暗示货币单位，但无注释说明

---

## 专门评估项

### admin-app Stub 端点（商品 CRUD 未实现）
**文件**: `admin-app/src/api/goods-mgmt.ts:15-19`
```ts
export function createGoods(data: any) { return request.post('/sys/goods', data) }
export function updateGoodsStatus(id: number, status: number) { ... }
export function deleteGoods(id: number) { ... }
```
后端 `/sys/goods` 路由当前返回 404。`GoodsManage.vue` 已调用 `updateGoodsStatus`，点"上架/下架"会报错。
**建议**: 要么在 WSL 后端实现这些端点，要么在 UI 中禁用按钮并标注"待后端实现"。

### admin-app 用户管理端点
`/sys/user/list`, `/sys/user/{id}`, `/sys/user/{id}/status` 同样不存在（返回 404），需与商品 CRUD 一并处理后端。

---

## 统计数据

| 指标 | h5-app | admin-app |
|------|--------|-----------|
| 源文件数 | 33 | 17 |
| 模块数（构建） | 1709 | 1672 |
| 重复文件 | — | 5 个 (与 h5-app 100% 相同) |
| 未使用 API 函数 | 6 | 5 (stub) |
| 静默异常捕获 | 18 处 | 10 处 |
| 重复 UI 模式 | 4 种 | 3 种 |
| 全局注册图标 | 280+ | 280+ |
| 实际使用图标 | ~15 | ~12 |

---

## 建议执行顺序

1. **提取共享包** (`encoding`, `storage`, `format`, `request`) → 消除 5+ 重复文件
2. **P0 修复** — 添加错误状态 UI + 统一 statusMap + Store 同步
3. **P1 修复** — Token 刷新 + 图标按需导入 + 类型补充
4. **P2 清理** — 组件提取 + 死代码删除 + 边界 case 处理
5. **后端扩展** — 实现 admin CRUD 端点 (/sys/goods/*, /sys/user/*)
