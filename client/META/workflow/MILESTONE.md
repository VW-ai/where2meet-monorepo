# Where2Meet - Project Milestones

> Complete project roadmap with milestones, deliverables, and success criteria

---

## Project Overview

**Project Name**: Where2Meet
**Type**: Client-only Web Application (Next.js 16)
**Development Mode**: Mock API / In-memory data (no external backend required)
**Timeline**: 7 weeks
**Theme**: Simple & Cute with Cat Mascot
**Architecture**: Feature-first development with TDD workflow

> **Note**: This is a client-only repository. All backend functionality is mocked using in-memory data stores and mock API handlers. See [API_SPEC.md](../architecture/API_SPEC.md) for mock data strategy.

---

## Milestone Structure

```
┌──────────────────────────────────────────────────────┐
│ MILESTONE 0: Project Kickoff                        │
│ Duration: 1 day                                      │
│ Status: ✅ Completed                                │
└──────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────┐
│ MILESTONE 1: Foundation & Landing Page              │
│ Duration: Week 1 (5 days)                            │
│ Status: ✅ Completed                                │
└──────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────┐
│ MILESTONE 2: Main App Layout & Header               │
│ Duration: Week 2 (5 days)                            │
│ Status: ✅ Completed                                │
└──────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────┐
│ MILESTONE 3: Participant Mgmt & Venue Voting        │
│ Duration: Week 3-4 (10 days)                         │
│ Status: ✅ Completed                                │
│ Parts: Participant (5d) ✅ + Venue Voting (5d) ✅   │
└──────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────┐
│ MILESTONE 4: Venue Search & Google Maps Integration │
│ Duration: Week 5 (5 days)                            │
│ Status: ✅ Completed                                │
└──────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────┐
│ MILESTONE 5: Map Integration (Routes & MEC)          │
│ Duration: Week 6 (5 days)                            │
│ Status: ✅ Completed                                │
└──────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────┐
│ MILESTONE 6: Testing, Optimization & Launch          │
│ Duration: Week 7 (5 days)                            │
│ Status: ⚪ Not Started                              │
└──────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────┐
│ 🚀 PROJECT LAUNCH                                   │
└──────────────────────────────────────────────────────┘
```

---

## MILESTONE 0: Project Kickoff

**Duration**: 1 day
**Priority**: Critical
**Status**: ✅ Completed

### Objectives
- Set up development environment
- Configure project infrastructure
- Prepare documentation and workflow

### Tasks
- [x] Initialize Next.js 16 project with App Router
- [x] Configure TypeScript with strict mode
- [x] Set up Tailwind CSS with custom config
- [x] Install dependencies (Zustand, Lucide React, Google Maps API types)
- [x] Configure ESLint, Prettier, Husky pre-commit hooks
- [x] Set up folder structure per CLIENT_ARCHITECTURE.md
- [x] Create `.env.local` with NEXT_PUBLIC_USE_MOCK_API, NEXT_PUBLIC_API_URL, and Google Maps API key placeholder
- [x] Initialize Git repository
- [x] Set up GitHub repository
- [x] Configure GitHub Actions CI/CD pipeline
- [x] Review all META documentation (COMPONENT_GUIDE, UIUX_GUIDE, etc.)

### Deliverables
- ✅ Working Next.js development server (`npm run dev`)
- ✅ TypeScript configuration with zero errors
- ✅ Tailwind CSS configured with warm color palette
- ✅ Git repository with main branch
- ✅ CI/CD pipeline configured
- ✅ Mock API mode configured for client-only development

### Success Criteria
- [x] `npm run dev` starts without errors
- [x] `npm run type-check` passes with zero errors
- [x] `npm run lint` passes with zero errors
- [x] Landing page displays at `http://localhost:3000`
- [x] Git pre-commit hooks working

### Dependencies
- None

### Risks
- ~~Google Maps API key setup issues~~ (Resolved: Using mock API mode for development)
- ~~Environment configuration problems~~ (Resolved: Mock API configured)

---

## MILESTONE 1: Foundation & Landing Page

**Duration**: Week 1 (5 days)
**Priority**: Critical
**Status**: ✅ Completed
**Phase**: Phase 1

### Objectives
- Build complete landing page
- Establish UI component foundation
- Create type system and data models
- Implement event creation flow

### Feature Specs
- [ ] `docs/features/landing-page.md` approved
- [ ] `docs/features/event-creation.md` approved

### Tasks

#### Day 1-2: Type System & Data Layer ✅ COMPLETE
- [x] Define all TypeScript interfaces in `types/index.ts`
  - [x] `Event` interface
  - [x] `Participant` interface
  - [x] `Venue` interface
  - [x] `Location` interface
  - [x] `TravelMode` enum
- [x] Set up Zustand store structure (`store/useMeetingStore.ts`)
- [x] Create initial store actions (createEvent, getEventById)
- [x] Create mock server with Next.js API routes
- [x] Implement file-based persistence for mock data
- [x] Integrate Google Maps Geocoding API
- [ ] Write unit tests for type utilities (deferred to Milestone 7)

#### Day 3-4: Landing Page UI ✅ COMPLETE
- [x] Build `HeroInput` component
  - [x] `TitleInput` (event name)
  - [x] `TimeInput` (meeting time picker) - AppointmentPicker
  - [x] Form validation
- [x] Create `ActionButtons` component
  - [x] Create Event button with API call
  - [x] Loading state
