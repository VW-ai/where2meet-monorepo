# Where2Meet Backend - 功能模块定义

> 本文档定义系统的核心功能模块、职责边界、以及模块间的依赖关系。

---

## 目录

1. [系统概览](#一系统概览)
2. [核心模块](#二核心模块)
3. [模块依赖关系](#三模块依赖关系)
4. [API 端点映射](#四api-端点映射)
5. [数据流](#五数据流)

---

## 一、系统概览

### 产品定位

Where2Meet 解决的核心问题：**多人聚会时，如何公平地选择一个对所有人都方便的地点？**

### 核心价值

| 价值点 | 说明 |
|--------|------|
| **公平性** | 基于几何算法（MEC）计算最优区域，而非某人主观决定 |
| **透明性** | 所有人看到相同的数据（距离、时间） |
| **隐私可选** | 支持模糊位置，不暴露精确地址 |
| **便捷性** | 无需注册，链接分享即可参与 |

### 用户角色

| 角色 | 权限 |
|------|------|
| **Organizer（组织者）** | 创建活动、编辑活动信息、发布最终地点、删除活动 |
| **Participant（参与者）** | 添加自己的位置、查看其他人位置、查看推荐地点 |

---

## 二、核心模块

### 模块总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        Where2Meet Backend                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │   Event     │    │ Participant │    │   Venue     │        │
│   │  Module     │◄───│   Module    │    │  Module     │        │
│   └─────────────┘    └──────┬──────┘    └──────┬──────┘        │
│                             │                   │               │
│                             ▼                   ▼               │
│                      ┌─────────────┐    ┌─────────────┐        │
│                      │    Maps     │    │    MEC      │        │
│                      │   Module    │    │  Module     │        │
│                      └─────────────┘    └─────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2.1 Event Module（活动模块）

**职责**：管理活动的生命周期

#### 功能

| 功能 | 描述 |
|------|------|
| 创建活动 | 生成活动 ID、organizerToken，设置标题和时间 |
| 查询活动 | 根据 ID 获取活动详情（含参与者、MEC、已发布地点） |
| 更新活动 | 修改标题、时间（需 organizer 权限） |
| 删除活动 | 删除活动及关联数据（需 organizer 权限） |
| 发布地点 | 设置最终聚会地点（需 organizer 权限） |

#### 状态机

```
Created ──► Active ──► Published
              │
              ▼
           Deleted
```

| 状态 | 可执行操作 |
|------|-----------|
| **Created/Active** | 添加/删除参与者、更新信息、发布地点 |
| **Published** | 只读（或有限修改） |
| **Deleted** | 无操作 |

#### 业务规则

- 活动创建时自动生成 organizerToken（不可更改）
- Published 后不能添加/删除参与者（可配置）
- 删除活动需要 organizer 权限

---

### 2.2 Participant Module（参与者模块）

**职责**：管理活动的参与者

#### 功能

| 功能 | 描述 |
|------|------|
| 添加参与者 | 输入姓名+地址，后端 geocode 获取坐标 |
| 更新参与者 | 修改姓名或地址（地址变更需重新 geocode） |
| 删除参与者 | 从活动中移除 |
| 模糊位置 | 可选开启，对坐标添加随机偏移（~0.5-1 mile） |

#### 业务规则

- 坐标**只能由后端 geocode 生成**，不接受前端传入
- 添加/删除参与者后需触发 MEC 重算
- 每个参与者自动分配唯一颜色（用于地图标记）
- 同一活动可能有参与者数量上限（可配置）

#### 数据要求

| 字段 | 要求 |
|------|------|
| name | 必填，1-50 字符 |
| address | 必填，1-255 字符 |
| fuzzyLocation | 可选，布尔值 |

---

### 2.3 Maps Module（地图服务模块）

**职责**：封装所有 Google Maps API 调用

#### 功能

| 功能 | 描述 |
|------|------|
| Geocoding | 地址 → 坐标（lat/lng） |
| Reverse Geocoding | 坐标 → 地址（可选） |
| Directions | 计算两点间路线（距离、时间、路径） |
| Places Search | 搜索指定区域内的场所 |

#### 子服务

**Geocoding Service**
- 输入：地址字符串
- 输出：`{ lat, lng, formattedAddress, placeId }`
- 特性：缓存结果（相同地址不重复调用）

**Directions Service**
- 输入：起点、终点、出行方式（driving/transit/walking/bicycling）
- 输出：`{ distance, duration, polyline }`
- 特性：支持批量计算（多个参与者到同一地点）

**Places Service**
- 文字搜索（Text Search）
  - 输入：查询词、中心点、半径
  - 输出：场所列表
  - 用途：用户输入 "星巴克"、"Italian restaurant" 等
- 附近搜索（Nearby Search）
  - 输入：中心点、半径、类别筛选
  - 输出：场所列表
  - 用途：按类别筛选（cafe/restaurant/bar 等）
- 场所详情（Place Details）
  - 输入：placeId
  - 输出：完整信息（营业时间、电话、照片等）

#### 非功能要求

| 要求 | 实现 |
|------|------|
| 缓存 | Redis，Geocode TTL 较长，Places TTL 较短 |
| 并发控制 | 限制同时请求数，避免超配额 |
| 重试 | 指数退避，429/5xx 时重试 |
| 降级 | 服务不可用时返回缓存数据或友好错误 |

---

### 2.4 MEC Module（最优区域计算模块）

**职责**：计算所有参与者的最小外包圆（Minimum Enclosing Circle）

#### 重要概念区分：MEC vs Search Radius

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│           ○ 参与者 A                                │
│                  ╭───────────╮                      │
│          ○       │    MEC    │     ○               │
│       参与者 B    │  (固定圆)  │  参与者 C           │
│                  ╰───────────╯                      │
│        ╭───────────────────────────────╮            │
│        │      Search Radius            │            │
│        │      (用户可拖动调整)          │            │
│        ╰───────────────────────────────╯            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

| 概念 | 来源 | 是否可调 | 用途 |
|------|------|----------|------|
| **MEC** | 后端根据参与者位置自动计算 | ❌ 固定 | 表示「最公平的中心区域」 |
| **Search Radius** | 前端用户拖动调整 | ✅ 可调 | 控制场所搜索范围 |

#### MEC 与 Search Radius 的关系

1. 后端计算 MEC → 返回 `{ center, radius }`
2. 前端显示 MEC 圆（如黄色，固定不可拖动）
3. 前端初始化 Search Radius = MEC radius × 1.5（或其他系数）
4. 用户可拖动调整 Search Radius（扩大或缩小）
5. 搜索场所时使用：**MEC center + 用户的 Search Radius**

#### 功能

| 功能 | 描述 |
|------|------|
| 计算 MEC | 输入多个坐标点，输出圆心和半径 |
| 触发时机 | 参与者增/删/改位置时自动重算 |

#### 算法

- 使用 Welzl 算法（随机化，O(n) 期望时间）
- 处理地理坐标（考虑地球曲率，使用 Haversine 公式）

#### 边界情况

| 参与者数 | 处理方式 |
|---------|----------|
| 0 | 无 MEC |
| 1 | 圆心 = 该点，半径 = 0（或默认最小值） |
| 2 | 圆心 = 中点，半径 = 两点距离的一半 |
| 3+ | Welzl 算法计算 |

#### 输出

```
{
  center: { lat, lng },
  radiusMeters: number   // MEC 半径，非搜索半径
}
```

**注意**：后端只计算并返回 MEC，Search Radius 由前端管理并在搜索时传入。

---

### 2.5 Venue Module（场所模块）

**职责**：管理场所搜索和推荐

#### 功能

| 功能 | 描述 |
|------|------|
| 文字搜索 | 根据用户输入的关键词搜索（如 "星巴克"、"coffee shops"） |
| 类别筛选 | 按类型过滤（cafe/restaurant/bar/gym/park） |
| 场所详情 | 获取单个场所的详细信息 |
| 路线计算 | 计算所有参与者到某场所的距离和时间 |

#### 搜索方式

后端需要支持两种搜索方式，可以单独使用或组合：

| 搜索方式 | 参数 | 示例 |
|---------|------|------|
| **文字搜索** | `query` | "星巴克"、"Italian restaurant"、"公园" |
| **类别筛选** | `categories` | ["cafe"]、["restaurant", "bar"] |
| **混合搜索** | `query` + `categories` | query="brunch" + categories=["cafe", "restaurant"] |

#### 搜索逻辑

```
┌─────────────────────────────────────────────────────────────┐
│  所有搜索的共同约束                                           │
│  ─────────────────────────────────────────────────────────  │
│  • 搜索中心：MEC 圆心（后端从 eventId 获取，不让前端传）        │
│  • 搜索半径：前端传入的 searchRadius（用户可拖动调整）          │
└─────────────────────────────────────────────────────────────┘
```

1. 搜索中心：使用 **MEC 圆心**（后端计算，保证公平性）
2. 搜索半径：使用 **前端传入的 Search Radius**（用户可拖动调整）
3. 搜索内容：**query（文字）** 和/或 **categories（类别）**
4. 结果按评分排序

```
搜索请求参数：
- eventId: 必填，用于获取 MEC 中心
- searchRadius: 必填，用户调整后的搜索半径（米）
- query?: 文字搜索关键词（可选）
- categories?: 类别筛选数组（可选）

注：query 和 categories 至少传一个
```

**为什么搜索中心不让前端传？**
- 保证搜索始终基于 MEC 中心，防止前端篡改
- MEC 中心代表「对所有人最公平的点」

#### 搜索示例

| 用户操作 | 请求参数 | 说明 |
|---------|---------|------|
| 输入 "星巴克" | `query: "星巴克"` | 文字搜索 |
| 点击 "咖啡厅" 类别 | `categories: ["cafe"]` | 类别筛选 |
| 输入 "brunch" + 选择餐厅 | `query: "brunch", categories: ["restaurant"]` | 混合搜索 |
| 只拖动半径 | 使用上次的 query/categories | 重新搜索 |

#### 场所类别

| 类别 | 说明 |
|------|------|
| cafe | 咖啡厅 |
| restaurant | 餐厅 |
| bar | 酒吧 |
| gym | 健身房 |
| park | 公园 |
| library | 图书馆 |
| ... | 可扩展 |

#### 路线计算

对于选中的场所，计算每个参与者到该场所的：
- 距离：`value`（米）+ `text`（默认 imperial：mi/ft）
- 时间：`value`（秒）+ `text`（mins/hours）
- 出行方式（driving/transit/walking/bicycling）
- 路径（用于地图绘制）

**距离单位规则**：
| 层级 | 单位 | 说明 |
|------|------|------|
| 后端存储/传输 | meters | 统一用米，便于计算 |
| 前端显示（默认） | miles / feet | 美国用户为主 |
| 用户设置可选 | km / m | metric 模式 |

---

### 2.6 Auth Module（认证模块）

**职责**：管理访问权限

#### 当前模式：Token-based（无账号）

| 链接类型 | 获取方式 | 权限 |
|----------|----------|------|
| 编辑链接 | 创建活动时返回 | 完整权限（CRUD） |
| 分享链接 | organizer 分享 | 添加自己、查看 |

#### Token 验证逻辑

- 编辑链接：URL 带 `?token=xxx` 或 Header 带 `X-Organizer-Token`
- 后端校验 token 是否匹配活动的 organizerToken

#### 未来扩展：用户账号

- 用户注册/登录
- JWT 认证
- 活动关联到用户

---

## 三、模块依赖关系

```
┌─────────────────────────────────────────────────────────────┐
│                      Controller Layer                       │
│  EventController | ParticipantController | VenueController  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                       Service Layer                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  EventService ◄─────────── ParticipantService               │
│       │                          │                          │
│       │                          ▼                          │
│       │                    MapsService                      │
│       │                    (Geocoding)                      │
│       │                          │                          │
│       ▼                          ▼                          │
│  MECService ◄──────────── (coordinates)                     │
│       │                                                     │
│       ▼                                                     │
│  VenueService ───────────► MapsService                      │
│                            (Places, Directions)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Repository Layer                        │
│     EventRepo    |    ParticipantRepo    |    VenueRepo     │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                        │
│         Database (PostgreSQL)  |  Google Maps API           │
└─────────────────────────────────────────────────────────────┘
```

### 依赖说明

| 调用方 | 被调用方 | 原因 |
|--------|----------|------|
| ParticipantService | MapsService | 添加参与者时需要 geocode |
| ParticipantService | MECService | 参与者变更时需要重算 MEC |
| EventService | MECService | 获取活动时需要返回 MEC |
| VenueService | MapsService | 搜索场所、计算路线 |
| VenueService | MECService | 获取搜索中心点 |

---

## 四、API 端点映射

### Event 相关

| 方法 | 端点 | 功能 | 权限 |
|------|------|------|------|
| POST | `/api/events` | 创建活动 | 公开 |
| GET | `/api/events/:id` | 获取活动详情 | 公开 |
| PATCH | `/api/events/:id` | 更新活动 | Organizer |
| DELETE | `/api/events/:id` | 删除活动 | Organizer |
| POST | `/api/events/:id/publish` | 发布最终地点 | Organizer |

### Participant 相关

| 方法 | 端点 | 功能 | 权限 |
|------|------|------|------|
| POST | `/api/events/:id/participants` | 添加参与者 | 公开/可配置 |
| PATCH | `/api/events/:id/participants/:pid` | 更新参与者 | 公开/可配置 |
| DELETE | `/api/events/:id/participants/:pid` | 删除参与者 | Organizer/Self |

### Venue 相关

| 方法 | 端点 | 功能 | 权限 |
|------|------|------|------|
| POST | `/api/venues/search` | 搜索场所 | 公开 |
| GET | `/api/venues/:id` | 场所详情 | 公开 |

**`/api/venues/search` 请求体**：

```
{
  eventId: string,        // 必填，用于获取 MEC 中心
  searchRadius: number,   // 必填，搜索半径（米）
  query?: string,         // 可选，文字搜索关键词
  categories?: string[]   // 可选，类别筛选数组
}
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `eventId` | ✅ | 用于获取 MEC 中心 |
| `searchRadius` | ✅ | 用户调整的搜索半径（米） |
| `query` | ❌ | 文字搜索（如 "星巴克"、"coffee"） |
| `categories` | ❌ | 类别筛选（如 ["cafe", "restaurant"]） |

**注**：`query` 和 `categories` 至少传一个

### Maps 相关

| 方法 | 端点 | 功能 | 权限 |
|------|------|------|------|
| POST | `/api/geocode` | 地址转坐标 | 公开（需限流） |
| POST | `/api/directions` | 计算路线 | 公开（需限流） |

---

## 五、数据流

### 5.1 创建活动流程

```
用户输入 (title, meetingTime)
         │
         ▼
    Controller
    ├── Schema 校验
    └── 调用 EventService
         │
         ▼
    EventService
    ├── 生成 eventId
    ├── 生成 organizerToken
    └── 存储到 DB
         │
         ▼
    返回 Event + organizerToken
    (token 仅在创建时返回一次)
```

### 5.2 添加参与者流程

```
用户输入 (name, address, fuzzyLocation?)
         │
         ▼
    Controller
    ├── Schema 校验
    └── 调用 ParticipantService
         │
         ▼
    ParticipantService
    ├── 检查 Event 存在且未发布
    ├── 调用 MapsService.geocode(address)
    │         │
    │         ▼
    │    MapsService
    │    ├── 检查缓存
    │    ├── 调用 Google Geocoding API
    │    └── 返回 { lat, lng }
    │         │
    ├── 如果 fuzzyLocation，添加随机偏移
    ├── 分配颜色
    ├── 存储 Participant
    └── 触发 MEC 重算
         │
         ▼
    MECService
    ├── 获取所有参与者坐标
    ├── 计算 MEC
    └── 更新 Event 的 MEC 数据
         │
         ▼
    返回 Participant
```

### 5.3 搜索场所流程

```
用户输入 (eventId, searchRadius, query?, categories?)
         │
         │  三种搜索方式：
         │  1. 文字搜索：query = "星巴克"
         │  2. 类别筛选：categories = ["cafe"]
         │  3. 混合搜索：query + categories
         ▼
    Controller
    ├── Schema 校验
    │   ├── searchRadius > 0
    │   └── query 和 categories 至少有一个
    └── 调用 VenueService
         │
         ▼
    VenueService
    ├── 获取 Event 的 MEC
    ├── 搜索中心 = MEC.center（不用前端传，防篡改）
    ├── 搜索半径 = 前端传入的 searchRadius
    └── 调用 MapsService
         │
         ├── 如果有 query → textSearch(query, center, radius)
         └── 如果只有 categories → nearbySearch(center, radius, categories)
         │
         ▼
    MapsService
    ├── 检查缓存（基于 query/categories + center + radius）
    ├── 调用 Google Places API
    │   ├── Text Search API（文字搜索）
    │   └── Nearby Search API（类别搜索）
    └── 返回场所列表
         │
         ▼
    返回 Venue[]
```

**Google Places API 选择**：
| 搜索类型 | API | 说明 |
|---------|-----|------|
| 文字搜索 | Text Search | 支持任意关键词 |
| 类别筛选 | Nearby Search | 基于 type 参数筛选 |
| 混合搜索 | Text Search | query 包含关键词，再按类别过滤结果 |

### 5.4 计算路线流程

```
用户输入 (eventId, venueId, travelMode)
         │
         ▼
    Controller
    ├── Schema 校验
    └── 调用 VenueService
         │
         ▼
    VenueService
    ├── 获取 Event 的所有参与者
    ├── 获取 Venue 位置
    └── 对每个参与者调用 MapsService.getDirections()
         │
         ▼
    MapsService
    ├── 检查缓存
    ├── 批量调用 Google Directions API
    └── 返回路线数据
         │
         ▼
    返回 Route[] (每个参与者一条)
```

---

## 附录：模块边界总结

| 模块 | 负责 | 不负责 |
|------|------|--------|
| **Event** | 活动 CRUD、状态管理、发布 | 不负责参与者管理、地图调用 |
| **Participant** | 参与者 CRUD、触发 MEC | 不负责 geocode 实现细节 |
| **Maps** | 所有 Google API 调用、缓存 | 不负责业务逻辑 |
| **MEC** | 几何计算 | 不负责数据存储 |
| **Venue** | 场所搜索、路线聚合 | 不负责 API 调用细节 |
| **Auth** | 权限验证 | 不负责业务逻辑 |
