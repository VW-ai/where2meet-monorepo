# Where2Meet Backend - API 规范

> 基于前端 codebase 分析，整理所有需要实现的 API

---

## 一、API 概览

| 模块        | 路由                                                       | 方法   | 说明                       |
| ----------- | ---------------------------------------------------------- | ------ | -------------------------- |
| Event       | /api/events                                                | POST   | 创建活动                   |
| Event       | /api/events/:id                                            | GET    | 获取活动详情               |
| Event       | /api/events/:id                                            | PATCH  | 更新活动                   |
| Event       | /api/events/:id                                            | DELETE | 删除活动                   |
| Event       | /api/events/:id/publish                                    | POST   | 发布场所                   |
| Event       | /api/events/:id/publish                                    | DELETE | 取消发布                   |
| Event       | /api/events/:id/mec                                        | GET    | 获取最小外接圆 (MEC)       |
| Participant | /api/events/:id/participants                               | POST   | 添加参与者（可选认证）     |
| Participant | /api/events/:id/participants/:participantId                | PATCH  | 更新参与者（双令牌）       |
| Participant | /api/events/:id/participants/:participantId                | DELETE | 移除参与者（双令牌）       |
| Venue       | /api/venues/search                                         | POST   | 搜索场所（用户指定中心点） |
| Venue       | /api/venues/:id                                            | GET    | 获取场所详情               |
| Vote        | /api/events/:id/participants/:participantId/votes          | POST   | 投票（仅自己）             |
| Vote        | /api/events/:id/participants/:participantId/votes/:venueId | DELETE | 取消投票（仅自己）         |
| Vote        | /api/events/:id/votes                                      | GET    | 获取投票统计               |
| Directions  | /api/events/:id/venues/:venueId/directions                 | GET    | 获取路线（事件上下文）     |
| SSE         | /api/events/:id/stream                                     | GET    | 订阅事件实时更新（需认证） |

---

## Fastify 运行时约定（依赖注入 / 错误出口 / Hooks）

> 本章节把架构规范进一步落到 Fastify 的运行时机制，确保团队写新路由时自动继承依赖注入、错误处理和横切关注点，而不是靠「大家自觉」。

### 1. 基础设施插件（依赖注入与共享客户端）

- **`plugins/db.ts`**：创建 PrismaClient，`app.decorate("db", prisma)`，在 `onClose` 中断开连接。
- **Redis**：当前实现使用模块级单例 `src/lib/redis.ts`（非 Fastify decorate）。SSE 插件内部使用 ioredis 做 pub/sub。
- **使用方式**：业务层/路由通过 `request.server.db` 访问数据库；Redis 通过 `import { redis } from "src/lib/redis"` 使用。

### 2. 统一错误出口（`setErrorHandler`）

- 所有业务异常继承 `AppError`：包含 `statusCode` + `code` + `message`，业务层只需 `throw`。
- `app.setErrorHandler` 负责：
  - **Zod/Fastify Schema 校验错误** → `400 VALIDATION_ERROR`
  - **Prisma 唯一键冲突** → `409 CONFLICT`
  - **外部服务 429/5xx** → `502/503 EXTERNAL_SERVICE_ERROR`（并写入 requestId + 原始错误）
  - **业务错误**（`EventNotFoundError` 等）→ 对应状态码/错误码
- NotFound Handler：当前未自定义（仍为 Fastify 默认），建议后续补充统一 JSON。
- 所有响应都经由统一 handler，保证脱敏 message、结构化日志（使用 requestId、eventId 等上下文）。

### 3. Lifecycle Hooks & Cross-cutting Concerns

