# Where2Meet Backend - 数据库设计

> 原则：**只存必要的数据，不做过度设计**

---

## 一、设计原则

1. **最小化存储** - 只存业务必需的数据
2. **不存可计算的** - MEC 可以从 participants 实时算出，不单独存
3. **外部数据最小持久化** - Google Places 数据默认只在 Redis 缓存（M4），只有被投票的场所快照才会落盘 PostgreSQL（M5）
4. **简单优先** - 先跑通，再优化

---

> **两层存储沿用**：Milestone 4 架好的 Redis venue/search 缓存继续保留负责“所有搜索/详情”的短期缓存；Milestone 5 新增的 Venue 表只负责“已被投票的 event-scoped 场所快照”。它们是互补关系，而不是互相替代。

---

## 二、核心表设计

### 2.1 Event（活动）

```
┌─────────────────────────────────────────────────────────┐
│  Event                                                  │
├─────────────────────────────────────────────────────────┤
│  id                     VARCHAR(64)  PK (semantic ID)   │
│  title                  VARCHAR(100)    NOT NULL        │
│  meeting_time           TIMESTAMP       NULL            │
│  organizer_token_hash   VARCHAR(64)     NOT NULL        │
│  organizer_participant_id UUID         FK -> Participant│
│  published_venue_id     VARCHAR(255)    NULL            │
│  published_at           TIMESTAMP       NULL            │
│  created_at             TIMESTAMP       NOT NULL        │
│  updated_at             TIMESTAMP       NOT NULL        │
└─────────────────────────────────────────────────────────┘
```

| 字段                       | 类型         | 说明                                                 |
| -------------------------- | ------------ | ---------------------------------------------------- |
| `id`                       | VARCHAR(64)  | 主键，语义化 ID (格式: `evt_<timestamp>_<random16>`) |
| `title`                    | VARCHAR(100) | 活动标题                                             |
| `meeting_time`             | TIMESTAMP    | 预计见面时间（可为空）                               |
| `organizer_token_hash`     | VARCHAR(64)  | 组织者令牌哈希（用于编辑权限）                       |
| `organizer_participant_id` | UUID         | 组织者参与者 ID（用于投票）                          |
| `published_venue_id`       | VARCHAR(255) | 已发布的场所 ID（Google Place ID）                   |
| `published_at`             | TIMESTAMP    | 发布时间                                             |
| `created_at`               | TIMESTAMP    | 创建时间                                             |
| `updated_at`               | TIMESTAMP    | 更新时间                                             |

**说明**：

- `published_venue_id` 存 Google Place ID，不存完整 venue 信息
- 不存 MEC（从 participants 实时计算）
- `organizer_participant_id` 指向自动创建的组织者参与者，用于投票
- 创建活动时自动创建组织者参与者（isOrganizer=true，无位置信息）

---

### 2.2 Participant（参与者）

```
┌─────────────────────────────────────────────────────────┐
│  Participant                                            │
├─────────────────────────────────────────────────────────┤
│  id              UUID        PK                         │
│  event_id        VARCHAR(64) FK -> Event.id, NOT NULL   │
│  name            VARCHAR(50)     NOT NULL               │
│  address         VARCHAR(255)    NULL (组织者可为空)     │
│  formatted_address VARCHAR(255)  NULL                   │
│  lat             DECIMAL(10,7)   NULL (组织者可为空)     │
│  lng             DECIMAL(10,7)   NULL (组织者可为空)     │
│  fuzzy_location  BOOLEAN         DEFAULT FALSE          │
│  color           VARCHAR(20)     NOT NULL               │
│  is_organizer    BOOLEAN         DEFAULT FALSE          │
│  token_hash      VARCHAR(64)     NULL                   │
│  created_at      TIMESTAMP       NOT NULL, DEFAULT NOW  │
└─────────────────────────────────────────────────────────┘
```

