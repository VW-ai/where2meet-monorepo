# Where2Meet UI/UX Guide
### Simple, Cute & Playful Design System

> A warm, friendly, and approachable design with cat mascot theme

## Table of Contents
1. [Design Philosophy](#design-philosophy)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Component Patterns](#component-patterns)
5. [Cat Theme Elements](#cat-theme-elements)
6. [Shapes & Borders](#shapes--borders)
7. [Spacing & Layout](#spacing--layout)
8. [Animations & Interactions](#animations--interactions)
9. [Responsive Design](#responsive-design)
10. [Accessibility](#accessibility)

---

## Design Philosophy

### Core Principles

**Simple** - Clean, uncluttered interfaces with clear purpose
**Cute** - Playful cat mascot elements that bring joy
**Warm** - Soft colors and friendly shapes
**Approachable** - Easy to understand, welcoming to all users
**Delightful** - Small animations and interactions that surprise and delight

### Visual Language

- **Floating elements** - Borderless cards that appear to float over the canvas (Google Maps style)
- **Elevation through shadows** - Components use shadow depth instead of borders for separation
- **Rounded everything** - Pills, circles, and soft edges
- **Playful details** - Cat tails, ears, and paws as decorative elements
- **Subtle shadows** - Gentle depth creates hierarchy, nothing harsh
- **Smooth transitions** - Everything feels fluid and natural
- **Friendly spacing** - Comfortable, breathable layouts with generous whitespace

---

## Floating UI Design System

### Philosophy - Inspired by Google Maps

The Where2Meet interface adopts a **borderless, floating design** where UI elements appear to hover over the canvas rather than being boxed in with visible borders. This creates a cleaner, more modern feel while maintaining excellent visual hierarchy through shadow elevation.

### Key Principles

**1. No Structural Borders**
- Remove `border`, `border-2`, and similar border classes from cards, pills, and containers
- Use shadows for visual separation instead
- Exception: Selected states can use subtle `ring-2` for accent

**2. Elevation Through Shadows**
```tsx
// Resting state - floating appearance
className="shadow-lg"           // Standard floating elevation

// Hover state - lifts higher
className="hover:shadow-xl"     // Increased elevation on hover

// Selected state - emphasized with ring
className="shadow-xl ring-2 ring-coral-500/30"  // Subtle colored ring + shadow
```

**3. Shadow Hierarchy**
```tsx
// Subtle - Small elements (input fields, badges)
className="shadow-md"           // 4-6px blur, subtle depth

// Standard - Cards, pills, floating elements
className="shadow-lg"           // 10-15px blur, clear floating effect

// Elevated - Selected states, modals, emphasized elements
className="shadow-xl"           // 20-25px blur, significant elevation

// Maximum - Major overlays, dropdowns
className="shadow-2xl"          // 40-50px blur, dramatic lift
```

**4. Whitespace & Breathing Room**
- Increase spacing between elements to compensate for removed borders
- Use generous padding inside components
- Let shadows define boundaries naturally

### Migration from Bordered to Floating

**Before (Bordered):**
```tsx
<div className="bg-white border-2 border-border rounded-xl p-4 hover:border-coral-500">
  Card content
</div>
```

**After (Floating):**
```tsx
<div className="bg-white shadow-lg hover:shadow-xl rounded-xl p-4 transition-shadow">
  Card content
</div>
```

**Selected State (Before):**
```tsx
<div className="bg-coral-50 border-2 border-coral-500 rounded-xl p-4">
  Selected content
</div>
```

**Selected State (After):**
```tsx
<div className="bg-coral-50 shadow-xl ring-2 ring-coral-500/30 rounded-xl p-4">
  Selected content
</div>
```

---

## Color Palette

### Primary Colors - Warm & Playful

```css
/* Coral - Primary Actions */
--coral-50:  #FFF5F5
--coral-100: #FFE5E5
--coral-500: #FF6B6B  /* Main accent */
--coral-600: #EE5A5A  /* Hover */
--coral-700: #DD4949  /* Active */

/* Sunshine Yellow - Highlights */
--yellow-50:  #FFFBEB
--yellow-100: #FFF3C4
--yellow-400: #FFD93D  /* Bright highlights */
--yellow-500: #FFCB05  /* MEC circle */

/* Mint Green - Success */
--mint-50:  #F0FDF4
--mint-100: #DCFCE7
--mint-500: #6BCB77   /* Success states */
--mint-600: #5BB968   /* Success hover */

/* Sky Blue - Info */
--sky-50:  #EFF6FF
--sky-100: #DBEAFE
--sky-500: #4D96FF   /* Info, links */
--sky-600: #3B82F6   /* Link hover */

/* Lavender - Secondary */
--lavender-50:  #FAF5FF
--lavender-100: #F3E8FF
--lavender-500: #B695C0  /* Secondary accent */
--lavender-600: #A78BB0  /* Secondary hover */
```

### Participant Avatar Colors
**Bright, cheerful colors for cat avatars**

```css
--cat-coral:     #FF6B6B
--cat-sunshine:  #FFD93D
--cat-mint:      #6BCB77
--cat-sky:       #4D96FF
--cat-lavender:  #B695C0
--cat-peach:     #FFAD84
--cat-teal:      #4ECDC4
--cat-rose:      #FF6B9D
--cat-indigo:    #6366F1
--cat-orange:    #FB923C
```

**Tailwind Implementation:**
```tsx
const CAT_COLORS = [
  'bg-red-500',      // Coral
  'bg-yellow-400',   // Sunshine
  'bg-green-500',    // Mint
  'bg-blue-500',     // Sky
  'bg-purple-500',   // Lavender
  'bg-orange-400',   // Peach
  'bg-teal-500',     // Teal
  'bg-pink-500',     // Rose
  'bg-indigo-500',   // Indigo
  'bg-cyan-500',     // Cyan
];
```

### Neutral Colors - Soft & Clean

```css
/* Backgrounds */
--background:     #FFFFFF  /* Pure white */
--background-alt: #F8F9FA  /* Light gray bg */

/* Borders & Dividers */
--border:         #E5E7EB  /* Light border */
--border-hover:   #D1D5DB  /* Hover border */

/* Text */
--foreground:          #1F2937  /* Primary text (gray-800) */
--muted-foreground:    #6B7280  /* Secondary text (gray-500) */
--placeholder:         #9CA3AF  /* Placeholder text (gray-400) */
```

### Special Colors

```css
/* Map Elements */
--mec-circle:     #FFD93D  /* Yellow, low opacity */
--search-circle:  #1F2937  /* Dark, stroke only */

/* Status Colors */
--success: #6BCB77   /* Green */
--error:   #EF4444   /* Red */
--warning: #F59E0B   /* Amber */

/* Pink Accents (Cat ears inner) */
--pink-inner: #FFC0CB  /* Light pink */
```

### Usage Examples

```tsx
// Primary action button
<button className="bg-coral-500 hover:bg-coral-600 text-white rounded-full">
  Create Event
</button>

// Participant pill with random cat color
<div className="bg-white border border-border rounded-full">
  <Avatar className={`${CAT_COLORS[index]} border-2 border-white`}>
    {initials}
  </Avatar>
</div>

// Success message
<div className="bg-mint-50 text-mint-600 border border-mint-500 rounded-lg">
  Location added successfully!
</div>
```

---

## Typography

### Font Family
**System Font Stack** - Clean, friendly, and performant

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
  'Helvetica Neue', 'Arial', sans-serif;
```

### Type Scale - Simple & Clear

| Usage | Class | Size | Weight | Line Height |
|-------|-------|------|--------|-------------|
| Page Title | `text-3xl font-bold` | 30px | 700 | tight |
| Section Title | `text-xl font-semibold` | 20px | 600 | snug |
| Card Title | `text-lg font-medium` | 18px | 500 | normal |
| Body | `text-base` | 16px | 400 | normal |
| Small | `text-sm` | 14px | 400 | relaxed |
| Tiny | `text-xs` | 12px | 400 | relaxed |

### Examples

```tsx
// Landing page title
<h1 className="text-3xl font-bold text-foreground">
  Where 2 Meet
</h1>

// Section header
<h2 className="text-xl font-semibold text-foreground mb-4">
  Participants
</h2>

// Participant name
<span className="text-sm font-medium text-foreground">
  Alex Johnson
</span>

// Address
<span className="text-xs text-muted-foreground">
  123 Main St, NY
</span>
```

### Text Colors

```tsx
// Primary text
<p className="text-foreground">Main content</p>

// Secondary text
<p className="text-muted-foreground">Supporting info</p>

// Placeholder
<input placeholder="..." className="placeholder:text-placeholder" />

// Colored text
<p className="text-coral-500">Attention!</p>
```

---

## Component Patterns

### Buttons

#### Primary Button (Coral, Rounded Pill)
```tsx
<button className="
  bg-coral-500 hover:bg-coral-600 active:bg-coral-700
  text-white font-medium
  px-6 py-2.5 rounded-full
  transition-all duration-200
  shadow-sm hover:shadow-md
  focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Create Event
</button>
```

#### Secondary Button (Outline, Pill)
```tsx
<button className="
  bg-white hover:bg-gray-50
  text-foreground font-medium
  px-6 py-2.5 rounded-full
  border-2 border-border hover:border-coral-500
  transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2
">
  Cancel
</button>
```

#### Ghost Button (Minimal)
```tsx
<button className="
  text-muted-foreground hover:text-foreground
  hover:bg-gray-50
  px-4 py-2 rounded-full
  transition-all duration-200
">
  Clear
</button>
```

#### Icon Button (Cute & Small)
```tsx
<button className="
  p-2 rounded-full
  hover:bg-gray-100
  transition-colors
  focus:outline-none focus:ring-2 focus:ring-coral-500
"
aria-label="Close">
  <X className="w-5 h-5 text-muted-foreground" />
</button>
```

#### Button Sizes
```tsx
// Small (pills, filters)
<button className="px-4 py-1.5 text-sm rounded-full">Small</button>

// Medium (default)
<button className="px-6 py-2.5 text-base rounded-full">Medium</button>

// Large (CTAs)
<button className="px-8 py-3 text-lg rounded-full">Large</button>
```

---

### Input Fields

#### Text Input (Floating Design)
```tsx
<input
  type="text"
  className="
    w-full px-4 py-2.5
    bg-white shadow-md
    rounded-xl
    text-foreground placeholder:text-placeholder
    focus:outline-none focus:shadow-lg focus:ring-2 focus:ring-coral-500/20
    transition-all duration-200
  "
  placeholder="Enter location..."
/>
```

#### Input with Icon (Search Style)
```tsx
<div className="relative">
  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
    <Search className="w-5 h-5 text-muted-foreground" />
  </div>
  <input
    type="text"
    className="
      w-full pl-12 pr-4 py-2.5
      bg-white border border-border
      rounded-full
      focus:outline-none focus:ring-2 focus:ring-coral-500
    "
    placeholder="Search venues..."
  />
</div>
```

#### Input with Label (Friendly)
```tsx
<div className="space-y-2">
  <label htmlFor="name" className="text-sm font-medium text-foreground">
    Name
  </label>
  <input
    id="name"
    type="text"
    className="
      w-full px-4 py-2.5
      bg-white border border-border
      rounded-lg
      focus:outline-none focus:ring-2 focus:ring-coral-500
    "
  />
</div>
```

#### Input with Button (Add Participant Style)
```tsx
<div className="flex gap-2">
  <input
    type="text"
    className="flex-1 px-4 py-2.5 border border-border rounded-full"
    placeholder="Enter name..."
  />
  <button className="p-2.5 bg-coral-500 text-white rounded-full hover:bg-coral-600">
    <Dice5 className="w-5 h-5" />
  </button>
</div>
```

---

### Cards

#### Basic Card (Floating Design)
```tsx
<div className="
  bg-white rounded-xl
  p-6
  shadow-lg
  transition-shadow duration-200
  hover:shadow-xl
">
  <h3 className="text-lg font-medium text-foreground mb-2">Card Title</h3>
  <p className="text-sm text-muted-foreground">Card content</p>
</div>
```

#### Venue Card (Image + Info - Floating)
```tsx
<div className="
  bg-white rounded-2xl
  overflow-hidden
  shadow-lg hover:shadow-xl
  transition-all duration-200
  cursor-pointer
">
  {/* Image */}
  <div className="h-40 bg-gray-100">
    <img src="..." alt="..." className="w-full h-full object-cover" />
  </div>

  {/* Content */}
  <div className="p-4 space-y-2">
    <h3 className="font-medium text-foreground">Planet Fitness</h3>

    {/* Rating */}
    <div className="flex items-center gap-1 text-sm">
      <div className="flex text-yellow-400">
        ⭐⭐⭐⭐⭐
      </div>
      <span className="text-muted-foreground">4.7</span>
    </div>

    {/* Status */}
    <div className="flex items-center gap-2 text-xs">
      <span className="w-2 h-2 rounded-full bg-mint-500"></span>
      <span className="text-muted-foreground">Open • Closes 12am</span>
    </div>

    {/* Vote button */}
    <button className="
      w-full mt-4 py-2
      bg-coral-50 text-coral-600
      rounded-full font-medium text-sm
      hover:bg-coral-100
      transition-colors
    ">
      Vote (5)
    </button>
  </div>
</div>
```

#### Clickable Card (Selected State - Floating)
```tsx
// Default - Floating
<div className="
  bg-white rounded-xl
  p-6 cursor-pointer
  shadow-lg hover:shadow-xl
  transition-all duration-200
">
  Content
</div>

// Selected - Ring accent + elevated shadow
<div className="
  bg-coral-50 rounded-xl
  p-6
  shadow-xl ring-2 ring-coral-500/30
">
  Selected Content
</div>
```

---

### Participant Component (THE Signature Component)

Based on your ParticipantComponent.ts - this is the heart of our cute design!

#### Full Implementation
```tsx
<div className="relative w-full pb-3">
  <div className="flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02]">

    {/* Cat Tail - Left Side */}
    <div className="relative flex items-center -mr-2">
      <svg width="40" height="64" viewBox="0 0 40 64" className="text-border">
        {/* Fluffy tail curve */}
        <path
          d="M 6 32 Q 10 20, 18 28 Q 26 36, 42 32"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          className="stroke-border"
        />
        {/* Inner curve */}
        <path
          d="M 8 32 Q 12 24, 18 30 Q 24 34, 40 32"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          className="stroke-muted-foreground/30"
        />
        {/* Tail tip */}
        <circle cx="6" cy="32" r="4" fill="currentColor" className="fill-border" />
        <circle cx="6" cy="32" r="2.5" fill="currentColor" className="fill-background" />
      </svg>
    </div>

    {/* Main Pill Container - Floating Design */}
    <div className="
      flex-1 flex items-center justify-between
      bg-background
      rounded-2xl px-4 py-3
      shadow-lg hover:shadow-xl
      transition-shadow
    ">
      {/* Info */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-sm font-medium text-foreground truncate">
          Alex Johnson
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">123 Main St, NY</span>
        </div>
      </div>

      {/* Cat Avatar */}
      <div className="ml-3 flex-shrink-0 relative">
        {/* Cat Ears */}
        <div className="absolute -top-1 left-0 right-0 flex justify-between px-0.5 z-10">
          {/* Left ear */}
          <div className="relative">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] bg-coral-500 rounded-sm" />
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-pink-300" />
          </div>
          {/* Right ear */}
          <div className="relative">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] bg-coral-500 rounded-sm" />
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-pink-300" />
          </div>
        </div>

        {/* Avatar */}
        <Avatar className="w-10 h-10 border-2 border-background bg-coral-500">
          <AvatarFallback className="text-white font-semibold text-sm">
            AJ
          </AvatarFallback>
        </Avatar>
      </div>
    </div>

    {/* Little Feet */}
    <div className="absolute bottom-0 left-8 right-8 flex justify-around">
      <div className="w-2 h-2 rounded-full bg-border" />
      <div className="w-2 h-2 rounded-full bg-border" />
    </div>

    {/* Travel Time Bubble (when venue selected) */}
    {selectedVenue && (
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full ml-2 z-10 animate-in fade-in slide-in-from-left-2 duration-200">
        <div className="relative">
          {/* Triangle connector */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full">
            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-coral-500" />
          </div>
          {/* Bubble */}
          <div className="bg-coral-500 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span className="text-xs font-medium">15 min</span>
          </div>
        </div>
      </div>
    )}
  </div>
</div>
```

#### Key Features
- **Cat tail** attached to the left (fluffy, curved SVG)
- **Pill shape** with rounded-full borders
- **Cat ears** on avatar (triangular, with pink inner)
- **Little feet** at the bottom (two circles)
- **Travel time bubble** that slides in when venue selected
- **Smooth hover** with scale effect
- **Color-coded avatars** from the cat color palette

---

### Badges & Pills

#### Filter Pills (Header)
```tsx
<button className="
  px-4 py-2 rounded-full
  bg-white border-2 border-border
  text-sm font-medium text-foreground
  hover:border-coral-500 hover:bg-coral-50
  transition-all duration-200
  data-[active=true]:bg-coral-500
  data-[active=true]:text-white
  data-[active=true]:border-coral-500
">
  🏋️ Gym
</button>
```

#### Status Badges
```tsx
// Open status (green)
<span className="
  inline-flex items-center gap-1.5
  px-3 py-1 rounded-full
  bg-mint-50 text-mint-600
  text-xs font-medium
">
  <span className="w-2 h-2 rounded-full bg-mint-500"></span>
  Open
</span>

// Closed status (red)
<span className="
  inline-flex items-center gap-1.5
  px-3 py-1 rounded-full
  bg-red-50 text-red-600
  text-xs font-medium
">
  <span className="w-2 h-2 rounded-full bg-red-500"></span>
  Closed
</span>

// Vote count
<span className="
  inline-flex items-center gap-1
  px-3 py-1 rounded-full
  bg-purple-50 text-purple-600
  text-xs font-medium
">
  👍 5 votes
</span>
```

---

### Modals & Overlays

#### Modal Container (Centered, Cute)
```tsx
{/* Backdrop */}
<div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  {/* Modal */}
  <div className="
    bg-white rounded-2xl
    max-w-md w-full
    shadow-2xl
    animate-in zoom-in-95 duration-200
  ">
    {/* Header */}
    <div className="flex items-center justify-between p-6 border-b border-border">
      <h3 className="text-xl font-semibold text-foreground">Share Event</h3>
      <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
        <X className="w-5 h-5 text-muted-foreground" />
      </button>
    </div>

    {/* Content */}
    <div className="p-6">
      <p className="text-sm text-muted-foreground">Modal content goes here</p>
    </div>

    {/* Footer */}
    <div className="flex gap-3 p-6 border-t border-border">
      <button className="flex-1 px-4 py-2.5 border-2 border-border rounded-full">
        Cancel
      </button>
      <button className="flex-1 px-4 py-2.5 bg-coral-500 text-white rounded-full">
        Confirm
      </button>
    </div>
  </div>
</div>
```

#### Share Modal (Specific)
```tsx
<div className="p-6 space-y-4">
  {/* Link display */}
  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-border">
    <code className="flex-1 text-sm text-foreground truncate">
      where2meet.app/meet/abc123
    </code>
    <button className="p-2 hover:bg-white rounded-lg transition-colors">
      <Copy className="w-4 h-4 text-muted-foreground" />
    </button>
  </div>

  {/* Copy button */}
  <button className="w-full py-3 bg-coral-500 text-white rounded-full font-medium hover:bg-coral-600 transition-colors">
    📋 Copy Link
  </button>
</div>
```

---

## Cat Theme Elements

### Cat Tail (SVG Component)

```tsx
const CatTail = () => (
  <svg width="40" height="64" viewBox="0 0 40 64" className="text-border">
    {/* Main tail curve - fluffy S-curve */}
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
    <circle cx="6" cy="32" r="4" className="fill-border" />
    <circle cx="6" cy="32" r="2.5" className="fill-background" />
  </svg>
);
```

### Cat Ears (Triangular)

```tsx
const CatEars = ({ color = 'bg-coral-500' }) => (
  <div className="absolute -top-1 left-0 right-0 flex justify-between px-0.5 z-10">
    {/* Left ear */}
    <div className="relative">
      {/* Outer ear */}
      <div
        className={`
          w-0 h-0
          border-l-[6px] border-l-transparent
          border-r-[6px] border-r-transparent
          border-b-[10px] ${color}
          rounded-sm
        `}
      />
      {/* Inner pink part */}
      <div className="
        absolute top-1 left-1/2 -translate-x-1/2
        w-0 h-0
        border-l-[3px] border-l-transparent
        border-r-[3px] border-r-transparent
        border-b-[5px] border-b-pink-300
      " />
    </div>

    {/* Right ear - same structure */}
    <div className="relative">
      <div className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] ${color} rounded-sm`} />
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-pink-300" />
    </div>
  </div>
);
```

### Cat Paws/Feet (Bottom Circles)

```tsx
const CatFeet = () => (
  <div className="absolute bottom-0 left-8 right-8 flex justify-around">
    <div className="w-2 h-2 rounded-full bg-border shadow-sm" />
    <div className="w-2 h-2 rounded-full bg-border shadow-sm" />
  </div>
);
```

### Cat Avatar (Color Randomization)

```tsx
const CAT_COLORS = [
  'bg-red-500',
  'bg-yellow-400',
  'bg-green-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-orange-400',
  'bg-teal-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-cyan-500',
];

// Get deterministic color based on ID
const getRandomColor = (id: string): string => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CAT_COLORS[hash % CAT_COLORS.length];
};

// Usage
<Avatar className={`w-10 h-10 border-2 border-white ${getRandomColor(userId)}`}>
  <AvatarFallback className="text-white font-semibold text-sm">
    {getInitials(name)}
  </AvatarFallback>
</Avatar>
```

---

## Shapes & Borders

### Border Radius Philosophy
**Everything is rounded - no sharp edges!**

| Usage | Class | Radius | Example |
|-------|-------|--------|---------|
| Buttons | `rounded-full` | 9999px | Pills, CTAs |
| Pills | `rounded-full` | 9999px | Filters, badges |
| Inputs | `rounded-full` | 9999px | Search, text fields |
| Cards | `rounded-xl` or `rounded-2xl` | 12px/16px | Venue cards |
| Modals | `rounded-2xl` | 16px | Overlays |
| Small elements | `rounded-lg` | 8px | Small cards |
| Circles | `rounded-full` | Full circle | Avatars, dots |

### Examples

```tsx
// Everything uses full or xl/2xl
<button className="rounded-full">Button</button>
<input className="rounded-full" />
<div className="rounded-2xl">Card</div>
<div className="rounded-full w-10 h-10">Avatar</div>
<span className="rounded-full">Badge</span>
```

### Border Widths

```tsx
// Default border
<div className="border border-border">1px border</div>

// Emphasis border
<div className="border-2 border-coral-500">2px colored border</div>

// Selected state
<div className="border-2 border-coral-500 bg-coral-50">Selected</div>
```

---

## Spacing & Layout

### Spacing Scale (Keep it Simple)

| Size | Value | Usage |
|------|-------|-------|
| Tight | `gap-2` (8px) | Icon + text |
| Cozy | `gap-3` (12px) | Form elements |
| Default | `gap-4` (16px) | Standard spacing |
| Comfortable | `gap-6` (24px) | Section spacing |
| Spacious | `gap-8` (32px) | Large sections |

### Padding Patterns

```tsx
// Buttons
<button className="px-6 py-2.5">Button</button>
<button className="px-4 py-2">Small Button</button>

// Cards
<div className="p-6">Standard Card</div>
<div className="p-4">Compact Card</div>

// Inputs
<input className="px-4 py-2.5" />

// Modals
<div className="p-6">Modal Content</div>
```

### Layout Containers

#### Centered Container (Landing Page)
```tsx
<div className="min-h-screen flex flex-col items-center justify-center p-8">
  <div className="max-w-md w-full space-y-6">
    {/* Content */}
  </div>
</div>
```

#### Sidebar Layout (Main App)
```tsx
<div className="flex h-screen">
  {/* Sidebar - 30% */}
  <aside className="w-full md:w-[30%] border-r border-border overflow-y-auto">
    <div className="p-6 space-y-6">
      {/* Sidebar content */}
    </div>
  </aside>

  {/* Map - 70% */}
  <main className="flex-1">
    {/* Map */}
  </main>
</div>
```

#### Stack Layout (Lists)
```tsx
<div className="space-y-4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

---

## Animations & Interactions

### Transition Speeds
**Keep it snappy and delightful**

```tsx
// Fast (hover, focus)
className="transition-colors duration-150"

// Default (most interactions)
className="transition-all duration-200"

// Slow (complex animations)
className="transition-all duration-300"
```

### Common Animations

#### Hover Scale (Cute bounce)
```tsx
<div className="transition-transform duration-200 hover:scale-[1.02] cursor-pointer">
  Card content
</div>
```

#### Shadow Lift
```tsx
<div className="shadow-sm hover:shadow-md transition-shadow duration-200">
  Card
</div>
```

#### Slide In (Travel time bubble)
```tsx
<div className="animate-in slide-in-from-left-2 fade-in duration-200">
  Bubble
</div>
```

#### Pulse (Loading)
```tsx
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded-full w-3/4"></div>
</div>
```

#### Spin (Loading icon)
```tsx
<div className="animate-spin">
  <Loader2 className="w-6 h-6" />
</div>
```

### Interactive States

```tsx
// Hover
className="hover:bg-coral-50 hover:border-coral-500"

// Active/Pressed
className="active:scale-95"

// Focus
className="focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2"

// Disabled
className="disabled:opacity-50 disabled:cursor-not-allowed"
```

### Micro-interactions

```tsx
// Button press effect
<button className="
  active:scale-95
  transition-transform
  duration-100
">
  Click me
</button>

// Card selection
<div className="
  hover:border-coral-500
  hover:-translate-y-1
  transition-all
  duration-200
">
  Selectable card
</div>
```

---

## Responsive Design

### Breakpoints (Mobile-First)

```css
/* Mobile: 0-640px (default) */
sm: 640px   /* Small tablet */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### Layout Adaptations

#### Main App Layout
```tsx
<div className="flex flex-col md:flex-row h-screen">
  {/* Sidebar: Full width mobile, 30% desktop */}
  <aside className="
    w-full md:w-[30%]
    h-1/2 md:h-full
    border-b md:border-b-0 md:border-r
  ">
    Sidebar
  </aside>

  {/* Map: Full width mobile, 70% desktop */}
  <main className="flex-1 h-1/2 md:h-full">
    Map
  </main>
</div>
```

#### Responsive Spacing
```tsx
<div className="p-4 md:p-6 lg:p-8">
  Content with responsive padding
</div>

<div className="space-y-4 md:space-y-6">
  Responsive vertical spacing
</div>
```

#### Hide/Show by Breakpoint
```tsx
{/* Mobile only */}
<div className="block md:hidden">Mobile content</div>

{/* Desktop only */}
<div className="hidden md:block">Desktop content</div>

{/* Tablet and up */}
<div className="hidden md:block">Tablet+ content</div>
```

#### Touch Targets (Mobile)
```tsx
<button className="
  min-h-[44px] min-w-[44px]  /* Mobile minimum */
  md:min-h-0 md:min-w-0      /* Remove on desktop */
  p-2
">
  <Icon className="w-5 h-5" />
</button>
```

---

## Accessibility

### Focus States (Always Visible)

```tsx
// Button focus
<button className="
  focus:outline-none
  focus:ring-2
  focus:ring-coral-500
  focus:ring-offset-2
">
  Button
</button>

// Input focus
<input className="
  focus:outline-none
  focus:ring-2
  focus:ring-coral-500
  focus:border-transparent
" />

// Link focus
<a href="#" className="
  focus:outline-none
  focus:ring-2
  focus:ring-coral-500
  focus:rounded-sm
">
  Link
</a>
```

### ARIA Labels

```tsx
// Icon-only buttons
<button aria-label="Close modal">
  <X className="w-5 h-5" />
</button>

// Search input
<input
  type="text"
  aria-label="Search venues"
  placeholder="Search..."
/>

// Status indicators
<div aria-live="polite" className="sr-only">
  3 participants added
</div>
```

### Keyboard Navigation

```tsx
// Clickable div
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
  className="cursor-pointer"
>
  Clickable content
</div>

// Skip link
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white px-4 py-2 rounded-lg"
>
  Skip to main content
</a>
```

### Screen Reader Text

```tsx
// Hide visually, available to screen readers
<span className="sr-only">
  Click to add participant
</span>

// Hide from screen readers (decorative)
<div aria-hidden="true">
  🎉
</div>
```

### Color Contrast

All text meets WCAG AA standards:
- `text-foreground` on white: ✅ Pass
- `text-muted-foreground` on white: ✅ Pass
- White on `bg-coral-500`: ✅ Pass
- White on `bg-mint-500`: ✅ Pass

---

## Loading & Empty States

### Loading States

#### Spinner
```tsx
<div className="flex items-center justify-center p-8">
  <div className="animate-spin rounded-full h-8 w-8 border-2 border-coral-500 border-t-transparent" />
</div>
```

#### Skeleton (Participant)
```tsx
<div className="animate-pulse flex items-center gap-3">
  {/* Tail placeholder */}
  <div className="w-10 h-16 bg-gray-200 rounded" />

  {/* Pill placeholder */}
  <div className="flex-1 h-14 bg-gray-200 rounded-full" />
</div>
```

#### Skeleton (Venue Card)
```tsx
<div className="animate-pulse space-y-3">
  <div className="h-40 bg-gray-200 rounded-2xl" />
  <div className="h-4 bg-gray-200 rounded-full w-3/4" />
  <div className="h-4 bg-gray-200 rounded-full w-1/2" />
</div>
```

### Empty States (Friendly & Encouraging)

```tsx
<div className="flex flex-col items-center justify-center p-12 text-center">
  {/* Icon */}
  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
    <MapPin className="w-8 h-8 text-muted-foreground" />
  </div>

  {/* Message */}
  <h3 className="text-lg font-medium text-foreground mb-2">
    No participants yet
  </h3>
  <p className="text-sm text-muted-foreground mb-6 max-w-xs">
    Add your first participant to start finding the perfect meeting spot!
  </p>

  {/* Action */}
  <button className="px-6 py-2.5 bg-coral-500 text-white rounded-full hover:bg-coral-600">
    Add Participant
  </button>
</div>
```

### Success States (Celebratory)

```tsx
<div className="bg-mint-50 border border-mint-500 rounded-xl p-4 flex items-center gap-3">
  <div className="w-8 h-8 rounded-full bg-mint-500 flex items-center justify-center">
    <Check className="w-5 h-5 text-white" />
  </div>
  <div>
    <p className="font-medium text-mint-900">Success!</p>
    <p className="text-sm text-mint-700">Participant added</p>
  </div>
</div>
```

### Error States (Gentle & Helpful)

```tsx
<div className="bg-red-50 border border-red-500 rounded-xl p-4 flex items-start gap-3">
  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
  <div>
    <p className="font-medium text-red-900">Oops!</p>
    <p className="text-sm text-red-700">Couldn't find that address. Try again?</p>
  </div>
</div>
```

---

## Icon Usage (Lucide React)

### Icon Sizes

```tsx
// Tiny (in badges)
<Icon className="w-3 h-3" />

// Small (inline with text)
<Icon className="w-4 h-4" />

// Default (buttons, cards)
<Icon className="w-5 h-5" />

// Large (empty states)
<Icon className="w-8 h-8" />

// Hero (landing page)
<Icon className="w-12 h-12" />
```

### Common Icons

```tsx
import {
  MapPin,      // Location
  Clock,       // Time
  Search,      // Search
  X,           // Close
  Plus,        // Add
  Check,       // Success
  AlertCircle, // Error
  Info,        // Information
  Settings,    // Settings
  Share2,      // Share
  Users,       // Participants
  Building2,   // Venue
  Car,         // Car travel
  Bus,         // Transit
  Footprints,  // Walk
  Bike,        // Bike
} from 'lucide-react';
```

### Usage Examples

```tsx
// With text
<button className="flex items-center gap-2">
  <MapPin className="w-5 h-5" />
  <span>Add Location</span>
</button>

// Icon only (needs aria-label)
<button aria-label="Close">
  <X className="w-5 h-5" />
</button>

// Colored
<Check className="w-5 h-5 text-mint-500" />
<AlertCircle className="w-5 h-5 text-red-500" />
```

---

## Quick Reference

### Essential Classes (Floating Design)

```tsx
// Primary Button
"bg-coral-500 hover:bg-coral-600 text-white px-6 py-2.5 rounded-full transition-all shadow-md hover:shadow-lg"

// Input (Floating)
"w-full px-4 py-2.5 shadow-md rounded-xl focus:outline-none focus:shadow-lg focus:ring-2 focus:ring-coral-500/20 transition-all"

// Card (Floating)
"bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"

// Pill Badge (Floating)
"px-4 py-2 rounded-full bg-white shadow-lg hover:shadow-xl transition-all"

// Selected Card (Floating + Ring)
"bg-coral-50 rounded-xl p-6 shadow-xl ring-2 ring-coral-500/30"

// Modal Backdrop
"fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"

// Centered Layout
"flex flex-col items-center justify-center min-h-screen p-8"

// Stack
"space-y-4"

// Grid
"grid grid-cols-1 md:grid-cols-2 gap-4"
```

---

## Design Checklist

When creating new components, ensure:

### Floating Design Principles
- [ ] **No structural borders** - Use `shadow-*` classes instead of `border` for separation
- [ ] **Proper elevation** - Use shadow hierarchy (shadow-md < shadow-lg < shadow-xl < shadow-2xl)
- [ ] **Hover interactions** - Increase shadow on hover for lift effect
- [ ] **Selected states** - Use `ring-2 ring-color/30` for subtle accent + `shadow-xl`
- [ ] **Generous spacing** - Adequate padding and margins for floating elements

### Core Design
- [ ] Uses rounded shapes (rounded-full for pills, rounded-xl/2xl for cards)
- [ ] Includes hover states with smooth transitions (duration-200)
- [ ] Has proper focus states (ring-2 ring-coral-500)
- [ ] Uses color palette (coral, mint, sky, lavender)
- [ ] Includes loading states where applicable
- [ ] Has empty states with friendly messages
- [ ] Accessible (ARIA labels, keyboard navigation)
- [ ] Responsive (mobile-first approach)
- [ ] Playful but not overwhelming
- [ ] Simple and easy to understand
- [ ] Cat theme elements where appropriate (tails, ears, paws)

---

*Last Updated: 2024*
*Design System Version: 1.0 - Simple & Cute*
*Theme: Cat Mascot 🐱*
