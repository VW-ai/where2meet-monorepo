## Where2Meet Server 部署说明（Railway + GitHub Actions）

本文描述当前后端的“部署整体架构、流程、细节与要点”，作为团队在维护/排障/扩展 CI/CD 时的唯一事实来源。

---

## 目标与原则

- **唯一控制面**：部署由 GitHub Actions 触发；Railway 负责构建/运行/资源（Postgres/Redis）。
- **配置即代码**：`railway.toml` 作为 Railway 的 build/deploy 设置来源（覆盖 Dashboard 同类设置）。
- **最小权限**：CD 使用 **Railway Project Token**（环境级）而非账号级 token。
- **可验证**：提供只读的 token 预检查 workflow，避免“直接 deploy 才发现 token 不可用”。

---

## 系统组件

### 运行平台：Railway

- Service：`where2meet-server`
- Builder：Dockerfile（见 `railway.toml` + `Dockerfile`）
- Healthcheck：`/health/ready`（见 `railway.toml`）
- 资源：
  - Postgres（必须）
  - Redis（可选：Redis 抖动不应影响服务存活性/健康检查）

### CI / CD：GitHub Actions

- CI：`.github/workflows/ci.yml`
  - lint / build / test（用于 PR & main）
- CD（staging）：`.github/workflows/cd-staging.yml`
  - 手动触发（`workflow_dispatch`）
  - CI 成功后自动触发（`workflow_run`）
  - 使用 Railway CLI：`railway up --ci --environment staging --service <service>`
- CD（production）：`.github/workflows/cd-production.yml`
  - 手动触发（要求输入 `deploy` 确认）
  - 使用 Railway CLI：`railway up --ci --environment production --service <service>`
- Token 预检查：`.github/workflows/railway-auth-check.yml`
  - 只读验证（`railway deployment list`），不触发部署

---

## 环境划分

我们默认至少存在两个 Railway 环境：

- `staging`
- `production`

建议：两套环境各自绑定独立的 Postgres/Redis，避免数据串环境。

---

## 配置：Railway Config as Code

### `railway.toml`

`railway.toml` 决定 Railway 对该服务的构建与运行方式（会覆盖 Dashboard 的 build/deploy 设置）：

- `[build]`
  - `builder = "dockerfile"`
  - `dockerfilePath = "Dockerfile"`
- `[deploy]`
  - `startCommand = "npx prisma migrate deploy && npm start"`
  - `healthcheckPath = "/health/ready"`
  - `healthcheckTimeout = 300`

### `Dockerfile`

`Dockerfile` 负责：

- 安装依赖并构建 TypeScript 产物（`dist/`）
- 生成 Prisma Client（`prisma generate`）
- 处理 Prisma 在 slim 镜像里常见的 OpenSSL 依赖（安装 `openssl`）
- 运行时启动命令（容器 `CMD`）与 Railway `startCommand` 保持一致的迁移 + 启动语义

要点：

- 迁移由 `prisma migrate deploy` 执行，基于仓库内 `prisma/migrations/`。
- 迁移在启动前执行：如果迁移失败，部署会失败（避免“服务起来但 schema 不一致”）。

---

## 运行时环境变量（Railway Dashboard 配置）

代码侧在 `src/lib/config.ts` 中声明了必需/可选 env：

- 必需：
  - `DATABASE_URL`（Postgres 连接串）
- 建议：
  - `NODE_ENV=production`（线上环境）
  - `CORS_ORIGIN`（生产必须显式配置允许的前端域名；不配会默认放开）
  - `REDIS_URL`（Redis 连接串）
  - `GOOGLE_MAPS_API_KEY`（如果使用 geocode/places/directions）

注意：

- `CORS_ORIGIN` 默认值为 `"*"`，`src/server.ts` 会将其转换为 `origin: true`（等价“放开所有 origin”）。
- readiness：`/health/ready` 以 **DB 为 hard requirement**，Redis 为 optional（见 `src/routes/health.ts`）。

---

## CD 身份认证（核心要点）

### 为什么用 Project Token（RAILWAY_TOKEN）

