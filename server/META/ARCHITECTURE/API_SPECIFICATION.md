# Where2Meet Backend - API 规范

> 基于前端 codebase 分析，整理所有需要实现的 API

---

## 一、API 概览

| 模块 | 路由 | 方法 | 说明 |
|------|------|------|------|
| Event | /api/events | POST | 创建活动 |
| Event | /api/events/:id | GET | 获取活动详情 |
| Event | /api/events/:id | PATCH | 更新活动 |
| Event | /api/events/:id | DELETE | 删除活动 |
| Event | /api/events/:id/publish | POST | 发布场所 |
| Participant | /api/events/:id/participants | POST | 添加参与者（可选认证） |
| Participant | /api/events/:id/participants/:pid | PATCH | 更新参与者（双令牌） |
| Participant | /api/events/:id/participants/:pid | DELETE | 移除参与者（双令牌） |
| Venue | /api/venues/search | POST | 搜索场所 |
| Venue | /api/venues/:id | GET | 获取场所详情 |
| Vote | /api/events/:id/votes | POST | 投票 |
| Vote | /api/events/:id/votes | DELETE | 取消投票 |
| Vote | /api/events/:id/votes | GET | 获取投票统计 |
| Maps | /api/geocode | POST | 地址转坐标 |
| Maps | /api/directions | POST | 获取路线 |

---

## Fastify 运行时约定（依赖注入 / 错误出口 / Hooks）

> 本章节把架构规范进一步落到 Fastify 的运行时机制，确保团队写新路由时自动继承依赖注入、错误处理和横切关注点，而不是靠「大家自觉」。

### 1. 基础设施插件（decorate 注入依赖）

- **`plugins/db.ts`**：创建 PrismaClient，`app.decorate("db", prisma)`，在 `onClose` 中 `await prisma.$disconnect()`。
- **`plugins/cache.ts`**：创建 Redis client，`app.decorate("cache", redis)`，在 `onClose` 中 `await redis.quit()`。
- **使用方式**：业务层/路由通过 `request.server.db`、`request.server.cache` 访问依赖，禁止直接 `import` 全局单例，测试可以用 `app.withTypeProvider().decorate(...)` 注入 mock。

### 2. 统一错误出口（`setErrorHandler` + `NotFound` Handler）

- 所有业务异常继承 `AppError`：包含 `statusCode` + `code` + `message`，业务层只需 `throw`。
- `app.setErrorHandler` 负责：
  - **Zod/Fastify Schema 校验错误** → `400 VALIDATION_ERROR`
  - **Prisma 唯一键冲突** → `409 CONFLICT`
  - **外部服务 429/5xx** → `502/503 EXTERNAL_SERVICE_ERROR`（并写入 requestId + 原始错误）
  - **业务错误**（`EventNotFoundError` 等）→ 对应状态码/错误码
- `app.setNotFoundHandler` 返回 `{ error: { code: "NOT_FOUND", message: "Route not found" } }`，避免 Fastify 默认 HTML。
- 所有响应都经由统一 handler，保证脱敏 message、结构化日志（使用 requestId、eventId 等上下文）。

### 3. Lifecycle Hooks & Cross-cutting Concerns

| Hook | 负责事项 | 说明 |
|------|----------|------|
| `onRequest` | requestId 注入、基础日志、全局速率限制入口 | 结合 Pino，把 organizerToken、API Key 通过 `redact` 脱敏 |
| `preValidation` | 字符串 trim/normalize、幂等 key 解析、严格 schema | 建议使用 `fastify-type-provider-zod`，保持 schema 单一来源 |
| `preHandler` | 鉴权/授权（如 organizerToken 校验）、RBAC、feature flag | 可针对 `/api/events/:id/*` 设专属 hook，集中校验 event 状态 |
| `onResponse` | latency/状态码指标、缓存命中统计 | 写入 Prometheus 计数器 + 结构化日志 |
| `onSend` | 统一响应 envelope/headers（如 `Cache-Control`、`X-Request-Id`） | 需要时可在这里做 gzip、脱敏兜底 |

> 通过 `app.register(moduleRoutes, { prefix, onRequest: [...], preHandler: [...] })` 将 hook 精准作用在模块级别，保持「分层边界」与「运行时机制」一致。

### 4. 额外生产级防护（推荐）