- [ ] Implement `ShareComponent` modal (deferred to later milestone)
  - [ ] Link display
  - [ ] Copy to clipboard functionality
  - [ ] Close button
- [ ] Build `Footer` component with links (deferred to later milestone)
- [ ] Add cat mascot illustration to landing page (deferred to later milestone)

#### Day 5: Integration & Testing (Partial)
- [x] Connect landing page to mock API handlers
- [x] Implement routing to `/meet/[id]` on event creation (code ready, /meet/[id] page in Milestone 2)
- [ ] Test event creation end-to-end with mock data (deferred)
- [ ] Mobile responsive testing (375px, 768px, 1024px) (deferred)
- [ ] UI/UX Agent review (deferred)
- [ ] Code Review Agent review (deferred)

### Deliverables
- ✅ Fully functional landing page
- ✅ Event creation working with mock API
- ⚪ Share modal with working copy functionality (deferred to later milestone)
- ✅ Type system defined
- ✅ Zustand store initialized
- ⚪ 80%+ test coverage for utilities (deferred to Milestone 7)

### Success Criteria
- [x] User can create event from landing page
- [x] Event ID generated and stored in mock data store
- [x] User redirected to `/meet/[id]` after creation (router.push implemented, page creation in Milestone 2)
- [ ] Share link copyable to clipboard (deferred)
- [x] All TypeScript checks pass
- [ ] All tests pass (unit + integration) (deferred to Milestone 7)
- [x] Landing page responsive on mobile, tablet, desktop (uses responsive classes)
- [x] Design matches UIUX_GUIDE.md (warm colors, rounded shapes)

### Dependencies
- MILESTONE 0 complete ✅
- Mock API server implemented ✅
- Mock data store with file persistence ✅

### Risks
- ~~Backend API not ready~~ (Not applicable: using mock API throughout development)
- ~~Time picker complexity~~ (Resolved: AppointmentPicker component with calendar and time slots successfully implemented)

---

## MILESTONE 2: Main App Layout & Header

**Duration**: Week 2 (5 days)
**Priority**: Critical
**Status**: ✅ Completed
**Phase**: Phase 2

### Objectives
- Implement main app grid layout
- Build header navigation and filters
- Create settings and share functionality
- Establish mobile responsiveness pattern

### Feature Specs
- [ ] `docs/features/app-layout.md` approved
- [ ] `docs/features/header-navigation.md` approved
- [ ] `docs/features/category-filters.md` approved

### Tasks

#### Day 1-2: Layout Structure ✅ COMPLETE
- [x] Create `/meet/[id]` page component
- [x] Implement grid layout (Header 10%, Sidebar 30%, Map 70%)
- [x] Build responsive wrapper with breakpoints
  - [x] Desktop: Grid layout
  - [x] Tablet: Responsive widths
  - [x] Mobile: Full width stacking
- [x] Set up UI store for state management (ui-store.ts)
- [x] Create Sidebar and MapArea placeholder components
- [ ] Add layout transitions and animations (deferred)

#### Day 2-3: Header Components ✅ COMPLETE
- [x] Build `PillNav` component
  - [x] Logo as home button (clickable cat mascot)
  - [x] Venue button (toggle venue section)
  - [x] Participant button (toggle participant section)
  - [x] Active state styling with coral theme
  - [x] Consistent gap spacing between buttons
  - [x] Mobile responsive (icon-only on small screens)
- [x] Create `FilterPills` component
  - [x] Horizontal scrollable container with no-scrollbar utility
  - [x] Filter pill items (Bar, Gym, Cafe, Things to do)
  - [x] Active filter highlighting (coral background)
  - [x] Toggle filter on/off functionality
  - [ ] Flash animation when filter selected (deferred)
- [x] Implement `SettingsDropdown`
  - [x] Edit event button
  - [x] Publish event button
  - [x] Delete event button
  - [x] Dropdown animations (fade-in, slide-in)
  - [x] Click-outside-to-close functionality
- [x] Add `TopRightActions` with settings and share buttons
- [x] Header refinements
  - [x] Transparent background
  - [x] Remove separating line
  - [x] Remove "Where2Meet" text from logo area

#### Day 4: Filter Logic & State ✅ COMPLETE
- [x] Implement category filter state management (in ui-store.ts)
- [x] Connect filters to mock venue search API
  - [x] Created VenueSection component with venue search integration
  - [x] Created VenueCard component to display venues
  - [x] Venue search automatically updates when category filter changes
  - [x] Calculate center point from participant locations
  - [x] Loading/error/empty states implemented
- [x] Add filter persistence (URL query params)
  - [x] Category filter persists in URL (?category=bar)
  - [x] View toggle persists in URL (?view=participant|venue)
  - [x] URL params sync with store on mount
- [ ] Test filter interactions

#### Day 5: Integration & Testing ✅ COMPLETE
- [x] Test header across all breakpoints (responsive design verified)
- [x] Verify navigation toggles work correctly (URL persistence working)
- [x] Test settings dropdown functionality (working with animations)
- [x] UI/UX Agent review (completed with accessibility fixes)
- [x] Fix all critical accessibility issues (WCAG 2.1 AA compliant)
  - [x] Focus indicators on all interactive elements
  - [x] Touch target sizes (44px minimum on mobile)
  - [x] Keyboard support on venue cards
  - [x] Aria-live regions for loading states
  - [x] Fixed focus ring clipping on filter pills