Railway CLI 有两类 token：

- **Project Token**：通过 `RAILWAY_TOKEN` 使用；作用域为“某个 project + 某个 environment”；适合 CI/CD。
- **Account/Team Token**：通过 `RAILWAY_API_TOKEN` 使用；权限更大；适合需要账号级操作。

我们的 CD 采用 `railway up --environment ... --service ...` 方案，不需要 `railway link`，因此使用 Project Token 更安全、更稳定。

### GitHub Secrets / Variables 约定

- Repo Variables（Actions Variables）：
  - `RAILWAY_SERVICE_NAME`：Railway service 名称（例如 `where2meet-server`）
- Environment Secrets（推荐放在对应 GitHub Environment 下）：
  - `staging` 环境：
    - `RAILWAY_TOKEN`（Project Token，Railway 环境选 staging）
  - `production` 环境：
    - `RAILWAY_TOKEN`（Project Token，Railway 环境选 production）

兼容：工作流也支持你使用 `railway_staging/railway_production` 或 `RAILWAY_STAGING/RAILWAY_PRODUCTION` 作为 secret 名称（见 workflow 代码）。

---

## 部署流程（Flow）

### 1) Staging 部署

触发方式：

- 手动：GitHub Actions → `CD Staging` → Run workflow
- 自动：CI 在 `main` push 上成功后触发 `workflow_run`

执行步骤（概念上）：

1. Checkout 代码（对应 commit）
2. 安装 Railway CLI
3. 使用 `RAILWAY_TOKEN` 对 staging 环境执行：
   - `railway up --ci --environment staging --service <service>`
4. Railway 构建镜像（Dockerfile）并发布部署
5. Railway 运行 `startCommand`：
   - `npx prisma migrate deploy`
   - `npm start`（启动 `dist/index.js`）
6. Railway 对 `/health/ready` 做健康检查

并发控制：

- staging workflow 使用 `concurrency` 分组，并区分 `workflow_dispatch` 和 `workflow_run`，避免“手动部署被自动触发 run 取消”。

### 2) Production 部署

触发方式：

- 手动：GitHub Actions → `CD Production` → 输入 `deploy` 确认

执行步骤与 staging 类似，只是 `--environment production`，并且通过 GitHub Environment `production` 可绑定额外审批策略（如 required reviewers）。

---

## “迁移会不会自动同步数据库？”

会。每次部署启动前都会执行：

- `npx prisma migrate deploy`

它会将 `prisma/migrations/` 中未应用的迁移按顺序应用到当前环境的 `DATABASE_URL` 对应的 Postgres。

要点：

- 确保 staging/prod 的 `DATABASE_URL` 指向各自数据库。
- 迁移失败会导致部署失败（这是期望行为）。

---

## 发布验证（验收）

最小验收集：

- `/health`：应返回 200
- `/health/ready`：DB healthy 时应返回 200（Redis unhealthy 允许 degraded）
- 关键 API（按前端集成需要）：
  - 创建 Event
  - participant join / update
  - venues search
  - votes & SSE（若 staging 环境具备 Redis）

---

## 常见问题与排障

### 1) Token 不可用

现象：GitHub Actions 报 Unauthorized。

处理：

- 先跑 `Railway Auth Check`（只读验证）确认 token 是否可用。
- 确认 token 是对应 Railway 环境创建的 **Project Token**。

### 2) 手动部署被取消

现象：workflow_dispatch run 很快变为 cancelled。

原因：concurrency 分组与其他触发（如 workflow_run）冲突。

处理：已在 `.github/workflows/cd-staging.yml` 中按 `github.event_name` 区分分组。

### 3) 迁移卡住/失败

处理：

- 在 Railway 部署日志中查看 `prisma migrate deploy` 输出。
- 检查数据库权限、连接串、锁冲突等。

---

## 变更建议（未来可选）

- 将迁移从 `startCommand` 拆为 `preDeployCommand`（如果希望语义更清晰、减少每次重启重复迁移）。
- 如果未来 Redis 成为强依赖（例如 SSE 必须），再把 readiness 策略改为 DB+Redis 都必须健康。