| Hook            | 负责事项                                                        | 说明                                                        |
| --------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| `onRequest`     | requestId 注入、基础日志、全局速率限制入口                      | 结合 Pino，把 organizerToken、API Key 通过 `redact` 脱敏    |
| `preValidation` | 字符串 trim/normalize、幂等 key 解析、严格 schema               | 建议使用 `fastify-type-provider-zod`，保持 schema 单一来源  |
| `preHandler`    | 鉴权/授权（如 organizerToken 校验）、RBAC、feature flag         | 可针对 `/api/events/:id/*` 设专属 hook，集中校验 event 状态 |
| `onResponse`    | latency/状态码指标、缓存命中统计                                | 写入 Prometheus 计数器 + 结构化日志                         |
| `onSend`        | 统一响应 envelope/headers（如 `Cache-Control`、`X-Request-Id`） | 需要时可在这里做 gzip、脱敏兜底                             |

> 通过 `app.register(moduleRoutes, { prefix, onRequest: [...], preHandler: [...] })` 将 hook 精准作用在模块级别，保持「分层边界」与「运行时机制」一致。

### 4. 额外生产级防护（推荐）

- **资源关闭**：所有插件在 `onClose` 中优雅关闭，配合 `vitest`/`app.inject` 避免句柄泄漏。
- **日志脱敏**：Pino `redact` 针对 `organizerToken`、地址、Google API Key 等敏感字段。
- **Schema 单一来源**：Zod → JSON Schema（`fastify-type-provider-zod`）以便既做校验又生成类型/文档。
- **测试首选 `app.inject`**：无需监听端口，直接注入请求，搭配自定义插件便于替换依赖。
- **外部调用并发阀门**：对 Places/Directions 调用增加信号量/队列，防止瞬时压爆配额。

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
| meetingTime | string | - | 预计见面时间（ISO 8601），可选 |

**后端输出（成功 201）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 活动 ID (格式: `evt_<timestamp>_<random16>`) |
| title | string | 活动标题 |
| meetingTime | string \| null | 预计见面时间 |
| organizerToken | string | 组织者令牌（仅创建时返回） |
| organizerParticipantId | string | 组织者参与者 ID（用于投票） |
| participants | array | 参与者列表（包含组织者，isOrganizer=true） |
| mec | object \| null | 最小外接圆（MEC），包含所有有位置的参与者 |
| publishedVenueId | string \| null | 已发布场所 ID |
| publishedAt | string \| null | 发布时间 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |
| settings | object | 活动设置 |

**说明**：创建活动时自动创建组织者参与者（isOrganizer=true，初始无位置信息），用于投票。MEC 计算包含所有具备有效坐标的参与者；当组织者添加了位置后，也会计入 MEC。

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
| id | URL Path | 活动 ID |

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 活动 ID |
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
| id | URL Path | string | ✓ | 活动 ID |
| Authorization | Header | string | ✓ | Bearer {organizerToken} |
| title | Body | string | - | 新标题 |
| meetingTime | Body | string | - | 新时间（可置为 null） |

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
| id | URL Path | 活动 ID |
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
| id | URL Path | string | ✓ | 活动 ID |
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

### 2.6 获取最小外接圆 (MEC)

```
GET /api/events/:id/mec
```

**说明**：返回参与者位置的最小外接圆 (Minimum Enclosing Circle)，用于前端显示搜索区域建议。

**前端输入：**
| 参数 | 位置 | 说明 |
|------|------|------|
| id | URL Path | 活动 ID |

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| center | Location \| null | MEC 圆心坐标（无参与者位置时为 null） |
| radiusMeters | number \| null | MEC 半径（米）（无参与者位置时为 null） |

**使用场景**：

1. 前端调用此端点获取建议的搜索区域
2. 用户可以接受 MEC 建议或手动拖动搜索圆
3. 用户选定位置后调用 `POST /api/venues/search` 进行搜索

**边界情况**：

- 0 个参与者有位置 → `{ center: null, radiusMeters: null }`
- 1 个参与者 → `{ center: 该点, radiusMeters: 0 }`
- 2+ 个参与者 → Welzl 算法计算 MEC

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 404 | EVENT_NOT_FOUND | 活动不存在 |

### 2.7 取消发布