| 字段                | 类型          | 说明                                                 |
| ------------------- | ------------- | ---------------------------------------------------- |
| `id`                | UUID          | 主键                                                 |
| `event_id`          | VARCHAR(64)   | 外键，关联 Event                                     |
| `name`              | VARCHAR(50)   | 参与者姓名                                           |
| `address`           | VARCHAR(255)  | 用户输入的原始地址（组织者可为空）                   |
| `formatted_address` | VARCHAR(255)  | Google 返回的标准化地址                              |
| `lat`               | DECIMAL(10,7) | 纬度（组织者可为空；MEC 计算包含所有有位置的参与者） |
| `lng`               | DECIMAL(10,7) | 经度（组织者可为空；MEC 计算包含所有有位置的参与者） |
| `fuzzy_location`    | BOOLEAN       | 是否模糊位置                                         |
| `color`             | VARCHAR(20)   | 显示颜色（如 "coral"）                               |
| `is_organizer`      | BOOLEAN       | 是否为组织者参与者                                   |
| `token_hash`        | VARCHAR(64)   | 参与者令牌哈希（SHA-256），用于自助管理              |
| `created_at`        | TIMESTAMP     | 创建时间                                             |

**说明**：

- `address`：用户输入的原始地址（如 "台北101"），组织者可为空
- `formatted_address`：Google Geocode 返回的标准化地址（如 "110台北市信義區信義路五段7號"）
- lat/lng 由后端 geocode 填入，不接受前端传入
- 如果 fuzzy_location=true，存储的是偏移后的坐标
- `is_organizer=true` 的参与者在创建活动时自动创建，无需提供位置信息
- 组织者参与者若 lat/lng 为 NULL 则不会计入 MEC；当组织者添加了位置后，将计入 MEC 计算

---

### 2.3 Venue（全局场所缓存 / Global Venue Cache）

```
┌─────────────────────────────────────────────────────────┐
│  Venue (Global, shared across all events)              │
├─────────────────────────────────────────────────────────┤
│  id              VARCHAR(255)  PK (Google Place ID)     │
│  name            VARCHAR(255)    NOT NULL               │
│  address         VARCHAR(255)    NULL                   │
│  lat             DECIMAL(10,7)   NOT NULL               │
│  lng             DECIMAL(10,7)   NOT NULL               │
│  category        VARCHAR(50)     NULL                   │
│  rating          DECIMAL(2,1)    NULL                   │
│  price_level     SMALLINT        NULL                   │
│  photo_url       TEXT            NULL                   │
│  created_at      TIMESTAMP       NOT NULL, DEFAULT NOW  │
│  updated_at      TIMESTAMP       NOT NULL, DEFAULT NOW  │
└─────────────────────────────────────────────────────────┘
```

| 字段          | 类型          | 说明                           |
| ------------- | ------------- | ------------------------------ |
| `id`          | VARCHAR(255)  | Google Place ID（主键）        |
| `name`        | VARCHAR(255)  | 场所名称                       |
| `address`     | VARCHAR(255)  | 地址                           |
| `lat`         | DECIMAL(10,7) | 纬度                           |
| `lng`         | DECIMAL(10,7) | 经度                           |
| `category`    | VARCHAR(50)   | 类别（cafe/restaurant/bar 等） |
| `rating`      | DECIMAL(2,1)  | 评分（0.0-5.0）                |
| `price_level` | SMALLINT      | 价格等级（1-4）                |
| `photo_url`   | TEXT          | 照片 URL                       |
| `created_at`  | TIMESTAMP     | 首次存储时间                   |
| `updated_at`  | TIMESTAMP     | 最后更新时间（用于刷新逻辑）   |

**设计说明**：

这是一个**全局的持久化场所缓存**，所有 event 共享同一份 venue 数据。Vote 表作为 junction table 追踪"哪些参与者在哪些活动中投了哪些场所"。

**为什么要全局存储而不是 event-scoped？**

1. **无数据重复**：同一场所不会因为多个 event 投票而重复存储
2. **跨 event 复用**：一旦某场所被任何 event 投票，所有 event 都可使用
3. **支持 venue 详情 API**：`GET /api/venues/:id` 可直接从 DB 查询（带刷新逻辑）
4. **成本优化**：5 天刷新窗口，大幅减少 Google API 调用
5. **简化架构**：一个 venue 表，Vote 表处理关系

**5 天刷新逻辑**：

```
GET /api/venues/:id 或投票时：
  1. 检查 Redis (24h TTL) → 命中则返回
  2. 检查 PostgreSQL → 存在且 updated_at < 5 天
     → 返回 DB 数据 + 写入 Redis
  3. 检查 PostgreSQL → 存在但 updated_at >= 5 天
     → 调用 Google API 刷新 + 更新 DB (updated_at) + 写入 Redis
  4. 不存在 → 调用 Google API + 插入 DB + 写入 Redis
```

