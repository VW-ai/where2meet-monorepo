# Claude Agent Guide - Where2Meet Documentation Index

> **Master reference guide for AI agents working on Where2Meet**
> Use this document to quickly locate the right documentation for any task

---

## Quick Start for New Agents

**Before starting any work, read these 3 documents first:**

1. **[UIUX_GUIDE.md](UIUX/UIUX_GUIDE.md)** - Understand the "simple & cute" design system and cat theme
2. **[CLIENT_ARCHITECTURE.md](architecture/CLIENT_ARCHITECTURE.md)** - Understand the folder structure and architectural patterns
3. **[COMPONENT_GUIDE.md](architecture/COMPONENT_GUIDE.md)** - Understand all components and implementation plan

**Then, based on your agent role, read:**
- **Implementation Agent** → [WORKFLOW-GUIDE.md](workflow/WORKFLOW-GUIDE.md) + [STATE_MANAGEMENT.md](architecture/STATE_MANAGEMENT.md)
- **Code Review Agent** → [CLIENT_ARCHITECTURE.md](architecture/CLIENT_ARCHITECTURE.md) + [AGENT.md](workflow/AGENT.md)
- **Testing Agent** → [TESTING_STRATEGY.md](workflow/TESTING_STRATEGY.md)
- **UI/UX Agent** → [UIUX_GUIDE.md](UIUX/UIUX_GUIDE.md) + [LAYOUT.md](UIUX/LAYOUT.md)
- **Documentation Agent** → This file (CLAUDE.md) + all docs

---

## Documentation Directory Structure

```
META/
├── CLAUDE.md                    # ← YOU ARE HERE (Master Index)
│
├── architecture/                # Architecture & Technical Design
│   ├── CLIENT_ARCHITECTURE.md   # Folder structure, tech stack, patterns
│   ├── COMPONENT_GUIDE.md       # Complete component hierarchy & specs
│   ├── STATE_MANAGEMENT.md      # Zustand store patterns
│   └── API_SPEC.md              # External backend API contracts
│
├── UIUX/                        # Design System & UI/UX
│   ├── UIUX_GUIDE.md            # Design system, colors, cat theme
│   └── LAYOUT.md                # ASCII art visualizations of all layouts
│
├── workflow/                    # Development Workflow & Process
│   ├── AGENT.md                 # Agent roles & responsibilities
│   ├── WORKFLOW-GUIDE.md        # Feature implementation workflow + example
│   ├── IMPLEMENTATION_WORKFLOW.md # General implementation guidelines
│   ├── MILESTONE.md             # 7-week project roadmap
│   ├── TESTING_STRATEGY.md      # Testing approach & coverage targets
│   └── TROUBLESHOOTING.md       # Common issues & solutions
│
└── ../UlTIMATE-REFERENCE/       # Original specs & requirements
    ├── DETAIIL.md               # Original detailed requirements
    ├── FEATURE.md               # Feature specifications
    └── PRODUCT.md               # Product vision & goals
```

---

## Document Index by Category

### 📐 Architecture Documents

#### [CLIENT_ARCHITECTURE.md](architecture/CLIENT_ARCHITECTURE.md)
**Read when:** Starting any implementation task, setting up project, organizing files
- **Contains:**
  - Complete Next.js 14 App Router folder structure
  - Tech stack (Next.js, TypeScript, Tailwind, Zustand, Google Maps)
  - File organization patterns
  - External backend API integration pattern
  - Environment variables (NEXT_PUBLIC_API_URL, Google Maps API key)
  - Example code for API client, components, store
- **Key sections:**
  - Folder structure with examples
  - `src/lib/api/` client for external backend
  - `'use client'` directive usage
  - TypeScript strict mode setup
- **Dependencies:** None (read first)
- **Related:** COMPONENT_GUIDE.md, STATE_MANAGEMENT.md

#### [COMPONENT_GUIDE.md](architecture/COMPONENT_GUIDE.md)
**Read when:** Implementing any feature, creating components, understanding component hierarchy
- **Contains:**
  - Complete component hierarchy (50+ components)
  - 7-phase implementation plan (Weeks 1-7)
  - Detailed specs for 25+ major components
  - TypeScript props interfaces
  - Component relationships
  - Phase-by-phase task breakdown
