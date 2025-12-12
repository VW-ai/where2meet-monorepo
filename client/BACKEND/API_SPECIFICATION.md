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
| Participant | /api/events/:id/participants | POST | 添加参与者 |
| Participant | /api/events/:id/participants/:pid | PATCH | 更新参与者 |
| Participant | /api/events/:id/participants/:pid | DELETE | 移除参与者 |
| Venue | /api/venues/search | POST | 搜索场所 |
| Venue | /api/venues/:id | GET | 获取场所详情 |
| Vote | /api/events/:id/votes | POST | 投票 |
| Vote | /api/events/:id/votes | DELETE | 取消投票 |
| Vote | /api/events/:id/votes | GET | 获取投票统计 |
| Maps | /api/geocode | POST | 地址转坐标 |
| Maps | /api/directions | POST | 获取路线 |

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
| id | string | 活动 UUID |
| title | string | 活动标题 |
| meetingTime | string | 预计见面时间 |
| organizerId | string | 组织者标识 |
| organizerToken | string | 组织者令牌（仅创建时返回） |
| participants | array | 参与者列表（空） |
| publishedVenueId | null | 已发布场所 ID |
| publishedAt | null | 发布时间 |
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
| meetingTime | string | 预计见面时间 |
| organizerId | string | 组织者标识 |
| participants | Participant[] | 参与者列表 |
| publishedVenueId | string \| null | 已发布场所 ID |
| publishedAt | string \| null | 发布时间 |
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

### 3.1 添加参与者

```
POST /api/events/:id/participants
```

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 UUID |
| name | Body | string | ✓ | 参与者姓名，max 50 |
| address | Body | string | ✓ | 地址（用户输入） |
| fuzzyLocation | Body | boolean | - | 是否模糊位置，默认 false |

**后端处理**：
1. 调用 Google Geocode 获取坐标
2. 如果 fuzzyLocation=true，对坐标添加随机偏移
3. 分配颜色
4. 保存到数据库

**后端输出（成功 201）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 参与者 UUID |
| name | string | 姓名 |
| address | string | 用户输入的原始地址 |
| location | Location | { lat, lng } 坐标（后端 geocode 结果） |
| color | string | 分配的颜色 |
| fuzzyLocation | boolean | 是否模糊 |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 缺少必填字段 |
| 400 | ADDRESS_NOT_FOUND | 无法解析地址 |
| 404 | NOT_FOUND | 活动不存在 |
| 409 | EVENT_ALREADY_PUBLISHED | 活动已发布，不能添加 |

---

### 3.2 更新参与者

```
PATCH /api/events/:id/participants/:participantId
```

**前端输入：**
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | URL Path | string | ✓ | 活动 UUID |
| participantId | URL Path | string | ✓ | 参与者 UUID |
| name | Body | string | - | 新姓名 |
| address | Body | string | - | 新地址（会触发重新 geocode） |
| fuzzyLocation | Body | boolean | - | 是否模糊 |

**后端输出（成功 200）：**

返回更新后的 Participant 对象

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 400 | ADDRESS_NOT_FOUND | 新地址无法解析 |
| 404 | NOT_FOUND | 参与者不存在 |
| 409 | EVENT_ALREADY_PUBLISHED | 活动已发布，不能修改 |

---

### 3.3 移除参与者

```
DELETE /api/events/:id/participants/:participantId
```

**前端输入：**
| 参数 | 位置 | 说明 |
|------|------|------|
| id | URL Path | 活动 UUID |
| participantId | URL Path | 参与者 UUID |

**后端输出（成功 200）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | true |
| message | string | "Participant removed successfully" |

**错误响应：**
| 状态码 | code | 说明 |
|--------|------|------|
| 404 | NOT_FOUND | 参与者不存在 |
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
| venueData | Body | object | ✓ | 场所信息（用于缓存） |

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
3. 缓存 venue 信息（如果不存在）
4. 创建投票记录（重复投票忽略）

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

| 场景 | 方式 |
|------|------|
| 创建活动 | 无需认证 |
| 查看活动 | 无需认证 |
| 修改/删除活动 | Header: Authorization: Bearer {organizerToken} |
| 发布场所 | Header: Authorization: Bearer {organizerToken} |
| 添加/修改/删除参与者 | 无需认证（任何人都可以） |
| 投票 | 需要 participantId（参与者身份） |

---

## 九、待实现 vs 已有 Mock

| API | Mock 状态 | 说明 |
|-----|----------|------|
| POST /api/events | ✅ 已实现 | |
| GET /api/events/:id | ✅ 已实现 | |
| PATCH /api/events/:id | ✅ 已实现 | |
| DELETE /api/events/:id | ✅ 已实现 | |
| POST /api/events/:id/publish | ❌ 未实现 | 前端有调用 |
| POST /api/events/:id/participants | ✅ 已实现 | |
| PATCH /api/events/:id/participants/:pid | ✅ 已实现 | |
| DELETE /api/events/:id/participants/:pid | ✅ 已实现 | |
| POST /api/venues/search | ✅ 已实现 | |
| GET /api/venues/:id | ✅ 已实现 | |
| POST /api/events/:id/votes | ❌ 未实现 | 需新增 |
| DELETE /api/events/:id/votes | ❌ 未实现 | 需新增 |
| GET /api/events/:id/votes | ❌ 未实现 | 需新增 |
| POST /api/geocode | ✅ 已实现 | |
| POST /api/directions | ✅ 已实现 | |