**与 Redis 缓存的协作（三层架构）**：

| 数据类型                 | Redis 缓存     | PostgreSQL Venue | 说明                                      |
| ------------------------ | -------------- | ---------------- | ----------------------------------------- |
| **Venue 搜索结果**       | ✓ (1小时 TTL)  | ✗                | 临时缓存，减少 API 调用                   |
| **Venue 详情（未投票）** | ✓ (24小时 TTL) | ✗                | 临时缓存                                  |
| **Venue 详情（已投票）** | ✓ (24小时 TTL) | ✓ (5天刷新)      | **三层**：Redis → PostgreSQL → Google API |
| Geocoding 结果           | ✓ (30天 TTL)   | ✗                | 地址转坐标缓存                            |

**设计原则**：

- **Redis（M4）**：所有 Google Places API 响应缓存（搜索 1h，详情 24h）
- **PostgreSQL（M5）**：被投票的场所全局缓存（5 天刷新）
- **投票统计查询**：`Venue JOIN Vote` 一次查询搞定
- **场所详情查询**：Redis → DB (< 5天) → Google API (>= 5天或 miss)

---

### 2.4 Vote（投票追踪表 / Junction Table）

```
┌─────────────────────────────────────────────────────────┐
│  Vote (Junction table for event-participant-venue)     │
├─────────────────────────────────────────────────────────┤
│  id              UUID        PK                         │
│  event_id        VARCHAR(64) FK -> Event.id, NOT NULL   │
│  participant_id  UUID        FK -> Participant.id, NOT NULL │
│  venue_id        VARCHAR(255) FK -> Venue.id, NOT NULL  │
│  created_at      TIMESTAMP       NOT NULL, DEFAULT NOW  │
│                                                         │
│  UNIQUE (event_id, participant_id, venue_id)            │
└─────────────────────────────────────────────────────────┘
```

| 字段             | 类型         | 说明                                           |
| ---------------- | ------------ | ---------------------------------------------- |
| `id`             | UUID         | 主键                                           |
| `event_id`       | VARCHAR(64)  | 外键，关联 Event                               |
| `participant_id` | UUID         | 外键，关联 Participant（谁投的票）             |
| `venue_id`       | VARCHAR(255) | 外键，关联 **global** Venue 表（投给哪个场所） |
| `created_at`     | TIMESTAMP    | 投票时间                                       |

**设计说明**：

Vote 表是一个 **junction table**，处理 Event-Participant-Venue 之间的多对多对多关系：

- 一个 event 可以有多个 participants 投多个 venues
- 一个 participant 可以在多个 events 中投多个 venues
- 一个 venue 可以被多个 events 的多个 participants 投票

**关键特性**：

- **UNIQUE 约束**：同一个 (event, participant, venue) 只能投一次（防止重复投票）
- **多选投票**：participant 可以在同一 event 中投多个 venues
- **全局 venue 引用**：`venue_id` 引用全局 Venue 表（不是 event-scoped）
- **投票时自动创建 venue**：如果 venue 不存在，先 upsert 到 Venue 表

---

## 三、不需要单独存储的数据

| 数据类型                 | 存储方式   | 原因                                              |
| ------------------------ | ---------- | ------------------------------------------------- |
| **User 表**              | 不存       | 当前无用户系统，用 token 控制权限                 |
| **MEC 结果**             | 不存       | 可从 participants 实时计算，不需要预存            |
| **Route 结果**           | Redis 缓存 | 从 Google Directions API 实时获取，Redis 临时缓存 |
| **Places 搜索结果**      | Redis 缓存 | 临时数据，Redis 缓存（1小时 TTL）即可             |
| **Venue 详情（未投票）** | Redis 缓存 | Redis 缓存（24小时 TTL），不需持久化              |

**重要区别**：

| 场景             | Redis 缓存         | PostgreSQL 存储           |
| ---------------- | ------------------ | ------------------------- |
| 用户搜索场所     | ✓ 缓存搜索结果     | ✗ 不存储                  |
| 用户查看场所详情 | ✓ 缓存详情         | ✗ 不存储                  |
| 用户投票给场所   | ✓ 缓存详情（已有） | **✓ 持久化快照（新增）**  |
| 获取投票统计     | -                  | **✓ 直接查询 PostgreSQL** |

