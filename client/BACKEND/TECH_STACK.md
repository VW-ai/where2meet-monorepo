# Where2Meet Backend - Tech Stack

---

## 核心技术

| 类别 | 选择 | 原因 |
|------|------|------|
| **语言** | TypeScript | 类型安全，与前端一致 |
| **框架** | Fastify | 高性能，原生 TypeScript 支持 |
| **数据库** | PostgreSQL | 可靠，支持 JSON，适合关系数据 |
| **ORM** | Prisma | 类型安全，迁移方便，开发体验好 |
| **缓存** | Redis | Google API 结果缓存，Rate Limiting |
| **校验** | Zod | Schema 校验，与 TypeScript 类型联动 |

---

## 辅助工具

| 类别 | 选择 |
|------|------|
| **日志** | Pino |
| **限流** | @fastify/rate-limit |
| **测试** | Vitest + Supertest |
| **监控** | Prometheus (可选) |

---

## 外部服务

| 服务 | 用途 |
|------|------|
| **Google Geocoding API** | 地址 → 坐标 |
| **Google Places API** | 场所搜索 |
| **Google Directions API** | 路线计算 |

---

## 部署选项

| 环境 | 推荐 |
|------|------|
| **开发** | 本地 Docker (PostgreSQL + Redis) |
| **生产** | Railway / Render / Fly.io |

---

## 项目结构 (推荐)

```
backend/
├── src/
│   ├── routes/          # API 路由
│   ├── services/        # 业务逻辑
│   ├── repositories/    # 数据库操作
│   ├── lib/             # 外部服务封装 (Google Maps)
│   ├── utils/           # 工具函数
│   ├── types/           # TypeScript 类型
│   └── index.ts         # 入口
├── prisma/
│   └── schema.prisma    # 数据库模型
├── tests/
└── package.json
```