### Deliverables
- ✅ Fully functional main app layout
- ✅ Working header navigation with URL persistence
- ✅ Category filters fully integrated with venue search API
- ✅ Settings dropdown with all actions
- ✅ Responsive mobile/tablet layouts
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ Loading/error states with proper ARIA attributes
- ✅ TypeScript zero errors

### Success Criteria
- [x] Grid layout renders correctly on desktop
- [x] Sidebar toggles between participant and venue sections
- [x] Category filters update venue search in real-time
- [x] Settings dropdown opens/closes smoothly
- [x] Header transparent with no separating line
- [x] Logo is clickable home button with consistent spacing
- [x] URL state persistence for view and category filters
- [x] All interactive elements have focus indicators
- [x] Touch targets meet 44px minimum on mobile
- [x] Keyboard navigation fully functional
- [x] Loading states with aria-live regions
- [ ] Share button modal (deferred to Milestone 6)
- [x] Mobile layout responsive across breakpoints
- [x] All animations smooth (60fps)
- [x] TypeScript checks pass (zero errors)
- [ ] Tests pass (>80% coverage) (deferred to Milestone 7)

### Dependencies
- MILESTONE 1 complete
- Event data loading from mock data store
- Mock venue search handler implemented

### Risks
- Responsive layout complexity on mobile
- Filter performance with many categories

---

## MILESTONE 3: Participant Management & Venue Section with Voting

**Duration**: Week 3-4 (10 days)
**Priority**: High
**Status**: ✅ COMPLETED
**Phase**: Phase 3
**Detailed Plan**: See [MILESTONE_3_PLAN.md](MILESTONE_3_PLAN.md)

### Objectives

**Part 1: Participant Management (Days 1-5)** - ✅ COMPLETE (100%)
- ✅ Build cat-themed participant UI components with animations
- ✅ Implement participant add/edit/delete functionality
- ✅ Integrate Google Places Autocomplete with real API
- ✅ Keyboard accessibility and error handling
- ⚪ Create participant analytics slide-out with charts (stretch goal - deferred)

**Part 2: Venue Section with Voting (Days 6-10)** - ✅ COMPLETE (100%)
- ✅ Build venue search with Google Places autocomplete and animations
- ✅ Implement travel type filter (Car, Transit, Walk, Bike)
- ✅ Create venue voting/liked system
- ✅ Build saved venues filter functionality
- ✅ Integrate Google Maps with real API (markers, circles, interactions)
- ✅ Add category filter integration with search bar synchronization

### Feature Specs
- [ ] `docs/features/participant-management.md` approved
- [ ] `docs/features/participant-analytics.md` approved
- [ ] `docs/features/venue-search-voting.md` approved

### Tasks Summary
> **Note**: For detailed day-by-day breakdown with time estimates, component specs, and technical details, see [MILESTONE_3_PLAN.md](MILESTONE_3_PLAN.md)

#### Part 1: Participant Management (Days 1-5) ✅ COMPLETE
- [x] **Day 1**: ✅ Participant Section UI Components
  - [x] ParticipantSection with header, count, add button
  - [x] ParticipantPill with cat theme (tail, feet, avatar)
  - [x] Color-coded avatars with initials
  - [x] Fuzzy location indicator
  - [x] Empty state with cat icon
  - [x] Mock travel time calculation
- [x] **Day 2**: ✅ Responsive Design & Travel Time Bubble
  - [x] TravelTimeBubble component with coral theme
  - [x] Dynamic pill sizing with flexbox
  - [x] Text truncation for long addresses
  - [x] Responsive design at all breakpoints
  - [x] Complete AddParticipant form
- [x] **Day 3**: ✅ Add/Edit/Delete Participant Features
  - [x] AddParticipant form with name and address fields
  - [x] Google Places Autocomplete integration
  - [x] Fuzzy location toggle with tooltip
  - [x] Form validation (name and address required)
  - [x] Connect to geocoding API
  - [x] Edit participant functionality with form pre-population
  - [x] Delete participant with confirmation dialog
  - [x] Update Zustand store actions
- [x] **Day 4-5**: ✅ Testing & Polish
  - [x] Keyboard accessibility (Escape key support)
  - [x] Improved error handling with inline messages
  - [x] React hooks optimization (useCallback)
  - [x] TypeScript compilation passes
  - [x] Ready for user testing

#### Part 2: Venue Section with Voting (Days 6-10) ✅ COMPLETE
- [x] **Day 6**: Travel Type Filter & Participant Icon Flash (3x animation)
- [x] **Day 7**: Search Pill Bar with Extension Animation & Autocomplete
- [x] **Day 8**: Saved Button & Venue Voting System (Liked filter implemented)
- [x] **Day 9**: Venue Cards, Map Interaction & Google Maps Integration
- [x] **Day 10**: Category Filter Integration & Search Synchronization

### Deliverables

**Participant Management:** ✅ COMPLETE
- [x] Working add participant form with autocomplete ✅
- [x] Dice name randomizer utility ✅
- [x] Fuzzy location toggle with offset logic ✅
- [x] Cat-themed participant pills (tail, feet, avatar) ✅
- [x] Participant list with empty/loading states ✅
- [x] Color randomization system (10 colors) ✅
- [x] Travel time bubbles ✅
- [x] Responsive flexbox layout with dynamic sizing ✅
- [x] Text truncation for long addresses ✅
- [x] Edit/delete participant functionality ✅
- [x] Delete confirmation dialog ✅
- [x] Keyboard accessibility (Escape key) ✅
- [x] Error handling with inline messages ✅
- [ ] Analytics slide-out with Recharts (stretch goal - deferred)