- **Key sections:**
  - Component hierarchy tree
  - Implementation Plan (Phase 1-7)
  - Detailed Component Specifications (all components with props)
- **Dependencies:** Read CLIENT_ARCHITECTURE.md first
- **Related:** UIUX_GUIDE.md, LAYOUT.md, MILESTONE.md

#### [STATE_MANAGEMENT.md](architecture/STATE_MANAGEMENT.md)
**Read when:** Working with Zustand store, managing global state, implementing actions
- **Contains:**
  - Zustand store structure
  - All store slices (event, participants, venues, map)
  - Store actions with examples
  - Selector patterns
  - State update best practices
- **Key sections:**
  - Store setup
  - Action patterns
  - Immutable update patterns
  - Selector usage
- **Dependencies:** Read CLIENT_ARCHITECTURE.md first
- **Related:** COMPONENT_GUIDE.md, API_SPEC.md

#### [API_SPEC.md](architecture/API_SPEC.md)
**Read when:** Integrating with backend API, making API calls, handling responses
- **Contains:**
  - External backend API endpoints
  - Request/response schemas
  - Error codes and handling
  - Authentication patterns
  - API client usage examples
- **Key sections:**
  - Endpoint specifications
  - Request/response types
  - Error handling
- **Dependencies:** Read CLIENT_ARCHITECTURE.md first
- **Related:** STATE_MANAGEMENT.md

---

### 🎨 UI/UX Documents