- **资源关闭**：所有插件在 `onClose` 中优雅关闭，配合 `vitest`/`app.inject` 避免句柄泄漏。
- **日志脱敏**：Pino `redact` 针对 `organizerToken`、地址、Google API Key 等敏感字段。
- **Schema 单一来源**：Zod → JSON Schema（`fastify-type-provider-zod`）以便既做校验又生成类型/文档。
- **测试首选 `app.inject`**：无需监听端口，直接注入请求，搭配自定义插件便于替换依赖。
- **外部调用并发阀门**：对 Maps/Places/Directions 调用增加信号量/队列，防止瞬时压爆配额。

---

## 二、Event 模块

### 2.1 创建活动

```
POST /api/events
```

**前端输入：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | ✓ | 活动标题，max 100 |
| meetingTime | string | ✓ | 预计见面时间，ISO 8601 格式 |

**后端输出（成功 201）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 活动 ID (格式: `evt_<timestamp>_<random16>`) |
| title | string | 活动标题 |
| meetingTime | string \| null | 预计见面时间 |
| organizerToken | string | 组织者令牌（仅创建时返回） |
| participants | array | 参与者列表（空） |
| mec | object \| null | 最小外接圆（MEC） |
| publishedVenueId | string \| null | 已发布场所 ID |
| publishedAt | string \| null | 发布时间 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |
| settings | object | 活动设置 |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 缺少必填字段或格式错误 |
| 500 | INTERNAL_ERROR | 服务器错误 |

---

### 2.2 获取活动详情

```
GET /api/events/:id
```

**前端输入：**
| 参数 | 位置 | 说明 |
|------|------|------|
| id | URL Path | 活动 UUID |

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 活动 UUID |
| title | string | 活动标题 |
| meetingTime | string \| null | 预计见面时间 |
| participants | Participant[] | 参与者列表 |
| mec | object \| null | 最小外接圆（MEC） |
| publishedVenueId | string \| null | 已发布场所 ID |
| publishedAt | string \| null | 发布时间 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |
| settings | object | 活动设置 |

**注意**：不返回 organizerToken（防止泄露）

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 404 | NOT_FOUND | 活动不存在 |

---

### 2.3 更新活动

```
PATCH /api/events/:id
```

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 UUID |
| Authorization | Header | string | ✓ | Bearer {organizerToken} |
| title | Body | string | - | 新标题 |
| meetingTime | Body | string | - | 新时间 |

**后端输出（成功 200）：**

返回更新后的 Event 对象

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 401 | UNAUTHORIZED | 缺少或无效的 token |
| 403 | FORBIDDEN | 无权限修改 |
| 404 | NOT_FOUND | 活动不存在 |

---

### 2.4 删除活动

```
DELETE /api/events/:id
```

**前端输入：**
| 参数 | 位置 | 说明 |
|------|------|------|
| id | URL Path | 活动 UUID |
| Authorization | Header | Bearer {organizerToken} |

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | true |
| message | string | "Event deleted successfully" |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 401 | UNAUTHORIZED | 缺少或无效的 token |
| 403 | FORBIDDEN | 无权限删除 |
| 404 | NOT_FOUND | 活动不存在 |

---

### 2.5 发布场所

```
POST /api/events/:id/publish
```

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 UUID |
| Authorization | Header | string | ✓ | Bearer {organizerToken} |
| venueId | Body | string | ✓ | 要发布的场所 ID (Google Place ID) |

**后端输出（成功 200）：**

返回更新后的 Event 对象（包含 publishedVenueId 和 publishedAt）

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 缺少 venueId |
| 401 | UNAUTHORIZED | 缺少或无效的 token |
| 403 | FORBIDDEN | 无权限发布 |
| 404 | NOT_FOUND | 活动不存在 |
| 409 | CONFLICT | 活动已发布 |

---

## 三、Participant 模块

### 3.1 添加参与者（可选认证）

```
POST /api/events/:id/participants
```

**说明**：统一端点，支持两种模式：
- **无认证**：参与者自行加入（返回 participantToken）
- **有 organizerToken**：组织者添加他人（不返回 participantToken）

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 ID |
| Authorization | Header | string | - | Bearer {organizerToken}（可选） |
| name | Body | string | ✓ | 参与者姓名，max 50 |
| address | Body | string | ✓ | 地址（用户输入） |
| fuzzyLocation | Body | boolean | - | 是否模糊位置，默认 false |

**后端处理**：
1. 验证活动存在且未发布
2. 检查参与者数量上限（50人）
3. 如有 Authorization header：
   - 验证 organizerToken → 失败则 403
