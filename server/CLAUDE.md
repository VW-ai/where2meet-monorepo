# CLAUDE.md - Development Guide

Rules for Claude when working on this project.

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
