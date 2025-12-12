# Where2Meet Backend - 数据库设计

> 原则：**只存必要的数据，不做过度设计**

---

## 一、设计原则

1. **最小化存储** - 只存业务必需的数据
2. **不存可计算的** - MEC 可以从 participants 实时算出，不单独存
3. **不存外部数据** - Venue 详情从 Google API 获取，不存本地
4. **简单优先** - 先跑通，再优化

---

## 二、核心表设计

### 2.1 Event（活动）

```
┌─────────────────────────────────────────────────────────┐
│  Event                                                  │
├─────────────────────────────────────────────────────────┤
│  id              UUID        PK                         │
│  title           VARCHAR(100)    NOT NULL               │
│  meeting_time    TIMESTAMP       NULL                   │
│  organizer_token VARCHAR(64)     NOT NULL, UNIQUE       │
│  published_venue_id  VARCHAR(255)  NULL                 │
│  published_at    TIMESTAMP       NULL                   │
│  created_at      TIMESTAMP       NOT NULL, DEFAULT NOW  │
│  updated_at      TIMESTAMP       NOT NULL, DEFAULT NOW  │
└─────────────────────────────────────────────────────────┘
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `title` | VARCHAR(100) | 活动标题 |
| `meeting_time` | TIMESTAMP | 预计见面时间（可为空） |
| `organizer_token` | VARCHAR(64) | 组织者令牌（用于编辑权限） |
| `published_venue_id` | VARCHAR(255) | 已发布的场所 ID（Google Place ID） |
| `published_at` | TIMESTAMP | 发布时间 |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

**说明**：
- `published_venue_id` 存 Google Place ID，不存完整 venue 信息
- 不存 MEC（从 participants 实时计算）
- 不存 organizer_id（当前无用户系统）

---

### 2.2 Participant（参与者）

```
┌─────────────────────────────────────────────────────────┐
│  Participant                                            │
├─────────────────────────────────────────────────────────┤
│  id              UUID        PK                         │
│  event_id        UUID        FK -> Event.id, NOT NULL   │
│  name            VARCHAR(50)     NOT NULL               │
│  address         VARCHAR(255)    NOT NULL               │
│  formatted_address VARCHAR(255)  NULL                   │
│  lat             DECIMAL(10,7)   NOT NULL               │
│  lng             DECIMAL(10,7)   NOT NULL               │
│  fuzzy_location  BOOLEAN         DEFAULT FALSE          │
│  color           VARCHAR(20)     NOT NULL               │
│  created_at      TIMESTAMP       NOT NULL, DEFAULT NOW  │
└─────────────────────────────────────────────────────────┘
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `event_id` | UUID | 外键，关联 Event |
| `name` | VARCHAR(50) | 参与者姓名 |
| `address` | VARCHAR(255) | 用户输入的原始地址 |
| `formatted_address` | VARCHAR(255) | Google 返回的标准化地址 |
| `lat` | DECIMAL(10,7) | 纬度（后端 geocode 结果） |
| `lng` | DECIMAL(10,7) | 经度（后端 geocode 结果） |
| `fuzzy_location` | BOOLEAN | 是否模糊位置 |
| `color` | VARCHAR(20) | 显示颜色（如 "coral"） |
| `created_at` | TIMESTAMP | 创建时间 |

**说明**：
- `address`：用户输入的原始地址（如 "台北101"）
- `formatted_address`：Google Geocode 返回的标准化地址（如 "110台北市信義區信義路五段7號"）
- lat/lng 由后端 geocode 填入，不接受前端传入
- 如果 fuzzy_location=true，存储的是偏移后的坐标

---

### 2.3 Venue（场所缓存）