**Venue Section with Voting:** ✅ COMPLETE
- [x] Travel type filter (4 modes) ✅
- [x] Search pill bar with expansion animation ✅
- [x] Venue autocomplete using Google Places API ✅
- [x] Liked venues filter button ✅
- [x] Venue cards with ratings, hours, and voting ✅
- [x] Category filters integrated with search ✅
- [x] Venue search without participant requirement ✅
- [x] Google Maps integration (real API) ✅
- [x] Map markers for participants and venues ✅
- [x] Semi-transparent sidebar with backdrop blur ✅

### Success Criteria

**Participant Management (Part 1):** ✅ COMPLETE
- [x] User can add participant with name and address ✅
- [x] Address autocomplete works via Google Places API ✅
- [x] Participant appears as cat pill with tail, feet, avatar ✅
- [x] Each participant gets random color avatar ✅
- [x] Initials calculated correctly ✅
- [x] Travel time bubble appears when venue selected ✅
- [x] Pill dynamically resizes with flexbox layout ✅
- [x] Text truncation works for long addresses ✅
- [x] Responsive design works at all breakpoints ✅
- [x] Cat tail wags on hover ✅
- [x] User can edit/delete participants ✅
- [x] Delete confirmation dialog works ✅
- [x] Fuzzy location toggle works ✅
- [x] Keyboard accessibility (Escape key) ✅
- [x] Error handling with user-friendly messages ✅
- [x] All cat theme elements match design ✅
- [x] TypeScript checks pass ✅
- [ ] Analytics slide-out shows travel time data (stretch goal - deferred)
- [ ] Tests pass (>85% coverage for participant logic)

**Venue Section (Part 2):** ✅ COMPLETE
- [x] User can search venues using search bar ✅
- [x] Search bar integrates with category filters ✅
- [x] Category filter buttons populate search query ✅
- [x] Travel type filter changes travel mode ✅
- [x] Venue cards display with all information ✅
- [x] User can like/save venues ✅
- [x] Liked filter shows only saved venues ✅
- [x] Google Maps displays with participant markers ✅
- [x] Selected venue appears on map ✅
- [x] Search works without participants (default location) ✅
- [x] Responsive design at all breakpoints ✅
- [x] TypeScript checks pass ✅

### Dependencies
- ✅ MILESTONE 2 complete
- ✅ Mock Google Places Autocomplete implementation (Part 1)
- [ ] Mock venue data preparation (Part 2)
- ✅ Mock Geocoding API handler (implemented)
- ✅ Mock participant management handlers (implemented)

### Risks
- Geocoding API quota limits
- Chart library integration complexity

---

## MILESTONE 4: Venue Search & Google Maps Integration

**Duration**: Week 4 (5 days)
**Priority**: High
**Status**: ✅ COMPLETED (100%)
**Phase**: Phase 4

> **Note**: Full Google Maps integration completed including real API integration, venue info slide-out, participant/venue markers, map interactions, and responsive viewport management. See [MILESTONE_4_COMPLETION.md](MILESTONE_4_COMPLETION.md) for details.

### Objectives
- Implement venue search with filters
- Build venue card components
- Create venue detail slide-out
- Add voting functionality

### Feature Specs
- [ ] `docs/features/venue-search.md` approved
- [ ] `docs/features/venue-voting.md` approved
- [ ] `docs/features/venue-details.md` approved

### Tasks

#### Day 1-2: Venue Search & Filters ✅ COMPLETE
- [x] Build `TravelTypeFilter` component
  - [x] Car, Transit, Walk, Bike buttons
  - [x] Active state styling
  - [ ] Flash animation on participant icon (deferred)
- [x] Create `SearchPillBar` component
  - [x] Search input with Google Places autocomplete
  - [x] Category filter integration with search synchronization
  - [x] Search radius from center point (5km)
- [x] Integrate Google Places API search (real API, not mock)
- [x] Implement venue search state management
- [x] Add search loading states

#### Day 2-3: Venue List & Google Maps ✅ COMPLETE
- [x] Build `VenueCard` component
  - [x] Venue image (or placeholder)
  - [x] Venue title
  - [x] Rating display (stars)
  - [x] Open hours status
  - [x] Like/save button
  - [ ] Hover effect (highlight on map) - deferred
- [x] Create `VenueList` scrollable container
- [x] Implement empty state (no results)
- [x] Add like/save functionality (store in Zustand)
- [x] Integrate Google Maps with real API
- [x] Add participant markers (colored circles)
- [x] Add venue markers
- [x] Add search radius circle (5km)
- [x] Fix participant geocoding to use real Google Places API
  - [x] Participants now appear at actual geocoded locations (not mock fallback)
  - [x] Each participant shows at unique coordinates on map
- [x] Implement responsive map viewport padding
  - [x] Accounts for sidebar width (~400px on desktop)
  - [x] Accounts for sidebar + venue info card when venue selected (~800px on desktop)
  - [x] Responsive across all breakpoints (mobile, md, lg, xl)
  - [x] Max zoom level of 16 to prevent over-zooming
- [x] Fix filter button behavior (one-time action, not toggle)
  - [x] Category filters (Bar, Gym, Cafe, etc.) don't stay red after click
  - [x] Liked button doesn't stay red after click
  - [x] Liked button responsive (icon-only on small screens)
- [ ] Connect venue hover to map marker highlight - deferred

