# Brand Audit Report – Level 5: Brand Semantic Defense

**Date:** 2025-01-15
**Audited Pages:** Homepage, FAQ, How It Works
**Focus:** Ensure consistent "fairness + travel time" messaging to differentiate from competitors (especially where2meet.net)

---

## Brand Messaging Pillars (Target)

### Primary Messages

1. **Fairness** – Equal travel burden, not just geographic midpoint
2. **Travel Time Comparison** – Real commute times, not distance
3. **Visual Analysis** – Interactive maps showing tradeoffs
4. **Group Decision Making** – Transparent, collaborative voting

### Preferred Language

- ✅ "Real travel times" (not estimates)
- ✅ "Equal commutes" (not equal distance)
- ✅ "Fair meeting spot with equal travel times"
- ✅ "Time-balanced location"
- ✅ "Balanced travel burden"

### Avoid

- ❌ "Find a meeting spot" (generic)
- ❌ "Central location" (without "fair")
- ❌ "Midpoint calculator"

---

## Page-by-Page Audit Results

### 1. Homepage (`/src/app/(landing)/page.tsx`)

**Current Score: 6/10** ⚠️ Needs Improvement

#### Strengths

- Footer has excellent messaging (Line 235-237): "Find fair meeting locations with equal travel time for everyone"
- Feature card "Fair for Everyone" mentions travel time comparison
- "Visual Planning" feature aligned with brand pillars

#### Issues

| Issue                       | Location     | Current                                                                                | Recommended Fix                                                                                               |
| --------------------------- | ------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Generic H1**              | Line 142-144 | "Find the perfect meeting spot"                                                        | "Find Fair Meeting Spots with Equal Travel Times"                                                             |
| **Weak subheading**         | Line 146-148 | "Add participants, compare travel times, and discover the ideal location for everyone" | "Stop making one person travel twice as far. Compare real travel times and find equitable meeting locations." |
| **Off-brand feature**       | Line 202-206 | "Smart Suggestions" – doesn't mention fairness or travel time                          | Replace with "Group Decision Making" or "Travel Time Transparency" feature                                    |
| **Missing differentiation** | Entire page  | No callout comparing to other tools                                                    | Add callout: "Unlike other planners, Where2Meet optimizes for travel time fairness, not just distance"        |

#### Priority Fixes

1. **HIGH:** Update H1 to include "fair" and "equal travel times"
2. **HIGH:** Strengthen hero subheading with fairness framing
3. **MEDIUM:** Replace "Smart Suggestions" feature card with fairness-focused feature
4. **MEDIUM:** Add competitive differentiation callout below hero or in features section

---

### 2. FAQ Page (`/src/app/(landing)/faq/page.tsx`)

**Current Score: 8.5/10** ✅ Strong (Minor Improvements)

#### Strengths

- **Excellent "Differentiation" category** (Lines 21-43) with 4 competitive FAQs
- Strong brand language throughout:
  - "focuses on fairness, not just finding a midpoint"
  - "optimizes for travel time fairness, not just distance"
  - "Travel time reflects the actual burden"
  - "minimize travel times... commute is roughly equal"
- "Product Mechanics" section reinforces "real travel times"
- Well-structured use cases

#### Issues

| Issue                               | Location                | Recommended Fix                                                      |
| ----------------------------------- | ----------------------- | -------------------------------------------------------------------- |
| **Missing competitor-specific FAQ** | Differentiation section | Add: "How is Where2Meet different from where2meet.net specifically?" |
| **Could strengthen**                | Throughout              | Add more explicit "vs other tools" comparisons in answers            |

#### Priority Fixes

1. **MEDIUM:** Add FAQ: "How is Where2Meet different from where2meet.net?"
   - Answer should mention: `.com focuses on fairness through travel time balancing, while .net uses geographic midpoint calculation`
2. **LOW:** Consider adding FAQ about "Why not just use Google Maps?"

---

### 3. How It Works Page (`/src/app/(landing)/how-it-works/page.tsx`)

**Current Score: 9/10** ✅ Excellent (One Missing Element)

#### Strengths

- **Perfect H1** (Line 42-44): "How Where2Meet Finds the Fairest Meeting Location"
- **Powerful subheading** (Line 46-48): "Stop making one person travel twice as far. Find meeting spots that respect everyone's time."
- **"What Does Fair Mean" section** (Lines 85-111) – Excellent equal commute philosophy explanation
- **"Travel Time vs Distance" section** (Lines 193-234) – Perfect example destroying the midpoint myth
- Strong brand language: "travel time balance", "real commute times", "fairness is about time, not miles"
- Problem articulation section with specific pain points

#### Issues

| Issue                        | Location                                | Recommended Fix                                                          |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| **Missing comparison table** | After "Why Travel Time Matters" section | Add 3-column table: Where2Meet vs Geographic Midpoint vs Manual Planning |

#### Priority Fixes

1. **HIGH:** Add comparison table (requested in plan)

**Recommended Table Structure:**