#### [UIUX_GUIDE.md](UIUX/UIUX_GUIDE.md)
**Read when:** Implementing any UI component, styling, checking design compliance
- **Contains:**
  - "Simple & Cute" design philosophy
  - Warm color palette (Coral #FF6B6B, Mint #6BCB77, Sunshine #FFD93D, Lavender #A8A4FF)
  - Cat mascot theme specifications
  - ParticipantComponent complete documentation
  - All component patterns (buttons, inputs, cards, modals)
  - Rounded shapes philosophy (no sharp edges)
  - Tailwind CSS classes for all patterns
- **Key sections:**
  - Color palette with usage guidelines
  - Cat theme elements (tail SVG, ears, feet, avatars)
  - Component patterns with code examples
  - Typography scale
  - Spacing system
  - Animation patterns
- **Dependencies:** None (can read standalone)
- **Related:** LAYOUT.md, COMPONENT_GUIDE.md

#### [LAYOUT.md](UIUX/LAYOUT.md)
**Read when:** Implementing page layouts, understanding responsive design, mobile layouts
- **Contains:**
  - ASCII art visualizations of all layouts
  - Landing page layout (desktop & mobile)
  - Main app grid layout (Header 10%, Sidebar 30%, Map 70%)
  - Header section breakdowns
  - Sidebar section layouts
  - Map area with layers
  - All modal layouts
  - Responsive breakpoint strategies
  - Interaction flow diagrams
- **Key sections:**
  - Desktop layouts
  - Mobile alternatives (drawer, stacked, tabs)
  - Component positioning
  - Visual hierarchy
- **Dependencies:** Read UIUX_GUIDE.md for design context
- **Related:** COMPONENT_GUIDE.md, UIUX_GUIDE.md

---

### ⚙️ Workflow Documents

#### [AGENT.md](workflow/AGENT.md)
**Read when:** Understanding your role, knowing when to invoke other agents
- **Contains:**
  - 5 AI agent specifications (Implementation, Code Review, Testing, UI/UX, Documentation)
  - 5 automated tool configurations (TypeScript, ESLint, Prettier, Husky, GitHub Actions)
  - Agent summary table (triggers, responsibilities, human involvement)
  - Detailed responsibilities for each agent
  - Phase-based workflow integration
  - Agent responsibility matrix
  - When to use which agent
- **Key sections:**
  - Agent Summary Table
  - Detailed Agent Specifications (1-5)
  - Automated Quality Agents (6-10)
  - Agent Workflow Integration
  - Quick Reference: When to Use Which Agent
- **Dependencies:** None
- **Related:** WORKFLOW-GUIDE.md, MILESTONE.md

#### [WORKFLOW-GUIDE.md](workflow/WORKFLOW-GUIDE.md)
**Read when:** Implementing a feature, following TDD workflow, understanding development process
- **Contains:**
  - 6-phase feature implementation workflow diagram
  - Complete concrete example (Participant Management feature)
  - Step-by-step TDD workflow
  - Code examples for all steps
  - Agent handoffs
  - Quality gate checkpoints
  - Timeline estimates
  - Workflow variations (bug fixes, UI-only, utilities)
- **Key sections:**
  - Feature Implementation Workflow Diagram
  - Concrete Example: Participant Management Feature
    - Types → Tests → Implementation → UI → Store → Integration
  - Workflow Variations
- **Dependencies:** Read AGENT.md first to understand agent roles
- **Related:** AGENT.md, MILESTONE.md, TESTING_STRATEGY.md

#### [IMPLEMENTATION_WORKFLOW.md](workflow/IMPLEMENTATION_WORKFLOW.md)
**Read when:** General implementation guidelines, understanding best practices
- **Contains:**
  - General coding guidelines
  - Best practices for implementation
  - Code quality standards
  - Review process
- **Dependencies:** None
- **Related:** WORKFLOW-GUIDE.md, AGENT.md

#### [MILESTONE.md](workflow/MILESTONE.md)
**Read when:** Planning work, understanding project timeline, checking what milestone you're in
- **Contains:**
  - 8 major milestones (M0 Kickoff + 7 weekly milestones)
  - Complete 7-week project roadmap
  - Day-by-day task breakdowns for each milestone
  - Deliverables and success criteria
  - Quality gates (all milestones)
  - Risk management matrix
  - Timeline summary (35 working days)
  - Milestone update protocol
- **Key sections:**
  - MILESTONE 0: Project Kickoff (1 day)
  - MILESTONE 1: Foundation & Landing Page (Week 1)
  - MILESTONE 2: Main App Layout & Header (Week 2)
  - MILESTONE 3: Participant Management (Week 3)
  - MILESTONE 4: Venue Search & Display (Week 4)
  - MILESTONE 5: Map Integration (Week 5)
  - MILESTONE 6: Advanced Features & Polish (Week 6)
  - MILESTONE 7: Testing, Optimization & Launch (Week 7)
  - Quality Gates (for all milestones)
  - Risk Management & Mitigation
- **Dependencies:** Read COMPONENT_GUIDE.md for understanding phases
- **Related:** WORKFLOW-GUIDE.md, COMPONENT_GUIDE.md

#### [TESTING_STRATEGY.md](workflow/TESTING_STRATEGY.md)
**Read when:** Writing tests, checking coverage targets, understanding test patterns
- **Contains:**
  - Testing approach (unit, integration, E2E)
  - Coverage targets (>80% overall, >85% utilities)
  - Test patterns and examples
  - Testing tools (Vitest, Testing Library, Playwright/Cypress)
  - What to test for each component type
- **Key sections:**
  - Unit testing guidelines
  - Integration testing patterns
  - E2E test scenarios
  - Coverage requirements
- **Dependencies:** None
- **Related:** WORKFLOW-GUIDE.md, COMPONENT_GUIDE.md

#### [TROUBLESHOOTING.md](workflow/TROUBLESHOOTING.md)
**Read when:** Encountering errors, debugging issues, solving common problems
- **Contains:**
  - Common issues and solutions
  - Error message explanations
  - Debugging strategies
  - Known issues
- **Dependencies:** None
- **Related:** All documents (for context-specific issues)

---

### 📚 Reference Documents

#### [DETAIIL.md](../UlTIMATE-REFERENCE/DETAIIL.md)
**Read when:** Clarifying original requirements, understanding design intent
- **Contains:**
  - Original detailed requirements
  - Initial design specifications
  - Cat mascot theme origin
  - Feature descriptions
  - Layout specifications
- **Note:** This is the source document for COMPONENT_GUIDE.md and UIUX_GUIDE.md
- **Dependencies:** None (original spec)
- **Related:** COMPONENT_GUIDE.md, UIUX_GUIDE.md

#### [FEATURE.md](../UlTIMATE-REFERENCE/FEATURE.md)
**Read when:** Understanding specific feature requirements
- **Contains:**
  - Feature specifications
  - User stories
  - Acceptance criteria
- **Dependencies:** Read DETAIIL.md first
- **Related:** COMPONENT_GUIDE.md, MILESTONE.md

#### [PRODUCT.md](../UlTIMATE-REFERENCE/PRODUCT.md)
**Read when:** Understanding product vision, goals, target users
- **Contains:**
  - Product vision
  - Target audience
  - Business goals
  - Success metrics
- **Dependencies:** None
- **Related:** DETAIIL.md, FEATURE.md

---

## Common Use Cases: What to Read When

### 🆕 Starting a New Feature

**Read in this order:**
1. **[MILESTONE.md](workflow/MILESTONE.md)** - Find which milestone this feature belongs to
2. **[COMPONENT_GUIDE.md](architecture/COMPONENT_GUIDE.md)** - Find component specs for this feature
3. **[WORKFLOW-GUIDE.md](workflow/WORKFLOW-GUIDE.md)** - Follow the 6-phase workflow
4. **[UIUX_GUIDE.md](UIUX/UIUX_GUIDE.md)** - Apply design system patterns
5. **[STATE_MANAGEMENT.md](architecture/STATE_MANAGEMENT.md)** - Implement store actions if needed
6. **[TESTING_STRATEGY.md](workflow/TESTING_STRATEGY.md)** - Write tests

**Quick checklist:**
- [ ] Feature spec approved in `docs/features/FEATURE_NAME.md`
- [ ] Read component specs from COMPONENT_GUIDE.md
- [ ] Follow TDD workflow from WORKFLOW-GUIDE.md
- [ ] Apply design patterns from UIUX_GUIDE.md
- [ ] Check in with Testing Agent for coverage

---

### 🎨 Implementing UI Components

**Read in this order:**
1. **[UIUX_GUIDE.md](UIUX/UIUX_GUIDE.md)** - Get color palette, cat theme specs, component patterns
2. **[LAYOUT.md](UIUX/LAYOUT.md)** - See visual layout for this component
3. **[COMPONENT_GUIDE.md](architecture/COMPONENT_GUIDE.md)** - Get TypeScript props interface
4. **[CLIENT_ARCHITECTURE.md](architecture/CLIENT_ARCHITECTURE.md)** - Understand where file goes

**Quick checklist:**
- [ ] Use warm color palette (Coral, Mint, Sunshine, Lavender)
- [ ] All shapes rounded (rounded-full or rounded-xl)
- [ ] Add cat theme elements if applicable (tail, ears, feet)
- [ ] Tailwind CSS only (no inline styles)
- [ ] Component <200 lines
- [ ] TypeScript strict mode (no `any`)

---

### 🧪 Writing Tests

**Read in this order:**
1. **[TESTING_STRATEGY.md](workflow/TESTING_STRATEGY.md)** - Understand testing approach and coverage targets
2. **[WORKFLOW-GUIDE.md](workflow/WORKFLOW-GUIDE.md)** - See concrete test examples
3. **[COMPONENT_GUIDE.md](architecture/COMPONENT_GUIDE.md)** - Understand component edge cases

**Quick checklist:**
- [ ] Unit tests for utilities (>85% coverage)
- [ ] Integration tests for store actions (>80% coverage)
- [ ] Component tests for UI (>80% coverage)
- [ ] Test edge cases (0 participants, empty states, errors)
- [ ] AAA pattern (Arrange, Act, Assert)
- [ ] Mock external dependencies

---

### 🔄 Integrating with Backend API

**Read in this order:**
1. **[CLIENT_ARCHITECTURE.md](architecture/CLIENT_ARCHITECTURE.md)** - Understand API client pattern in `src/lib/api/`
2. **[API_SPEC.md](architecture/API_SPEC.md)** - Find endpoint specifications
3. **[STATE_MANAGEMENT.md](architecture/STATE_MANAGEMENT.md)** - Store API response in Zustand

**Quick checklist:**
- [ ] Use `apiCall()` helper from `src/lib/api/client.ts`
- [ ] Handle loading state
- [ ] Handle error state
- [ ] Store response in Zustand
- [ ] Add TypeScript types for request/response

---

### 🗺️ Working with Google Maps

**Read in this order:**
1. **[COMPONENT_GUIDE.md](architecture/COMPONENT_GUIDE.md)** - Find map component specs (Phase 5)
2. **[CLIENT_ARCHITECTURE.md](architecture/CLIENT_ARCHITECTURE.md)** - Understand Google Maps API integration
3. **[STATE_MANAGEMENT.md](architecture/STATE_MANAGEMENT.md)** - Manage map state in Zustand
4. **[TESTING_STRATEGY.md](workflow/TESTING_STRATEGY.md)** - Test MEC algorithm

**Quick checklist:**
- [ ] Google Maps API key in `.env.local`
- [ ] MEC calculation tested (>85% coverage)
- [ ] Participant markers (colored cat icons)
- [ ] MEC circle (yellow, low visibility)
- [ ] Search radius circle (black, draggable)
- [ ] Venue markers
- [ ] Route display

---

### 👥 Code Review

**Read in this order:**
1. **[AGENT.md](workflow/AGENT.md)** - Understand Code Review Agent responsibilities
2. **[CLIENT_ARCHITECTURE.md](architecture/CLIENT_ARCHITECTURE.md)** - Check architectural compliance
3. **[UIUX_GUIDE.md](UIUX/UIUX_GUIDE.md)** - Check design system compliance (if UI changes)
4. **[TESTING_STRATEGY.md](workflow/TESTING_STRATEGY.md)** - Check test coverage

**Review checklist:**
- [ ] TypeScript strict mode compliant (no `any`)
- [ ] Follows CLIENT_ARCHITECTURE.md patterns
- [ ] No console.log statements
- [ ] Proper error handling
- [ ] Tests pass (>80% coverage)
- [ ] Design system compliance (if UI)
- [ ] Accessibility standards (if UI)
- [ ] No hardcoded values

---

### 🐛 Debugging Issues

**Read in this order:**
1. **[TROUBLESHOOTING.md](workflow/TROUBLESHOOTING.md)** - Check for known issues
2. **[CLIENT_ARCHITECTURE.md](architecture/CLIENT_ARCHITECTURE.md)** - Verify folder structure and patterns
3. **[STATE_MANAGEMENT.md](architecture/STATE_MANAGEMENT.md)** - Check store state
4. **[API_SPEC.md](architecture/API_SPEC.md)** - Verify API contracts

**Debugging checklist:**
- [ ] Check console for errors
- [ ] Verify TypeScript types
- [ ] Check Zustand store state
- [ ] Verify API responses
- [ ] Check network tab
- [ ] Test in different browsers

---

### 📝 Updating Documentation

**Read in this order:**
1. **[AGENT.md](workflow/AGENT.md)** - Understand Documentation Agent responsibilities
2. This file (CLAUDE.md) - Understand documentation structure
3. Relevant specific docs to update

**Documentation update checklist:**
- [ ] Update COMPONENT_GUIDE.md (if new components)
- [ ] Update API_SPEC.md (if API changes)
- [ ] Update STATE_MANAGEMENT.md (if store changes)
- [ ] Update TROUBLESHOOTING.md (if new issues/solutions)
- [ ] Add JSDoc comments to code
- [ ] Update this CLAUDE.md if document structure changes

---

## Document Reading Order by Agent Role

### Implementation Agent 🤖
**Priority reading order:**
1. CLAUDE.md (this file)
2. CLIENT_ARCHITECTURE.md
3. COMPONENT_GUIDE.md
4. WORKFLOW-GUIDE.md
5. UIUX_GUIDE.md
6. STATE_MANAGEMENT.md
7. TESTING_STRATEGY.md

### Code Review Agent 🤖
**Priority reading order:**
1. CLAUDE.md (this file)
2. AGENT.md
3. CLIENT_ARCHITECTURE.md
4. UIUX_GUIDE.md (if UI changes)
5. TESTING_STRATEGY.md
6. STATE_MANAGEMENT.md

### Testing Agent 🤖
**Priority reading order:**
1. CLAUDE.md (this file)
2. TESTING_STRATEGY.md
3. WORKFLOW-GUIDE.md
4. COMPONENT_GUIDE.md
5. STATE_MANAGEMENT.md

### UI/UX Agent 🤖
**Priority reading order:**
1. CLAUDE.md (this file)
2. UIUX_GUIDE.md
3. LAYOUT.md
4. COMPONENT_GUIDE.md
5. CLIENT_ARCHITECTURE.md

### Documentation Agent 🤖
**Priority reading order:**
1. CLAUDE.md (this file)
2. All documents (must understand entire codebase)

---

## Key Architectural Patterns (Quick Reference)

### File Naming Conventions
```
PascalCase:  Components (ParticipantItem.tsx)
camelCase:   Utilities (calculateMEC.ts)
kebab-case:  Pages (meet/[id]/page.tsx)
UPPER_CASE:  Types (types/index.ts exports)
```

### Import Order
```typescript
// 1. React/Next.js
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. External libraries
import { create } from 'zustand';

// 3. Internal components
import { ParticipantItem } from '@/components/sidebar/ParticipantItem';

// 4. Types
import { Participant } from '@/types';

// 5. Utilities
import { generateParticipantColor } from '@/lib/utils/participant';
```

### Component Structure Pattern
```typescript
'use client'; // If using hooks or client-side features

import React from 'react';

interface ComponentNameProps {
  // Props with JSDoc comments
}

export const ComponentName: React.FC<ComponentNameProps> = ({ prop1, prop2 }) => {
  // 1. Hooks
  // 2. State
  // 3. Effects
  // 4. Handlers
  // 5. Render helpers
  // 6. Return JSX
};
```

### Zustand Store Pattern
```typescript
interface StoreSlice {
  // State
  items: Item[];

  // Actions
  addItem: (item: Item) => void;
}

export const useStore = create<StoreSlice>((set) => ({
  items: [],

  addItem: (item) => set((state) => ({
    items: [...state.items, item], // Immutable
  })),
}));
```

---

## Design System Quick Reference

### Color Palette
```typescript
Primary: Coral #FF6B6B (bg-coral-500)
Secondary: Mint #6BCB77 (bg-mint-500)
Accent: Sunshine #FFD93D (bg-sunshine-500)
Highlight: Lavender #A8A4FF (bg-lavender-500)

Text: Gray-900 (text-gray-900)
Muted: Gray-600 (text-gray-600)
Background: White (bg-white)
Border: Gray-300 (border-gray-300)
```

### Spacing Scale
```
4px = p-1, m-1, gap-1
8px = p-2, m-2, gap-2
12px = p-3, m-3, gap-3
16px = p-4, m-4, gap-4
24px = p-6, m-6, gap-6
32px = p-8, m-8, gap-8
```

### Rounded Shapes
```
Pills/buttons: rounded-full
Cards: rounded-xl
Inputs: rounded-lg
```

### Cat Theme Elements
```
Tail: SVG fluffy S-curve
Ears: Triangular with pink inner (border-b-[10px])
Feet: Small circles (w-2 h-2 rounded-full)
Avatars: 10 random colors (bg-red-500, bg-blue-500, etc.)
```

---

## Quality Standards Quick Reference

### TypeScript
```
✅ Strict mode enabled
✅ No `any` types
✅ All props interfaced
✅ All functions typed
```

### Testing Coverage
```
✅ Utilities: >85%
✅ Store actions: >80%
✅ Components: >80%
✅ Overall: >80%
```

### Component Size
```
✅ Max 200 lines per component
✅ Split if larger
✅ Extract to sub-components
```

### Accessibility
```
✅ WCAG 2.1 AA compliant
✅ Color contrast: 4.5:1 (normal), 3:1 (large)
✅ Keyboard navigation
✅ ARIA labels
✅ Focus indicators
```

### Performance
```
✅ Lighthouse Performance >90
✅ LCP <2.5s
✅ FID <100ms
✅ CLS <0.1
```

---

## Environment Variables

```bash
# Required for all environments
NEXT_PUBLIC_API_URL=http://localhost:8000  # Backend API base URL
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here

# Development only
NODE_ENV=development

# Production
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.where2meet.com
```

---

## Git Workflow (Quick Reference)

```bash
# Feature branch naming
feature/participant-management
feature/venue-search
fix/geocoding-error

# Commit message format
feat: implement participant management
fix: resolve geocoding error for invalid addresses
refactor: extract MEC calculation to utility
test: add unit tests for participant utilities
docs: update COMPONENT_GUIDE with new components

# PR workflow
1. Create feature branch
2. Implement with TDD
3. Run quality checks (type-check, lint, test)
4. Self-validate
5. Code Review Agent review
6. UI/UX Agent review (if applicable)
7. Create PR
8. GitHub Actions CI/CD runs
9. Human review & approval
10. Merge to main
```

---

## NPM Scripts Quick Reference

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)