**设计原则**：

- Venue 表存储的是**被投票的场所快照**，不是所有搜索/查看过的场所
- 只有用户投票的场所才会持久化到数据库
- Redis 缓存（M4）和 PostgreSQL 存储（M5）是**互补的**，不是替代关系

---

## 四、索引

```sql
-- Event 表
CREATE INDEX idx_event_created_at ON event(created_at);

-- Participant 表
CREATE INDEX idx_participant_event_id ON participant(event_id);

-- Venue 表
CREATE INDEX idx_venue_event_id ON venue(event_id);

-- Vote 表
CREATE INDEX idx_vote_event_id ON vote(event_id);
CREATE INDEX idx_vote_participant_id ON vote(participant_id);
CREATE INDEX idx_vote_venue_id ON vote(venue_id);
```

---

## 五、约束

```sql
-- Event
ALTER TABLE event ADD CONSTRAINT unique_organizer_token UNIQUE (organizer_token);

-- Participant
ALTER TABLE participant ADD CONSTRAINT fk_participant_event
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE;

-- Venue
ALTER TABLE venue ADD CONSTRAINT pk_venue PRIMARY KEY (id, event_id);

ALTER TABLE venue ADD CONSTRAINT fk_venue_event
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE;

-- Vote
ALTER TABLE vote ADD CONSTRAINT fk_vote_event
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE;

ALTER TABLE vote ADD CONSTRAINT fk_vote_participant
  FOREIGN KEY (participant_id) REFERENCES participant(id) ON DELETE CASCADE;

ALTER TABLE vote ADD CONSTRAINT fk_vote_venue
  FOREIGN KEY (venue_id, event_id) REFERENCES venue(id, event_id) ON DELETE CASCADE;

ALTER TABLE vote ADD CONSTRAINT unique_vote
  UNIQUE (event_id, participant_id, venue_id);
```

**ON DELETE CASCADE**：

- 删除 Event → 自动删除所有 Participants、Venues、Votes
- 删除 Participant → 自动删除该参与者的所有 Votes
- 删除 Venue → 自动删除该场所的所有 Votes

---

## 六、ER 图

```
┌──────────────┐
│    Event     │
├──────────────┤
│ id (PK)      │◀──────────────────────────────────────────┐
│ title        │                                           │
│ meeting_time │                                           │
│ organizer_   │                                           │
│   token      │                                           │
│ published_   │                                           │
│   venue_id   │                                           │
│ published_at │                                           │
│ created_at   │                                           │
│ updated_at   │                                           │
└──────────────┘                                           │
        │                                                  │
        │ 1:N                                              │
        ▼                                                  │
┌──────────────────┐         ┌──────────────┐             │
│   Participant    │         │    Venue     │             │
├──────────────────┤         ├──────────────┤             │
│ id (PK)          │◀───┐    │ id (PK)      │◀───┐        │
│ event_id (FK)    │────┼───▶│ event_id(PK) │────┼────────┘
│ name             │    │    │ name         │    │
│ address          │    │    │ address      │    │
│ formatted_address│    │    │ lat, lng     │    │
│ lat, lng         │    │    │ category     │    │
│ fuzzy_location   │    │    │ rating       │    │
│ color            │    │    │ price_level  │    │
│ created_at       │    │    │ photo_url    │    │
└──────────────────┘    │    │ created_at   │    │
                        │    └──────────────┘    │
                        │           ▲            │
                        │           │            │
                        │    ┌──────┴───────┐    │
                        │    │     Vote     │    │
                        │    ├──────────────┤    │
                        │    │ id (PK)      │    │
                        └────│ participant_ │    │
                             │   id (FK)    │    │
                             │ venue_id(FK) │────┘
                             │ event_id(FK) │
                             │ created_at   │
                             └──────────────┘

关系说明：
• Event 1:N Participant
• Event 1:N Venue（缓存该 event 中被投票的场所）
• Event 1:N Vote
• Participant 1:N Vote（一个参与者可以投多个场所）
• Venue 1:N Vote（一个场所可以被多人投票）

生命周期：
• 删除 Event → 自动删除 Participants + Venues + Votes
```

---

## 七、数据流示例

### 创建活动