#### Day 3-4: Venue Details & Map Interactions ✅ COMPLETE
- [x] Build `VenueInfoComponent` slide-out
  - [x] Slide animation from right
  - [x] Background image header with gradient overlay
  - [x] Rating display with vote count
  - [x] Venue address with icon
  - [x] About section (description)
  - [x] Open hours display
  - [x] Phone number (click to call)
  - [x] Website link with external icon
  - [x] Google Maps redirect button
  - [x] Close button (X)
  - [x] Like/save button in header
- [x] Fetch venue details from Google Places Details API
- [x] Add loading state for details fetch
- [x] Implement venue click → open details
- [x] Keyboard accessible (Escape key to close)

#### Day 5: Integration & Testing ✅ COMPLETE
- [x] Test venue search with different categories
- [x] Test travel type filter changes
- [x] Test like/save functionality
- [x] Category filter integration tested
- [x] Test venue details slide-out
- [x] Mobile responsive testing
- [ ] UI/UX Agent review (deferred to Milestone 6)
- [ ] Code Review Agent review (deferred to Milestone 6)

### Deliverables
- ✅ Working venue search with Google Places API
- ✅ Venue cards with ratings, hours, and save functionality
- ✅ Venue details slide-out with full info
- ✅ Like/save functionality
- ✅ Travel type filter integration
- ✅ Google Maps integration with real API
- ✅ Participant and venue markers
- ✅ Search radius circle visualization
- ✅ Category filter + search bar synchronization

### Success Criteria
- [x] Venue search returns results within search radius ✅
- [x] Category filters update search results ✅
- [x] Category filters populate search bar ✅
- [x] Category filters don't stay selected (one-time action) ✅
- [x] Travel type filter changes in store ✅
- [x] Venue cards display all required info ✅
- [x] User can like/save venues ✅
- [x] Liked filter shows only saved venues ✅
- [x] Liked button responsive (icon-only on small screens) ✅
- [x] Google Maps displays with markers ✅
- [x] Participants appear at real geocoded locations ✅
- [x] Selected venue appears on map ✅
- [x] Map viewport adjusts for sidebar and venue info card ✅
- [x] Map doesn't zoom in too close (max zoom: 16) ✅
- [x] Venue details slide-out opens on card click ✅
- [x] Google Maps redirect works ✅
- [ ] Hover on venue card highlights map marker (deferred to Milestone 6)
- [x] TypeScript checks pass ✅
- [ ] Tests pass (>80% coverage) (deferred to Milestone 7)

### Dependencies
- MILESTONE 3 complete
- Mock Google Places API (Search, Details) handlers
- Mock venue data and search functionality
- MEC calculation complete (for search radius)

### Risks
- Google Places API quota limits
- Search performance with large result sets

---

## MILESTONE 5: Map Integration (Routes & MEC)

**Duration**: Week 5 (5 days)
**Priority**: Critical
**Status**: ✅ COMPLETED (100%)
**Phase**: Phase 5

> **Note**: Full map integration completed including MEC algorithm, route display, colored participant markers, and draggable search radius.

### Objectives
- Integrate Google Maps fully ✅
- Implement all markers and overlays ✅
- Add route display functionality ✅
- Create map interactions ✅

### Feature Specs
- [ ] `docs/features/map-integration.md` approved
- [ ] `docs/features/mec-calculation.md` approved
- [ ] `docs/features/route-display.md` approved

### Tasks

#### Day 1-2: Map Setup & Markers ✅ COMPLETE
- [x] Initialize Google Maps in `MapArea` component
- [x] Configure map styling (custom or default)
- [x] Set up map controls (zoom, pan, street view)
- [x] Render participant markers on map (colored circles)
- [x] Implement marker color matching participant avatars
- [x] Add marker click handlers (select participant for route highlight)

#### Day 2-3: MEC & Search Radius Circles ✅ COMPLETE
- [x] Implement MEC (Minimum Enclosing Circle) algorithm
  - [x] Welzl's O(n) algorithm implementation
  - [x] Calculate from participant locations
  - [x] Haversine distance formula for geographic calculations
  - [ ] Write unit tests for algorithm (deferred to Milestone 7)
- [x] Render MEC circle on map (yellow, low visibility)
- [x] Create draggable search radius circle (black/gray)
- [x] Ensure search radius circle renders on top of MEC
- [x] Connect search radius to Zustand store
- [x] Clamp radius between 500m and 15km

#### Day 3-4: Venue Markers & Routes ✅ COMPLETE
- [x] Venue markers rendered on search
- [x] Add `RouteDisplay` component (polylines)
  - [x] Show routes from all participants to selected venue
  - [x] Color-code routes by participant avatar color
  - [x] Display travel time/distance
- [x] Integrate Google Directions API
- [x] Handle route calculation errors (graceful fallback)
- [x] Batch route calculations with rate limiting (5 at a time)

#### Day 4-5: Map Interactions & Polish ✅ COMPLETE
- [x] Implement participant click → highlight specific route
- [x] Selected participant shows bold route, others faded
- [x] Auto-zoom map to fit all markers
- [x] Handle map state in Zustand store (`map-store.ts`)
- [x] Add loading states for route calculations ("Calculating routes...")
- [x] Travel mode conversion (UI mode → Google Directions mode)

#### Day 5: Integration & Testing ✅ COMPLETE
- [x] Test MEC calculation with various participant configurations
- [x] Test route display with different travel modes
- [x] TypeScript compilation passes (0 errors)
- [x] Build succeeds
- [ ] Mobile map interaction testing (touch, pinch-zoom) (deferred)
- [ ] Code Review Agent review (deferred to Milestone 6)
- [ ] Testing Agent review (deferred to Milestone 7)

