# Milestone 3 Implementation Plan: Participant Management & Venue Section with Voting

**Duration**: Week 3-4 (10 days)
**Priority**: High
**Status**: Ready to Start
**Phase**: Phase 3

---

## Table of Contents
1. [Overview](#overview)
2. [Day-by-Day Breakdown](#day-by-day-breakdown)
   - [Part 1: Participant Management (Days 1-5)](#part-1-participant-management-days-1-5)
   - [Part 2: Venue Section with Voting (Days 6-10)](#part-2-venue-section-with-voting-days-6-10)
3. [Component Specifications](#component-specifications)
4. [Technical Implementation Details](#technical-implementation-details)
5. [Mock API Strategy](#mock-api-strategy)
6. [Testing Strategy](#testing-strategy)
7. [Success Criteria](#success-criteria)

---

## Overview

### Objectives
**Part 1: Participant Management**
- Build fully functional participant add/edit/delete system
- Implement cat-themed participant UI with tail, ears, and feet
- Create participant analytics slide-out with charts
- Integrate mock Google Places autocomplete and geocoding
- Implement fuzzy location toggle feature

**Part 2: Venue Section with Voting**
- Build venue search with autocomplete and extension animation
- Implement travel type filter (Car, Transit, Walk, Bike)
- Create participant icon flash notification (3 times after filter change)
- Build saved venues functionality with extension animation
- Implement venue voting system
- Create venue info slide-out component
- Build voted/saved venues display sorted by votes
- Implement venue-map interaction (hover highlight, click for info)

### Key Features - Part 1: Participant Management
1. **Add Participant Form**
   - Name input with dice randomizer (generates random names like "apple_cat", "banana_dog")
   - Address input with Google Places autocomplete (mock)
   - Fuzzy location toggle with eye icon
   - Explanation tooltip for fuzzy location
   - Form validation

2. **Cat-Themed Participant Pills**
   - Fluffy cat tail (S-curve SVG attached to left side)
   - Cat tail should be attached to left side of pill
   - Cat tail should be animated (tail wagging)
   - Cat tail should be responsive (tail should shrink when pill is hovered)
   - delete button on pill (organizer only)
   - Cat ears on avatar (triangular with pink inner)
   - Randomized color avatar (10 colors)
   - Name and address display
   - Little circle feet at bottom
   - Travel time bubble (appears when venue selected)

3. **Participant List**
   - Scrollable container
   - Empty/loading states
   - Participant count header
   - Color randomization utility
   - Initial generation from names

4. **Analytics Slide-Out**
   - Time/Distance dot chart
   - Participant time bar chart
   - Slide animation from right
   - Close button

5. **Participant Interactions**
   - Click participant to highlight route on map
   - Edit participant (organizer only)
   - Delete participant (organizer only)
   - Add participant button (organizer view)

### Key Features - Part 2: Venue Section with Voting
1. **Travel Type Filter**
   - Four modes: Car, Transit, Walk, Bike
   - Filter pills UI (similar to category filters)
   - After filter change: Participant icon in top-left pill nav flashes 3 times
   - Updates travel times for all participants
   - Persists selection in URL

2. **Search Pill Bar**
   - Compact state: Search input with icon
   - Expanded state: Takes up whole bar when clicked
   - Autocomplete dropdown with venue suggestions
   - Smooth width transition animation
   - Closes on blur or selection

3. **Saved Button**
   - Located beside search pill bar
   - Extends to show saved venues when clicked
   - Displays saved venue count badge
   - Smooth animation
   - Toggle open/close behavior

4. **Venue List**
   - Scrollable container
   - Venue cards with: Name, Rating (stars), Open/Close hours, Facility picture
   - Vote button on each venue
   - Hover effect: Highlights venue marker on map
   - Click effect: Opens Venue Info Component slide-out

5. **Venue Info Component**
   - Slides out from right side
   - Venue title with background image
   - Ratings, address, about section
   - Open hours display
   - Google Maps button (redirects to Google Maps)
   - Vote button
   - Close button

6. **Voted/Saved Venue Info Component**
   - Separate section showing voted venues
   - Sorted by vote count (descending)
   - Displays vote count badge
   - Quick access to venue details
   - Remove vote functionality

7. **Default View**
   - First join: Shows Participant Section with Add Participant component
   - After adding participant: User can navigate to Venue Section

### Dependencies
- Milestone 2 complete ✅
- Zustand meeting store ready ✅
- UI store ready ✅
- Mock data store with file persistence ✅

---

## Day-by-Day Breakdown

---

## Part 1: Participant Management (Days 1-5)

### Day 1: Add Participant Form & Name Generator (Monday)

**Time Estimate**: 8 hours

#### Morning (4 hours): Form Structure & Name Generator
1. **Create AddParticipantComponent** (`src/components/sidebar/participant/add-participant.tsx`)
   - Set up component structure with form state
   - Create controlled inputs for name and address
   - Add form validation logic
   - Style with Tailwind (rounded, coral theme)

2. **Implement Dice Name Randomizer**
   - Create utility function `generateRandomName()` in `src/lib/utils/name-generator.ts`
   - Adjective list: 20+ adjectives (happy, sleepy, fluffy, bouncy, etc.)
   - Animal list: 20+ animals (cat, dog, fox, bear, rabbit, etc.)
   - Format: `{adjective}_{animal}` (e.g., "happy_cat", "sleepy_fox")
   - Add dice icon button from Lucide React
   - Connect button to name input

3. **Write Tests for Name Generator**
   - Test random name generation
   - Test format consistency
   - Test uniqueness (no duplicates in reasonable sample)

#### Afternoon (4 hours): Address Input & Autocomplete Setup
1. **Create Mock Google Places Autocomplete**
   - Create mock handler in `src/lib/api/mock/places-autocomplete.ts`
   - Mock data: 50+ real NYC addresses
   - Implement fuzzy search matching
   - Return predictions with main_text, secondary_text, place_id

2. **Build AddressAutocomplete Component**
   - Create `src/components/shared/address-autocomplete.tsx`
   - Dropdown suggestions list
   - Keyboard navigation (up/down arrows, enter to select)
   - Click outside to close
   - Loading state
   - No results state

3. **Integrate Autocomplete with Form**
   - Connect autocomplete to address input
   - Handle selection
   - Store selected place_id
   - Clear suggestions on selection

**Deliverables:**
- ✅ AddParticipantComponent with name and address inputs
- ✅ Working dice randomizer
- ✅ Mock autocomplete with 50+ addresses
- ✅ Keyboard-navigable dropdown
- ✅ Form validation
- ✅ Unit tests for name generator

---

### Day 2: Fuzzy Location, Geocoding & Store Integration (Tuesday)

**Time Estimate**: 8 hours

#### Morning (4 hours): Fuzzy Location Feature
1. **Create Fuzzy Location Toggle**
   - Add eye icon toggle from Lucide React
   - Toggle state in form (boolean)
   - Active/inactive styling (coral theme)
   - Add explanation icon (Info icon) next to toggle

2. **Build Fuzzy Location Tooltip**
   - Create tooltip component or use Radix UI tooltip
   - Tooltip text: "Fuzzy location hides your exact address by showing an approximate area within 0.5 miles. Your precise location won't be visible to others."
   - Hover to show, mobile: tap to show
   - Smooth fade-in animation

3. **Implement Fuzzy Logic**
   - Create utility `applyFuzzyOffset()` in `src/lib/utils/location.ts`
   - When fuzzy enabled: Add random offset to lat/lng (±0.005 to ±0.01 degrees)
   - Store both actual and fuzzy coordinates
   - Display fuzzy address (format: "Near {street name}, {city}")

4. **Write Tests for Fuzzy Logic**
   - Test offset calculation
   - Test random offset within bounds
   - Test address formatting

#### Afternoon (4 hours): Mock Geocoding & Store Actions
1. **Create Mock Geocoding API**
   - Create handler in `src/lib/api/mock/geocoding.ts`
   - Map addresses to mock coordinates
   - Return lat/lng for known addresses
   - Error handling for unknown addresses

2. **Implement addParticipant Store Action**
   - Extend `useMeetingStore` with proper types
   - Generate unique participant ID (uuid)
   - Assign random color from palette (10 colors)
   - Calculate initials from name
   - Store fuzzy flag and coordinates
   - Add participant to currentEvent.participants array

3. **Connect Form to Store**
   - Handle form submission
   - Call geocoding mock API
   - Create participant object with all fields
   - Call addParticipant action
   - Clear form on success
   - Show success feedback
   - Handle errors (geocoding failure, duplicate name)

4. **Add Loading States**
   - Loading during geocoding
   - Disabled form during submission
   - Loading spinner on Join button
   - Error state display

**Deliverables:**
- ✅ Fuzzy location toggle with tooltip
- ✅ Fuzzy coordinate offset logic
- ✅ Mock geocoding handler
- ✅ addParticipant store action
- ✅ Form integrated with store
- ✅ Loading and error states
- ✅ Tests for fuzzy logic and store actions

---

### Day 3: Cat-Themed Participant Pills (Wednesday)

**Time Estimate**: 8 hours

#### Morning (4 hours): Participant Pill Component
1. **Create ParticipantPill Component** (`src/components/sidebar/participant/participant-pill.tsx`)
   - Basic structure: wrapper div, tail, main pill, avatar, feet
   - Props: participant (id, name, address, color, fuzzyLocation)
   - Responsive design (mobile, tablet, desktop)

2. **Implement Cat Tail SVG**
   - Copy tail design from ParticipantComponent.ts reference
   - SVG with fluffy double curve (S-shape)
   - Attach to left side of pill with relative positioning
   - Fluffy tail tip (circle at end)
   - Inner curve for extra fluffiness
   - Color matches participant color
   - Width: 40px, Height: 64px
   - Smooth curves using Bezier paths

3. **Build Main Pill Container**
   - Rounded-full border
   - Background: white
   - Border: 2px solid border color
   - Padding: px-4 py-2
   - Flex layout: left (info), right (avatar)
   - Shadow on hover
   - Smooth transitions

4. **Style Name and Address Display**
   - Left side: Name (font-medium, truncate)
   - Address with MapPin icon (text-xs, muted-foreground)
   - Truncate long text with ellipsis
   - Responsive font sizes

#### Afternoon (4 hours): Avatar with Cat Ears & Feet
1. **Create Avatar with Cat Ears**
   - Use shadcn/ui Avatar component
   - Size: 40px (w-10 h-10)
   - Border: 2px white border
   - Background: participant color

2. **Implement Cat Ears**
   - Position absolute above avatar
   - Two triangular ears using border trick
   - Left and right ears with spacing
   - Pink inner triangle (border-b-pink-300)
   - Ear size: 12px base, 10px height
   - Z-index: 10 (above avatar)

3. **Add Initial Fallback**
   - Calculate initials utility (first letter of each word, max 2)
   - White text, font-semibold
   - AvatarFallback with initials
   - Center aligned

4. **Create Little Feet**
   - Position absolute at bottom of main wrapper
   - Two small circles (w-2 h-2)
   - Background: border color
   - Positioned at bottom-0, spread with justify-around
   - Left margin: 8 (skip tail area), right margin: 8 (skip avatar area)

5. **Add Hover Effects**
   - Scale transform on hover (hover:scale-[1.02])
   - Shadow increase (hover:shadow-md)
   - Smooth transition-all duration-200
   - Cursor pointer

**Deliverables:**
- ✅ ParticipantPill component with all cat elements
- ✅ Fluffy S-curve tail SVG
- ✅ Cat ears on avatar (pink inner)
- ✅ Little circle feet at bottom
- ✅ Proper color matching
- ✅ Responsive design
- ✅ Hover interactions

---

### Day 4: Participant List, Color System & Travel Time Bubble (Thursday)

**Time Estimate**: 8 hours

#### Morning (4 hours): Participant List & Color System
1. **Create ParticipantsList Component** (`src/components/sidebar/participant/participants-list.tsx`)
   - Scrollable container (overflow-y-auto)
   - Map through participants
   - Render ParticipantPill for each
   - Empty state component
   - Loading state (skeleton loaders)

2. **Build Participant Count Header**
   - Display count: "Participants ({count})"
   - Text styling: font-semibold, text-lg
   - Position above list
   - Update count reactively

3. **Implement Color Randomization**
   - Create utility `getRandomColor()` in `src/lib/utils/colors.ts`
   - 10 color palette (tailwind classes):
     - bg-red-500
     - bg-blue-500
     - bg-green-500
     - bg-yellow-500
     - bg-purple-500
     - bg-pink-500
     - bg-indigo-500
     - bg-orange-500
     - bg-teal-500
     - bg-cyan-500
   - Deterministic: Hash participant ID to select color
   - Same participant always gets same color
   - Write tests for color consistency

4. **Create Initial Generator**
   - Utility `getInitials(name: string)` in `src/lib/utils/text.ts`
   - Split name by spaces
   - Take first letter of each word
   - Max 2 letters
   - Uppercase
   - Handle edge cases (single name, empty)
   - Write tests

5. **Build Empty State**
   - Component: `participant-list-empty.tsx`
   - Centered layout
   - Cat illustration or icon
   - Text: "No participants yet. Be the first to join!"
   - CTA: "Add Participant" button (if organizer)

6. **Build Loading State**
   - Skeleton loader component
   - Animate pulse
   - 3-4 skeleton pills
   - Match pill dimensions

#### Afternoon (4 hours): Travel Time Bubble
1. **Create TravelTimeBubble Component** (`src/components/sidebar/participant/travel-time-bubble.tsx`)
   - Props: travelTime (string), isVisible (boolean)
   - Position absolute to right of pill
   - Conditional render when venue selected

2. **Build Bubble with Connector**
   - Connector triangle (left side)
   - Border trick for triangle
   - Points to participant pill
   - Badge component for bubble
   - Background: coral-500 (primary)
   - Text: white
   - Clock icon from Lucide
   - Time text (e.g., "12 min")

3. **Add Animations**
   - Entrance: fade-in, slide-in-from-left-2
   - Duration: 200ms
   - Exit: fade-out
   - Smooth transitions

4. **Integrate with ParticipantPill**
   - Add selectedVenue prop to pill
   - Add travelTime prop (optional)
   - Render bubble when both are present
   - Position bubble correctly (absolute positioning)

5. **Connect to Store**
   - Read selectedVenue from store
   - Calculate travel time when venue selected
   - Store travel times in participant objects
   - Update pills when selection changes

**Deliverables:**
- ✅ ParticipantsList component with scrolling
- ✅ Participant count header
- ✅ Color randomization utility (10 colors)
- ✅ Initial generator utility
- ✅ Empty state component
- ✅ Loading state with skeletons
- ✅ Travel time bubble with connector
- ✅ Animations for bubble entrance
- ✅ Integration with store
- ✅ Tests for utilities

---

### Day 5: Analytics Slide-Out, Edit/Delete & Integration Testing (Friday)

**Time Estimate**: 8 hours

#### Morning (4 hours): Analytics Slide-Out Component
1. **Create AnalysisComponent** (`src/components/sidebar/participant/analysis-component.tsx`)
   - Slide-out panel from right
   - Props: participants, selectedVenue, isOpen, onClose
   - Overlay backdrop
   - Close button (X icon top-right)
   - Click outside to close

2. **Build Slide-Out Animation**
   - Initial: translate-x-full (off screen)
   - Open: translate-x-0
   - Transition: duration-300 ease-in-out
   - Backdrop: bg-black/20, fade-in
   - Z-index: 50

3. **Implement Time-Distance Dot Chart**
   - Top half of panel (50%)
   - Use Recharts library
   - ScatterChart component
   - X-axis: Distance (km)
   - Y-axis: Time (minutes)
   - Dots: Custom component with participant color
   - Render participant initials in dots
   - Axis labels and grid

4. **Implement Participant Time Bar Chart**
   - Bottom half of panel (50%)
   - BarChart component from Recharts
   - X-axis: Participant names (or initials)
   - Y-axis: Travel time (minutes)
   - Bars: Participant colors
   - Tooltip with details
   - Responsive sizing

5. **Add Loading State**
   - Show while calculating routes
   - Spinner in chart areas
   - Skeleton loaders

#### Afternoon (4 hours): Edit/Delete, Organizer Controls & Testing
1. **Add Edit Participant**
   - Edit icon button on pill (organizer only)
   - Opens AddParticipantComponent in edit mode
   - Pre-fill form with participant data
   - Save updates to store action: updateParticipant
   - Confirmation feedback

2. **Add Delete Participant**
   - Delete icon button on pill (organizer only)
   - Confirmation dialog/modal
   - Warning text: "Remove {name} from this meeting?"
   - Confirm/Cancel buttons
   - Store action: removeParticipant
   - Remove from participants array
   - Update map markers

3. **Create Add Participant Button (Organizer View)**
   - Button in participant section header
   - Shows AddParticipantComponent form
   - Only visible to organizer
   - Icon: UserPlus from Lucide
   - Coral primary styling

4. **Update ParticipantSection Component**
   - Import all sub-components
   - Manage form visibility state
   - Handle add/edit/delete flows
   - Conditional rendering based on organizer status
   - Read participants from store
   - Pass props to children

5. **Integration Testing**
   - Test complete add flow
   - Test edit flow
   - Test delete flow
   - Test fuzzy location toggle
   - Test color assignment
   - Test travel time bubbles
   - Test analytics slide-out
   - Test organizer vs participant view
   - Mobile responsive testing (375px, 768px)

6. **Code Review Preparation**
   - Run TypeScript checks
   - Run ESLint
   - Format with Prettier
   - Review accessibility (focus states, ARIA labels)
   - Check keyboard navigation
   - Update component documentation

**Deliverables:**
- ✅ AnalysisComponent with charts
- ✅ Time-Distance dot chart
- ✅ Participant time bar chart
- ✅ Edit participant functionality
- ✅ Delete participant with confirmation
- ✅ Add participant button (organizer)
- ✅ ParticipantSection integration
- ✅ All flows tested
- ✅ TypeScript zero errors
- ✅ Mobile responsive
- ✅ Accessibility compliant

---

## Part 2: Venue Section with Voting (Days 6-10)

### Day 6: Travel Type Filter & Participant Icon Flash (Monday Week 4)

**Time Estimate**: 8 hours

#### Morning (4 hours): Travel Type Filter Component
1. **Create TravelTypeFilter Component** (`src/components/sidebar/venue/travel-type-filter.tsx`)
   - Four filter pills: Car, Transit, Walk, Bike
   - Icons from Lucide: Car, Bus, PersonStanding, Bike
   - Single selection (radio button behavior)
   - Default: Car
   - Active state styling (coral-500 background)
   - Inactive state styling (white background with border)
   - Smooth transition animations

2. **Integrate Filter with Store**
   - Add `selectedTravelMode` to UI store or meeting store
   - Add `setTravelMode` action
   - Update URL params when filter changes
   - Sync URL params on mount

3. **Implement Travel Time Recalculation**
   - Listen to travel mode changes
   - Trigger recalculation for all participants
   - Update participant travel times in store
   - Update travel time bubbles on participant pills

4. **Write Tests**
   - Test filter selection
   - Test URL persistence
   - Test travel time recalculation

#### Afternoon (4 hours): Participant Icon Flash Notification
1. **Create Flash Animation Component** (`src/components/header/participant-icon-flash.tsx`)
   - Flash animation: 3 pulses with scale and opacity
   - Duration: 600ms total (200ms per pulse)
   - Trigger on travel mode change
   - CSS keyframe animation or Framer Motion

2. **Implement Cross-Component Trigger**
   - Add `triggerParticipantFlash` to UI store
   - TravelTypeFilter calls trigger on mode change
   - PillNav component listens for trigger
   - Reset trigger after animation completes

3. **Add Animation to Participant Icon in PillNav**
   - Wrap participant icon in flash container
   - Apply animation class on trigger
   - Remove class after 600ms
   - Ensure animation doesn't interfere with click events

4. **Test Flash Animation**
   - Test trigger from travel filter
   - Test animation timing (3 flashes)
   - Test animation doesn't block interaction
   - Test on mobile (touch-friendly)

**Deliverables:**
- ✅ TravelTypeFilter with 4 modes
- ✅ Travel mode persists in URL
- ✅ Travel time recalculation on filter change
- ✅ Participant icon flash animation (3 times)
- ✅ Cross-component trigger system
- ✅ Tests for filter and animation

---

### Day 7: Search Pill Bar with Extension Animation (Tuesday)

**Time Estimate**: 8 hours

#### Morning (4 hours): Search Pill Bar Component
1. **Create SearchPillBar Component** (`src/components/sidebar/venue/search-pill-bar.tsx`)
   - Compact state: Rounded pill with search icon and placeholder
   - Expanded state: Takes full width of container
   - Smooth width transition (transition-all duration-300)
   - Focus management (auto-focus input on expand)
   - Click to expand, blur to collapse
   - Search input with clear button

2. **Build Expansion Animation**
   - Initial width: w-48 (compact)
   - Expanded width: w-full
   - Border-radius: rounded-full (compact) → rounded-lg (expanded)
   - Padding adjustments for expanded state
   - Icon transitions (search icon → clear icon)

3. **Handle Focus States**
   - Expand on input click
   - Expand on container click
   - Collapse on blur (with delay for selection)
   - Collapse on Escape key
   - Trap focus in expanded state

4. **Style Compact and Expanded States**
   - Compact: px-4 py-2, icon + placeholder
   - Expanded: px-4 py-3, full input + clear button
   - Border: 2px border with coral focus ring
   - Shadow: sm → md on expand

#### Afternoon (4 hours): Venue Autocomplete Integration
1. **Create Mock Venue Search API** (`src/lib/api/mock/venue-search.ts`)
   - Mock NYC venues (gyms, bars, cafes, activities)
   - 100+ mock venues with realistic data:
     - Name, address, category, rating, hours, image URL
   - Fuzzy search by name and category
   - Return top 5 matches
   - Simulate 200ms network delay

2. **Build Autocomplete Dropdown**
   - Position: absolute below search bar
   - Max height with scroll
   - Keyboard navigation (up/down/enter)
   - Highlight on hover and keyboard focus
   - Display: Venue name, category badge, rating
   - Click to select

3. **Integrate Autocomplete with Search Input**
   - Debounce input (300ms)
   - Call mock API on input change
   - Display results in dropdown
   - Handle selection (add to venue list)
   - Clear input on selection
   - Loading state (spinner icon)

4. **Handle Edge Cases**
   - No results message
   - Error state
   - Empty input clears results
   - Click outside closes dropdown
   - Escape key closes dropdown

**Deliverables:**
- ✅ SearchPillBar with compact/expanded states
- ✅ Smooth width and border-radius transitions
- ✅ Focus management and keyboard handling
- ✅ Mock venue search API with 100+ venues
- ✅ Autocomplete dropdown with keyboard nav
- ✅ Debounced search
- ✅ Tests for search and autocomplete

---

### Day 8: Saved Button & Venue Voting System (Wednesday)

**Time Estimate**: 8 hours

#### Morning (4 hours): Saved Button Component
1. **Create SavedButton Component** (`src/components/sidebar/venue/saved-button.tsx`)
   - Compact state: Pill button with bookmark icon + count badge
   - Expanded state: Full-width panel showing saved venues
   - Toggle open/close behavior
   - Smooth expansion animation (height: 0 → auto)
   - Position: Next to search pill bar

2. **Build Expansion Animation**
   - Initial: Collapsed (height-0, overflow-hidden)
   - Expanded: Full height (max-h-96 with scroll)
   - Transition: duration-300 ease-in-out
   - Badge count animates (scale + color change)
   - Content fades in with stagger

3. **Saved Venues Panel**
   - List of saved venues (compact cards)
   - Each card: Name, rating, quick actions (remove, view)
   - Empty state: "No saved venues yet"
   - Scroll container if > 5 venues

4. **Add Save/Unsave Functionality**
   - Bookmark icon on venue cards (toggle)
   - Add to saved list in store
   - Update count badge
   - Persist saved venues in store
   - Remove from saved list

#### Afternoon (4 hours): Venue Voting System
1. **Design Voting Data Structure**
   ```typescript
   interface VenueVote {
     venueId: string;
     userId: string;
     timestamp: number;
   }

   interface Venue {
     id: string;
     name: string;
     // ... other fields
     votes: VenueVote[];
     voteCount: number;
   }
   ```

2. **Implement Voting Actions in Store**
   - Add `voteForVenue(venueId)` action
   - Add `unvoteForVenue(venueId)` action
   - Update venue voteCount
   - Track user's votes (one vote per user per venue)
   - Store votes array in venue object

3. **Create Vote Button Component** (`src/components/sidebar/venue/vote-button.tsx`)
   - Heart icon or thumbs-up icon
   - Filled state when user has voted
   - Outlined state when not voted
   - Vote count display
   - Click animation (scale bounce)
   - Optimistic updates

4. **Integrate Voting with Venue Cards**
   - Add vote button to each venue card
   - Update vote count on click
   - Visual feedback (color change, scale)
   - Disable if user already voted (or allow toggle)

5. **Sort Venues by Votes**
   - Create utility to sort venues by voteCount
   - Apply sorting in venue list
   - Show vote count badge on cards
   - Highlight top-voted venue

**Deliverables:**
- ✅ SavedButton with expand/collapse animation
- ✅ Saved venues panel
- ✅ Save/unsave functionality
- ✅ Voting data structure in store
- ✅ Vote/unvote actions
- ✅ Vote button component with animation
- ✅ Sort venues by vote count
- ✅ Tests for saving and voting

---

### Day 9: Venue Cards, Map Interaction & Venue Info Slide-Out (Thursday)

**Time Estimate**: 8 hours

#### Morning (4 hours): Venue Cards with Map Interaction
1. **Create VenueCard Component** (`src/components/sidebar/venue/venue-card.tsx`)
   - Card layout: Image (top), Content (bottom)
   - Content: Name (font-semibold), Rating (stars), Hours (open/close)
   - Vote button positioned top-right
   - Save button (bookmark) top-left
   - Hover effect: Shadow increase, scale-[1.02]
   - Click: Opens VenueInfoComponent

2. **Implement Rating Stars**
   - Display 5 stars with filled/half/empty states
   - Use Star and StarHalf icons from Lucide
   - Color: yellow-400 for filled, gray-300 for empty
   - Show numeric rating (e.g., "4.7")

3. **Open/Close Hours Display**
   - Parse hours data (e.g., "9am - 10pm")
   - Show current status: "Open" (green) or "Closed" (red)
   - Display closing time if open: "Closes 10pm"
   - Display opening time if closed: "Opens 9am"

4. **Map Highlight on Hover**
   - Add `hoveredVenueId` to UI store
   - Set on venue card hover
   - Clear on hover out
   - Map component listens to `hoveredVenueId`
   - Highlight marker: Increase size, add glow, z-index bump
   - Smooth transition

5. **Venue List Component**
   - Scrollable container (overflow-y-auto)
   - Map through venues
   - Render VenueCard for each
   - Empty state: "No venues found"
   - Loading state: Skeleton loaders

#### Afternoon (4 hours): Venue Info Slide-Out Component
1. **Create VenueInfoComponent** (`src/components/sidebar/venue/venue-info-slide-out.tsx`)
   - Fixed positioned overlay (z-50)
   - Slide-out panel from right
   - Width: w-full md:w-96
   - Height: Full screen
   - Background: white
   - Shadow: shadow-2xl

2. **Build Slide-Out Animation**
   - Initial: translate-x-full (off-screen right)
   - Open: translate-x-0
   - Backdrop: bg-black/30, fade-in
   - Transition: duration-300 ease-in-out
   - Click backdrop to close
   - Close button (X) top-right

3. **Header Section with Background Image**
   - Hero image as background
   - Gradient overlay for text readability
   - Venue name (text-2xl font-bold text-white)
   - Height: h-48
   - Background: cover, center

4. **Content Section**
   - Scrollable content area
   - Rating with stars and review count
   - Address with MapPin icon
   - About section (description)
   - Open hours (formatted list)
   - Vote button (large, prominent)
   - Save button (bookmark)

5. **Google Maps Button**
   - Button: "Open in Google Maps"
   - Icon: ExternalLink from Lucide
   - Opens: `https://www.google.com/maps/search/?api=1&query={lat},{lng}&query_place_id={placeId}`
   - Target: _blank (new tab)
   - Styling: Primary coral button

6. **Integration with Store**
   - Add `selectedVenueId` to UI store
   - Add `setSelectedVenue(id)` action
   - Open slide-out on venue card click
   - Close on backdrop click or X button

**Deliverables:**
- ✅ VenueCard component with all data
- ✅ Rating stars display
- ✅ Open/close hours display
- ✅ Map highlight on hover
- ✅ Venue list with scrolling
- ✅ VenueInfoComponent slide-out
- ✅ Slide animation from right
- ✅ Hero image header
- ✅ Complete venue details display
- ✅ Google Maps button (opens new tab)
- ✅ Tests for venue cards and slide-out

---

### Day 10: Voted Venues Display, Default View & Integration Testing (Friday)

**Time Estimate**: 8 hours

#### Morning (4 hours): Voted/Saved Venue Info Component
1. **Create VotedVenuesSection Component** (`src/components/sidebar/venue/voted-venues-section.tsx`)
   - Section header: "Voted Venues" with count
   - Sorted list of venues by vote count (descending)
   - Each item: Compact venue card with vote count badge
   - Empty state: "No votes yet"
   - Max height with scroll

2. **Voted Venue Compact Card**
   - Horizontal layout: Image (left), Content (middle), Vote badge (right)
   - Image: w-16 h-16, rounded
   - Content: Name, rating, vote count
   - Vote badge: Circular badge with number, coral background
   - Click: Opens VenueInfoComponent

3. **Sort by Vote Count**
   - Sort venues where voteCount > 0
   - Descending order (highest first)
   - Tie-breaker: Alphabetical by name
   - Update reactively when votes change

4. **Remove Vote Functionality**
   - X button or minus icon on compact card
   - Click to remove vote
   - Update vote count
   - Remove from voted list if voteCount reaches 0

#### Afternoon (4 hours): Default View & Integration Testing
1. **Implement Default View Logic**
   - Add `isFirstVisit` flag to store or local storage
   - On mount of meet page: Check if first visit
   - If first visit: Set activeView to 'participant'
   - Show Add Participant component in open state
   - After adding first participant: Set isFirstVisit = false

2. **Update PillNav to Reflect Default**
   - If no participants: Participant pill active by default
   - If participants exist: Last active view or participant
   - URL param overrides default

3. **Integration Testing**
   - Test complete participant flow (add/edit/delete)
   - Test complete venue flow (search/save/vote)
   - Test travel filter → participant icon flash
   - Test search pill expansion
   - Test saved button expansion
   - Test venue card → map highlight
   - Test venue card → slide-out
   - Test voting system
   - Test voted venues sorting
   - Test default view on first join

4. **Cross-Component Interaction Testing**
   - Travel filter change → participant icon flash → participant travel times update
   - Venue hover → map marker highlight
   - Venue click → slide-out opens → vote → voted list updates → sort changes
   - Search → select → add to list → vote → appears in voted list

5. **Mobile Responsive Testing**
   - Test on 375px (iPhone SE)
   - Test on 768px (iPad)
   - Test on 1024px+ (desktop)
   - Ensure slide-outs work on mobile (full width)
   - Ensure expansions work on mobile
   - Test touch interactions

6. **Code Quality & Accessibility**
   - Run TypeScript checks
   - Run ESLint
   - Format with Prettier
   - Test keyboard navigation
   - Test screen reader
   - Add ARIA labels
   - Check focus states
   - Ensure color contrast

**Deliverables:**
- ✅ VotedVenuesSection component
- ✅ Voted venue compact cards
- ✅ Sort by vote count (descending)
- ✅ Remove vote functionality
- ✅ Default view on first join
- ✅ All integration tests passing
- ✅ Cross-component interactions verified
- ✅ Mobile responsive (3 breakpoints)
- ✅ Accessibility compliant (WCAG 2.1 AA)
- ✅ TypeScript zero errors
- ✅ ESLint zero errors

---

## Component Specifications

### 1. AddParticipantComponent

**File**: `src/components/sidebar/participant/add-participant.tsx`

**Props**:
```typescript
interface AddParticipantComponentProps {
  mode?: 'add' | 'edit';
  participant?: Participant; // for edit mode
  onSubmit: (participant: ParticipantInput) => void;
  onCancel?: () => void;
}

interface ParticipantInput {
  name: string;
  address: string;
  placeId: string;
  fuzzyLocation: boolean;
}
```

**State**:
```typescript
const [name, setName] = useState('');
const [address, setAddress] = useState('');
const [placeId, setPlaceId] = useState('');
const [fuzzyLocation, setFuzzyLocation] = useState(false);
const [isGeocoding, setIsGeocoding] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Key Features**:
- Name input with dice randomizer button
- Address autocomplete with dropdown
- Fuzzy location toggle with tooltip
- Form validation (required fields)
- Loading state during geocoding
- Error handling

**Styling**:
- Rounded corners (rounded-xl)
- White background
- Border: 2px coral on focus
- Stacked layout (flex-col)
- Gap between inputs
- Coral primary button

---

### 2. ParticipantPill

**File**: `src/components/sidebar/participant/participant-pill.tsx`

**Props**:
```typescript
interface ParticipantPillProps {
  participant: Participant;
  selectedVenue?: Venue | null;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean; // organizer only
}

interface Participant {
  id: string;
  name: string;
  address: string;
  color: string;
  initials: string;
  fuzzyLocation: boolean;
  location: {
    lat: number;
    lng: number;
  };
  displayLocation?: {
    lat: number;
    lng: number;
  }; // fuzzy coordinates
  travelTime?: string;
}
```

**Structure**:
```
<div className="relative w-full pb-3">
  <div className="flex items-center gap-3">
    {/* Cat Tail SVG */}
    <CatTail color={participant.color} />

    {/* Main Pill */}
    <div className="flex-1 flex items-center justify-between bg-background border rounded-full px-4 py-2">
      {/* Left: Info */}
      <div className="flex flex-col gap-0.5">
        <span>{participant.name}</span>
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          <span>{participant.address}</span>
        </div>
      </div>

      {/* Right: Avatar with Ears */}
      <div className="relative">
        {/* Cat Ears */}
        <CatEars color={participant.color} />

        {/* Avatar */}
        <Avatar className={participant.color}>
          <AvatarFallback>{participant.initials}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  </div>

  {/* Little Feet */}
  <div className="absolute bottom-0 left-8 right-8 flex justify-around">
    <div className="w-2 h-2 rounded-full bg-border" />
    <div className="w-2 h-2 rounded-full bg-border" />
  </div>

  {/* Travel Time Bubble */}
  {selectedVenue && participant.travelTime && (
    <TravelTimeBubble travelTime={participant.travelTime} />
  )}
</div>
```

**Tail SVG** (exact implementation from reference):
```typescript
<svg width="40" height="64" viewBox="0 0 40 64" className="text-border">
  {/* Fluffy cat tail with double curve */}
  <path
    d="M 6 32 Q 10 20, 18 28 Q 26 36, 42 32"
    stroke="currentColor"
    strokeWidth="4"
    fill="none"
    strokeLinecap="round"
    className="stroke-border"
  />
  {/* Inner curve for fluffiness */}
  <path
    d="M 8 32 Q 12 24, 18 30 Q 24 34, 40 32"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    className="stroke-muted-foreground/30"
  />
  {/* Fluffy tail tip */}
  <circle cx="6" cy="32" r="4" fill="currentColor" className="fill-border" />
  <circle cx="6" cy="32" r="2.5" fill="currentColor" className="fill-background" />
</svg>
```

**Cat Ears** (exact implementation):
```typescript
<div className="absolute -top-1 left-0 right-0 flex justify-between px-0.5 z-10">
  {/* Left ear */}
  <div className="relative">
    <div
      className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] ${color} rounded-sm`}
    />
    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-pink-300" />
  </div>

  {/* Right ear */}
  <div className="relative">
    <div
      className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] ${color} rounded-sm`}
    />
    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-pink-300" />
  </div>
</div>
```

---

### 3. AnalysisComponent

**File**: `src/components/sidebar/participant/analysis-component.tsx`

**Props**:
```typescript
interface AnalysisComponentProps {
  participants: Participant[];
  selectedVenue: Venue;
  isOpen: boolean;
  onClose: () => void;
}
```

**Structure**:
```typescript
<div className="fixed inset-0 z-50 flex items-center justify-end">
  {/* Backdrop */}
  <div
    className="absolute inset-0 bg-black/20"
    onClick={onClose}
  />

  {/* Slide-out Panel */}
  <div className="relative w-full md:w-96 h-full bg-white shadow-2xl transform transition-transform duration-300">
    {/* Close Button */}
    <button
      onClick={onClose}
      className="absolute top-4 right-4 z-10"
    >
      <X className="w-6 h-6" />
    </button>

    {/* Header */}
    <div className="p-6 border-b">
      <h2 className="text-xl font-semibold">Travel Time Analysis</h2>
      <p className="text-sm text-muted-foreground">{selectedVenue.name}</p>
    </div>

    {/* Charts Container */}
    <div className="h-[calc(100%-80px)] flex flex-col">
      {/* Top Half: Dot Chart */}
      <div className="flex-1 p-4 border-b">
        <h3 className="text-sm font-medium mb-2">Time vs Distance</h3>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="distance"
              name="Distance"
              unit=" km"
              label={{ value: 'Distance (km)', position: 'bottom' }}
            />
            <YAxis
              dataKey="time"
              name="Time"
              unit=" min"
              label={{ value: 'Time (min)', angle: -90, position: 'left' }}
            />
            <Tooltip />
            <Scatter
              data={chartData}
              fill="#8884d8"
              shape={<CustomDot />}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Half: Bar Chart */}
      <div className="flex-1 p-4">
        <h3 className="text-sm font-medium mb-2">Travel Time by Participant</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis
              label={{ value: 'Time (min)', angle: -90, position: 'left' }}
            />
            <Tooltip />
            <Bar
              dataKey="time"
              radius={[8, 8, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
</div>
```

**Custom Dot for Scatter Chart**:
```typescript
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={16}
        fill={payload.color}
        stroke="white"
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={10}
        fontWeight="semibold"
      >
        {payload.initials}
      </text>
    </g>
  );
};
```

---

### 4. TravelTypeFilter Component

**File**: `src/components/sidebar/venue/travel-type-filter.tsx`

**Props**:
```typescript
interface TravelTypeFilterProps {
  selectedMode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
}

type TravelMode = 'driving' | 'transit' | 'walking' | 'bicycling';
```

**Structure**:
```tsx
<div className="flex items-center gap-2 py-2">
  {TRAVEL_MODES.map(mode => (
    <button
      key={mode.id}
      onClick={() => handleModeChange(mode.id)}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
        selectedMode === mode.id
          ? 'bg-coral-500 text-white shadow-md'
          : 'bg-white text-foreground border-2 border-border hover:border-coral-500'
      )}
    >
      <mode.Icon className="w-5 h-5" />
      <span>{mode.label}</span>
    </button>
  ))}
</div>
```

**Travel Modes**:
```typescript
const TRAVEL_MODES = [
  { id: 'driving', label: 'Car', Icon: Car },
  { id: 'transit', label: 'Transit', Icon: Bus },
  { id: 'walking', label: 'Walk', Icon: PersonStanding },
  { id: 'bicycling', label: 'Bike', Icon: Bike },
];
```

---

### 5. SearchPillBar Component

**File**: `src/components/sidebar/venue/search-pill-bar.tsx`

**Props**:
```typescript
interface SearchPillBarProps {
  onSelect: (venue: Venue) => void;
  placeholder?: string;
}
```

**State**:
```typescript
const [isExpanded, setIsExpanded] = useState(false);
const [query, setQuery] = useState('');
const [suggestions, setSuggestions] = useState<Venue[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [selectedIndex, setSelectedIndex] = useState(-1);
```

**Structure**:
```tsx
<div className="relative">
  {/* Search Input Container */}
  <div
    className={cn(
      'flex items-center gap-2 bg-white border-2 border-border transition-all duration-300',
      isExpanded
        ? 'w-full rounded-lg px-4 py-3 border-coral-500 shadow-md'
        : 'w-48 rounded-full px-4 py-2 hover:border-coral-300'
    )}
  >
    <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
    <input
      type="text"
      value={query}
      onChange={handleInputChange}
      onFocus={() => setIsExpanded(true)}
      onBlur={handleBlur}
      placeholder={placeholder || 'Search venues...'}
      className="flex-1 outline-none text-sm bg-transparent"
    />
    {query && (
      <button onClick={handleClear}>
        <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
      </button>
    )}
  </div>

  {/* Autocomplete Dropdown */}
  {isExpanded && suggestions.length > 0 && (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-border rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
      {suggestions.map((venue, index) => (
        <VenueSuggestionItem
          key={venue.id}
          venue={venue}
          isSelected={index === selectedIndex}
          onClick={() => handleSelect(venue)}
        />
      ))}
    </div>
  )}
</div>
```

---

### 6. SavedButton Component

**File**: `src/components/sidebar/venue/saved-button.tsx`

**Props**:
```typescript
interface SavedButtonProps {
  savedVenues: Venue[];
  onVenueClick: (venue: Venue) => void;
  onRemove: (venueId: string) => void;
}
```

**State**:
```typescript
const [isExpanded, setIsExpanded] = useState(false);
```

**Structure**:
```tsx
<div className="relative">
  {/* Saved Button */}
  <button
    onClick={() => setIsExpanded(!isExpanded)}
    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border-2 border-border hover:border-coral-500 transition-all duration-200"
  >
    <Bookmark className="w-5 h-5" />
    <span className="text-sm font-medium">Saved</span>
    {savedVenues.length > 0 && (
      <Badge className="ml-1 bg-coral-500 text-white">
        {savedVenues.length}
      </Badge>
    )}
  </button>

  {/* Expanded Panel */}
  {isExpanded && (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="p-4">
        <h3 className="text-sm font-semibold mb-3">Saved Venues</h3>
        {savedVenues.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No saved venues yet
          </p>
        ) : (
          <div className="space-y-2">
            {savedVenues.map(venue => (
              <SavedVenueCard
                key={venue.id}
                venue={venue}
                onClick={() => onVenueClick(venue)}
                onRemove={() => onRemove(venue.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )}
</div>
```

---

### 7. VenueCard Component

**File**: `src/components/sidebar/venue/venue-card.tsx`

**Props**:
```typescript
interface VenueCardProps {
  venue: Venue;
  onVote: (venueId: string) => void;
  onSave: (venueId: string) => void;
  onClick: (venueId: string) => void;
  onHover?: (venueId: string | null) => void;
  isVoted: boolean;
  isSaved: boolean;
}

interface Venue {
  id: string;
  name: string;
  address: string;
  category: string;
  rating: number;
  imageUrl: string;
  hours: {
    open: string;
    close: string;
  };
  voteCount: number;
  location: {
    lat: number;
    lng: number;
  };
}
```

**Structure**:
```tsx
<div
  className="relative bg-white border-2 border-border rounded-xl overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer"
  onClick={() => onClick(venue.id)}
  onMouseEnter={() => onHover?.(venue.id)}
  onMouseLeave={() => onHover?.(null)}
>
  {/* Image */}
  <div className="relative h-40 bg-gray-200">
    <img
      src={venue.imageUrl}
      alt={venue.name}
      className="w-full h-full object-cover"
    />

    {/* Save Button (top-left) */}
    <button
      onClick={(e) => { e.stopPropagation(); onSave(venue.id); }}
      className="absolute top-2 left-2 p-2 bg-white/90 rounded-full hover:bg-white shadow-md"
    >
      <Bookmark className={cn("w-5 h-5", isSaved ? "fill-coral-500 text-coral-500" : "text-gray-600")} />
    </button>

    {/* Vote Button (top-right) */}
    <button
      onClick={(e) => { e.stopPropagation(); onVote(venue.id); }}
      className="absolute top-2 right-2 flex items-center gap-1 px-3 py-1.5 bg-white/90 rounded-full hover:bg-white shadow-md"
    >
      <Heart className={cn("w-5 h-5", isVoted ? "fill-coral-500 text-coral-500" : "text-gray-600")} />
      <span className="text-sm font-medium">{venue.voteCount}</span>
    </button>
  </div>

  {/* Content */}
  <div className="p-4 space-y-2">
    {/* Name */}
    <h3 className="text-lg font-semibold text-foreground truncate">
      {venue.name}
    </h3>

    {/* Rating */}
    <div className="flex items-center gap-1">
      <RatingStars rating={venue.rating} />
      <span className="text-sm text-muted-foreground ml-1">
        {venue.rating}
      </span>
    </div>

    {/* Hours */}
    <div className="flex items-center gap-2 text-sm">
      <OpenStatusBadge hours={venue.hours} />
    </div>

    {/* Category Badge */}
    <Badge variant="secondary" className="text-xs">
      {venue.category}
    </Badge>
  </div>
</div>
```

---

### 8. VenueInfoComponent (Slide-Out)

**File**: `src/components/sidebar/venue/venue-info-slide-out.tsx`

**Props**:
```typescript
interface VenueInfoSlideOutProps {
  venue: Venue;
  isOpen: boolean;
  onClose: () => void;
  onVote: (venueId: string) => void;
  onSave: (venueId: string) => void;
  isVoted: boolean;
  isSaved: boolean;
}
```

**Structure**:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-end">
  {/* Backdrop */}
  <div
    className="absolute inset-0 bg-black/30 animate-in fade-in duration-200"
    onClick={onClose}
  />

  {/* Slide-out Panel */}
  <div className="relative w-full md:w-96 h-full bg-white shadow-2xl transform transition-transform duration-300 animate-in slide-in-from-right">
    {/* Close Button */}
    <button
      onClick={onClose}
      className="absolute top-4 right-4 z-10 p-2 bg-white/90 rounded-full shadow-lg hover:bg-white"
    >
      <X className="w-6 h-6" />
    </button>

    {/* Hero Image Header */}
    <div className="relative h-48 bg-gradient-to-b from-black/40 to-black/60">
      <img
        src={venue.imageUrl}
        alt={venue.name}
        className="absolute inset-0 w-full h-full object-cover -z-10"
      />
      <div className="absolute bottom-4 left-4 right-4">
        <h2 className="text-2xl font-bold text-white drop-shadow-lg">
          {venue.name}
        </h2>
      </div>
    </div>

    {/* Content */}
    <div className="h-[calc(100%-12rem)] overflow-y-auto p-6 space-y-6">
      {/* Rating */}
      <div className="flex items-center gap-2">
        <RatingStars rating={venue.rating} size="lg" />
        <span className="text-lg font-semibold">{venue.rating}</span>
        <span className="text-sm text-muted-foreground">(120 reviews)</span>
      </div>

      {/* Address */}
      <div className="flex items-start gap-2">
        <MapPin className="w-5 h-5 text-coral-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">{venue.address}</p>
      </div>

      {/* About */}
      <div>
        <h3 className="text-sm font-semibold mb-2">About</h3>
        <p className="text-sm text-muted-foreground">
          {venue.description || 'No description available.'}
        </p>
      </div>

      {/* Open Hours */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Hours</h3>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <OpenStatusBadge hours={venue.hours} />
            <span className="text-muted-foreground">
              {venue.hours.open} - {venue.hours.close}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {/* Vote Button */}
        <button
          onClick={() => onVote(venue.id)}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-200",
            isVoted
              ? "bg-coral-500 text-white shadow-md"
              : "bg-white text-foreground border-2 border-coral-500 hover:bg-coral-50"
          )}
        >
          <Heart className={cn("w-5 h-5", isVoted && "fill-white")} />
          <span>{isVoted ? 'Voted' : 'Vote for this venue'}</span>
        </button>

        {/* Save Button */}
        <button
          onClick={() => onSave(venue.id)}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-foreground border-2 border-border hover:border-coral-500 transition-all duration-200"
        >
          <Bookmark className={cn("w-5 h-5", isSaved && "fill-coral-500 text-coral-500")} />
          <span>{isSaved ? 'Saved' : 'Save venue'}</span>
        </button>

        {/* Google Maps Button */}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${venue.location.lat},${venue.location.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-coral-500 text-white font-medium hover:bg-coral-600 transition-all duration-200"
        >
          <ExternalLink className="w-5 h-5" />
          <span>Open in Google Maps</span>
        </a>
      </div>
    </div>
  </div>
</div>
```

---

### 9. VotedVenuesSection Component

**File**: `src/components/sidebar/venue/voted-venues-section.tsx`

**Props**:
```typescript
interface VotedVenuesSectionProps {
  venues: Venue[];
  onVenueClick: (venueId: string) => void;
  onRemoveVote: (venueId: string) => void;
}
```

**Structure**:
```tsx
<div className="space-y-4">
  {/* Header */}
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-semibold text-foreground">
      Voted Venues
    </h3>
    <Badge className="bg-coral-500 text-white">
      {votedVenues.length}
    </Badge>
  </div>

  {/* Voted Venues List */}
  {votedVenues.length === 0 ? (
    <div className="text-center py-8">
      <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
      <p className="text-sm text-muted-foreground">No votes yet</p>
    </div>
  ) : (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {votedVenues.map(venue => (
        <VotedVenueCompactCard
          key={venue.id}
          venue={venue}
          onClick={() => onVenueClick(venue.id)}
          onRemoveVote={() => onRemoveVote(venue.id)}
        />
      ))}
    </div>
  )}
</div>
```

**VotedVenueCompactCard**:
```tsx
<div
  className="flex items-center gap-3 p-3 bg-white border-2 border-border rounded-lg hover:border-coral-500 hover:shadow-md transition-all duration-200 cursor-pointer"
  onClick={onClick}
>
  {/* Image */}
  <img
    src={venue.imageUrl}
    alt={venue.name}
    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
  />

  {/* Content */}
  <div className="flex-1 min-w-0">
    <h4 className="text-sm font-semibold text-foreground truncate">
      {venue.name}
    </h4>
    <div className="flex items-center gap-1 mt-1">
      <RatingStars rating={venue.rating} size="sm" />
      <span className="text-xs text-muted-foreground ml-1">
        {venue.rating}
      </span>
    </div>
  </div>

  {/* Vote Badge */}
  <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-coral-500 text-white rounded-full">
    <Heart className="w-4 h-4 fill-white" />
    <span className="text-sm font-semibold">{venue.voteCount}</span>
  </div>

  {/* Remove Button */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      onRemoveVote();
    }}
    className="flex-shrink-0 p-1 hover:bg-red-50 rounded-full transition-colors"
  >
    <X className="w-4 h-4 text-red-500" />
  </button>
</div>
```

---

## Technical Implementation Details

### Utilities

#### 1. Name Generator (`src/lib/utils/name-generator.ts`)

```typescript
const ADJECTIVES = [
  'happy', 'sleepy', 'fluffy', 'bouncy', 'clever',
  'swift', 'gentle', 'brave', 'silly', 'curious',
  'playful', 'lazy', 'sneaky', 'mighty', 'tiny',
  'fuzzy', 'grumpy', 'cheerful', 'wild', 'calm'
];

const ANIMALS = [
  'cat', 'dog', 'fox', 'bear', 'rabbit',
  'owl', 'panda', 'tiger', 'lion', 'wolf',
  'deer', 'squirrel', 'otter', 'raccoon', 'koala',
  'penguin', 'dolphin', 'elephant', 'giraffe', 'zebra'
];

export function generateRandomName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adjective}_${animal}`;
}
```

#### 2. Color Generator (`src/lib/utils/colors.ts`)

```typescript
const PARTICIPANT_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-cyan-500',
];

export function getRandomColor(id: string): string {
  // Hash the ID to get consistent color
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PARTICIPANT_COLORS[hash % PARTICIPANT_COLORS.length];
}

// Alternative: hex colors for charts
export const PARTICIPANT_HEX_COLORS = [
  '#ef4444', // red-500
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#06b6d4', // cyan-500
];

export function getParticipantHexColor(id: string): string {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PARTICIPANT_HEX_COLORS[hash % PARTICIPANT_HEX_COLORS.length];
}
```

#### 3. Initials Generator (`src/lib/utils/text.ts`)

```typescript
export function getInitials(name: string): string {
  if (!name || name.trim().length === 0) return '??';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}
```

#### 4. Fuzzy Location (`src/lib/utils/location.ts`)

```typescript
export interface Coordinates {
  lat: number;
  lng: number;
}

export function applyFuzzyOffset(coords: Coordinates): Coordinates {
  // Random offset between 0.005 and 0.01 degrees (~0.3 to 0.7 miles)
  const offsetLat = (Math.random() * 0.005 + 0.005) * (Math.random() > 0.5 ? 1 : -1);
  const offsetLng = (Math.random() * 0.005 + 0.005) * (Math.random() > 0.5 ? 1 : -1);

  return {
    lat: coords.lat + offsetLat,
    lng: coords.lng + offsetLng,
  };
}

export function formatFuzzyAddress(address: string): string {
  // Extract street name and city
  const parts = address.split(',');
  if (parts.length >= 2) {
    const street = parts[0].trim();
    const city = parts[1].trim();
    return `Near ${street}, ${city}`;
  }
  return `Near ${address}`;
}
```

---

## Mock API Strategy

### 1. Mock Places Autocomplete (`src/lib/api/mock/places-autocomplete.ts`)

```typescript
interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

const MOCK_NYC_ADDRESSES = [
  { id: '1', main: '123 Broadway', secondary: 'New York, NY' },
  { id: '2', main: '456 5th Avenue', secondary: 'New York, NY' },
  { id: '3', main: '789 Madison Avenue', secondary: 'New York, NY' },
  { id: '4', main: '321 Park Avenue', secondary: 'New York, NY' },
  { id: '5', main: '654 Lexington Avenue', secondary: 'New York, NY' },
  // ... 45 more addresses
];

export async function mockAutocomplete(input: string): Promise<PlacePrediction[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));

  if (!input || input.length < 2) return [];

  const normalized = input.toLowerCase();

  return MOCK_NYC_ADDRESSES
    .filter(addr =>
      addr.main.toLowerCase().includes(normalized) ||
      addr.secondary.toLowerCase().includes(normalized)
    )
    .slice(0, 5)
    .map(addr => ({
      place_id: addr.id,
      description: `${addr.main}, ${addr.secondary}`,
      structured_formatting: {
        main_text: addr.main,
        secondary_text: addr.secondary,
      },
    }));
}
```

### 2. Mock Geocoding (`src/lib/api/mock/geocoding.ts`)

```typescript
interface GeocodeResult {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

// Map place_ids to coordinates
const PLACE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  '1': { lat: 40.7580, lng: -73.9855 }, // Broadway
  '2': { lat: 40.7614, lng: -73.9776 }, // 5th Avenue
  '3': { lat: 40.7614, lng: -73.9733 }, // Madison Ave
  // ... more mappings
};

export async function mockGeocode(placeId: string, address: string): Promise<GeocodeResult> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  const coords = PLACE_COORDINATES[placeId];

  if (!coords) {
    throw new Error('Address not found');
  }

  return {
    place_id: placeId,
    formatted_address: address,
    geometry: {
      location: coords,
    },
  };
}
```

### 3. Mock Directions/Travel Time (`src/lib/api/mock/directions.ts`)

```typescript
export interface TravelTimeResult {
  participantId: string;
  distance: number; // km
  duration: number; // minutes
}

export async function mockCalculateTravelTime(
  origin: Coordinates,
  destination: Coordinates,
  mode: 'driving' | 'transit' | 'walking' | 'bicycling'
): Promise<{ distance: number; duration: number }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 400));

  // Calculate straight-line distance (Haversine formula)
  const R = 6371; // Earth radius in km
  const dLat = (destination.lat - origin.lat) * Math.PI / 180;
  const dLng = (destination.lng - origin.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  // Estimate duration based on mode
  const speedKmh = {
    driving: 40,
    transit: 25,
    walking: 5,
    bicycling: 15,
  };

  const duration = (distance / speedKmh[mode]) * 60; // convert to minutes

  return {
    distance: Math.round(distance * 10) / 10, // round to 1 decimal
    duration: Math.round(duration),
  };
}

export async function mockCalculateAllTravelTimes(
  participants: Participant[],
  venue: Venue,
  mode: 'driving' | 'transit' | 'walking' | 'bicycling'
): Promise<TravelTimeResult[]> {
  const results = await Promise.all(
    participants.map(async (p) => {
      const { distance, duration } = await mockCalculateTravelTime(
        p.displayLocation || p.location,
        venue.location,
        mode
      );
      return {
        participantId: p.id,
        distance,
        duration,
      };
    })
  );

  return results;
}
```

### 4. Mock Venue Search API (`src/lib/api/mock/venue-search.ts`)

```typescript
export interface MockVenue {
  id: string;
  name: string;
  address: string;
  category: 'gym' | 'bar' | 'cafe' | 'things_to_do';
  rating: number;
  imageUrl: string;
  hours: {
    open: string;
    close: string;
  };
  description: string;
  location: {
    lat: number;
    lng: number;
  };
  voteCount: number;
  votes: VenueVote[];
}

const MOCK_VENUES: MockVenue[] = [
  // Gyms
  {
    id: 'gym-1',
    name: 'Planet Fitness - Midtown',
    address: '123 W 42nd St, New York, NY 10036',
    category: 'gym',
    rating: 4.2,
    imageUrl: '/images/venues/planet-fitness.jpg',
    hours: { open: '5:00 AM', close: '12:00 AM' },
    description: '24-hour gym with state-of-the-art equipment and personal training.',
    location: { lat: 40.7580, lng: -73.9855 },
    voteCount: 0,
    votes: [],
  },
  {
    id: 'gym-2',
    name: 'Equinox Bryant Park',
    address: '10 E 40th St, New York, NY 10016',
    category: 'gym',
    rating: 4.7,
    imageUrl: '/images/venues/equinox.jpg',
    hours: { open: '5:30 AM', close: '11:00 PM' },
    description: 'Luxury fitness club with premium amenities and classes.',
    location: { lat: 40.7527, lng: -73.9802 },
    voteCount: 0,
    votes: [],
  },
  // Bars
  {
    id: 'bar-1',
    name: 'The Dead Rabbit',
    address: '30 Water St, New York, NY 10004',
    category: 'bar',
    rating: 4.8,
    imageUrl: '/images/venues/dead-rabbit.jpg',
    hours: { open: '11:00 AM', close: '2:00 AM' },
    description: 'Award-winning Irish pub with craft cocktails and taproom.',
    location: { lat: 40.7033, lng: -74.0118 },
    voteCount: 0,
    votes: [],
  },
  {
    id: 'bar-2',
    name: 'Employees Only',
    address: '510 Hudson St, New York, NY 10014',
    category: 'bar',
    rating: 4.6,
    imageUrl: '/images/venues/employees-only.jpg',
    hours: { open: '6:00 PM', close: '3:30 AM' },
    description: 'Speakeasy-style cocktail bar with a hidden entrance.',
    location: { lat: 40.7373, lng: -74.0063 },
    voteCount: 0,
    votes: [],
  },
  // Cafes
  {
    id: 'cafe-1',
    name: 'Blue Bottle Coffee',
    address: '450 W 15th St, New York, NY 10011',
    category: 'cafe',
    rating: 4.5,
    imageUrl: '/images/venues/blue-bottle.jpg',
    hours: { open: '7:00 AM', close: '7:00 PM' },
    description: 'Artisanal coffee roaster with minimalist aesthetic.',
    location: { lat: 40.7423, lng: -74.0067 },
    voteCount: 0,
    votes: [],
  },
  {
    id: 'cafe-2',
    name: 'Stumptown Coffee Roasters',
    address: '18 W 29th St, New York, NY 10001',
    category: 'cafe',
    rating: 4.4,
    imageUrl: '/images/venues/stumptown.jpg',
    hours: { open: '6:30 AM', close: '8:00 PM' },
    description: 'Portland-based coffee roaster with multiple NYC locations.',
    location: { lat: 40.7456, lng: -73.9889 },
    voteCount: 0,
    votes: [],
  },
  // Things to Do
  {
    id: 'activity-1',
    name: 'Brooklyn Bowl',
    address: '61 Wythe Ave, Brooklyn, NY 11249',
    category: 'things_to_do',
    rating: 4.6,
    imageUrl: '/images/venues/brooklyn-bowl.jpg',
    hours: { open: '11:00 AM', close: '2:00 AM' },
    description: 'Bowling alley, live music venue, and restaurant.',
    location: { lat: 40.7217, lng: -73.9571 },
    voteCount: 0,
    votes: [],
  },
  {
    id: 'activity-2',
    name: 'The High Line',
    address: 'Access at Gansevoort St, New York, NY 10014',
    category: 'things_to_do',
    rating: 4.9,
    imageUrl: '/images/venues/high-line.jpg',
    hours: { open: '7:00 AM', close: '10:00 PM' },
    description: 'Elevated park built on historic freight rail line.',
    location: { lat: 40.7479, lng: -74.0048 },
    voteCount: 0,
    votes: [],
  },
  // ... Add 92 more venues for total of 100+
];

export async function mockVenueSearch(query: string, category?: string): Promise<MockVenue[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));

  if (!query || query.length < 2) return [];

  const normalized = query.toLowerCase();

  let filtered = MOCK_VENUES.filter(venue =>
    venue.name.toLowerCase().includes(normalized) ||
    venue.address.toLowerCase().includes(normalized) ||
    venue.category.toLowerCase().includes(normalized)
  );

  // Filter by category if provided
  if (category) {
    filtered = filtered.filter(venue => venue.category === category);
  }

  return filtered.slice(0, 5); // Return top 5 matches
}

export function getMockVenueById(id: string): MockVenue | undefined {
  return MOCK_VENUES.find(venue => venue.id === id);
}

export function getMockVenuesByCategory(category: string): MockVenue[] {
  return MOCK_VENUES.filter(venue => venue.category === category);
}
```

### 5. Flash Animation Utility (`src/lib/utils/animations.ts`)

```typescript
// Flash animation keyframes for participant icon
export const flashAnimation = {
  keyframes: `
    @keyframes flash-pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      16.67% {
        opacity: 0.4;
        transform: scale(1.15);
      }
      33.33% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.4;
        transform: scale(1.15);
      }
      66.67% {
        opacity: 1;
        transform: scale(1);
      }
      83.33% {
        opacity: 0.4;
        transform: scale(1.15);
      }
    }
  `,
  className: 'animate-flash-pulse',
  duration: 600, // 600ms total (3 flashes × 200ms each)
};

// Tail wag animation for cat tail
export const tailWagAnimation = {
  keyframes: `
    @keyframes tail-wag {
      0%, 100% {
        transform: rotate(0deg);
      }
      25% {
        transform: rotate(-5deg);
      }
      75% {
        transform: rotate(5deg);
      }
    }
  `,
  className: 'animate-tail-wag',
  duration: 1000, // 1 second per wag cycle
};
```

### 6. Venue Sorting Utility (`src/lib/utils/venue-sort.ts`)

```typescript
export function sortVenuesByVotes(venues: Venue[]): Venue[] {
  return [...venues]
    .filter(venue => venue.voteCount > 0)
    .sort((a, b) => {
      // Primary sort: vote count (descending)
      if (b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }
      // Tie-breaker: alphabetical by name
      return a.name.localeCompare(b.name);
    });
}

export function getTopVotedVenue(venues: Venue[]): Venue | null {
  const sorted = sortVenuesByVotes(venues);
  return sorted.length > 0 ? sorted[0] : null;
}
```

---

## Testing Strategy

### Unit Tests

**Name Generator** (`name-generator.test.ts`):
```typescript
describe('generateRandomName', () => {
  it('should generate name in format adjective_animal', () => {
    const name = generateRandomName();
    expect(name).toMatch(/^[a-z]+_[a-z]+$/);
  });

  it('should generate different names on multiple calls', () => {
    const names = Array.from({ length: 10 }, () => generateRandomName());
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBeGreaterThan(1);
  });
});
```

**Color Generator** (`colors.test.ts`):
```typescript
describe('getRandomColor', () => {
  it('should return consistent color for same id', () => {
    const id = 'test-123';
    const color1 = getRandomColor(id);
    const color2 = getRandomColor(id);
    expect(color1).toBe(color2);
  });

  it('should return valid tailwind class', () => {
    const color = getRandomColor('test');
    expect(color).toMatch(/^bg-(red|blue|green|yellow|purple|pink|indigo|orange|teal|cyan)-500$/);
  });
});
```

**Initials Generator** (`text.test.ts`):
```typescript
describe('getInitials', () => {
  it('should extract initials from multi-word name', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('Alice Bob Charlie')).toBe('AB');
  });

  it('should handle single word name', () => {
    expect(getInitials('Alice')).toBe('AL');
  });

  it('should handle edge cases', () => {
    expect(getInitials('')).toBe('??');
    expect(getInitials('  ')).toBe('??');
  });
});
```

**Fuzzy Location** (`location.test.ts`):
```typescript
describe('applyFuzzyOffset', () => {
  it('should apply random offset within bounds', () => {
    const original = { lat: 40.7580, lng: -73.9855 };
    const fuzzy = applyFuzzyOffset(original);

    const latDiff = Math.abs(fuzzy.lat - original.lat);
    const lngDiff = Math.abs(fuzzy.lng - original.lng);

    expect(latDiff).toBeGreaterThan(0.005);
    expect(latDiff).toBeLessThan(0.015);
    expect(lngDiff).toBeGreaterThan(0.005);
    expect(lngDiff).toBeLessThan(0.015);
  });

  it('should not modify original coordinates', () => {
    const original = { lat: 40.7580, lng: -73.9855 };
    const originalCopy = { ...original };
    applyFuzzyOffset(original);
    expect(original).toEqual(originalCopy);
  });
});
```

### Integration Tests

**Add Participant Flow** (`add-participant.test.tsx`):
```typescript
describe('AddParticipantComponent', () => {
  it('should add participant on form submission', async () => {
    render(<AddParticipantComponent onSubmit={mockSubmit} />);

    // Fill name
    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.type(nameInput, 'Test User');

    // Fill address (with autocomplete)
    const addressInput = screen.getByLabelText(/address/i);
    await userEvent.type(addressInput, 'Broadway');

    // Select from dropdown
    await waitFor(() => screen.getByText('123 Broadway'));
    await userEvent.click(screen.getByText('123 Broadway'));

    // Submit
    await userEvent.click(screen.getByText(/join/i));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test User',
          address: expect.stringContaining('Broadway'),
        })
      );
    });
  });
});
```

### E2E Tests

**Complete Participant Flow** (Playwright):
```typescript
test('add participant and view on map', async ({ page }) => {
  await page.goto('/meet/test-event-123');

  // Click "Add Participant" button
  await page.click('text=Add Participant');

  // Fill form
  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="address"]', '123 Broadway');

  // Wait for autocomplete
  await page.waitForSelector('text=123 Broadway, New York');
  await page.click('text=123 Broadway, New York');

  // Enable fuzzy location
  await page.click('[aria-label="Toggle fuzzy location"]');

  // Submit
  await page.click('text=Join');

  // Verify participant appears
  await page.waitForSelector('text=Test User');

  // Verify marker on map
  await expect(page.locator('.participant-marker')).toBeVisible();
});
```

---

## Success Criteria

### Functional Requirements - Participant Management
- [ ] User can add participant with name and address
- [ ] Dice randomizer generates unique animal names
- [ ] Address autocomplete works with mock data (50+ addresses)
- [ ] Autocomplete keyboard navigable (up/down/enter)
- [ ] Fuzzy location toggle functional
- [ ] Fuzzy location tooltip displays correctly
- [ ] Geocoding returns mock coordinates
- [ ] Participant appears in list with cat theme
- [ ] Cat tail visible and matches participant color
- [ ] Cat tail wagging animation works
- [ ] Cat tail shrinks on pill hover
- [ ] Cat ears on avatar with pink inner triangles
- [ ] Little feet circles at bottom
- [ ] Color assignment consistent per participant
- [ ] Initials calculated correctly
- [ ] Participant count updates reactively
- [ ] Empty state displays when no participants
- [ ] Loading state displays during operations
- [ ] Travel time bubble appears when venue selected
- [ ] Travel time bubble animates smoothly
- [ ] Analytics slide-out opens from participant list
- [ ] Time-distance dot chart renders correctly
- [ ] Participant time bar chart renders correctly
- [ ] Charts use participant colors
- [ ] Edit participant updates data in store
- [ ] Delete participant shows confirmation (organizer only)
- [ ] Delete removes participant from list and map
- [ ] Add participant button visible to organizer only
- [ ] Participant click highlights route on map

### Functional Requirements - Venue Section with Voting
- [ ] Travel type filter displays 4 modes (Car, Transit, Walk, Bike)
- [ ] Travel type filter single-selection works
- [ ] Travel type selection persists in URL
- [ ] Changing travel type triggers participant icon flash (3 times)
- [ ] Flash animation completes 3 pulses in 600ms
- [ ] Travel times recalculate when travel type changes
- [ ] Search pill bar compact state (w-48)
- [ ] Search pill bar expands to full width on click
- [ ] Search pill bar collapses on blur
- [ ] Venue search debounced (300ms)
- [ ] Autocomplete dropdown shows top 5 matches
- [ ] Autocomplete keyboard navigable
- [ ] Venue selection from autocomplete works
- [ ] Saved button displays count badge
- [ ] Saved button expands to show saved venues
- [ ] Saved button collapses on click outside
- [ ] Save/unsave venue functionality works
- [ ] Venue cards display all data (name, rating, hours, image)
- [ ] Venue card hover highlights marker on map
- [ ] Venue card click opens info slide-out
- [ ] Vote button toggles vote on/off
- [ ] Vote count updates immediately (optimistic)
- [ ] Venue info slide-out opens from right
- [ ] Venue info displays all details
- [ ] Google Maps button opens correct URL in new tab
- [ ] Voted venues section displays only voted venues
- [ ] Voted venues sorted by vote count (descending)
- [ ] Remove vote functionality works
- [ ] Default view on first join shows participant section
- [ ] Default view shows add participant component open

### Technical Requirements
- [ ] TypeScript zero errors
- [ ] ESLint zero errors
- [ ] All tests pass (>85% coverage)
- [ ] Mock APIs return data in <500ms
- [ ] No console errors
- [ ] Store actions properly typed
- [ ] Components properly memoized (React.memo where needed)
- [ ] Voting system persists in store
- [ ] Saved venues persist in store
- [ ] Travel mode persists in URL and store
- [ ] Cross-component flash trigger works reliably
- [ ] Map marker highlighting responsive (<50ms)

### UI/UX Requirements
- [ ] Cat theme matches ParticipantComponent.ts design
- [ ] Responsive on mobile (375px), tablet (768px), desktop (1024px+)
- [ ] All interactive elements have focus states
- [ ] Keyboard navigation works throughout
- [ ] Touch targets ≥44px on mobile
- [ ] Animations smooth (60fps)
- [ ] Loading states user-friendly
- [ ] Error messages clear and helpful
- [ ] WCAG 2.1 AA compliant
- [ ] ARIA labels on all inputs
- [ ] Screen reader friendly
- [ ] Search pill expansion smooth (300ms transition)
- [ ] Saved button expansion smooth (300ms transition)
- [ ] Venue info slide-out smooth (300ms transition)
- [ ] Participant icon flash visible but not jarring
- [ ] Cat tail wag animation playful (1s loop)
- [ ] Vote button feedback immediate (scale bounce)
- [ ] Map marker highlight clear and visible
- [ ] Rating stars display correctly (filled/half/empty)
- [ ] Open/close hours badge color-coded (green/red)

### Performance Requirements
- [ ] Initial render <100ms
- [ ] Form submission <500ms (including mock geocoding)
- [ ] List scrolls smoothly with 20+ participants
- [ ] Venue list scrolls smoothly with 20+ venues
- [ ] Charts render <200ms
- [ ] No unnecessary re-renders (verified with React DevTools)
- [ ] Search debounce prevents excessive API calls
- [ ] Venue search returns results <200ms
- [ ] Travel time recalculation <500ms for all participants
- [ ] Map marker highlight instantaneous (<50ms)

---

## Dependencies & Prerequisites

### NPM Packages to Install
```bash
npm install recharts
npm install @radix-ui/react-tooltip
npm install uuid
npm install @types/uuid --save-dev
```

### Files to Create

#### Participant Management (Days 1-5)
1. `src/components/sidebar/participant/add-participant.tsx`
2. `src/components/sidebar/participant/participant-pill.tsx`
3. `src/components/sidebar/participant/participants-list.tsx`
4. `src/components/sidebar/participant/analysis-component.tsx`
5. `src/components/sidebar/participant/travel-time-bubble.tsx`
6. `src/components/sidebar/participant/cat-tail.tsx`
7. `src/components/sidebar/participant/cat-ears.tsx`
8. `src/components/shared/address-autocomplete.tsx`
9. `src/lib/utils/name-generator.ts`
10. `src/lib/utils/colors.ts`
11. `src/lib/utils/text.ts`
12. `src/lib/utils/location.ts`
13. `src/lib/api/mock/places-autocomplete.ts`
14. `src/lib/api/mock/geocoding.ts`
15. `src/lib/api/mock/directions.ts`

#### Venue Section with Voting (Days 6-10)
16. `src/components/sidebar/venue/travel-type-filter.tsx`
17. `src/components/header/participant-icon-flash.tsx`
18. `src/components/sidebar/venue/search-pill-bar.tsx`
19. `src/components/sidebar/venue/saved-button.tsx`
20. `src/components/sidebar/venue/venue-card.tsx`
21. `src/components/sidebar/venue/venue-info-slide-out.tsx`
22. `src/components/sidebar/venue/voted-venues-section.tsx`
23. `src/components/sidebar/venue/vote-button.tsx`
24. `src/components/shared/rating-stars.tsx`
25. `src/components/shared/open-status-badge.tsx`
26. `src/lib/api/mock/venue-search.ts`
27. `src/lib/utils/animations.ts`
28. `src/lib/utils/venue-sort.ts`

### Store Extensions

**Update `src/store/useMeetingStore.ts`:**
- Add `addParticipant` action
- Add `updateParticipant` action
- Add `removeParticipant` action (already exists ✅)
- Add `voteForVenue(venueId)` action
- Add `unvoteForVenue(venueId)` action
- Add `saveVenue(venueId)` action
- Add `unsaveVenue(venueId)` action
- Add `venues` array to state
- Add `savedVenues` array to state

**Update `src/store/ui-store.ts`:**
- Add `isAnalysisOpen` state
- Add `setAnalysisOpen` action
- Add `selectedTravelMode` state ('driving' | 'transit' | 'walking' | 'bicycling')
- Add `setTravelMode` action
- Add `triggerParticipantFlash` boolean state
- Add `setTriggerParticipantFlash` action
- Add `hoveredVenueId` state (string | null)
- Add `setHoveredVenueId` action
- Add `selectedVenueId` state (string | null)
- Add `setSelectedVenueId` action
- Add `isFirstVisit` state (boolean)
- Add `setIsFirstVisit` action

---

## Risk Mitigation

### High-Risk Areas
1. **Recharts Integration Complexity**
   - Mitigation: Start with simple charts, add customization incrementally
   - Fallback: Use alternative chart library (Chart.js) if needed

2. **Cat Theme SVG Complexity**
   - Mitigation: Copy exact implementation from ParticipantComponent.ts
   - Test SVG rendering in isolation first
   - Ensure responsive sizing

3. **Color Consistency**
   - Mitigation: Hash-based color assignment ensures consistency
   - Store color in participant object
   - Unit tests verify color determinism

4. **Mobile Responsive Charts**
   - Mitigation: Use ResponsiveContainer from Recharts
   - Test on real mobile devices
   - Fallback: Simplify charts on small screens

---

## Quality Gates

Before marking Milestone 3 complete:

- [ ] All components render without errors
- [ ] TypeScript strict mode passes
- [ ] ESLint passes (zero warnings)
- [ ] Prettier formatting applied
- [ ] All unit tests pass (>85% coverage)
- [ ] Integration tests pass
- [ ] Mobile responsive (tested on 375px, 768px, 1024px)
- [ ] Accessibility audit passes
- [ ] UI/UX agent review approved
- [ ] Code review agent approved
- [ ] Cat theme matches reference design exactly
- [ ] Mock APIs functional
- [ ] Store actions working correctly
- [ ] Documentation updated

---

## Notes

### Design Reference
All cat-themed elements (tail, ears, feet, colors) are based on the exact specifications in:
`/Users/victor/work/where2meet-v1.0-client/META/UlTIMATE-REFERENCE/ParticipantComponent.ts`

Refer to this file for:
- Exact SVG paths for cat tail
- Cat ear triangle dimensions and colors
- Little feet positioning
- Travel time bubble design
- Color palette values

### Mock Data Strategy
This milestone uses mock APIs throughout. No external Google APIs are called. All autocomplete, geocoding, and travel time calculations use mock data stored in `/src/lib/api/mock/`.

When transitioning to real APIs, replace mock handlers with real Google Maps API calls while keeping the same interface.

---

**Last Updated**: 2025-11-24
**Status**: Ready to Start
**Estimated Completion**: End of Week 4 (Day 20)
**Total Duration**: 10 days (80 hours)
**Scope**: Participant Management + Venue Section with Voting System
