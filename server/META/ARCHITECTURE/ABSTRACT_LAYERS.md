# Where2Meet Backend - 分层架构与安全设计

> 核心原则：**实现功能只是最小的一部分，真正要做的是在每一层都不信任输入，并谨慎对待输出。**

---

## 目录

1. [整体架构](#一整体架构)
2. [DTO 层设计](#二dto-层设计)
3. [输入验证](#三输入验证不信任任何外部数据)
4. [输出处理](#四输出处理谨慎暴露信息)
5. [安全机制](#五安全机制)
6. [数据一致性](#六数据一致性)
7. [外部服务集成](#七外部服务集成)
8. [可观测性](#八可观测性)
9. [Where2Meet 开发 Checklist](#九where2meet-开发-checklist)

---

## 一、整体架构

### 分层模型

```
┌─────────────────────────────────────────────────────────────────┐
│                        外部世界 (完全不可信)                       │
│                   浏览器 / 移动端 / 第三方调用                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Controller / Route 层                                          │
│  ─────────────────────────────────────────────────────────────  │
│  职责：HTTP 请求解析、Schema 校验、鉴权、限流、请求日志             │
│  原则：完全当成垃圾数据对待                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ 只传递「干净的、已校验的 DTO」
┌─────────────────────────────────────────────────────────────────┐
│  Service 层                                                     │
│  ─────────────────────────────────────────────────────────────  │
│  职责：业务逻辑、存在性校验、状态约束、权限检查、调用外部服务、事务    │
│  原则：只接受已校验的 DTO，但仍检查「系统状态相关」的部分              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Repository 层                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  职责：数据库 CRUD、查询构建、事务执行                              │
│  原则：只接受内部 domain 对象，不直接暴露到 HTTP                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  外部集成层                                                      │
│  ─────────────────────────────────────────────────────────────  │
│  Google Maps API / Redis / 邮件服务                              │
│  原则：不信任外部服务永远可用或返回正确数据                          │
└─────────────────────────────────────────────────────────────────┘
```

### 层间契约原则

每一层都必须声明清楚：**「我保证什么 / 不保证什么」**

**Service 层契约示例**：
- `EventService.createParticipant()`
  - 保证：返回的 participant 包含有效的 geocoded location；MEC 已触发重算
  - 可能抛出：EventNotFoundError、AddressNotFoundError、EventPublishedError

**外部服务契约示例**：
- `MapsService.geocode()`
  - 保证：返回标准化的 `{ lat, lng, formattedAddress }`，坐标在有效范围内
  - 可能抛出：AddressNotFoundError、ExternalServiceError
  - 不保证：不把 Google 原始错误直接传出

---

## 二、DTO 层设计

### 2.1 什么是 DTO？

DTO（Data Transfer Object）是专门用于层间数据传输的对象，职责是：

| 类型 | 职责 | 位置 |
|------|------|------|
| **Request DTO** | 定义外部请求的数据结构和校验规则 | Controller 入口 |
| **Response DTO** | 定义返回给客户端的数据结构 | Controller 出口 |
| **Internal DTO** | Service 层间传递的内部数据结构 | Service 层内部 |

### 2.2 为什么需要 DTO？

**不用 DTO 的问题**：
- 直接暴露 DB 实体 → 泄露内部字段（如 organizerToken）
- 校验逻辑散落各处 → 难以维护
- 层间耦合 → 改 DB schema 影响 API 响应

**使用 DTO 的好处**：
- 明确的数据契约
- 集中的转换逻辑
- 解耦 DB schema 和 API 响应

### 2.3 DTO 与 Zod Schema 的关系

在 TypeScript + Zod 项目中，推荐方式：

```typescript
// src/schemas/event.ts - Request DTO (Zod schemas)
export const CreateEventSchema = z.object({
  title: z.string().min(1).max(100),
  meetingTime: z.iso.datetime().optional(),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

// src/types/responses.ts - Response DTO (TypeScript interfaces)
export interface EventResponse {
  id: string;
  title: string;
  meetingTime: string | null;
  participants: ParticipantResponse[];
  mec: MECResponse | null;
  // 注意：不包含 organizerToken
}

// Response DTO 在创建时特殊处理
export interface CreateEventResponse extends EventResponse {
  organizerToken: string;  // 仅创建时返回
}
```

### 2.4 转换函数

集中管理 DB Entity → Response DTO 的转换：

```typescript
// src/mappers/event.mapper.ts
export function toEventResponse(entity: EventWithParticipants): EventResponse {
  return {
    id: entity.id,
    title: entity.title,
    meetingTime: entity.meetingTime?.toISOString() ?? null,
    participants: entity.participants.map(toParticipantResponse),
    mec: entity.mecCenter ? toMECResponse(entity) : null,
  };
}

export function toParticipantResponse(entity: Participant): ParticipantResponse {
  return {
    id: entity.id,
    name: entity.name,
    address: entity.address,
    // Nullable for organizer participants (no location)
    location: entity.lat !== null && entity.lng !== null
      ? { lat: Number(entity.lat), lng: Number(entity.lng) }
      : null,
    color: entity.color,
    fuzzyLocation: entity.fuzzyLocation,
    isOrganizer: entity.isOrganizer,  // true for auto-created organizer
  };
}
```

### 2.5 数据流中的 DTO

```
外部请求 (JSON)
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Controller 层                                                   │
│  ─────────────────────────────────────────────────────────────  │
│  1. Zod Schema 校验 → Request DTO (CreateEventInput)             │
│  2. 调用 Service 层                                              │
│  3. 接收内部对象，调用 Mapper → Response DTO                       │
└─────────────────────────────────────────────────────────────────┘
      │                                           │
      ▼ Request DTO                               ▼ Response DTO
┌─────────────────────────────────────────────────────────────────┐
│  Service 层                                                      │
│  ─────────────────────────────────────────────────────────────  │
│  接收 Request DTO，返回 DB Entity 或 Internal DTO                 │
│  业务逻辑处理，不关心 HTTP 响应格式                                 │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Repository 层                                                   │
│  ─────────────────────────────────────────────────────────────  │
│  操作 DB Entity (Prisma model)                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.6 文件组织

推荐的文件结构：

```
src/
├── schemas/           # Request DTOs (Zod schemas)
│   ├── event.ts
│   ├── participant.ts
│   └── venue.ts
├── types/
│   ├── responses.ts   # Response DTO interfaces
│   ├── errors.ts      # Error types
│   └── internal.ts    # Internal DTOs (Service 层间)
├── mappers/           # Entity → Response DTO 转换
│   ├── event.mapper.ts
│   ├── participant.mapper.ts
│   └── venue.mapper.ts
├── services/          # 业务逻辑
├── repositories/      # 数据访问
└── routes/            # Controller (Fastify routes)
```

### 2.7 Where2Meet 具体示例

| 场景 | Request DTO | Response DTO |
|------|-------------|--------------|
| 创建活动 | `CreateEventInput` | `CreateEventResponse` (含 token + organizerParticipantId) |
| 获取活动 | `EventIdParams` | `EventResponse` (不含 token) |
| 添加参与者 | `AddParticipantInput` | `ParticipantResponse` |
| 搜索场所 | `VenueSearchInput` | `VenueSearchResponse` |
| 投票 | `CastVoteBody` (venueId + venueData) | `VoteResponse` |
| 取消投票 | URL params only | `VoteRemovalResponse` |
| 获取投票统计 | `EventIdParams` | `VoteStatisticsResponse` |

**注意**：创建活动时会自动创建 organizer 参与者（无位置），返回 `organizerParticipantId` 供投票使用。

---

## 三、输入验证：不信任任何外部数据

### 3.1 HTTP 输入校验（Controller 层）

| 校验项 | 说明 |
|--------|------|
| **必填字段** | 明确标注，空字符串视为无效 |
| **长度限制** | 所有字符串设置 max length（title ≤ 100, address ≤ 255） |
| **类型校验** | ID 必须是合法 UUID，日期必须是 ISO 8601 |
| **数值范围** | lat: -90~90, lng: -180~180 |
| **拒绝多余字段** | 使用 strict mode，防止注入 `isAdmin: true` |
| **Trim** | 字符串自动去除首尾空格 |

**幂等性支持**：POST 请求可选支持 `idempotencyKey`，防止网络重试导致重复创建

### 3.2 业务层二次防御（Service 层）

即使 Controller 校验过，Service 层仍需检查「系统状态相关」的部分：

| 检查类型 | 示例 |
|----------|------|
| **存在性校验** | eventId 必须在 DB 存在 |
| **状态约束** | 已 published 的 event 不能添加参与者 |
| **数量限制** | 参与者不能超过 MAX_PARTICIPANTS |
| **权限检查** | 只有 organizer 能删除 event |

#### Where2Meet 特有规则

| 规则 | 原因 |
|------|------|
| **不接受前端传的 lat/lng** | 防止用户伪造位置「作弊」，防止浮点异常攻击 |
| **不接受前端传的 MEC 结果** | 后端统一计算，保证一致性 |
| **不接受前端传的 route 结果** | 同上 |

所有坐标以服务端 geocode 的结果为准。

### 3.3 外部 API 输入校验

不要假设外部服务返回的数据一定正确：

| 服务 | 需要处理的情况 |
|------|----------------|
| **Google Geocode** | 可能返回 0 个结果、多个结果、精度不够的结果 |
| **Google Directions** | 可能 partial failure，某些路线不可达 |
| **Google Places** | 可能返回过期数据、缺少某些字段 |
| **Redis** | 可能网络超时、数据不存在 |
| **Database** | 约束冲突 (409)、临时错误 (500) 需要区分处理 |

---

## 四、输出处理：谨慎暴露信息

### 4.1 响应 DTO 映射

**永远不要直接返回数据库记录**

| 做法 | 原因 |
|------|------|
| 定义专门的 Response DTO | 控制暴露的字段 |
| 隐藏内部字段 | organizerToken、updatedAt、内部 ID 不必暴露 |
| 统一格式 | 枚举/状态用前端友好的值 |
| 解耦 DB schema | 未来改 DB 不会直接导致 API 变化 |

### 4.2 距离/时间单位标准化

**原则**：后端统一用国际单位，前端负责本地化显示

| 数据类型 | 后端存储/传输 | 前端显示（默认） | 用户可选 |
|---------|--------------|-----------------|---------|
| 距离 | **meters (number)** | miles / feet | 可切换为 km / m |
| 时间 | **seconds (number)** | mins / hours | - |
| 坐标 | lat/lng (decimal) | - | - |

**API 响应格式**：
- `value`：数值（米/秒），用于计算和排序
- `text`：已格式化字符串（默认 imperial），用于直接显示

**为什么默认 imperial（英制）？**
- 目标用户主要在美国
- 用户设置可切换为 metric（公制）

---

### 4.3 错误响应标准化

**对外：简洁统一**

```
{
  "error": {
    "code": "EVENT_NOT_FOUND",      // 机器可读
    "message": "Event does not exist" // 用户友好
  }
}
```

错误码分类：
- 通用：VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, FORBIDDEN, CONFLICT, INTERNAL_ERROR
- 业务：EVENT_NOT_FOUND, PARTICIPANT_NOT_FOUND, ADDRESS_NOT_FOUND, EVENT_ALREADY_PUBLISHED

**对内：详细日志**

记录完整 stack trace、请求 ID、用户/event ID、外部服务原始错误，但不暴露给前端。

---

## 五、安全机制

### 5.1 鉴权与授权

#### 模式一：无账号，基于链接 Token（初期）

| 链接类型 | 权限 | 实现 |
|----------|------|------|
| 编辑链接 | 完整权限 | URL 带 `?token={organizerToken}` |
| 只读链接 | 只能查看、添加自己 | 普通 `/meet/{id}` |

关键：**organizerToken 只存后端**，不暴露给普通参与者

#### 模式二：用户账号（未来）

- JWT 验证
- `event.organizerId === currentUser.id` 检查

**原则**：永远不信任前端传的 `isOrganizer: true`

#### 投票权限：selfOnly 模式

投票端点使用特殊的 `selfOnly` 认证模式，防止代投：

| 操作 | 认证要求 | 说明 |
|------|----------|------|
| 投票 | participantId 必须匹配 token | 只能为自己投票 |
| 取消投票 | participantId 必须匹配 token | 只能取消自己的票 |
| 查看统计 | 无需认证 | 公开数据 |

**实现**：`createVerifyParticipantAccess({ selfOnly: true })`

```typescript
// Organizer 也必须使用自己的 participantId
// 其 tokenHash = organizerTokenHash，通过 verifyParticipantToken 验证
POST /api/events/:eventId/participants/:participantId/votes
Authorization: Bearer {organizerToken 或 participantToken}
```

**关键**：Organizer 在创建活动时自动获得一个 participantId（无位置），用于投票。

### 5.2 Rate Limiting

| 接口 | 限制 | 原因 |
|------|------|------|
| 全局 | 100 次/15分钟/IP | 基础防护 |
| POST /events | 10 次/小时/IP | 防止滥用创建 |
| Geocode/Directions | 30 次/分钟/IP | 保护 Google API 配额 |

防止有人拿你当「免费 Google Maps Proxy」。

---

## 六、数据一致性

### 6.1 数据库约束

| 约束类型 | 示例 |
|----------|------|
| Unique | organizerToken 唯一 |
| Foreign Key | participant.eventId → event.id |
| onDelete | Cascade（删 event 自动删 participants） |
| 长度限制 | VARCHAR(100) for title |

不要只靠业务代码保证「不重复」，DB 层要有约束。

### 6.2 事务处理

需要事务的场景：
- 添加 participant + 更新 MEC
- 发布 venue + 更新 event 状态
- 批量操作

### 6.3 并发处理

场景：两个人同时添加 participant

决策点：
- 是否接受短暂的 MEC 不一致？（可以，下次操作重算）
- 是否需要乐观锁？（看业务需求）

**原则**：设计时先想清楚能接受什么程度的「最终一致性」

---

## 七、外部服务集成

### 7.1 Google Maps 服务要求

| 要求 | 说明 |
|------|------|
| **缓存** | Redis 缓存 geocode/directions 结果，设置合理 TTL |
| **并发限制** | 最大同时 N 个请求，避免超配额 |
| **Retry + Backoff** | 429/5xx 时指数退避重试 |
| **错误分类** | 400 不重试，429/5xx 重试 |

### 7.2 降级策略

| 场景 | 降级方案 |
|------|----------|
| Geocode 失败 | 返回错误，让用户重试或换地址 |
| Places 搜索失败 | 返回缓存的/预设的 venue 数据 |
| Directions 失败 | 只显示直线距离，不显示路线 |

**原则**：外部服务挂了不能导致整个页面白屏

### 7.3 缓存注意点

| 点 | 说明 |
|----|------|
| 不信任一定命中 | miss 时正确回源 |
| 不信任一定成功 | 写缓存失败不影响主流程 |
| 不信任永远正确 | 设置合理 TTL |

---

## 八、可观测性

### 8.1 结构化日志

每个请求记录：
- requestId（贯穿整个请求链路）
- 路由 + HTTP 方法 + 状态码
- 关键业务 ID（eventId, participantId）
- 耗时

错误时额外记录：
- error name, message, stack
- 外部调用类型和原始错误（脱敏后）

### 8.2 指标收集

| 指标 | 用途 |
|------|------|
| Google API 成功率 | 监控外部服务健康 |
| Google API 延迟 | 性能监控 |
| 缓存命中率 | 优化缓存策略 |
| 4xx vs 5xx 比例 | 区分用户错误和系统错误 |

### 8.3 错误分级

| 级别 | 含义 | 告警 |
|------|------|------|
| 4xx | 用户输入问题 | 不需要告警 |
| 5xx | 系统/外部服务问题 | 需要告警 |

---

## 九、Where2Meet 开发 Checklist

### DTO 层
- [ ] Request DTO 使用 Zod schemas 定义 (`src/schemas/`)
- [ ] Response DTO 使用 TypeScript interfaces 定义 (`src/types/responses.ts`)
- [ ] Mapper 函数集中管理转换逻辑 (`src/mappers/`)
- [ ] 不直接返回 Prisma entity 给客户端
- [ ] organizerToken 只在创建响应中返回

### 输入验证
- [ ] 所有 HTTP 输入用 Schema 校验（Zod）
- [ ] 使用 strict mode 拒绝多余字段
- [ ] ID 参数校验为合法 UUID
- [ ] 字符串设置合理的长度限制
- [ ] lat/lng 校验在有效范围 (-90~90, -180~180)

### 业务逻辑
- [ ] Service 层检查 entity 存在性
- [ ] 检查状态约束（已发布不能改）
- [ ] **不接受前端传的坐标**，统一后端 geocode
- [ ] **不接受前端传的 MEC 结果**，后端计算
- [ ] **不接受前端传的 route 结果**，后端计算

### 权限控制
- [ ] 区分「编辑链接」与「只读链接」
- [ ] organizerToken 不暴露给普通参与者
- [ ] 后端验证 token，不信任前端声明
- [ ] 敏感操作需要 organizer 权限
- [ ] 投票端点使用 selfOnly 模式（只能为自己投票）
- [ ] Organizer 自动创建为参与者（无位置），用于投票

### 外部服务
- [ ] Google API 调用加缓存（Redis）
- [ ] 设置并发限制
- [ ] 实现 retry + exponential backoff
- [ ] 处理空结果/部分失败
- [ ] 设计优雅降级策略

### 数据层
- [ ] DB 设置 unique / foreign key 约束
- [ ] 关键操作使用事务
- [ ] 考虑并发修改场景

### 输出
- [ ] 定义 Response DTO，不直接返回 DB 记录
- [ ] 统一错误响应格式
- [ ] 错误信息脱敏
- [ ] 日志记录完整错误详情

### 安全
- [ ] Rate limiting（全局 + 关键接口）
- [ ] Secrets 通过环境变量注入
- [ ] Google API Key 不暴露给前端

### 可观测性
- [ ] 结构化日志（requestId 贯穿）
- [ ] Google API 调用监控
- [ ] 缓存命中率监控
- [ ] 错误分级告警

---

## 附录：推荐技术栈

| 层级 | 推荐 |
|------|------|
| HTTP 框架 | Fastify (性能) 或 Express (生态) |
| 校验 | Zod |
| ORM | Prisma |
| 缓存 | Redis |
| 日志 | Pino |
| 指标 | Prometheus |
| Rate Limit | @fastify/rate-limit |
| 测试 | Vitest + Supertest |