4. 调用 Google Geocode 获取坐标
5. 如果 fuzzyLocation=true，对坐标添加随机偏移
6. 分配颜色
7. 如**无认证**：生成 participantToken，存储 hash
8. 保存到数据库

**后端输出（成功 201）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 参与者 UUID |
| name | string | 姓名 |
| address | string | 用户输入的原始地址 |
| location | Location | { lat, lng } 坐标（后端 geocode 结果） |
| color | string | 分配的颜色 |
| fuzzyLocation | boolean | 是否模糊 |
| participantToken | string | 参与者令牌（**仅无认证时返回**，用于自管理） |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 缺少必填字段 |
| 400 | ADDRESS_NOT_FOUND | 无法解析地址 |
| 403 | FORBIDDEN | 无效的 organizerToken |
| 404 | EVENT_NOT_FOUND | 活动不存在 |
| 409 | EVENT_ALREADY_PUBLISHED | 活动已发布，不能添加 |
| 409 | PARTICIPANT_LIMIT_EXCEEDED | 参与者数量已达上限 |
| 429 | RATE_LIMIT_EXCEEDED | 请求过于频繁（仅无认证时） |

**限流规则（仅无认证时）：**
- 10 次/IP/小时
- 50 次/活动/小时

---

### 3.2 更新参与者

```
PATCH /api/events/:id/participants/:participantId
```

**说明**：支持双令牌认证 - 组织者可更新任何参与者，参与者只能更新自己。

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 ID |
| participantId | URL Path | string | ✓ | 参与者 UUID |
| Authorization | Header | string | ✓ | Bearer {organizerToken} 或 Bearer {participantToken} |
| name | Body | string | - | 新姓名 |
| address | Body | string | - | 新地址（会触发重新 geocode） |
| fuzzyLocation | Body | boolean | - | 是否模糊 |

**认证逻辑**：
1. 尝试验证为 organizerToken → 可更新任何参与者
2. 尝试验证为 participantToken → 只能更新自己（participantId 必须匹配）
3. 都不匹配 → 403 Forbidden

**后端输出（成功 200）：**

返回更新后的 Participant 对象

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | ADDRESS_NOT_FOUND | 新地址无法解析 |
| 401 | UNAUTHORIZED | 缺少认证头 |
| 403 | FORBIDDEN | 无效令牌或无权限 |
| 404 | PARTICIPANT_NOT_FOUND | 参与者不存在 |
| 409 | EVENT_ALREADY_PUBLISHED | 活动已发布，不能修改 |

---

### 3.3 移除参与者

```
DELETE /api/events/:id/participants/:participantId
```

**说明**：支持双令牌认证 - 组织者可删除任何参与者，参与者可删除自己（退出活动）。

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 ID |
| participantId | URL Path | string | ✓ | 参与者 UUID |
| Authorization | Header | string | ✓ | Bearer {organizerToken} 或 Bearer {participantToken} |

**认证逻辑**：
1. 尝试验证为 organizerToken → 可删除任何参与者
2. 尝试验证为 participantToken → 只能删除自己（participantId 必须匹配）
3. 都不匹配 → 403 Forbidden

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | true |
| message | string | "Participant deleted successfully" |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 401 | UNAUTHORIZED | 缺少认证头 |
| 403 | FORBIDDEN | 无效令牌或无权限 |
| 404 | PARTICIPANT_NOT_FOUND | 参与者不存在 |
| 409 | EVENT_ALREADY_PUBLISHED | 活动已发布，不能删除 |

---

## 四、Venue 模块

### 4.1 搜索场所

```
POST /api/venues/search
```

**前端输入：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| center | Location | ✓ | 搜索中心点 { lat, lng } |
| radius | number | ✓ | 搜索半径（米） |
| categories | string[] | - | 类别过滤 ["cafe", "restaurant", "bar", "park", "library"] |
| query | string | - | 文本搜索关键词 |
| travelMode | string | - | 出行方式 |

**后端处理**：
1. 调用 Google Places API Nearby Search 或 Text Search
2. 按距离排序
3. 返回结果

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| venues | Venue[] | 场所列表 |
| totalResults | number | 结果总数 |

**Venue 对象结构：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | Google Place ID |
| name | string | 场所名称 |
| address | string | 地址 |
| location | Location | { lat, lng } |
| category | string | 类别 |
| rating | number | 评分（0-5） |
| priceLevel | number | 价格等级（1-4） |
| photoUrl | string | 照片 URL |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 缺少必填字段 |
| 500 | EXTERNAL_SERVICE_ERROR | Google API 调用失败 |

