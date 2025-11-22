# Where2Meet - Agent Roles & Responsibilities

> AI-Assisted Development Agents for Where2Meet Project

## Agent Overview

This document describes all agents (AI assistants and automated tools) used in the Where2Meet development workflow, their specific responsibilities, and when to invoke them.

---

## Development Agents (AI-Assisted)

### Agent Summary Table

| Agent Name | Type | Trigger | Primary Responsibility | Human Involvement |
|------------|------|---------|------------------------|-------------------|
| **Implementation Agent** | AI | After spec approval | Write feature code following TDD | 0-20% |
| **Code Review Agent** | AI | Before commit/PR | Review code quality & architecture | 30% |
| **Testing Agent** | AI | During implementation | Generate & maintain tests | 20% |
| **UI/UX Agent** | AI | During implementation & before PR | Design system compliance & accessibility | 30% |
| **Documentation Agent** | AI | After implementation | Update technical docs | 10% |

---

## Detailed Agent Specifications

### 1. Implementation Agent 🤖

**PRIMARY CODING AGENT**

#### Purpose
Write production-ready feature code based on approved specifications while following TDD workflow and architectural patterns.

#### Type
AI-powered development assistant (Claude Code, Cursor, GitHub Copilot, etc.)

#### Trigger Conditions
- Feature spec is approved in `docs/features/FEATURE_NAME.md`
- Tasks have been broken down and prioritized
- Ready to begin coding

#### Core Responsibilities

##### 1. Read & Understand
- Review feature spec from `docs/features/FEATURE_NAME.md`
- Understand acceptance criteria and edge cases
- Check dependencies on other features

##### 2. Follow TDD Workflow
```
1. Write failing tests first (for utility functions)
2. Define types in types/index.ts
3. Implement utility functions to pass tests
4. Build UI components bottom-up (atomic → composite)
5. Integrate with Zustand store using defined actions
6. Add error handling and loading states
```

##### 3. Maintain Code Quality
- ✅ Use TypeScript strict mode (no `any` types)
- ✅ Follow patterns from CLIENT_ARCHITECTURE.md
- ✅ Add JSDoc comments for exported functions
- ✅ Keep components under 200 lines (split if larger)
- ✅ Use Tailwind CSS only (no inline styles)

##### 4. Handle Edge Cases
- Empty states (no participants, no results)
- Error states (API failures, network issues)
- Loading states (async operations)

##### 5. Self-Validate Before Handoff
```bash
npm run type-check  # Zero errors
npm run lint        # Zero errors
npm run test        # All tests pass
# Manual browser testing (happy path + edge cases)
```

##### 6. Handoff
Transfer to Code Review Agent when implementation is complete

#### Example Workflow
```bash
# 1. Read feature spec
cat docs/features/venue-category-filter.md

# 2. Implement following CLIENT_ARCHITECTURE.md structure
# - Add types to types/index.ts
# - Create components/sidebar/CategoryFilter.tsx
# - Update store/useMeetingStore.ts with new action
# - Write tests in __tests__/

# 3. Validate locally
npm run type-check && npm run lint && npm run test

# 4. Trigger Code Review Agent
```

#### Success Criteria
- [ ] All TypeScript checks pass
- [ ] All tests pass (>80% coverage)
- [ ] Feature works as specified
- [ ] Edge cases handled
- [ ] Code follows architectural patterns

---

### 2. Code Review Agent 🤖

#### Purpose
Review all code changes for best practices, type safety, architectural consistency, and potential bugs before committing.

#### Type
AI-powered code reviewer

#### Trigger Conditions
- Before committing changes
- Before creating pull requests
- When Implementation Agent completes a feature

#### Core Responsibilities

##### Technical Review
- ✅ Verify TypeScript strict mode compliance
- ✅ Check adherence to CLIENT_ARCHITECTURE.md patterns
- ✅ Identify potential bugs or anti-patterns
- ✅ Ensure proper error handling in API routes
- ✅ Validate proper use of Zustand store patterns
- ✅ Check for accessibility issues in UI components

