# Where2Meet - Feature Implementation Workflow Guide

> Step-by-step workflow for implementing features in Where2Meet

---

## Feature Implementation Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: PLANNING & SPECIFICATION                          │
│ Human: Write feature spec → docs/features/FEATURE_NAME.md  │
│ Human: Approve spec                                         │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: IMPLEMENTATION (TDD WORKFLOW)                      │
│ Agent: Implementation Agent 🤖                              │
│                                                             │
│  1. Read feature spec                                       │
│  2. Define types in types/index.ts                          │
│  3. Write failing tests (for utils/algorithms)              │
│  4. Implement utility functions to pass tests               │
│  5. Build UI components (atomic → composite)                │
│  6. Integrate Zustand store actions                         │
│  7. Add error/loading states                                │
│  8. Self-validate (type-check, lint, test, browser)         │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: QUALITY ASSURANCE                                  │
│                                                             │
│  Parallel Reviews:                                          │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Code Review Agent│  │ UI/UX Agent      │                │
│  │ 🤖               │  │ 🤖               │                │
│  │ - Type safety    │  │ - Design system  │                │
│  │ - Architecture   │  │ - Accessibility  │                │
│  │ - Performance    │  │ - Responsiveness │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
│  Agent: Testing Agent 🤖                                    │
│  - Generate additional test coverage                        │
│  - Edge case validation                                     │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: DOCUMENTATION                                      │
│ Agent: Documentation Agent 🤖                               │
│ - Update API_SPEC.md (if API changes)                       │
│ - Update COMPONENT_GUIDE.md (if new components)             │
│ - Update STATE_MANAGEMENT.md (if store changes)             │
│ - Add JSDoc comments                                        │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: COMMIT & PR                                        │
│ Tool: Husky Pre-commit Hooks ⚙️                             │
│ - Auto-format with Prettier                                 │
│ - Run ESLint --fix                                          │
│ - Run TypeScript type check                                 │
│ - Run affected tests                                        │
│                                                             │
│ Human: Create PR                                            │
│ Tool: GitHub Actions CI/CD ⚙️                               │
│ - Run full test suite                                       │
│ - Build production bundle                                   │
│ - Check bundle size                                         │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 6: MERGE                                              │
│ Human: Review PR                                            │
│ Human: Approve & Merge                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Concrete Example: Participant Management Feature

### Feature: Add, Edit, and Display Participants

**Feature Spec**: `docs/features/participant-management.md`

---

### PHASE 1: Planning & Specification (Human)

**Spec Document**:
```markdown
# Feature: Participant Management

## Overview
Allow users to add participants with addresses, display them as cat-themed pills, and show them on the map.

## Acceptance Criteria
- [ ] User can add participant name and address
- [ ] Participants display as cat pills with tails, ears, feet
- [ ] Each participant gets random color avatar
- [ ] Participant appears as marker on map
- [ ] User can edit participant details
- [ ] User can delete participant

## Edge Cases
- Empty participant name
- Invalid address (geocoding fails)
- Duplicate participants
- 0 participants (empty state)
- 10+ participants (scrolling)
```

**Human Action**: Approve spec ✅

---

### PHASE 2: Implementation (Implementation Agent 🤖)

#### Step 1: Define Types
**File**: `src/types/index.ts`
```typescript
export interface Participant {
  id: string;
  name: string;
  address: string;
  location?: {
    lat: number;
    lng: number;
  };
  color: string;
  avatarUrl?: string;
}
```

#### Step 2: Write Failing Tests
**File**: `src/__tests__/utils/participant.test.ts`
```typescript
import { generateParticipantColor, getInitials } from '@/lib/utils/participant';

describe('Participant Utilities', () => {
  it('should generate consistent color for same ID', () => {
    const color1 = generateParticipantColor('user-123');
    const color2 = generateParticipantColor('user-123');
    expect(color1).toBe(color2);
  });

  it('should return initials from full name', () => {
    expect(getInitials('Alice Johnson')).toBe('AJ');
    expect(getInitials('Bob')).toBe('B');
  });
});
```