# Quality Checks
npm run type-check       # TypeScript type checking (must be zero errors)
npm run lint             # ESLint (must be zero errors)
npm run lint:fix         # Auto-fix ESLint errors

# Testing
npm run test             # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Build
npm run build            # Production build
npm run start            # Start production server

# Formatting
npm run format           # Format with Prettier
```

---

## Agent Invocation Quick Reference

### When to Invoke Each Agent

| Scenario | Agent to Invoke | Priority |
|----------|----------------|----------|
| Starting a new feature | Implementation Agent | Primary |
| Before committing code | Code Review Agent | Required |
| Adding/modifying UI | UI/UX Agent | Required |
| Writing tests | Testing Agent | Primary |
| After implementation | Documentation Agent | Required |
| Bug found in review | Implementation Agent | Primary |
| Design system violation | UI/UX Agent | Required |
| Test coverage low | Testing Agent | Required |

### Agent Handoff Flow
```
Implementation Agent
         ↓
  Code Complete
         ↓
    ┌────┴────┐
    ↓         ↓
Code Review  UI/UX Agent
   Agent     (if UI)
    ↓         ↓
    └────┬────┘
         ↓
  Testing Agent
         ↓
Documentation Agent
         ↓
     Human Review
```

---

## Glossary

**MEC** - Minimum Enclosing Circle (smallest circle that contains all participants)
**TDD** - Test-Driven Development (write tests first, then implementation)
**AAA** - Arrange, Act, Assert (test pattern)
**E2E** - End-to-End (full user flow testing)
**LCP** - Largest Contentful Paint (performance metric)
**FID** - First Input Delay (performance metric)
**CLS** - Cumulative Layout Shift (performance metric)
**WCAG** - Web Content Accessibility Guidelines
**JSDoc** - JavaScript documentation comments

---

## FAQ for Agents

### Q: Which document should I read first?
**A:** Always start with CLAUDE.md (this file), then CLIENT_ARCHITECTURE.md, then documents specific to your task.

### Q: Where do I find component props interfaces?
**A:** COMPONENT_GUIDE.md has TypeScript props for all components.

### Q: Where do I find color codes?
**A:** UIUX_GUIDE.md has the complete color palette with hex codes and Tailwind classes.

### Q: How do I know which milestone I'm in?
**A:** Check MILESTONE.md and match your current feature to the milestone tasks.

### Q: Where are the original requirements?
**A:** DETAIIL.md in UlTIMATE-REFERENCE/ contains the original detailed requirements.

### Q: What's the test coverage target?
**A:** >80% overall, >85% for utilities. See TESTING_STRATEGY.md.

### Q: How do I integrate with the backend API?
**A:** Use the API client pattern in CLIENT_ARCHITECTURE.md (`src/lib/api/client.ts`).

### Q: Where do I find layout visualizations?
**A:** LAYOUT.md has ASCII art diagrams of all layouts.

### Q: What's the cat theme about?
**A:** UIUX_GUIDE.md documents all cat elements (tail, ears, feet, avatars). It's a playful design choice for the "simple & cute" aesthetic.

### Q: Where do I find the TDD workflow?
**A:** WORKFLOW-GUIDE.md has a complete concrete example of TDD workflow for a feature.

### Q: How do I know when to invoke other agents?
**A:** AGENT.md has "When to Use Which Agent" section with detailed triggers.

### Q: This document is outdated. What should I do?
**A:** As Documentation Agent, update this file immediately and note changes in commit message.

---

## Document Update History

| Date | Version | Changes | Updated By |
|------|---------|---------|------------|
| 2024-11-21 | 1.0 | Initial creation - Master index for all META documentation | Claude (Documentation Agent) |

---

## For Human Developers

This document is primarily for AI agents, but human developers can also use it to:
- Quickly find the right documentation
- Understand project structure
- Onboard new team members
- Reference quality standards
- Find component specifications

**Tip for humans**: Bookmark this file in your IDE for quick reference!

---

**Last Updated**: 2024-11-21
**Maintained By**: Documentation Agent
**Status**: Active