```
┌─────────────────────────────────────────────────────────┐
│  Venue                                                  │
├─────────────────────────────────────────────────────────┤
│  id              VARCHAR(255)  PK  (Google Place ID)    │
│  event_id        UUID        FK -> Event.id, NOT NULL   │
│  name            VARCHAR(255)    NOT NULL               │
│  address         VARCHAR(255)    NULL                   │
│  lat             DECIMAL(10,7)   NOT NULL               │
│  lng             DECIMAL(10,7)   NOT NULL               │
│  category        VARCHAR(50)     NULL                   │
│  rating          DECIMAL(2,1)    NULL                   │
│  price_level     SMALLINT        NULL                   │
│  photo_url       TEXT            NULL                   │
│  created_at      TIMESTAMP       NOT NULL, DEFAULT NOW  │
│                                                         │
│  UNIQUE (id, event_id)                                  │
└─────────────────────────────────────────────────────────┘
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | VARCHAR(255) | Google Place ID（主键之一） |
| `event_id` | UUID | 外键，关联 Event（主键之一） |
| `name` | VARCHAR(255) | 场所名称 |
| `address` | VARCHAR(255) | 地址 |
| `lat` | DECIMAL(10,7) | 纬度 |
| `lng` | DECIMAL(10,7) | 经度 |
| `category` | VARCHAR(50) | 类别（cafe/restaurant/bar 等） |
| `rating` | DECIMAL(2,1) | 评分（0.0-5.0） |
| `price_level` | SMALLINT | 价格等级（1-4） |
| `photo_url` | TEXT | 照片 URL |
| `created_at` | TIMESTAMP | 缓存时间 |

**说明**：
- 同一个 venue 在不同 event 中分别缓存（方便按 event 清理）
- 主键是 (id, event_id) 组合
- 删除 Event 时自动清理该 event 的所有 venue 缓存

---

### 2.4 Vote（投票）

```
┌─────────────────────────────────────────────────────────┐
│  Vote                                                   │
├─────────────────────────────────────────────────────────┤
│  id              UUID        PK                         │
│  event_id        UUID        FK -> Event.id, NOT NULL   │
│  participant_id  UUID        FK -> Participant.id, NOT NULL │
│  venue_id        VARCHAR(255)    FK -> Venue.id, NOT NULL │
│  created_at      TIMESTAMP       NOT NULL, DEFAULT NOW  │
│                                                         │
│  UNIQUE (event_id, participant_id, venue_id)            │
└─────────────────────────────────────────────────────────┘
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `event_id` | UUID | 外键，关联 Event |
| `participant_id` | UUID | 外键，关联 Participant（谁投的票） |
| `venue_id` | VARCHAR(255) | 外键，关联 Venue（投给哪个场所） |
| `created_at` | TIMESTAMP | 投票时间 |

**说明**：
- 同一个 participant 可以投多个 venue
- 同一个 (event, participant, venue) 组合只能投一次（UNIQUE 约束）
- 投票时，venue 信息会自动缓存到 Venue 表

---

## 三、不需要的表

| 不需要 | 原因 |
|--------|------|
| **User** | 当前无用户系统，用 token 控制权限 |
| **MEC** | 可从 participants 实时计算 |

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
生成: id = uuid(), organizer_token = random(64)
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

### 投票

```
投票:
输入: { eventId, participantId, venueId, venueData }
       │
       │  venueData = 前端传入的场所信息（从 Google API 获取的）
       ▼
检查 event 存在
  ↓
检查 participant 属于该 event
  ↓
检查/缓存 venue:
  SELECT * FROM venue WHERE id = ? AND event_id = ?
  如果不存在:
    INSERT INTO venue (id, event_id, name, address, lat, lng, ...)
    VALUES (venueId, eventId, venueData.name, ...)
  ↓
INSERT INTO vote (id, event_id, participant_id, venue_id)
  ON CONFLICT DO NOTHING  -- 已投过则忽略
  ↓
返回: { success: true }

取消投票:
DELETE FROM vote WHERE event_id = ? AND participant_id = ? AND venue_id = ?
（注意：不删除 venue 缓存，因为可能还有其他人投了这个场所）

获取投票统计（含场所信息）:
SELECT v.*, COUNT(vote.id) as vote_count
FROM venue v
LEFT JOIN vote ON vote.venue_id = v.id AND vote.event_id = v.event_id
WHERE v.event_id = ?
GROUP BY v.id, v.event_id
ORDER BY vote_count DESC
```

---

## 八、后续可能扩展（暂不实现）

| 功能 | 需要的表/字段 |
|------|--------------|
| 用户系统 | User 表，Event.organizer_id |
| 评论功能 | Comment 表 |
| 历史记录 | Event.status 字段 |

**原则**：等需要时再加，不提前设计。
