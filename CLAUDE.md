# Where2Meet monorepo

Two independent npm packages in one git repo. There are **no npm workspaces**:
each package has its own `package.json`, `package-lock.json` and `node_modules`.
Run npm commands inside the package directory (or via the root `npm run *:client` /
`*:server` shortcuts).

| Path | What | Deploy |
|------|------|--------|
| `client/` | Next.js 16 app (React 19, Tailwind 4) | Vercel, project root directory = `client` |
| `server/` | Fastify 5 + Prisma API | Railway, service root directory = `server` (Dockerfile + `railway.toml` live there) |

## Rules
- Server-side conventions live in [server/CLAUDE.md](server/CLAUDE.md); paths in it are
  relative to `server/`. Client docs: [client/README.md](client/README.md), [client/META/](client/META/).
- Git hooks are installed once at the root (`npm install` here runs husky).
  `.husky/pre-commit` runs lint-staged, which uses each package's own config.
- CI is path-filtered: `.github/workflows/client-ci.yml` runs for `client/**`,
  `server-ci.yml` for `server/**`. Server CD to Railway is triggered by Server CI on `main`.
- Keep commits scoped to one package where possible; prefix messages with `client:` / `server:`
  when it helps.