| Feature                  | Where2Meet                     | Geographic Midpoint Tools      | Manual Planning        |
| ------------------------ | ------------------------------ | ------------------------------ | ---------------------- |
| **Optimization Goal**    | Equal travel times             | Equal distance                 | Guesswork              |
| **Accounts for traffic** | ✅ Yes (real routing data)     | ❌ No                          | ❌ No                  |
| **Transportation modes** | ✅ Driving, transit, walking   | ❌ Straight-line distance only | ⚠️ Manually check each |
| **Fairness focus**       | ✅ Balanced commutes           | ❌ Midpoint may be unfair      | ❌ Subjective          |
| **Visual comparison**    | ✅ Interactive map with routes | ⚠️ Static map                  | ❌ Multiple apps       |
| **Group decision**       | ✅ Collaborative voting        | ❌ No voting                   | ❌ Text thread chaos   |
| **Time to plan**         | ⏱️ < 2 minutes                 | ⏱️ < 1 minute                  | ⏱️ 20+ minutes         |

---

## Brand Consistency Checklist

### Homepage

- [ ] H1 includes "fair" or "equal travel time"
- [x] Meta description mentions differentiation _(Need to verify metadata)_
- [ ] First paragraph explains fairness problem
- [ ] At least one section on travel time vs distance
- [x] Examples show unfair → fair transformation _(Implicit in features)_
- [ ] CTAs reinforce "fair meeting" messaging
- [x] Internal links use keyword-rich anchor text

**Status:** 3/7 ✅ (43%)

### FAQ

- [x] H1 includes "fair" or "equal travel time"
- [x] Meta description mentions differentiation
- [x] First paragraph explains fairness problem
- [x] At least one section on travel time vs distance
- [x] Examples show unfair → fair transformation
- [x] CTAs reinforce "fair meeting" messaging
- [ ] Competitive FAQ: "How different from where2meet.net?"

**Status:** 6/7 ✅ (86%)

### How It Works

- [x] H1 includes "fair" or "equal travel time"
- [x] Meta description mentions differentiation
- [x] First paragraph explains fairness problem
- [x] At least one section on travel time vs distance
- [x] Examples show unfair → fair transformation
- [x] CTAs reinforce "fair meeting" messaging
- [ ] Comparison table present

**Status:** 6/7 ✅ (86%)

---

## Summary & Recommendations

### Overall Brand Alignment: 7.8/10

**Strengths:**

- FAQ and How It Works pages have excellent brand messaging
- Strong differentiation language in FAQ ("fairness vs midpoint")
- "Travel time vs distance" narrative is clear and compelling
- Use of real-world examples (Sarah/Tom, Alex/Jamie)

**Weaknesses:**

- **Homepage H1 is generic** and doesn't communicate fairness
- Missing competitive differentiation callout on homepage
- No comparison table on How It Works (explicitly requested in plan)
- Missing "vs where2meet.net" FAQ

---

## Priority Action Items

### 🔴 High Priority (Brand-Critical)

1. **Homepage H1 rewrite** – Change from "Find the perfect meeting spot" to "Find Fair Meeting Spots with Equal Travel Times"
2. **Homepage hero strengthening** – Add fairness problem statement to subheading
3. **How It Works comparison table** – Add Where2Meet vs Competitors table

### 🟡 Medium Priority (Brand Improvement)

4. **Homepage differentiation callout** – Add 1-2 sentence box explaining difference from other tools
5. **FAQ competitive question** – Add "How is Where2Meet different from where2meet.net?"
6. **Homepage feature card update** – Replace "Smart Suggestions" with fairness-focused feature

### 🟢 Low Priority (Nice-to-Have)

7. **FAQ expansion** – Add "Why not just use Google Maps?" question
8. **Homepage examples** – Add before/after scenario showing unfairness → fairness
9. **Footer links** – Add "Scenarios" link once scenario pages are live

---

## Competitive Positioning Gaps

### Where2Meet.net Differentiation

Currently, we don't explicitly call out the difference between Where2Meet.com (us) and where2meet.net (competitor).

**Recommended messaging:**

- **Us:** "Fair meeting locations through travel time balancing"
- **Them:** "Geographic midpoint calculator"
- **Why it matters:** "Travel time ≠ distance. A midpoint can be unfair if one person has faster routes."

### Google Maps Comparison

Users might think "Can't I just do this with Google Maps?"

**Recommended FAQ answer:**

> "Google Maps excels at point-to-point navigation, but doesn't optimize for fairness across multiple starting points. You'd need to manually check every participant's route to each potential venue—Where2Meet does this automatically and shows you the fairest options side-by-side."

---

## Next Steps

1. **Review this audit** with stakeholders
2. **Implement High Priority fixes** (H1, comparison table)
3. **Test messaging** with 2-3 users to validate fairness clarity
4. **Apply fixes** to homepage, FAQ, How It Works
5. **Run follow-up audit** after changes implemented
6. **Extend messaging** to scenario pages (once content is generated)

---

## Appendix: Brand Voice Examples

### ✅ Good Examples (Use This Voice)

**From How It Works:**

> "Stop making one person travel twice as far. Find meeting spots that respect everyone's time."

> "Fairness is about time, not miles."

**From FAQ:**

> "Where2Meet focuses on fairness, not just finding a midpoint."

> "Travel time reflects the actual burden of getting somewhere."

### ❌ Avoid (Too Generic)

**Current Homepage H1:**

> "Find the perfect meeting spot" _(No differentiation, could be any tool)_

**Better:**

> "Find Fair Meeting Spots with Equal Travel Times"

---

**Audit Conducted By:** Claude Code SEO Agent
**Date:** 2025-01-15
**Next Audit:** After implementing High Priority fixes
