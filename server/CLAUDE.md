# CLAUDE.md - Development Guide

Rules for Claude when working on this project.

The rewrite branch's current runtime and commands are described in [README.md](README.md) and [src/META.md](src/META.md). `META/ARCHITECTURE` is historical. The first lifecycle is incomplete as a production replacement; keep its unimplemented operations explicit and follow the scoped PPE acceptance plan.

---

## Before Every Commit

1. **Review against REGULATION.md**
   - Atomic files? (single responsibility)
   - Atomic functions? (one thing, done well)
   - Tests written?
   - Documentation co-located?
   - Clean code style?
   - Old code cleaned up?

2. **Update tracking files**
   - `META/PROGRESS.md` - What was completed
   - `META/TODO.md` - What's next

3. **Small commits**
   - One logical change per commit
   - Clear commit message explaining WHY

---

## Code Quality Standards

- Write steady, high quality code over fast, hacky code
- Follow Google Style guidelines
- Comments explain WHY, not WHAT
- No commented-out code (use git history)
- Remove unused imports/functions immediately

---

## Key References

| File | Purpose |
|------|---------|
| [META/CORE/REGULATION.md](META/CORE/REGULATION.md) | Development principles |
| [META/CORE/PRODUCT.md](META/CORE/PRODUCT.md) | Product requirements |
| [META/ARCHITECTURE/](META/ARCHITECTURE/) | Technical design |
| [META/MILESTONES/](META/MILESTONES/) | Implementation plan |
| [META/PROGRESS.md](META/PROGRESS.md) | Completed work |
| [META/TODO.md](META/TODO.md) | Current tasks |

---

## Commit Message Format

```
<type>: <short description>

- Detail 1
- Detail 2

Ref: MILESTONE_X
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

---

## Agents

| Agent | Role |
|-------|------|
| [where2meet-backend-dev](.claude/agents/where2meet-backend-dev.md) | Implementation |
| [architecture-advisor](.claude/agents/architecture-advisor.md) | Design decisions |
| [qa-devops-engineer](.claude/agents/qa-devops-engineer.md) | Testing & CI/CD |