### Deliverables
- ✅ Fully functional Google Maps integration
- ✅ Participant markers with matching avatar colors
- ✅ MEC circle calculation and display (Welzl's algorithm)
- ✅ Draggable search radius circle
- ✅ Venue markers on search
- ✅ Route display for all participants
- ✅ Color-coded routes matching participant colors
- ✅ Route highlighting on participant selection
- ✅ Map state store (`map-store.ts`)
- ✅ Google Directions API integration

### Success Criteria
- [x] Map loads and centers on participants ✅
- [x] Participant markers display with correct colors ✅
- [x] MEC circle accurately encompasses all participants ✅
- [x] Search radius circle editable and clamped ✅
- [x] Venue markers appear on search ✅
- [x] Clicking venue shows routes from all participants ✅
- [x] Routes color-coded by participant ✅
- [x] Click participant marker to highlight their route ✅
- [x] Travel mode conversion works (car/walk/bike/transit) ✅
- [x] Loading state shown during route calculation ✅
- [x] TypeScript checks pass ✅
- [ ] Tests pass (>85% coverage for MEC algorithm) (deferred to Milestone 7)

### Dependencies
- MILESTONE 4 complete
- Mock Google Maps implementation (or real Google Maps with mock data)
- Mock Directions API handler
- Participant data with mock geocoded locations
- Venue data with mock coordinates

### Risks
- Google Maps API quota limits
- Route calculation performance with many participants
- MEC algorithm edge cases (collinear points, etc.)

---

## MILESTONE 6: Advanced Features & Polish

**Duration**: Week 6 (5 days)
**Priority**: Medium
**Status**: ⚪ Not Started
**Phase**: Phase 6

### Objectives
- Implement cross-component interactions
- Add organizer mode and settings
- Polish UI/UX with animations
- Implement error handling

### Feature Specs
- [ ] `docs/features/organizer-mode.md` approved
- [ ] `docs/features/event-management.md` approved

### Tasks

#### Day 1-2: Cross-Component Interactions
- [ ] Link participant clicks to map route display
- [ ] Implement venue card hover → map marker highlight
- [ ] Add travel time chips to participant cards (on venue selection)
- [ ] Create filter flash animation on participant icon
- [ ] Sync all component states via Zustand
- [ ] Test interaction flows end-to-end

#### Day 2-3: Organizer Mode & Settings
- [ ] Build `ModeToggle` component ("Only Organizer" switch)
- [ ] Implement organizer-only features
  - [ ] Add participant button (hidden for non-organizers)
  - [ ] Edit event functionality
  - [ ] Delete event functionality
  - [ ] Publish event (finalize location)
- [ ] Create edit event modal
  - [ ] Edit title
  - [ ] Edit meeting time
  - [ ] Save changes
- [ ] Implement publish event logic
- [ ] Add delete event confirmation modal
- [ ] Connect settings to mock API handlers

#### Day 3-4: Polish & UX Enhancements
- [ ] Add loading states to all async operations
  - [ ] Geocoding
  - [ ] Venue search
  - [ ] Route calculation
  - [ ] Event updates
- [ ] Implement error handling
  - [ ] Geocoding errors (invalid address)
  - [ ] API errors (network, quota)
  - [ ] Empty states (no participants, no venues)
- [ ] Add animations and transitions
  - [ ] Slide-out animations
  - [ ] Filter flash
  - [ ] Loading spinners
  - [ ] Fade-in transitions
- [ ] Mobile responsive refinements
  - [ ] Drawer animations
  - [ ] Touch gesture improvements
  - [ ] Button sizing (≥44px touch targets)

#### Day 5: Testing & Review
- [ ] Test organizer vs non-organizer views
- [ ] Test all error scenarios
- [ ] Test loading states
- [ ] Mobile device testing on real devices
- [ ] UI/UX Agent review (accessibility, design compliance)
- [ ] Code Review Agent review

### Deliverables
- ✅ Working organizer mode toggle
- ✅ Edit/delete/publish event functionality
- ✅ All cross-component interactions
- ✅ Complete error handling
- ✅ All loading states
- ✅ Polished animations

### Success Criteria
- [ ] Organizer can toggle "Only Organizer" mode
- [ ] Organizer-only features hidden from non-organizers
- [ ] Edit event updates title and time
- [ ] Delete event shows confirmation and removes event
- [ ] Publish event finalizes location
- [ ] All async operations show loading states
- [ ] All errors display user-friendly messages
- [ ] Animations smooth (60fps)
- [ ] Mobile interactions feel native
- [ ] WCAG 2.1 AA accessibility standards met
- [ ] TypeScript checks pass
- [ ] Tests pass (>80% coverage)

### Dependencies
- MILESTONE 5 complete
- Mock API handlers for event updates (PATCH, DELETE operations)

### Risks
- Permission system complexity (organizer vs participant)
- Animation performance on low-end devices

---

## MILESTONE 7: Testing, Optimization & Launch

**Duration**: Week 7 (5 days)
**Priority**: High
**Status**: ⚪ Not Started
**Phase**: Phase 7

### Objectives
- Comprehensive testing (unit, integration, E2E)
- Performance optimization
- Accessibility compliance
- Production deployment preparation

### Feature Specs
- [ ] `docs/testing/test-plan.md` created
- [ ] `docs/deployment/deployment-guide.md` created

### Tasks

#### Day 1-2: Comprehensive Testing
- [ ] Write unit tests for all utilities
  - [ ] MEC calculation
  - [ ] Color generation
  - [ ] Initial generation
  - [ ] Distance calculations
- [ ] Write integration tests for Zustand store
  - [ ] Participant actions
  - [ ] Venue actions
  - [ ] Event actions
  - [ ] Map state
- [ ] Write component tests
  - [ ] ParticipantPill
  - [ ] VenueCard
  - [ ] All modals
  - [ ] All slide-outs
- [ ] Write E2E tests (Playwright or Cypress)
  - [ ] Complete user flow: create event → add participants → search venues → select venue
  - [ ] Organizer flow: create event → edit → delete
  - [ ] Voting flow
  - [ ] Share flow
- [ ] Mobile device testing on real devices (iOS, Android)
- [ ] Browser compatibility testing (Chrome, Safari, Firefox, Edge)

#### Day 2-3: Performance Optimization
- [ ] Optimize map rendering
  - [ ] Lazy load markers
  - [ ] Debounce route calculations
  - [ ] Optimize circle rendering
- [ ] Optimize bundle size
  - [ ] Tree-shake unused code
  - [ ] Code split routes
  - [ ] Lazy load heavy components
  - [ ] Optimize images
- [ ] Optimize API calls
  - [ ] Implement caching
  - [ ] Batch requests where possible
  - [ ] Add request debouncing
- [ ] Run Lighthouse audits
  - [ ] Performance: >90
  - [ ] Accessibility: 100
  - [ ] Best Practices: >90
  - [ ] SEO: >90
- [ ] Optimize Core Web Vitals
  - [ ] LCP (Largest Contentful Paint) <2.5s
  - [ ] FID (First Input Delay) <100ms
  - [ ] CLS (Cumulative Layout Shift) <0.1

#### Day 3-4: Accessibility & Final Polish
- [ ] Full accessibility audit
  - [ ] Keyboard navigation (all interactive elements)
  - [ ] Focus indicators visible
  - [ ] ARIA labels on all buttons/inputs
  - [ ] Screen reader testing (VoiceOver, NVDA)
  - [ ] Color contrast ratios (4.5:1 normal, 3:1 large)
- [ ] Fix all accessibility issues
- [ ] Add skip links for keyboard users
- [ ] Test with assistive technologies
- [ ] Final UI polish
  - [ ] Consistent spacing
  - [ ] Consistent colors
  - [ ] Smooth animations
  - [ ] Clear error messages
  - [ ] Helpful empty states

#### Day 4-5: Deployment Preparation & Launch
- [ ] Create production build
  - [ ] `npm run build` succeeds
  - [ ] No build warnings
  - [ ] Bundle size acceptable (<500KB main bundle)
- [ ] Set up production environment variables
- [ ] Configure CDN for static assets
- [ ] Set up error tracking (Sentry or similar)
- [ ] Set up analytics (Google Analytics or similar)
- [ ] Configure production API endpoints
- [ ] Deploy to production (Vercel, Netlify, or similar)
- [ ] Smoke test production deployment
- [ ] Final stakeholder review
- [ ] Launch! 🚀

### Deliverables
- ✅ >80% code coverage (utilities >85%)
- ✅ All E2E tests passing
- ✅ Lighthouse scores >90 (all categories)
- ✅ WCAG 2.1 AA compliant
- ✅ Production deployment live
- ✅ Error tracking configured
- ✅ Analytics configured

### Success Criteria
- [ ] All unit tests pass (>80% coverage)
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Lighthouse Performance >90
- [ ] Lighthouse Accessibility = 100
- [ ] WCAG 2.1 AA compliance verified
- [ ] Production build successful
- [ ] Production deployment smoke tested
- [ ] No console errors in production
- [ ] Error tracking active
- [ ] Analytics tracking events
- [ ] All stakeholders approve launch

### Dependencies
- All MILESTONES 1-6 complete
- Production environment provisioned (Vercel/Netlify)
- Domain name configured (if applicable)
- SSL certificate configured
- Decision made on production backend (continue with mock API or integrate real backend)

### Risks
- Last-minute bugs discovered in E2E tests
- Performance issues on production environment
- Accessibility issues require significant refactoring
- Deployment issues (DNS, SSL, etc.)

---

## Quality Gates (All Milestones)

Each milestone must pass these quality gates before moving to the next:

### Code Quality Gates
- [ ] ✅ TypeScript: `npm run type-check` → Zero errors
- [ ] ✅ Linting: `npm run lint` → Zero errors, zero warnings
- [ ] ✅ Formatting: Prettier auto-format on commit
- [ ] ✅ Tests: All tests pass, coverage meets target
- [ ] ✅ Build: `npm run build` succeeds without warnings

### Review Gates
- [ ] ✅ Code Review Agent: Approved (technical quality, architecture, best practices)
- [ ] ✅ UI/UX Agent: Approved (design system, accessibility, responsiveness)
- [ ] ✅ Testing Agent: Coverage targets met (utilities >85%, components >80%)

### Manual Testing Gates
- [ ] ✅ Browser Testing: Works on Chrome, Safari, Firefox, Edge
- [ ] ✅ Mobile Testing: Works on iOS and Android devices
- [ ] ✅ Responsive Testing: Works at 375px, 768px, 1024px, 1440px
- [ ] ✅ User Acceptance: Stakeholder approves feature

### Documentation Gates
- [ ] ✅ Feature spec exists in `docs/features/`
- [ ] ✅ Component documented in COMPONENT_GUIDE.md (if new component)
- [ ] ✅ API changes documented in API_SPEC.md (if applicable)
- [ ] ✅ JSDoc comments on all exported functions

---

## Risk Management & Mitigation

> **Client-Only Development Note**: Many traditional backend-related risks are mitigated by using a mock API approach throughout development. Google Maps API integration can use real APIs with API keys, or mock implementations for testing.

### High-Risk Areas

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| **Google Maps API quota exceeded** | Medium | High | Use mock implementations during development, real API only when needed, implement caching |
| **Performance issues with many markers** | Medium | High | Lazy load markers, cluster markers, optimize rendering |
| **~~Backend API delays~~** | ~~Medium~~ | ~~High~~ | **N/A** - Using mock API with instant responses |
| **Responsive design complexity** | Medium | Medium | Mobile-first approach, test early and often |
| **Accessibility non-compliance** | Low | High | Use UI/UX Agent proactively, test with screen readers |
| **MEC algorithm edge cases** | Medium | Medium | Comprehensive unit tests, handle collinear points |
| **Geocoding failures** | Medium | Medium | Error handling, fallback to manual location input |
| **Browser compatibility issues** | Low | Medium | Test on all major browsers, use polyfills |

---

## Success Metrics (Post-Launch)

### User Metrics
- **Adoption**: 100+ events created in first month
- **Engagement**: Average 3+ participants per event
- **Retention**: 30% of users create second event within 30 days

### Technical Metrics
- **Performance**: LCP <2.5s, FID <100ms, CLS <0.1
- **Reliability**: 99.9% uptime
- **Error Rate**: <0.1% of user sessions encounter errors
- **Test Coverage**: >80% overall, >85% for utilities

### Quality Metrics
- **Accessibility**: WCAG 2.1 AA compliant (100% Lighthouse Accessibility)
- **Code Quality**: Zero TypeScript errors, zero ESLint errors
- **Bundle Size**: <500KB main bundle (gzipped)

---

## Timeline Summary

| Milestone | Duration | Start | End | Status |
|-----------|----------|-------|-----|--------|
| **M0: Kickoff** | 1 day | Day 0 | Day 0 | ✅ Completed |
| **M1: Foundation & Landing** | Week 1 | Day 1 | Day 5 | ✅ Completed |
| **M2: Layout & Header** | Week 2 | Day 6 | Day 10 | ✅ Completed |
| **M3: Participants & Venues** | Week 3-4 | Day 11 | Day 20 | ✅ Completed |
| **M4: Google Maps & Search** | Week 4-5 | Day 16 | Day 25 | ✅ Completed |
| **M5: Route Display & MEC** | Week 5 | Day 21 | Day 25 | ✅ Completed |
| **M6: Polish & Features** | Week 6 | Day 26 | Day 30 | ⚪ Not Started |
| **M7: Testing & Launch** | Week 7 | Day 31 | Day 35 | ⚪ Not Started |
| **🚀 LAUNCH** | - | - | Day 35 | ⚪ Not Started |

**Total Project Duration**: 7 weeks (35 working days)

---

## Milestone Update Protocol

### How to Update Milestones

1. **Start Milestone**: Change status from ⚪ Not Started → 🟡 In Progress
2. **Complete Task**: Check off task in task list
3. **Pass Quality Gate**: Check off quality gate item
4. **Complete Milestone**: Change status to ✅ Completed
5. **Document Blockers**: Add to "Blockers" section if stuck
6. **Update Timeline**: Adjust dates if delays occur

### Milestone Status Legend
- ⚪ **Not Started**: Milestone hasn't begun
- 🟡 **In Progress**: Currently working on milestone
- ✅ **Completed**: All tasks, deliverables, and quality gates passed
- ⚠️ **At Risk**: Behind schedule or blocked
- 🔴 **Blocked**: Cannot proceed due to external dependency

---

## Appendix: Feature Spec Template

When creating feature specs for each milestone, use this template:

```markdown
# Feature: [Feature Name]

## Overview
[1-2 sentence description of the feature]

## User Story
As a [user type], I want to [action], so that [benefit].

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Edge Cases
- Case 1: [Description and expected behavior]
- Case 2: [Description and expected behavior]

## Design
[Link to Figma/mockups or reference to UIUX_GUIDE.md]

## Technical Considerations
- Tech detail 1
- Tech detail 2

## Dependencies
- Dependency 1
- Dependency 2

## Testing Requirements
- Test 1
- Test 2
```

---

*This milestone document is a living document and should be updated as the project progresses. Regular milestone reviews ensure the project stays on track and quality remains high.*

**Last Updated**: 2025-12-06
**Development Mode**: Real Google Maps API Integration
**Status**: Milestones 0-5 Complete (100%), Ready for Milestone 6 (Polish & Features)

---

## Development Notes

### Client-Only Architecture
- All backend functionality is mocked using in-memory data stores
- `NEXT_PUBLIC_USE_MOCK_API=true` enables mock mode (default for development)
- Switch to real backend by setting `NEXT_PUBLIC_USE_MOCK_API=false` when available
- See [API_SPEC.md](../architecture/API_SPEC.md) for complete mock implementation guide

### Google Maps Integration
- Can use real Google Maps API with API key (set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
- Or implement mock Google Maps for testing without API quota concerns
- Geocoding, Places API, and Directions can all be mocked
