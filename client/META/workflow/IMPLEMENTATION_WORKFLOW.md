# Implementation Workflow

This document outlines the complete development workflow for implementing features in Where2Meet, from planning to deployment.

## Table of Contents
1. [Overview](#overview)
2. [Pre-Implementation Phase](#pre-implementation-phase)
3. [Implementation Phase](#implementation-phase)
4. [Quality Assurance Phase](#quality-assurance-phase)
5. [Documentation Phase](#documentation-phase)
6. [Commit & PR Phase](#commit--pr-phase)
7. [Post-Merge Phase](#post-merge-phase)

---

## Overview

The Where2Meet development workflow follows TDD (Test-Driven Development) principles and emphasizes:
- **Architecture compliance**: All code follows `CLIENT_ARCHITECTURE.md`
- **Type safety**: TypeScript strict mode with no `any` types
- **Component reusability**: Atomic design principles
- **State management**: Zustand for client state, React Query for server state
- **Testing**: Comprehensive test coverage for utilities and components
- **Accessibility**: WCAG 2.1 AA compliance

---

## Pre-Implementation Phase

### Step 1: Feature Specification

For complex features, create a feature document in `docs/features/FEATURE_NAME.md`:

```markdown
# Feature: Venue Category Filter

## Problem Statement
Users need to filter venues by category (restaurants, cafes, bars, etc.) to find relevant meeting spots.

## User Story
As a user organizing a meetup, I want to filter venues by category so that I can find the most appropriate meeting location for my group.

## Acceptance Criteria
- [ ] User can select a category from a predefined list
- [ ] Map shows only venues matching the selected category
- [ ] Venue list updates to show filtered results
- [ ] User can clear the filter to see all venues
- [ ] Category selection persists when adding/removing participants

## Technical Approach
- Add `selectedCategory` state to `useMeetingStore`
- Create `CategorySelector` component with category buttons
- Update `usePlaceSearch` hook to accept category parameter
- Filter venues client-side or via API

## UI/UX Mockups
[Include screenshots or Figma links]

## Edge Cases
- No venues found for selected category
- Category selection before adding participants
- Switching categories while search is loading

## Estimated Effort
2-3 hours
```

### Step 2: Architecture Review

Review the feature against `CLIENT_ARCHITECTURE.md`:

**Questions to ask**:
1. Does this fit the single-purpose utility model?
2. Should this be a new component or extend an existing one?
3. Does it require new Zustand state or React Query hooks?
4. Will it impact bundle size significantly?
5. Are there any accessibility concerns?

**Architecture Decision Template**:
```markdown
## Architecture Decisions

### State Management
- **Decision**: Add `selectedCategory` to `useMeetingStore`
- **Rationale**: Category selection is client-side, synchronous state
- **Alternatives considered**: URL param, local component state
- **Trade-offs**: Global state allows persistence, but couples components

### Component Structure
- **Decision**: New `CategorySelector` component in `sidebar/`
- **Rationale**: Follows sidebar component organization pattern
- **Dependencies**: Uses `useMeetingStore`, `Button` UI component

### API Integration
- **Decision**: Use existing `/api/places/search` with `type` parameter
- **Rationale**: Google Places API already supports type filtering
- **Changes required**: None
```

### Step 3: Task Breakdown

Break feature into small, testable tasks:

**Example Task List**:
- [ ] Add `selectedCategory` state to `useMeetingStore`
- [ ] Create `CategorySelector` component
- [ ] Add category buttons with icons
- [ ] Integrate `CategorySelector` in sidebar
- [ ] Update `usePlaceSearch` to filter by category
- [ ] Add tests for store action
- [ ] Add tests for `CategorySelector`
- [ ] Update `COMPONENT_GUIDE.md`
- [ ] Manual testing (mobile + desktop)

---

## Implementation Phase

### Step 1: Set Up Branch

```bash
# Always start from main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/venue-category-filter

# Verify you're on the right branch
git branch --show-current
```

**Branch Naming Convention**:
- Features: `feature/description`
- Bug fixes: `fix/description`
- Refactoring: `refactor/description`
- Documentation: `docs/description`

### Step 2: TDD for Utilities

If your feature includes utility functions, **write tests first**:

**Example: Testing a distance calculation function**

```typescript
// __tests__/lib/algorithms.test.ts
import { calculateDistance } from '@/lib/algorithms';

describe('calculateDistance', () => {
  it('should return 0 for the same point', () => {
    const point = { lat: 40.7589, lng: -73.9851 };
    expect(calculateDistance(point, point)).toBe(0);
  });

  it('should calculate distance between two points', () => {
    const point1 = { lat: 40.7589, lng: -73.9851 };
    const point2 = { lat: 40.7614, lng: -73.9776 };
    const distance = calculateDistance(point1, point2);

    // Distance should be roughly 800 meters
    expect(distance).toBeGreaterThan(700);
    expect(distance).toBeLessThan(900);
  });

  it('should handle points across hemispheres', () => {
    const point1 = { lat: 40.7589, lng: -73.9851 };
    const point2 = { lat: -33.8688, lng: 151.2093 }; // Sydney
    const distance = calculateDistance(point1, point2);

    expect(distance).toBeGreaterThan(15000000); // ~16,000 km
  });
});
```

**Then implement the function**:

```typescript
// lib/algorithms.ts

/**
 * Calculates the distance between two geographic points using the Haversine formula
 * @param point1 - First point with lat/lng
 * @param point2 - Second point with lat/lng
 * @returns Distance in meters
 */
export function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
```

**Run tests**:
```bash
npm run test -- algorithms.test.ts
```

### Step 3: Define Types First

Always define TypeScript types before implementation:

```typescript
// types/index.ts

export type PlaceCategory =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'park'
  | 'gym'
  | 'library'
  | 'movie_theater';

export interface Category {
  id: PlaceCategory;
  label: string;
  icon: React.ReactNode;
}

export interface PlaceSearchParams {
  location: {
    lat: number;
    lng: number;
  };
  radius: number;
  type?: PlaceCategory;
  keyword?: string;
}
```

### Step 4: Update Zustand Store

Add new state and actions:

```typescript
// store/useMeetingStore.ts

interface MeetingState {
  // ... existing state
  selectedCategory: PlaceCategory | null;

  // ... existing actions
  setSelectedCategory: (category: PlaceCategory | null) => void;
}

export const useMeetingStore = create<MeetingState>()(
  devtools((set) => ({
    // ... existing state
    selectedCategory: null,

    // ... existing actions
    setSelectedCategory: (category) => set({ selectedCategory: category }),
  }))
);
```

**Test the store action**:

```typescript
// __tests__/store/useMeetingStore.test.ts

import { useMeetingStore } from '@/store/useMeetingStore';

describe('useMeetingStore - category selection', () => {
  beforeEach(() => {
    useMeetingStore.getState().reset();
  });

  it('should set selected category', () => {
    const { setSelectedCategory } = useMeetingStore.getState();

    setSelectedCategory('restaurant');

    expect(useMeetingStore.getState().selectedCategory).toBe('restaurant');
  });

  it('should clear selected category', () => {
    const { setSelectedCategory } = useMeetingStore.getState();

    setSelectedCategory('restaurant');
    setSelectedCategory(null);

    expect(useMeetingStore.getState().selectedCategory).toBeNull();
  });
});
```

### Step 5: Build Components Bottom-Up

Start with atomic components, then compose:

#### 5.1 Create UI Components

```tsx
// components/ui/CategoryButton.tsx

import { cn } from '@/lib/utils';

interface CategoryButtonProps {
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}

export function CategoryButton({
  label,
  icon,
  isSelected,
  onClick,
}: CategoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
        isSelected
          ? 'border-blue-600 bg-blue-50 text-blue-900'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
```

#### 5.2 Create Feature Component

```tsx
// components/sidebar/CategorySelector.tsx

import { Utensils, Coffee, Beer, TreePine, Dumbbell, Book } from 'lucide-react';
import { CategoryButton } from '@/components/ui/CategoryButton';
import { useMeetingStore } from '@/store/useMeetingStore';
import type { PlaceCategory, Category } from '@/types';

const categories: Category[] = [
  { id: 'restaurant', label: 'Restaurants', icon: <Utensils className="w-6 h-6" /> },
  { id: 'cafe', label: 'Cafes', icon: <Coffee className="w-6 h-6" /> },
  { id: 'bar', label: 'Bars', icon: <Beer className="w-6 h-6" /> },
  { id: 'park', label: 'Parks', icon: <TreePine className="w-6 h-6" /> },
  { id: 'gym', label: 'Gyms', icon: <Dumbbell className="w-6 h-6" /> },
  { id: 'library', label: 'Libraries', icon: <Book className="w-6 h-6" /> },
];

export function CategorySelector() {
  const selectedCategory = useMeetingStore(state => state.selectedCategory);
  const setSelectedCategory = useMeetingStore(state => state.setSelectedCategory);

  const handleCategoryClick = (categoryId: PlaceCategory) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null); // Deselect
    } else {
      setSelectedCategory(categoryId);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Select Category
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {categories.map(category => (
          <CategoryButton
            key={category.id}
            label={category.label}
            icon={category.icon}
            isSelected={selectedCategory === category.id}
            onClick={() => handleCategoryClick(category.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Step 6: Integration

Integrate the new component into the app:

```tsx
// components/sidebar/Sidebar.tsx

import { LocationInput } from './LocationInput';
import { ParticipantList } from './ParticipantList';
import { CategorySelector } from './CategorySelector'; // New import
import { VenueList } from './VenueList';

export function Sidebar() {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <LocationInput />
      <ParticipantList />
      <CategorySelector /> {/* New component */}
      <VenueList />
    </div>
  );
}
```

### Step 7: Error Handling

Add proper error handling:

```tsx
// hooks/usePlaceSearch.ts

import { useQuery } from '@tanstack/react-query';
import { useMeetingStore } from '@/store/useMeetingStore';

export function usePlaceSearch() {
  const centroid = useMeetingStore(state => state.centroid);
  const searchRadius = useMeetingStore(state => state.searchRadius);
  const selectedCategory = useMeetingStore(state => state.selectedCategory);

  return useQuery({
    queryKey: ['places', centroid, searchRadius, selectedCategory],
    queryFn: async () => {
      if (!centroid) {
        throw new Error('No centroid available');
      }

      const response = await fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: centroid,
          radius: searchRadius,
          type: selectedCategory,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(data.error_message || 'Failed to fetch places');
      }

      return data.results || [];
    },
    enabled: !!centroid && !!selectedCategory,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}
```

---

## Quality Assurance Phase

### Step 1: Self-Review Checklist

Before asking for review, complete this checklist:

- [ ] **TypeScript**: All type errors resolved, no `any` types
- [ ] **ESLint**: No linter errors or warnings
- [ ] **Tests**: All tests passing, new tests added for new code
- [ ] **Build**: `npm run build` completes successfully
- [ ] **Console**: No console errors or warnings in browser
- [ ] **Accessibility**:
  - [ ] Keyboard navigation works
  - [ ] ARIA labels added where needed
  - [ ] Color contrast meets WCAG AA
  - [ ] Focus indicators visible
- [ ] **Responsive Design**:
  - [ ] Works on mobile (375px)
  - [ ] Works on tablet (768px)
  - [ ] Works on desktop (1024px+)
- [ ] **Edge Cases**: Tested empty states, error states, loading states
- [ ] **Performance**: No unnecessary re-renders, queries are optimized
- [ ] **Comments**: Complex logic is documented
- [ ] **Cleanup**: No commented-out code, console.logs removed

### Step 2: Automated Checks

Run all automated checks locally:

```bash
# TypeScript check
npm run type-check

# Linting
npm run lint

# Tests
npm run test

# Build
npm run build
```

### Step 3: Manual Testing

**Test Matrix**:

| Feature | Mobile | Tablet | Desktop | Notes |
|---------|--------|--------|---------|-------|
| Category selection | ✅ | ✅ | ✅ | Touch targets adequate |
| Venue filtering | ✅ | ✅ | ✅ | Results update correctly |
| Clear filter | ✅ | ✅ | ✅ | UI resets properly |
| No results | ✅ | ✅ | ✅ | Empty state displays |
| Loading state | ✅ | ✅ | ✅ | Spinner shows |

**Browsers to Test**:
- Chrome (latest)
- Safari (latest)
- Firefox (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

---

## Documentation Phase

### Update Relevant Documentation

- [ ] **COMPONENT_GUIDE.md**: Add `CategorySelector` usage example
- [ ] **STATE_MANAGEMENT.md**: Document `selectedCategory` state
- [ ] **API_SPEC.md**: Update if API routes changed
- [ ] **UIUX_GUIDE.md**: Add category button pattern if new
- [ ] **TROUBLESHOOTING.md**: Add any gotchas discovered

**Example Documentation Update**:

```markdown
<!-- COMPONENT_GUIDE.md -->

### CategorySelector

**Purpose**: Allows users to filter venues by category.

**Location**: `src/components/sidebar/CategorySelector.tsx`

**Props**: None (uses Zustand store)

**Usage**:
```tsx
import { CategorySelector } from '@/components/sidebar/CategorySelector';

<CategorySelector />
```

**Categories**:
- Restaurant, Cafe, Bar, Park, Gym, Library

**Behavior**:
- Click to select category
- Click again to deselect
- Only one category can be selected at a time
- Triggers venue search automatically
```

---

## Commit & PR Phase

### Step 1: Commit with Conventional Commits

```bash
# Stage changes
git add .

# Review changes before committing
git diff --staged

# Commit with descriptive message
git commit -m "feat(sidebar): add venue category filter

- Add selectedCategory state to useMeetingStore
- Create CategorySelector component with 6 categories
- Update usePlaceSearch to filter by selected category
- Add tests for category selection
- Update COMPONENT_GUIDE.md with CategorySelector docs

Closes #42"
```

**Conventional Commit Format**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semi-colons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding tests
- `chore`: Updating build tasks, package manager configs, etc.

**Scopes** (optional):
- `sidebar`, `map`, `api`, `store`, `ui`, `lib`

### Step 2: Push and Create PR

```bash
# Push to remote
git push -u origin feature/venue-category-filter

# Create PR using GitHub CLI (optional)
gh pr create --title "Add venue category filter" --body "$(cat <<'EOF'
## Summary
Adds ability to filter venues by category (restaurants, cafes, bars, parks, gyms, libraries).

## Changes
- Added `selectedCategory` state to `useMeetingStore`
- Created `CategorySelector` component in sidebar
- Updated `usePlaceSearch` hook to filter by category
- Added comprehensive tests for store and component
- Updated documentation

## Screenshots
[Add screenshots showing category selection and filtering]

## Testing
- [x] Unit tests added and passing
- [x] Manual testing on mobile, tablet, desktop
- [x] Tested all 6 categories
- [x] Tested empty results scenario
- [x] Keyboard navigation works
- [x] Screen reader compatible

## Checklist
- [x] Code follows style guidelines
- [x] Self-review completed
- [x] No TypeScript errors
- [x] All tests passing
- [x] Documentation updated

## Closes
Closes #42
EOF
)"
```

### Step 3: Address PR Feedback

```bash
# Make requested changes
# ... edit files ...

# Commit changes
git add .
git commit -m "fix: address PR feedback

- Increase touch target size on mobile
- Add loading state to category buttons
- Fix type error in CategoryButton"

# Push updates
git push
```

### Step 4: Merge

Once approved:
- Squash and merge (recommended for feature branches)
- Or regular merge (for multi-commit features)

```bash
# After merge, clean up local branch
git checkout main
git pull origin main
git branch -d feature/venue-category-filter
```

---

## Post-Merge Phase

### Step 1: Verify Deployment

- Check production build on Vercel/Netlify
- Smoke test core functionality
- Check Sentry/error tracking for new errors
- Monitor performance metrics

### Step 2: Update Project Board

- Move issue to "Done"
- Update sprint progress
- Close related issues

### Step 3: Retrospective (if needed)

**Questions to ask**:
- What went well?
- What could be improved?
- Did we follow the architecture?
- Were estimates accurate?
- Any new patterns to document?

**Update this document** with learnings:
```markdown
## Lessons Learned

### 2024-01-15: Category Filter Implementation
**What worked**: TDD approach caught edge case early
**What didn't**: Underestimated time for mobile styling
**Action**: Add 50% buffer for mobile responsiveness in estimates
```

---

## Quick Reference: Daily Workflow

### Starting Work
```bash
git checkout main && git pull
git checkout -b feature/my-feature
```

### During Development
```bash
# Run tests in watch mode
npm run test:watch

# Check types continuously
npm run type-check -- --watch

# Run dev server
npm run dev
```

### Before Committing
```bash
npm run type-check
npm run lint
npm run test
npm run build
git diff --staged  # Review changes
```

### Creating PR
```bash
git push -u origin feature/my-feature
# Create PR on GitHub with template
```

---

## Troubleshooting

See `TROUBLESHOOTING.md` for common issues and solutions.

**Common Issues**:
- Build failures → Check `TROUBLESHOOTING.md#build-errors`
- Test failures → Check `TESTING_STRATEGY.md`
- Type errors → Check `CLIENT_ARCHITECTURE.md#typescript-patterns`
- Component issues → Check `COMPONENT_GUIDE.md`