##### Code Quality Checks
- ✅ No `any` types used
- ✅ No console.log statements left
- ✅ Proper error boundaries implemented
- ✅ Loading states handled
- ✅ No hardcoded values (use constants)
- ✅ Comments added for complex logic

##### Performance Review
- ✅ No unnecessary re-renders
- ✅ Proper memoization where needed
- ✅ Efficient state updates
- ✅ Bundle size impact acceptable

#### Review Checklist
```markdown
- [ ] TypeScript strict mode compliant
- [ ] Follows architectural patterns
- [ ] Error handling implemented
- [ ] Tests cover edge cases
- [ ] No performance red flags
- [ ] Accessibility standards met
- [ ] Security vulnerabilities checked
```

#### Success Criteria
- [ ] All review items pass
- [ ] No critical issues found
- [ ] Best practices followed
- [ ] Ready for human approval

---

### 3. Testing Agent 🤖

#### Purpose
Generate comprehensive test coverage for features, utilities, and integrations.

#### Type
AI-powered test generator

#### Trigger Conditions
- When implementing new features
- When fixing bugs (regression tests)
- When refactoring code

#### Core Responsibilities

##### Test Generation
- ✅ Write unit tests for utility functions (algorithms.ts, utils.ts)
- ✅ Create integration tests for Zustand store actions
- ✅ Test API routes (/api/places, /api/geocode)
- ✅ Generate test cases for edge conditions

##### Coverage Areas
```
1. Utility Functions
   - calculateCentroid()
   - calculateMEC()
   - Distance calculations

2. Store Actions
   - addParticipant()
   - updateCentroid()
   - searchVenues()

3. API Routes
   - /api/places/search
   - /api/geocode

4. Edge Cases
   - 0 participants
   - Single participant
   - Very distant participants
   - No search results
```

##### Test Quality
- ✅ Clear test descriptions
- ✅ AAA pattern (Arrange, Act, Assert)
- ✅ Mock external dependencies
- ✅ Test both happy and error paths

#### Example Test Structure
```typescript
describe('calculateCentroid', () => {
  it('should return null for empty array', () => {
    expect(calculateCentroid([])).toBeNull();
  });

  it('should calculate correct centroid for 2 points', () => {
    const result = calculateCentroid([
      { lat: 40, lng: -74 },
      { lat: 42, lng: -72 }
    ]);
    expect(result).toEqual({ lat: 41, lng: -73 });
  });

  it('should handle edge case: all points at same location', () => {
    // ...
  });
});
```

#### Success Criteria
- [ ] >80% code coverage for utilities
- [ ] >60% coverage for components
- [ ] All edge cases tested
- [ ] Tests are maintainable

---

### 4. UI/UX Agent 🤖

#### Purpose
Ensure consistent, accessible, and user-friendly interface design following UIUX_GUIDE.md patterns.

#### Type
AI-powered UI/UX reviewer

#### Trigger Conditions
- During implementation (parallel with Implementation Agent)
- Before PR review
- When UI components are modified

#### Core Responsibilities

##### 1. Design System Compliance
- ✅ Verify Tailwind CSS usage follows UIUX_GUIDE.md patterns
- ✅ Check spacing, sizing, and layout consistency
- ✅ Validate color usage matches defined palette
- ✅ Ensure typography follows hierarchy

**Spacing Scale Check**:
```
Standard spacing: 4, 8, 12, 16, 24, 32, 48, 64px
Tailwind classes: p-1, p-2, p-3, p-4, p-6, p-8, p-12, p-16
```

##### 2. Responsive Design
- ✅ Test layouts across breakpoints
  - Mobile: 320-640px
  - Tablet: 640-1024px
  - Desktop: 1024px+
- ✅ Verify map and sidebar adapt properly
- ✅ Check touch targets are ≥44x44px on mobile

##### 3. Accessibility (WCAG 2.1 AA)
- ✅ Color contrast ratios meet standards
  - Normal text: 4.5:1 minimum
  - Large text: 3:1 minimum
- ✅ Validate keyboard navigation and focus indicators
- ✅ Check ARIA labels for interactive elements
- ✅ Verify screen reader compatibility