```
DELETE /api/events/:id/publish
```

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 ID |
| Authorization | Header | string | ✓ | Bearer {organizerToken} |

**后端输出（成功 200）：**

返回更新后的 Event 对象（publishedVenueId 和 publishedAt 置为 null）

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 401 | UNAUTHORIZED | 缺少或无效的 token |
| 403 | FORBIDDEN | 无权限操作 |
| 404 | NOT_FOUND | 活动不存在 |
| 409 | NOT_PUBLISHED | 活动未发布，无法取消 |

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
2. 如有 Authorization header：验证 organizerToken（失败则 403）
3. 调用 Google Geocoding 获取坐标（内部服务）
4. 如果 fuzzyLocation=true，对坐标添加随机偏移
5. 分配颜色
6. 如**无认证**：生成 participantToken，存储 hash
7. 保存到数据库

**后端输出（成功 201）：**

| 字段             | 类型     | 说明                                         |
| ---------------- | -------- | -------------------------------------------- |
| id               | string   | 参与者 UUID                                  |
| name             | string   | 姓名                                         |
| address          | string   | 用户输入的原始地址                           |
| location         | Location | { lat, lng } 坐标（后端 geocode 结果）       |
| color            | string   | 分配的颜色                                   |
| fuzzyLocation    | boolean  | 是否模糊                                     |
| participantToken | string   | 参与者令牌（**仅无认证时返回**，用于自管理） |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 缺少必填字段 |
| 400 | ADDRESS_NOT_FOUND | 无法解析地址 |
| 403 | FORBIDDEN | 无效的 organizerToken |
| 404 | EVENT_NOT_FOUND | 活动不存在 |
| 409 | EVENT_ALREADY_PUBLISHED | 活动已发布，不能添加 |

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

**补充**：不能删除组织者（Organizer）。

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

**说明**：根据用户指定的搜索中心点和半径搜索附近场所。搜索中心由前端提供（可来自 MEC 端点建议或用户手动指定）。

**前端输入：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| center | Location | ✓ | 搜索中心点 { lat: -90~90, lng: -180~180 } |
| searchRadius | number | ✓ | 搜索半径（米），100~50000 |
| categories | string[] | - | 类别过滤 ["cafe", "restaurant", "bar", "park", "library", "gym", "museum", "shopping", "things_to_do"] |
| query | string | - | 文本搜索关键词（1-100 字符） |

**注意**：`query` 和 `categories` 至少需要提供一个。

**后端处理**：

1. 验证 center 坐标范围、searchRadius 范围
2. 调用 Google Places API Nearby Search（categories）或 Text Search（query）
3. 按评分排序（高到低，null 评分排最后）
4. 返回结果

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| venues | Venue[] | 场所列表 |
| totalResults | number | 结果总数 |
| searchCenter | Location | 搜索中心点（与输入 center 相同） |