```
输入: { title, meetingTime }
  ↓
生成: id = evt_<timestamp>_<random16>, organizer_token = random(64)
  ↓
INSERT INTO event (id, title, meeting_time, organizer_token)
  ↓
返回: { id, title, meetingTime, organizerToken }
```

### 添加参与者

```
输入: { eventId, name, address, fuzzyLocation }
  ↓
Geocode address → { lat, lng, formattedAddress }
  ↓
如果 fuzzyLocation: 对 lat/lng 添加随机偏移
  ↓
生成: id = uuid(), color = nextColor()
  ↓
INSERT INTO participant (id, event_id, name, address, formatted_address, lat, lng, ...)
  ↓
返回: participant 对象
```

### 获取活动详情

```
SELECT * FROM event WHERE id = ?
  ↓
SELECT * FROM participant WHERE event_id = ?
  ↓
计算 MEC (从 participants 的 lat/lng)
  ↓
返回: { event, participants, mec }
```

### 发布场所

```
输入: { eventId, venueId, organizerToken }
  ↓
验证 organizer_token
  ↓
UPDATE event SET published_venue_id = ?, published_at = NOW()
  ↓
返回: 更新后的 event
```

### 投票流程

> 数据流：Google Places API → (M4) Redis 缓存 → 前端把 `venueData` 贴在请求体 → (M5) PostgreSQL 全局 Venue 表 (upsert) + Vote 追踪表 (insert)

```
投票:
输入: { eventId, participantId, venueId, venueData }
       │
       │  venueData = 前端传入的场所信息（从 Redis 或 Google API 获取）
       ▼
检查 event 存在
  ↓
检查 participant 属于该 event
  ↓
Upsert 全局 venue（如不存在或需要刷新）:
  SELECT * FROM venue WHERE id = ?
  如果不存在:
    INSERT INTO venue (id, name, address, lat, lng, rating, ...)
    VALUES (venueId, venueData.name, venueData.address, ...)
  如果存在但 updated_at >= 5 天:
    UPDATE venue SET name = ?, address = ?, rating = ?, updated_at = NOW()
    WHERE id = ?

    【设计说明】：
    - 全局共享，跨 event 复用
    - 5 天刷新窗口，成本优化
    - 支持 venue 详情 API 从 DB 查询
  ↓
创建投票记录（junction table）:
  INSERT INTO vote (id, event_id, participant_id, venue_id, created_at)
  VALUES (uuid(), ?, ?, ?, NOW())
  ON CONFLICT (event_id, participant_id, venue_id) DO NOTHING

  【幂等性设计】：
  - UNIQUE 约束防止重复投票
  - 前端可安全重试，不会产生重复记录
  ↓
返回: { success: true, voteId: "uuid" }

---

取消投票:
DELETE FROM vote WHERE event_id = ? AND participant_id = ? AND venue_id = ?

【注意】：不删除 venue 记录，因为：
1. Venue 是全局的，可能被其他 event 引用
2. 保留 venue 数据供将来复用（5 天内无需重新调用 API）
3. 删除 event 时会 CASCADE 删除该 event 的所有 votes（但不删除 venue）

---

获取投票统计（含场所详细信息）:
SELECT
  v.id,
  v.name,
  v.address,
  v.lat,
  v.lng,
  v.rating,
  v.photo_url,
  COUNT(vote.id) as vote_count,
  ARRAY_AGG(vote.participant_id) as voters
FROM vote
JOIN venue v ON vote.venue_id = v.id
WHERE vote.event_id = ?
GROUP BY v.id, v.name, v.address, v.lat, v.lng, v.rating, v.photo_url
ORDER BY vote_count DESC, v.rating DESC NULLS LAST

【性能优势】：
- 单次 JOIN 查询获取所有数据
- 无需调用 Google API
- 即使外部服务故障也能正常显示
- 利用全局 venue 表，数据无重复

【查询逻辑】：
- 从 Vote 表过滤出该 event 的所有投票
- JOIN 全局 Venue 表获取场所详情
- 按投票数和评分排序
```

---

## 八、后续可能扩展（暂不实现）

| 功能     | 需要的表/字段               |
| -------- | --------------------------- |
| 用户系统 | User 表，Event.organizer_id |
| 评论功能 | Comment 表                  |
| 历史记录 | Event.status 字段           |

**原则**：等需要时再加，不提前设计。