##### 4. User Experience
- ✅ Review user flows for intuitive interactions
- ✅ Validate loading states, error messages, empty states
- ✅ Check micro-interactions (hover, focus, active states)
- ✅ Ensure feedback for user actions

##### 5. Component Consistency
- ✅ Verify components match COMPONENT_GUIDE.md specs
- ✅ Check for design inconsistencies
- ✅ Validate icon usage (size, color, semantic meaning)

#### Review Checklist
```markdown
- [ ] Spacing uses Tailwind scale (p-4, m-8, gap-6, etc.)
- [ ] Colors use defined palette (text-gray-900, bg-coral-500, etc.)
- [ ] Buttons have consistent styling and states
- [ ] Focus indicators visible for keyboard navigation
- [ ] Error states use red-600, success uses green-600
- [ ] Loading spinners centered and appropriately sized
- [ ] Mobile layout tested at 375px width
- [ ] Touch targets ≥44px on mobile
- [ ] Cat theme elements consistent (tails, ears, colors)
```

#### Success Criteria
- [ ] All design system checks pass
- [ ] Responsive across all breakpoints
- [ ] WCAG 2.1 AA compliant
- [ ] Consistent user experience

---

### 5. Documentation Agent 🤖

#### Purpose
Automatically update technical documentation when code changes occur.

#### Type
AI-powered documentation updater

#### Trigger Conditions
- After implementation is complete
- When API contracts change
- When new components are added
- When store structure changes

#### Core Responsibilities

##### Document Updates
- ✅ Update API_SPEC.md when API changes
- ✅ Update COMPONENT_GUIDE.md when new components added
- ✅ Update STATE_MANAGEMENT.md when store changes
- ✅ Add/update JSDoc comments in code
- ✅ Write migration notes for breaking changes

##### Documentation Quality
- ✅ Keep docs in sync with code
- ✅ Clear examples provided
- ✅ Edge cases documented
- ✅ Migration paths explained

#### Files to Update
```
1. API_SPEC.md
   - New endpoints
   - Request/response changes
   - Error codes

2. COMPONENT_GUIDE.md
   - New components
   - Props changes
   - Usage examples

3. STATE_MANAGEMENT.md
   - New store actions
   - State structure changes
   - Selector patterns

4. TROUBLESHOOTING.md
   - Known issues
   - Solutions found
```

#### Success Criteria
- [ ] All relevant docs updated
- [ ] Examples are accurate
- [ ] Breaking changes documented
- [ ] Migration guides provided

---

## Automated Quality Agents (Tools)

### Tool Summary Table

| Tool | Type | Trigger | Purpose | Auto-Fix |
|------|------|---------|---------|----------|
| **TypeScript Compiler** | Tool | On save | Type checking | ❌ No |
| **ESLint** | Tool | Pre-commit | Code quality | ✅ Yes |
| **Prettier** | Tool | Pre-commit | Code formatting | ✅ Yes |
| **Husky + Lint-Staged** | Tool | Pre-commit | Quality gates | ✅ Yes |
| **GitHub Actions** | Tool | Push/PR | CI/CD pipeline | ❌ No |

---

### 6. TypeScript Compiler ⚙️

#### Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true
  }
}
```

#### Trigger
- On every file save (IDE integration)
- Pre-commit hook
- CI/CD pipeline

#### Command
```bash
tsc --noEmit
```

#### Success Criteria
- Zero TypeScript errors

---

### 7. ESLint ⚙️

#### Configuration
- Next.js ESLint config
- React hooks rules
- TypeScript-specific rules
- Import ordering

#### Trigger
- Pre-commit hook
- CI/CD pipeline

#### Command
```bash
npm run lint
npm run lint:fix  # Auto-fix
```

#### Rules Enforced
- No unused variables
- Proper hook dependencies
- Import order
- Naming conventions

---

### 8. Prettier ⚙️

#### Configuration
```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

#### Trigger
- Pre-commit hook (auto-format)
- On save (IDE)

#### Command
```bash
prettier --write .
```

---

### 9. Husky + Lint-Staged ⚙️

