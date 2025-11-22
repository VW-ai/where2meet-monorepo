# Testing Strategy

This document outlines the testing approach, tools, and best practices for Where2Meet.

## Table of Contents
1. [Testing Philosophy](#testing-philosophy)
2. [Testing Tools](#testing-tools)
3. [Testing Pyramid](#testing-pyramid)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [Component Testing](#component-testing)
7. [E2E Testing](#e2e-testing)
8. [Coverage Goals](#coverage-goals)
9. [Mocking Patterns](#mocking-patterns)
10. [CI/CD Integration](#cicd-integration)

---

## Testing Philosophy

Where2Meet follows a **pragmatic testing approach**:

- **Test behavior, not implementation**: Tests should verify what the code does, not how it does it
- **Write tests you trust**: If a test doesn't catch bugs, it's not valuable
- **Fast feedback**: Tests should run quickly to enable TDD
- **Maintainable tests**: Tests should be easy to update when requirements change
- **Coverage is a guide, not a goal**: Aim for high coverage, but prioritize critical paths

**Key Principles**:
1. Write tests first for utility functions (TDD)
2. Test user-facing behavior for components
3. Mock external dependencies (APIs, Google Maps)
4. Test edge cases and error states
5. Keep tests simple and readable

---

## Testing Tools

### Core Testing Framework: Vitest

**Why Vitest**:
- Fast (uses Vite's transform pipeline)
- Compatible with Jest API
- Built-in TypeScript support
- Great DX with watch mode

**Installation**:
```bash
npm install -D vitest @vitest/ui
```

**Configuration** (`vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'vitest.setup.ts',
        '**/*.config.ts',
        '**/*.d.ts',
        '**/types/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### React Testing Library

**Why React Testing Library**:
- Tests components from user perspective
- Encourages accessibility best practices
- Prevents implementation detail testing

**Installation**:
```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### Setup File (`vitest.setup.ts`):
```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Google Maps (if needed)
global.google = {
  maps: {
    Map: vi.fn(),
    Marker: vi.fn(),
    LatLng: vi.fn(),
    // Add other Google Maps mocks as needed
  },
} as any;
```

---

## Testing Pyramid

Where2Meet follows the testing pyramid approach:

```
      /\
     /E2E\       <- Few (5-10 critical user flows)
    /------\
   / Integ  \    <- Some (20-30 integration tests)
  /----------\
 /    Unit    \  <- Many (100+ unit tests)
/--------------\
```

**Distribution**:
- **70% Unit Tests**: Fast, isolated tests for utilities and logic
- **20% Integration Tests**: Test component + state + API interaction
- **10% E2E Tests**: Full user flows in real browser

---

## Unit Testing

### What to Unit Test

✅ **DO test**:
- Utility functions (`lib/algorithms.ts`, `lib/utils.ts`)
- Type guards and validators
- Pure functions (no side effects)
- Zustand store actions
- Custom hooks (isolated)

❌ **DON'T test**:
- Third-party libraries
- Type definitions
- Constants and enums
- Simple getters/setters

### Example: Testing Utility Functions

**File**: `lib/algorithms.ts`

```typescript
/**
 * Calculates the geographic centroid of multiple points
 */
export function calculateCentroid(
  points: { lat: number; lng: number }[]
): { lat: number; lng: number } | null {
  if (points.length === 0) return null;

  const sum = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  };
}
```

**Test**: `__tests__/lib/algorithms.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { calculateCentroid } from '@/lib/algorithms';

describe('calculateCentroid', () => {
  it('should return null for empty array', () => {
    expect(calculateCentroid([])).toBeNull();
  });

  it('should return the same point for single point', () => {
    const point = { lat: 40.7589, lng: -73.9851 };
    expect(calculateCentroid([point])).toEqual(point);
  });

  it('should calculate centroid for two points', () => {
    const points = [
      { lat: 40, lng: -74 },
      { lat: 42, lng: -72 },
    ];

    const result = calculateCentroid(points);

    expect(result).toEqual({ lat: 41, lng: -73 });
  });

  it('should calculate centroid for multiple points', () => {
    const points = [
      { lat: 40.7589, lng: -73.9851 }, // Times Square
      { lat: 40.7614, lng: -73.9776 }, // Grand Central
      { lat: 40.7484, lng: -73.9857 }, // Empire State
    ];

    const result = calculateCentroid(points);

    expect(result?.lat).toBeCloseTo(40.7562, 3);
    expect(result?.lng).toBeCloseTo(-73.9828, 3);
  });

  it('should handle points across hemispheres', () => {
    const points = [
      { lat: 40, lng: -73 },  // Northern/Western
      { lat: -30, lng: 150 }, // Southern/Eastern
    ];

    const result = calculateCentroid(points);

    expect(result?.lat).toBe(5);
    expect(result?.lng).toBe(38.5);
  });
});
```

### Example: Testing Zustand Store

**Test**: `__tests__/store/useMeetingStore.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useMeetingStore } from '@/store/useMeetingStore';

describe('useMeetingStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useMeetingStore.getState().reset();
  });

  describe('addParticipant', () => {
    it('should add a participant', () => {
      const { addParticipant } = useMeetingStore.getState();

      addParticipant({
        name: 'Alice',
        lat: 40.7589,
        lng: -73.9851,
        address: 'Times Square, NYC',
      });

      const { participants } = useMeetingStore.getState();

      expect(participants).toHaveLength(1);
      expect(participants[0].name).toBe('Alice');
      expect(participants[0].lat).toBe(40.7589);
      expect(participants[0].id).toBeDefined();
    });

    it('should update centroid after adding participant', () => {
      const { addParticipant, centroid } = useMeetingStore.getState();

      expect(centroid).toBeNull();

      addParticipant({
        lat: 40.7589,
        lng: -73.9851,
        address: 'Location 1',
      });

      addParticipant({
        lat: 40.7614,
        lng: -73.9776,
        address: 'Location 2',
      });

      const newCentroid = useMeetingStore.getState().centroid;

      expect(newCentroid).not.toBeNull();
      expect(newCentroid?.lat).toBeCloseTo(40.7601, 3);
      expect(newCentroid?.lng).toBeCloseTo(-73.9813, 3);
    });
  });

  describe('removeParticipant', () => {
    it('should remove a participant by id', () => {
      const { addParticipant, removeParticipant } = useMeetingStore.getState();

      addParticipant({
        lat: 40,
        lng: -73,
        address: 'Location 1',
      });

      const { participants } = useMeetingStore.getState();
      const id = participants[0].id;

      removeParticipant(id);

      expect(useMeetingStore.getState().participants).toHaveLength(0);
    });

    it('should update centroid after removing participant', () => {
      const { addParticipant, removeParticipant } = useMeetingStore.getState();

      addParticipant({ lat: 40, lng: -73, address: 'Loc 1' });
      addParticipant({ lat: 42, lng: -72, address: 'Loc 2' });

      const firstId = useMeetingStore.getState().participants[0].id;
      removeParticipant(firstId);

      const { centroid } = useMeetingStore.getState();

      expect(centroid).toEqual({ lat: 42, lng: -72 });
    });
  });

  describe('clearParticipants', () => {
    it('should remove all participants and reset centroid', () => {
      const { addParticipant, clearParticipants } = useMeetingStore.getState();

      addParticipant({ lat: 40, lng: -73, address: 'Loc 1' });
      addParticipant({ lat: 42, lng: -72, address: 'Loc 2' });

      clearParticipants();

      const { participants, centroid } = useMeetingStore.getState();

      expect(participants).toHaveLength(0);
      expect(centroid).toBeNull();
    });
  });
});
```

---

## Integration Testing

### What to Integration Test

Integration tests verify that multiple parts work together:

✅ **DO test**:
- Component + Zustand store
- Component + React Query
- API route + Google Maps API (mocked)
- User interactions that span multiple components

### Example: Component + Store Integration

**Test**: `__tests__/components/ParticipantList.integration.test.tsx`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParticipantList } from '@/components/sidebar/ParticipantList';
import { useMeetingStore } from '@/store/useMeetingStore';

describe('ParticipantList Integration', () => {
  beforeEach(() => {
    useMeetingStore.getState().reset();
  });

  it('should display added participants from store', () => {
    const { addParticipant } = useMeetingStore.getState();

    addParticipant({
      name: 'Alice',
      lat: 40.7589,
      lng: -73.9851,
      address: 'Times Square, NYC',
    });

    render(<ParticipantList />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Times Square, NYC')).toBeInTheDocument();
  });

  it('should remove participant when delete button is clicked', () => {
    const { addParticipant } = useMeetingStore.getState();

    addParticipant({
      name: 'Bob',
      lat: 40,
      lng: -73,
      address: 'Location 1',
    });

    render(<ParticipantList />);

    const deleteButton = screen.getByLabelText('Remove participant');
    fireEvent.click(deleteButton);

    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    expect(useMeetingStore.getState().participants).toHaveLength(0);
  });

  it('should show empty state when no participants', () => {
    render(<ParticipantList />);

    expect(screen.getByText(/no participants/i)).toBeInTheDocument();
  });
});
```

### Example: React Query Integration

**Test**: `__tests__/hooks/usePlaceSearch.integration.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlaceSearch } from '@/hooks/usePlaceSearch';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('usePlaceSearch Integration', () => {
  it('should fetch places successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            place_id: '1',
            name: "Joe's Pizza",
            vicinity: '123 Main St',
            geometry: { location: { lat: 40.7589, lng: -73.9851 } },
          },
        ],
      }),
    });

    const { result } = renderHook(
      () => usePlaceSearch({
        location: { lat: 40.7589, lng: -73.9851 },
        radius: 1000,
        type: 'restaurant',
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe("Joe's Pizza");
  });

  it('should handle API errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(
      () => usePlaceSearch({
        location: { lat: 40, lng: -73 },
        radius: 1000,
        type: 'cafe',
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('should not fetch when disabled', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    renderHook(
      () => usePlaceSearch({
        location: null, // Disabled condition
        radius: 1000,
        type: 'restaurant',
      }),
      { wrapper: createWrapper() }
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

---

## Component Testing

### What to Component Test

✅ **DO test**:
- User interactions (clicks, typing, navigation)
- Conditional rendering
- Accessibility (keyboard nav, ARIA labels)
- Props variations
- State changes

❌ **DON'T test**:
- Styling/CSS (use visual regression instead)
- Implementation details (state variable names)

### Example: Button Component

**Test**: `__tests__/components/ui/Button.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50');
  });

  it('shows loading state', () => {
    render(<Button isLoading>Submit</Button>);

    expect(screen.getByRole('status')).toBeInTheDocument(); // Spinner
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with left icon', () => {
    const Icon = () => <span data-testid="icon">Icon</span>;
    render(<Button leftIcon={<Icon />}>With Icon</Button>);

    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-blue-600');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-white');

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-red-600');
  });

  it('is keyboard accessible', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Press me</Button>);

    const button = screen.getByRole('button');
    button.focus();

    expect(button).toHaveFocus();

    fireEvent.keyDown(button, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalled();
  });
});
```

---

## E2E Testing

### When to E2E Test

Use E2E tests for **critical user flows** only:

✅ **DO test**:
- Happy path: Add participants → Search venues → Select venue
- Error recovery: API failure → Retry
- Cross-browser compatibility

❌ **DON'T test**:
- Every UI interaction (too slow, too brittle)
- Implementation details

### Tool: Playwright

**Installation**:
```bash
npm install -D @playwright/test
npx playwright install
```

**Example E2E Test**:

```typescript
// e2e/happy-path.spec.ts
import { test, expect } from '@playwright/test';

test('user can find a meeting spot', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Add first participant
  await page.fill('[placeholder="Enter location..."]', 'Times Square, NYC');
  await page.click('text=Times Square');
  await expect(page.locator('text=Times Square, NYC')).toBeVisible();

  // Add second participant
  await page.fill('[placeholder="Enter location..."]', 'Central Park, NYC');
  await page.click('text=Central Park');
  await expect(page.locator('text=Central Park, NYC')).toBeVisible();

  // Centroid should appear
  await expect(page.locator('text=Meeting Center')).toBeVisible();

  // Select category
  await page.click('text=Restaurants');

  // Wait for venue results
  await expect(page.locator('[data-testid="venue-list"]')).toBeVisible();

  // Select a venue
  await page.click('text=Joe\'s Pizza');

  // Venue details should show
  await expect(page.locator('text=Open now')).toBeVisible();
});
```

---

## Coverage Goals

### Target Coverage

- **Overall**: >80%
- **Utilities** (`lib/`): >90%
- **Store** (`store/`): >85%
- **Components** (`components/`): >70%
- **API routes** (`app/api/`): >80%

### How to Check Coverage

```bash
# Run tests with coverage
npm run test:coverage

# View HTML report
open coverage/index.html
```

### What Coverage Doesn't Tell You

- ✅ Coverage = Lines executed
- ❌ Coverage ≠ Well-tested
- ❌ Coverage ≠ Quality

**Focus on**:
- Edge cases tested
- Error states tested
- Critical paths covered

---

## Mocking Patterns

### Mocking Google Maps API

```typescript
// vitest.setup.ts
global.google = {
  maps: {
    Map: vi.fn().mockImplementation(() => ({
      setCenter: vi.fn(),
      setZoom: vi.fn(),
      fitBounds: vi.fn(),
    })),
    Marker: vi.fn().mockImplementation(() => ({
      setMap: vi.fn(),
      setPosition: vi.fn(),
    })),
    LatLng: vi.fn((lat, lng) => ({ lat, lng })),
    LatLngBounds: vi.fn(() => ({
      extend: vi.fn(),
    })),
  },
} as any;
```

### Mocking Fetch

```typescript
import { vi } from 'vitest';

// Mock successful response
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ status: 'OK', results: [] }),
});

// Mock error response
global.fetch = vi.fn().mockResolvedValue({
  ok: false,
  status: 500,
  statusText: 'Internal Server Error',
});

// Mock network error
global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
```

### Mocking Zustand Store

```typescript
import { vi } from 'vitest';

vi.mock('@/store/useMeetingStore', () => ({
  useMeetingStore: vi.fn((selector) =>
    selector({
      participants: [],
      centroid: null,
      addParticipant: vi.fn(),
      removeParticipant: vi.fn(),
    })
  ),
}));
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run type check
        run: npm run type-check

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - name: Run build
        run: npm run build
```

---

## Quick Reference: Test Commands

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- algorithms.test.ts

# Run tests matching pattern
npm run test -- --grep="centroid"

# Run E2E tests
npm run test:e2e

# Update snapshots
npm run test -- -u
```