---

### 4.2 获取场所详情

```
GET /api/venues/:id
```

**前端输入：**
| 参数 | 位置 | 说明 |
|------|------|------|
| id | URL Path | Google Place ID |

**后端输出（成功 200）：**

返回 Venue 对象（调用 Google Place Details API/ 缓存）

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 404 | NOT_FOUND | 场所不存在 |

---

## 五、Vote 模块

### 5.1 投票

```
POST /api/events/:id/votes
```

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 UUID |
| participantId | Body | string | ✓ | 投票人（参与者 UUID） |
| venueId | Body | string | ✓ | 被投的场所（Google Place ID） |
| venueData | Body | object | ✓ | 场所信息（来自 Milestone 4 Redis 缓存/Google API 响应，用于持久化存储） |

**venueData 结构：**
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 场所名称 |
| address | string | 地址 |
| lat | number | 纬度 |
| lng | number | 经度 |
| category | string | 类别 |
| rating | number | 评分 |
| priceLevel | number | 价格等级 |
| photoUrl | string | 照片 URL |

**后端处理**：
1. 验证 event 存在
2. 验证 participant 属于该 event
3. 持久化 venue 快照到数据库（如果不存在则插入）
   - 保存投票时的场所信息（历史准确性）
   - 支持外键约束和高效查询
4. 创建投票记录（重复投票通过 UNIQUE 约束自动忽略）

**缓存说明**：Milestone 4 的 `/api/venues/search` 与 `/api/venues/:id` 依旧负责 Redis 缓存；Vote 路由不直接调用 Google API，而是使用前端附带的 `venueData`，在 Redis 命中失败时由前端先调用详情 API 再来投票。

**后端输出（成功 201）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | true |
| voteId | string | 投票记录 UUID |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 缺少必填字段 |
| 404 | EVENT_NOT_FOUND | 活动不存在 |
| 404 | PARTICIPANT_NOT_FOUND | 参与者不存在 |
| 409 | ALREADY_VOTED | 已投过该场所（可选，或静默忽略） |

---

### 5.2 取消投票

```
DELETE /api/events/:id/votes
```

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 UUID |
| participantId | Body/Query | string | ✓ | 投票人 UUID |
| venueId | Body/Query | string | ✓ | 场所 ID |

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | true |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 404 | NOT_FOUND | 投票记录不存在 |

---

### 5.3 获取投票统计

```
GET /api/events/:id/votes
```

**前端输入：**
| 参数 | 位置 | 说明 |
|------|------|------|
| id | URL Path | 活动 UUID |

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| venues | VenueWithVotes[] | 场所列表（含投票数） |
| totalVotes | number | 总投票数 |

**VenueWithVotes 结构：**
| 字段 | 类型 | 说明 |
|------|------|------|
| ...Venue | - | 所有 Venue 字段 |
| voteCount | number | 该场所获得的票数 |
| voters | string[] | 投票者 ID 列表 |

**实现说明**：该统计接口只 JOIN PostgreSQL（Venue + Vote），不要为统计再次访问 Redis 或 Google API。

---

## 六、Maps 模块

### 6.1 地址转坐标

```
POST /api/geocode
```

**前端输入：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| address | string | ✓ | 用户输入的地址 |

**后端处理**：
1. 调用 Google Geocoding API
2. 缓存结果（Redis）
3. 返回标准化结果

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| address | string | 用户输入的原始地址 |
| formattedAddress | string | Google 返回的标准化地址 |
| location | Location | { lat, lng } |
| placeId | string | Google Place ID（可选） |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 缺少 address |
| 400 | ADDRESS_NOT_FOUND | 无法解析地址 |
| 500 | EXTERNAL_SERVICE_ERROR | Google API 调用失败 |

---

### 6.2 获取路线

```
POST /api/directions
```

**前端输入：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| origins | Location[] | ✓ | 起点列表 |
| destination | Location | ✓ | 终点 |
| travelMode | string | - | 出行方式：driving/walking/transit/bicycling |

**后端处理**：
1. 调用 Google Directions API
2. 计算每个起点到终点的路线
3. 缓存结果

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| routes | Route[] | 路线列表 |