#### Purpose
Pre-commit quality gates to prevent bad code from being committed.

#### Configuration
```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "vitest related --run"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

#### Actions on Commit
1. Run ESLint on staged files
2. Run Prettier on staged files
3. Run TypeScript type checking
4. Run affected tests

---

### 10. GitHub Actions CI/CD ⚙️

#### Pipeline Stages

```yaml
name: CI/CD Pipeline

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - Install dependencies
      - Run TypeScript checks
      - Run linter
      - Run all tests
      - Build production bundle
      - Check bundle size
```

#### Quality Gates
- ✅ TypeScript: Zero errors
- ✅ ESLint: Zero errors
- ✅ Tests: 100% pass rate
- ✅ Build: Successful
- ⚠️ Bundle size: Warn if >500KB increase

---

## Agent Workflow Integration

### Phase-Based Agent Usage

```
┌────────────────────────────────────────────────┐
│ PHASE 1: PLAN                                  │
│ Agent: None (Human-led)                        │
│ Output: Feature spec document                  │
└────────────────┬───────────────────────────────┘
                 ▼
┌────────────────────────────────────────────────┐
│ PHASE 2: IMPLEMENT                             │
│ Primary: Implementation Agent 🤖               │
│ Supporting: Testing Agent 🤖                   │
│ Output: Working code + tests                   │
└────────────────┬───────────────────────────────┘
                 ▼
┌────────────────────────────────────────────────┐
│ PHASE 3: QUALITY ASSURANCE                     │
│ Agents: Code Review Agent 🤖 + UI/UX Agent 🤖  │
│ Tools: TypeScript, ESLint, Prettier            │
│ Output: Reviewed, validated code               │
└────────────────┬───────────────────────────────┘
                 ▼
┌────────────────────────────────────────────────┐
│ PHASE 4: DOCUMENT                              │
│ Agent: Documentation Agent 🤖                  │
│ Output: Updated docs                           │
└────────────────┬───────────────────────────────┘
                 ▼
┌────────────────────────────────────────────────┐
│ PHASE 5: COMMIT & PR                           │
│ Tool: GitHub Actions ⚙️                        │
│ Human: Final approval                          │
│ Output: Merged PR                              │
└────────────────────────────────────────────────┘
```

---

## Agent Responsibility Matrix

| Task | Implementation | Code Review | Testing | UI/UX | Documentation | Human |
|------|---------------|-------------|---------|-------|---------------|-------|
| **Write code** | ✅ Primary | | | | | Review |
| **Write tests** | ✅ Shared | | ✅ Primary | | | Review |
| **Review code** | | ✅ Primary | | | | Approve |
| **Check design** | | | | ✅ Primary | | Approve |
| **Update docs** | | | | | ✅ Primary | Review |
| **Fix bugs** | ✅ Primary | ✅ Review | ✅ Tests | | | Verify |
| **Approve PR** | | | | | | ✅ Required |

---

## Quick Reference: When to Use Which Agent

### Starting a Feature
```
1. Read feature spec (Human)
2. Invoke Implementation Agent 🤖
```

### Before Committing
```
1. Implementation Agent self-validates
2. Invoke Code Review Agent 🤖
3. Invoke UI/UX Agent 🤖 (if UI changes)
```

### After Implementation
```
1. Invoke Testing Agent 🤖 (if not done)
2. Invoke Documentation Agent 🤖
```

### Before Merging PR
```
1. GitHub Actions runs automatically ⚙️
2. Human final approval ✅
```

---

## Summary

**Total Agents**: 10 (5 AI + 5 Automated Tools)

**Key Benefits**:
- ✅ Consistent code quality
- ✅ Comprehensive test coverage
- ✅ Up-to-date documentation
- ✅ Design system compliance
- ✅ Reduced human review burden

**Human Involvement**:
- Planning: 100%
- Implementation: 0-20%
- Review: 30-50%
- Approval: 100%

**Success Factors**:
- Use agents proactively, not reactively
- Trust agent validation
- Keep specs clear and detailed
- Review agent outputs regularly

---

*Last Updated: 2024*
*Version: 1.0*