**Run**: `npm run test` → ❌ FAIL (functions don't exist)

#### Step 3: Implement Utilities
**File**: `src/lib/utils/participant.ts`
```typescript
const COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500',
  'bg-teal-500', 'bg-cyan-500',
];

export function generateParticipantColor(id: string): string {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
```

**Run**: `npm run test` → ✅ PASS

#### Step 4: Build UI Components (Bottom-Up)

**Atomic Component**: `src/components/cat/CatTail.tsx`
```typescript
export const CatTail = () => (
  <svg width="40" height="64" viewBox="0 0 40 64">
    <path
      d="M 6 32 Q 10 20, 18 28 Q 26 36, 42 32"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
      strokeLinecap="round"
      className="stroke-border"
    />
  </svg>
);
```

**Composite Component**: `src/components/sidebar/ParticipantItem.tsx`
```typescript
'use client';

import { CatTail } from '@/components/cat/CatTail';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Participant } from '@/types';
import { generateParticipantColor, getInitials } from '@/lib/utils/participant';

interface ParticipantItemProps {
  participant: Participant;
  onClick?: () => void;
}

export const ParticipantItem = ({ participant, onClick }: ParticipantItemProps) => {
  const color = generateParticipantColor(participant.id);
  const initials = getInitials(participant.name);

  return (
    <div className="relative w-full pb-3">
      <div className="flex items-center gap-3 cursor-pointer" onClick={onClick}>
        <CatTail />
        <div className="flex-1 bg-background border rounded-full px-4 py-2">
          <span className="text-sm font-medium">{participant.name}</span>
          <div className="text-xs text-muted-foreground">{participant.address}</div>
        </div>
        <Avatar className={`w-10 h-10 ${color}`}>
          <AvatarFallback className="text-white">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
};
```

#### Step 5: Integrate Zustand Store
**File**: `src/store/useMeetingStore.ts`
```typescript
import { create } from 'zustand';
import { Participant } from '@/types';

interface MeetingStore {
  participants: Participant[];
  addParticipant: (participant: Participant) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  deleteParticipant: (id: string) => void;
}

export const useMeetingStore = create<MeetingStore>((set) => ({
  participants: [],

  addParticipant: (participant) => set((state) => ({
    participants: [...state.participants, participant],
  })),

  updateParticipant: (id, updates) => set((state) => ({
    participants: state.participants.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    ),
  })),

  deleteParticipant: (id) => set((state) => ({
    participants: state.participants.filter((p) => p.id !== id),
  })),
}));
```

#### Step 6: Add Error/Loading States
**File**: `src/components/sidebar/ParticipantList.tsx`
```typescript
'use client';

import { useState } from 'react';
import { useMeetingStore } from '@/store/useMeetingStore';
import { ParticipantItem } from './ParticipantItem';
import { Loader2 } from 'lucide-react';

export const ParticipantList = () => {
  const { participants } = useMeetingStore();
  const [isLoading, setIsLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No participants yet. Add your first participant!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {participants.map((participant) => (
        <ParticipantItem key={participant.id} participant={participant} />
      ))}
    </div>
  );
};
```

#### Step 7: Self-Validate
```bash
npm run type-check  # ✅ Zero errors
npm run lint        # ✅ Zero errors
npm run test        # ✅ All tests pass (8/8)
# Manual browser testing
# ✅ Can add participant
# ✅ Cat theme displays correctly
# ✅ Empty state shows
# ✅ Loading state works
```

**Implementation Agent**: ✅ Complete, handoff to Code Review Agent

---

### PHASE 3: Quality Assurance

#### Code Review Agent 🤖

**Review Checklist**:
- ✅ TypeScript strict mode compliant (no `any` types)
- ✅ Follows CLIENT_ARCHITECTURE.md patterns
- ✅ Proper error handling (empty state, invalid address)
- ✅ Zustand store actions immutable (using spread operator)
- ✅ No console.log statements
- ✅ Component size <200 lines
- ✅ Tailwind CSS only (no inline styles)

**Result**: ✅ Approved

#### UI/UX Agent 🤖

**Review Checklist**:
- ✅ Spacing uses Tailwind scale (p-4, gap-3, pb-3)
- ✅ Colors use defined palette (bg-background, text-foreground)
- ✅ Cat tail, ears, feet consistent with ParticipantComponent.ts
- ✅ All shapes rounded (rounded-full for pill)
- ✅ Focus indicators visible
- ✅ Empty state messaging clear
- ✅ Loading spinner centered
- ✅ Responsive at 375px mobile width
- ✅ Touch targets ≥44px on mobile

**Result**: ✅ Approved

#### Testing Agent 🤖

**Additional Test Coverage**:
```typescript
// src/__tests__/store/useMeetingStore.test.ts
describe('useMeetingStore - Participant Actions', () => {
  it('should add participant to empty array', () => {
    const { result } = renderHook(() => useMeetingStore());
    act(() => {
      result.current.addParticipant({
        id: '1',
        name: 'Alice',
        address: '123 Main St',
        color: 'bg-red-500',
      });
    });
    expect(result.current.participants).toHaveLength(1);
  });

  it('should update participant immutably', () => {
    // Test immutability...
  });

  it('should delete participant', () => {
    // Test deletion...
  });
});
```

**Coverage**: 85% (✅ >80% target met)

---

### PHASE 4: Documentation (Documentation Agent 🤖)

**Updates**:

1. **COMPONENT_GUIDE.md**:
```markdown
### ParticipantItem
**Location**: `src/components/sidebar/ParticipantItem.tsx`
**Purpose**: Display single participant as cat-themed pill

**Props**:
- participant: Participant (required)
- onClick?: () => void (optional)

**Features**:
- Cat tail (SVG)
- Cat ears on avatar
- Random color avatar
- Displays name and address
```

2. **STATE_MANAGEMENT.md**:
```markdown
### Participant Management Actions

- addParticipant(participant: Participant): void
- updateParticipant(id: string, updates: Partial<Participant>): void
- deleteParticipant(id: string): void
```

3. **JSDoc Comments**:
```typescript
/**
 * Generates a consistent color for a participant based on their ID
 * @param id - Unique participant identifier
 * @returns Tailwind CSS color class (e.g., 'bg-red-500')
 */
export function generateParticipantColor(id: string): string {
  // ...
}
```

---

### PHASE 5: Commit & PR

#### Pre-commit Hooks (Husky)
```bash
# Automatically runs on `git commit`
✅ Prettier --write (formatted 8 files)
✅ ESLint --fix (0 errors, 0 warnings)
✅ TypeScript check (0 errors)
✅ Affected tests (8 passed)
```

#### Create Pull Request
```bash
git checkout -b feature/participant-management
git add .
git commit -m "feat: implement participant management with cat-themed UI

- Add ParticipantItem component with cat tail, ears, feet
- Implement Zustand store actions (add, update, delete)
- Add participant utilities (color generation, initials)
- Include empty and loading states
- Add comprehensive test coverage (85%)

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

git push -u origin feature/participant-management

gh pr create --title "Feature: Participant Management" --body "$(cat <<'EOF'
## Summary
- Implements participant add/edit/delete functionality
- Cat-themed UI components (tail, ears, feet, random colors)
- Zustand store integration with immutable updates
- 85% test coverage for utilities and store actions

## Test Plan
- [x] Unit tests pass (8/8)
- [x] Type checking passes
- [x] Linting passes
- [x] Manual testing: add, edit, delete participants
- [x] Manual testing: empty state displays correctly
- [x] Manual testing: responsive on mobile (375px)
- [x] Accessibility: keyboard navigation works
- [x] Accessibility: screen reader labels present

🤖 Generated with Claude Code
EOF
)"
```

#### GitHub Actions CI/CD
```yaml
✅ Install dependencies (2m 14s)
✅ TypeScript type-check (0 errors)
✅ ESLint (0 errors, 0 warnings)
✅ Run all tests (42 passed, 0 failed)
✅ Build production bundle (successful)
⚠️ Bundle size check (+12KB, within limit)
```

**CI Result**: ✅ All checks passed

---

### PHASE 6: Merge (Human)

**Human Review**:
- Code quality: ✅ Excellent
- Design: ✅ Matches cat theme perfectly
- Functionality: ✅ All acceptance criteria met
- Tests: ✅ Comprehensive coverage

**Human Action**: Approve & Merge ✅

```bash
gh pr merge --squash
```

**Feature Complete**: ✅ Participant Management shipped to main

---

## Summary

### Timeline for This Feature
- **Planning**: 30 minutes (human)
- **Implementation**: 2-3 hours (Implementation Agent)
- **QA Reviews**: 30 minutes (Code Review + UI/UX + Testing Agents in parallel)
- **Documentation**: 15 minutes (Documentation Agent)
- **PR & CI**: 10 minutes (automated)
- **Human Review**: 15 minutes
- **Total**: ~4 hours

### Key Success Factors
1. ✅ Clear feature spec with acceptance criteria
2. ✅ TDD workflow ensures working code
3. ✅ Parallel agent reviews catch issues early
4. ✅ Automated quality gates prevent regressions
5. ✅ Comprehensive documentation for future reference

---

## Workflow Variations

### For Bug Fixes
```
Skip Phase 1 (Planning) → Start at Phase 2
Add regression test first → Fix bug → All other phases same
```

### For UI-Only Changes
```
Phase 1 → Phase 2 (skip tests for pure styling) →
Phase 3 (UI/UX Agent primary) → Phase 5-6
```

### For Utility Functions
```
Phase 1 → Phase 2 (focus on TDD, no UI) →
Phase 3 (Code Review + Testing Agents) → Phase 4-6
```

---

*This workflow ensures consistent, high-quality feature delivery with minimal human intervention while maintaining full visibility and control.*