**Venue 对象结构：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | Google Place ID |
| name | string | 场所名称 |
| address | string | 地址 |
| location | Location | { lat, lng } |
| types | string[] | Google Place Types |
| rating | number \| null | 评分（0-5） |
| userRatingsTotal | number \| null | 评分总数 |
| priceLevel | number \| null | 价格等级（0-4） |
| openNow | boolean \| null | 是否营业中 |
| photoUrl | string \| null | 照片 URL |

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
POST /api/events/:id/participants/:participantId/votes
```

**认证**：必须使用 `participantToken` 或 `organizerToken`，且只能为自己投票（participantId 必须匹配认证身份）。

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 ID |
| participantId | URL Path | string | ✓ | 投票人（参与者 UUID，必须是自己） |
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

1. 验证认证令牌（organizerToken 或 participantToken）
2. 验证 participantId 与认证身份匹配（只能为自己投票）
3. 验证 event 存在
4. 验证 participant 属于该 event
5. 持久化 venue 快照到数据库（如果不存在则插入）
6. 创建投票记录（幂等：重复投票通过 UNIQUE 约束返回已有记录，不报错）

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
| 401 | UNAUTHORIZED | 缺少认证令牌 |
| 403 | FORBIDDEN | 无权为他人投票 |
| 404 | EVENT_NOT_FOUND | 活动不存在 |
| 404 | PARTICIPANT_NOT_FOUND | 参与者不存在 |

---

### 5.2 取消投票

```
DELETE /api/events/:id/participants/:participantId/votes/:venueId
```

**认证**：必须使用 `participantToken` 或 `organizerToken`，且只能取消自己的投票（participantId 必须匹配认证身份）。

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 ID |
| participantId | URL Path | string | ✓ | 投票人 UUID（必须是自己） |
| venueId | URL Path | string | ✓ | 场所 ID |

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | true |
| deleted | boolean | 是否实际删除了投票 |

**说明**：幂等，若记录不存在也返回 200（deleted=false）。

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 401 | UNAUTHORIZED | 缺少认证令牌 |
| 403 | FORBIDDEN | 无权取消他人投票 |

---

### 5.3 获取投票统计

```
GET /api/events/:id/votes
```

**前端输入：**
| 参数 | 位置 | 说明 |
|------|------|------|
| id | URL Path | 活动 ID |

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| venues | VenueWithVotes[] | 场所列表（含投票数） |
| totalVotes | number | 总投票数 |

**VenueWithVotes 结构：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 场所 ID |
| name | string | 场所名称 |
| address | string \| null | 地址 |
| location | Location | { lat, lng } |
| category | string \| null | 类别（数据库快照） |
| rating | number \| null | 评分 |
| priceLevel | number \| null | 价格等级 |
| photoUrl | string \| null | 照片 |
| voteCount | number | 该场所获得的票数 |
| voters | string[] | 投票者 ID 列表 |

**实现说明**：该统计接口只 JOIN PostgreSQL（Venue + Vote），不要为统计再次访问 Redis 或 Google API。

---

## 六、Directions 模块

### 6.1 获取路线（事件上下文）

```
GET /api/events/:id/venues/:venueId/directions
```

**Query 参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| travelMode | string | - | driving/walking/transit/bicycling（默认 driving） |
| participantId | string | - | 可选，仅计算某一参与者（UUID） |

**认证**：需要 Authorization: Bearer {organizerToken 或 participantToken}（需属于该活动）。

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| venueId | string | 目的地场所 ID |
| travelMode | string | 出行方式 |
| routes | Route[] | 路线列表 |

**Route 结构：**
| 字段 | 类型 | 说明 |
|------|------|------|
| participantId | string | 参与者 ID（UUID） |
| distance | Distance | { value: 米, text: 文本 } |
| duration | Duration | { value: 秒, text: 文本 } |
| polyline | string | 路线编码（用于地图显示） |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 参数格式错误 |
| 400 | INVALID_VENUE | 场所 ID 无效 |
| 404 | EVENT_NOT_FOUND | 活动不存在 |
| 404 | PARTICIPANT_NOT_FOUND | 指定参与者不存在/无可用位置 |
| 500 | EXTERNAL_SERVICE_ERROR | Google API 调用失败 |

**说明**：起点数据来自活动内参与者（过滤掉 organizer 与无坐标者）。

---

## 七、SSE 模块

### 7.1 订阅事件实时更新

```
GET /api/events/:id/stream
```

**认证**：需要 Authorization: Bearer {organizerToken 或 participantToken}。

**响应头**：`Content-Type: text/event-stream`

**事件类型（示例）**：

- `event:updated`：活动字段变更（title/meetingTime/publish 状态）
- `event:published`：活动发布并携带发布场所的基本信息
- `participant:added|updated|removed`：参与者变更
- `vote:statistics`：投票统计刷新

---

## 八、通用结构定义

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

## 九、认证方式

### 9.1 令牌类型

| 令牌类型         | 生成时机   | 存储                                 | 用途                     |
| ---------------- | ---------- | ------------------------------------ | ------------------------ |
| organizerToken   | 创建活动时 | Event.organizerToken (SHA-256 hash)  | 活动完全控制权           |
| participantToken | 加入活动时 | Participant.tokenHash (SHA-256 hash) | 自我管理（只能操作自己） |

### 9.2 端点认证矩阵

| 场景         | 无认证                 | participantToken | organizerToken                             |
| ------------ | ---------------------- | ---------------- | ------------------------------------------ |
| 创建活动     | ✓                      | -                | -                                          |
| 查看活动     | ✓                      | -                | -                                          |
| 修改活动     | -                      | -                | ✓                                          |
| 删除活动     | -                      | -                | ✓                                          |
| 发布场所     | -                      | -                | ✓                                          |
| 添加参与者   | ✓（自加入，返回token） | -                | ✓（添加他人）                              |
| 更新参与者   | -                      | ✓（仅自己）      | ✓（任何人）                                |
| 删除参与者   | -                      | ✓（仅自己）      | ✓（任何人）                                |
| 投票         | -                      | ✓（仅自己）      | ✓（仅自己，需使用 organizerParticipantId） |
| 取消投票     | -                      | ✓（仅自己）      | ✓（仅自己，需使用 organizerParticipantId） |
| 查看投票统计 | ✓                      | -                | -                                          |
| 订阅 SSE     | -                      | ✓                | ✓                                          |
| 获取路线     | -                      | ✓（属于该活动）  | ✓                                          |

**投票说明**：组织者创建活动时自动获得 `organizerParticipantId`，投票时使用此 ID。组织者不能代替其他参与者投票。

### 9.3 双令牌认证流程

参与者管理端点（PATCH/DELETE /participants/:participantId）支持双令牌认证：

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

### 9.4 安全措施

| 措施       | 值                | 说明                     |
| ---------- | ----------------- | ------------------------ |
| 令牌长度   | 64 hex (256 bits) | 防止枚举攻击             |
| 存储方式   | SHA-256 hash      | 数据库泄露不暴露原始令牌 |
| 加入限流   | -                 | 暂未实现（可按需添加）   |
| 参与者上限 | -                 | 暂未实现（可按需添加）   |

---

## 十、待实现 vs 已有实现

| API                                                               | Mock 状态 | 说明                        |
| ----------------------------------------------------------------- | --------- | --------------------------- |
| POST /api/events                                                  | ✅ 已实现 |                             |
| GET /api/events/:id                                               | ✅ 已实现 |                             |
| PATCH /api/events/:id                                             | ✅ 已实现 |                             |
| DELETE /api/events/:id                                            | ✅ 已实现 |                             |
| POST /api/events/:id/publish                                      | ✅ 已实现 |                             |
| DELETE /api/events/:id/publish                                    | ✅ 已实现 |                             |
| GET /api/events/:id/mec                                           | ✅ 已实现 | 返回 MEC（可为 null）       |
| POST /api/events/:id/participants                                 | ✅ 已实现 | 可选认证 + participantToken |
| PATCH /api/events/:id/participants/:participantId                 | ✅ 已实现 | 双令牌认证                  |
| DELETE /api/events/:id/participants/:participantId                | ✅ 已实现 | 双令牌认证                  |
| POST /api/venues/search                                           | ✅ 已实现 | 用户提供 center 坐标        |
| GET /api/venues/:id                                               | ✅ 已实现 |                             |
| POST /api/events/:id/participants/:participantId/votes            | ✅ 已实现 | 仅自己投票                  |
| DELETE /api/events/:id/participants/:participantId/votes/:venueId | ✅ 已实现 | 仅自己取消                  |
| GET /api/events/:id/votes                                         | ✅ 已实现 | 公开统计                    |
| GET /api/events/:id/venues/:venueId/directions                    | ✅ 已实现 | 需认证                      |
| GET /api/events/:id/stream                                        | ✅ 已实现 | 需认证（SSE）               |