**Route 结构：**
| 字段 | 类型 | 说明 |
|------|------|------|
| participantId | string | 关联的参与者 ID |
| distance | Distance | { text: "3.2 mi", value: 5200 } |
| duration | Duration | { text: "12 mins", value: 720 } |
| polyline | string | 路线编码（用于地图显示） |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 缺少必填字段 |
| 400 | ROUTE_NOT_FOUND | 无法计算路线 |
| 500 | EXTERNAL_SERVICE_ERROR | Google API 调用失败 |

---

## 七、通用结构定义

### Location
```
{
  lat: number,  // 纬度 -90 ~ 90
  lng: number   // 经度 -180 ~ 180
}
```

### Distance
```
{
  text: string,   // "3.2 mi" 或 "850 ft"（默认 imperial）
  value: number   // 5200 (米，用于计算和排序)
}
```

**单位规则**：
- `value`：始终为**米 (meters)**
- `text`：默认 **imperial**（美制）
  - < 0.1 miles → 显示 feet（如 "850 ft"）
  - ≥ 0.1 miles → 显示 miles（如 "3.2 mi"）
- 用户可在设置中切换为 metric（公制：km/m）

### Duration
```
{
  text: string,   // "12 mins"
  value: number   // 720 (秒)
}
```

### Error Response
```
{
  error: {
    code: string,     // 机器可读的错误码
    message: string   // 用户友好的错误信息
  }
}
```

---

## 八、认证方式

### 8.1 令牌类型

| 令牌类型 | 生成时机 | 存储 | 用途 |
|----------|----------|------|------|
| organizerToken | 创建活动时 | Event.organizerToken (SHA-256 hash) | 活动完全控制权 |
| participantToken | 加入活动时 | Participant.tokenHash (SHA-256 hash) | 自我管理（只能操作自己） |

### 8.2 端点认证矩阵

| 场景 | 无认证 | participantToken | organizerToken |
|------|--------|------------------|----------------|
| 创建活动 | ✓ | - | - |
| 查看活动 | ✓ | - | - |
| 修改活动 | - | - | ✓ |
| 删除活动 | - | - | ✓ |
| 发布场所 | - | - | ✓ |
| 添加参与者 | ✓（自加入，返回token） | - | ✓（添加他人） |
| 更新参与者 | - | ✓（仅自己） | ✓（任何人） |
| 删除参与者 | - | ✓（仅自己） | ✓（任何人） |
| 投票 | - | ✓ | - |

### 8.3 双令牌认证流程

参与者管理端点（PATCH/DELETE /participants/:pid）支持双令牌认证：

```
1. 提取 Authorization: Bearer {token}
2. 尝试作为 organizerToken 验证
   - 成功 → 允许操作任何参与者
3. 尝试作为 participantToken 验证
   - 成功 → 验证 participantId 匹配
   - 匹配 → 允许操作
   - 不匹配 → 403 Forbidden
4. 都失败 → 403 Forbidden
```

### 8.4 安全措施

| 措施 | 值 | 说明 |
|------|-----|------|
| 令牌长度 | 64 hex (256 bits) | 防止枚举攻击 |
| 存储方式 | SHA-256 hash | 数据库泄露不暴露原始令牌 |
| 加入限流 | 10 次/IP/小时 | 防止垃圾注册 |
| 参与者上限 | 50 人/活动 | 防止活动过载 |

---

## 九、待实现 vs 已有 Mock

| API | Mock 状态 | 说明 |
|-----|----------|------|
| POST /api/events | ✅ 已实现 | |
| GET /api/events/:id | ✅ 已实现 | |
| PATCH /api/events/:id | ✅ 已实现 | |
| DELETE /api/events/:id | ✅ 已实现 | |
| POST /api/events/:id/publish | ❌ 未实现 | 前端有调用 |
| POST /api/events/:id/participants | ✅ 已实现 | 需升级：可选认证 + participantToken |
| PATCH /api/events/:id/participants/:pid | ✅ 已实现 | 需升级为双令牌 |
| DELETE /api/events/:id/participants/:pid | ✅ 已实现 | 需升级为双令牌 |
| POST /api/venues/search | ✅ 已实现 | |
| GET /api/venues/:id | ✅ 已实现 | |
| POST /api/events/:id/votes | ❌ 未实现 | 需新增 |
| DELETE /api/events/:id/votes | ❌ 未实现 | 需新增 |
| GET /api/events/:id/votes | ❌ 未实现 | 需新增 |
| POST /api/geocode | ✅ 已实现 | |
| POST /api/directions | ✅ 已实现 | |
