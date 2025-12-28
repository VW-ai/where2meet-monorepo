# Where2Meet User Authentication System - Complete Documentation

**Last Updated:** December 25, 2025
**Version:** 1.0 (Phase 1 - Email/Password Authentication)
**Status:** ✅ Fully Implemented

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Reference](#api-reference)
4. [Data Schema](#data-schema)
5. [Authentication Flow](#authentication-flow)
6. [Frontend Components](#frontend-components)
7. [State Management](#state-management)
8. [Security Features](#security-features)
9. [User Experience Flows](#user-experience-flows)
10. [File Structure](#file-structure)

---

## Overview

The Where2Meet authentication system provides email/password-based user accounts with session management, password recovery, and seamless integration with the existing anonymous event creation flow. The system is built entirely using Next.js API routes with file-based JSON persistence, maintaining the client-only architecture.

### Key Features

✅ **Email/Password Authentication** - Secure user registration and login
✅ **Session Management** - HTTP-only cookies with 7-day expiration
✅ **Password Recovery** - Email-based reset flow (mock email in dev)
✅ **User Dashboard** - View and manage all user events
✅ **Profile Management** - Update name, address, and preferences
✅ **Token Claiming** - Link anonymous events to user accounts
✅ **Protected Routes** - Automatic authentication enforcement
✅ **Hybrid Model** - Support both authenticated and anonymous users

### Technology Stack

- **Frontend**: React, Next.js App Router, Zustand (state management)
- **Backend**: Next.js API Routes (mock backend)
- **Storage**: File-based JSON persistence (`.mock-data/` folder)
- **Security**: bcryptjs (password hashing), HTTP-only cookies
- **Session**: Opaque session tokens with 7-day expiration

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
├─────────────────────────────────────────────────────────────────┤
│  Landing Page    │  Auth Pages  │  Dashboard  │  Settings       │
│  (/)             │  (/auth/*)   │  (/dashboard)                 │
├─────────────────────────────────────────────────────────────────┤
│              Zustand Auth Store (src/store/auth-store.ts)       │
├─────────────────────────────────────────────────────────────────┤
│           API Client (src/lib/api/auth.ts, users.ts)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP Requests (credentials: include)
                              │ Session Cookie: session_token
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NEXT.JS API ROUTES (Server)                    │
├─────────────────────────────────────────────────────────────────┤
│  /api/auth/register  │  /api/auth/login   │  /api/auth/logout  │
│  /api/auth/session   │  /api/auth/claim-token                   │
│  /api/auth/recovery/request │  /api/auth/recovery/reset         │
│  /api/users/me       │  /api/users/me/events                    │
├─────────────────────────────────────────────────────────────────┤
│      Auth Persistence (src/mock-server/auth-persistence.ts)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ File I/O
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FILE-BASED STORAGE (.mock-data/)                │
├─────────────────────────────────────────────────────────────────┤
│  users.json       │  sessions.json  │  user-events.json         │
│  password-reset-tokens.json         │  events.json              │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication Model

- **Session-Based**: Uses HTTP-only cookies with opaque session tokens
- **Stateful**: Session data stored in `sessions.json` on server
- **Secure**: bcrypt password hashing (12 rounds), CSRF protection via SameSite
- **Hybrid**: Supports both authenticated users and anonymous participants

---

## API Reference

### Authentication Endpoints

#### `POST /api/auth/register`

Create a new user account.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe" // Optional
}
```

**Response (201):**

```json
{
  "user": {
    "id": "usr_e89463b23013c0cc513503832cd93d12",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": null,
    "emailVerified": false,
    "defaultAddress": null,
    "defaultPlaceId": null,
    "defaultFuzzyLocation": false,
    "createdAt": "2025-12-25T23:33:19.277Z",
    "updatedAt": "2025-12-25T23:33:19.277Z"
  }
}
```

**Validation:**

- Email: Must be valid format (regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- Password: Minimum 8 characters
- Email uniqueness: Returns 409 if email exists

**Side Effects:**

- Creates user record in `users.json`
- Creates email identity with bcrypt hashed password
- Creates 7-day session
- Sets `session_token` HTTP-only cookie

**Error Codes:**

- `VALIDATION_ERROR` (400): Invalid input
- `EMAIL_EXISTS` (409): Duplicate email
- `INTERNAL_ERROR` (500): Server error

---

#### `POST /api/auth/login`

Authenticate existing user.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "usr_e89463b23013c0cc513503832cd93d12",
    "email": "user@example.com",
    "name": "John Doe"
    // ... full user object
  }
}
```

**Authentication Flow:**

1. Lookup email identity by provider='email' and providerId=email
2. Verify password against bcrypt hash
3. Retrieve associated user record
4. Create new session (7-day expiration)
5. Set session cookie

**Error Codes:**

- `VALIDATION_ERROR` (400): Missing fields
- `INVALID_CREDENTIALS` (401): Wrong email or password
- `USER_NOT_FOUND` (404): User record missing
- `INTERNAL_ERROR` (500): Server error

---

#### `POST /api/auth/logout`

Invalidate current session.

**Request:** None (uses session cookie)

**Response (200):**

```json
{
  "success": true
}
```

**Side Effects:**

- Deletes session from `sessions.json`
- Clears `session_token` cookie (maxAge: 0)

---

#### `GET /api/auth/session`

Validate session and retrieve current user.

**Request:** None (uses session cookie)

**Response (200):**

```json
{
  "user": {
    "id": "usr_...",
    "email": "user@example.com"
    // ... full user object
  }
}
```

**Validation:**

1. Extract `session_token` from cookie
2. Find session by token in `sessions.json`
3. Check expiration (delete if expired)
4. Return associated user

**Error Codes:**

- `UNAUTHORIZED` (401): No session cookie
- `UNAUTHORIZED` (401): Invalid session token
- `SESSION_EXPIRED` (401): Session expired (auto-deleted)
- `USER_NOT_FOUND` (404): User record missing
- `INTERNAL_ERROR` (500): Server error

---

#### `POST /api/auth/claim-token`

Link anonymous event to authenticated user account.

**Request:**

```json
{
  "eventId": "evt_abc123",
  "token": "organizer-or-participant-token",
  "tokenType": "organizer" | "participant"
}
```

**Response (200):**

```json
{
  "success": true,
  "userEvent": {
    "id": "ue_...",
    "userId": "usr_...",
    "eventId": "evt_abc123",
    "participantId": "prt_...",
    "role": "organizer",
    "createdAt": "2025-12-25T..."
  }
}
```

**Requirements:**

- Valid session (authenticated user)
- Event must exist
- Token type must be 'organizer' or 'participant'

**Side Effects:**

- Creates UserEvent record in `user-events.json`
- Links user to event participant record
- Frontend clears localStorage tokens after claim

**Error Codes:**

- `UNAUTHORIZED` (401): Not authenticated
- `VALIDATION_ERROR` (400): Invalid input
- `EVENT_NOT_FOUND` (404): Event doesn't exist

---

#### `POST /api/auth/recovery/request`

Request password reset token.

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "success": true
}
```

**Behavior:**

- Always returns success (prevents email enumeration)
- Only creates reset token if email exists
- Token expires in 1 hour
- Logs reset link to console (mock email)

**Console Output Example:**

```
=== PASSWORD RESET EMAIL (MOCK) ===
To: user@example.com
Reset link: http://localhost:3000/auth/reset-password?token=abc123...
Token expires in 1 hour
===================================
```

---

#### `POST /api/auth/recovery/reset`

Reset password using token.

**Request:**

```json
{
  "token": "reset-token-from-email",
  "newPassword": "newSecurePassword123"
}
```

**Response (200):**

```json
{
  "success": true
}
```

**Validation:**

- Token must exist and not be expired
- New password must be ≥8 characters

**Side Effects:**

- Updates password hash in user identity
- **Invalidates ALL user sessions** (security measure)
- Deletes reset token (single-use)

**Error Codes:**

- `VALIDATION_ERROR` (400): Invalid input
- `INVALID_TOKEN` (400): Token not found
- `TOKEN_EXPIRED` (400): Token expired (auto-deleted)
- `USER_NOT_FOUND` (404): User missing
- `INTERNAL_ERROR` (500): Server error

---

### User Management Endpoints

#### `GET /api/users/me`

Get current user profile.

**Request:** None (uses session cookie)

**Response (200):**

```json
{
  "id": "usr_...",
  "email": "user@example.com",
  "name": "John Doe",
  "avatarUrl": null,
  "emailVerified": false,
  "defaultAddress": "123 Main St, City, State",
  "defaultPlaceId": "ChIJ...",
  "defaultFuzzyLocation": false,
  "createdAt": "2025-12-25T...",
  "updatedAt": "2025-12-25T..."
}
```

**Error Codes:**

- `UNAUTHORIZED` (401): Not authenticated
- `USER_NOT_FOUND` (404): User missing

---

#### `PATCH /api/users/me`

Update user profile.

**Request:** (All fields optional)

```json
{
  "name": "Jane Doe",
  "defaultAddress": "456 Oak Ave, City, State",
  "defaultPlaceId": "ChIJ...",
  "defaultFuzzyLocation": true,
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

**Response (200):**

```json
{
  "id": "usr_...",
  "email": "user@example.com", // Cannot be changed
  "name": "Jane Doe",
  "defaultAddress": "456 Oak Ave, City, State",
  "defaultPlaceId": "ChIJ...",
  "defaultFuzzyLocation": true,
  "avatarUrl": "https://example.com/avatar.jpg",
  "updatedAt": "2025-12-26T..." // Updated timestamp
}
```

**Error Codes:**

- `UNAUTHORIZED` (401): Not authenticated
- `INTERNAL_ERROR` (500): Server error

---

#### `GET /api/users/me/events`

Get all events for current user.

**Request:** None (uses session cookie)

**Response (200):**

```json
[
  {
    "id": "evt_...",
    "title": "Team Meeting",
    "meetingTime": "2025-12-30T14:00:00Z",
    "createdAt": "2025-12-25T...",
    "updatedAt": "2025-12-25T...",
    "participants": [...],
    "mec": {...},
    "publishedVenueId": null,
    "publishedAt": null,
    "settings": {...}
    // Note: organizerToken and organizerParticipantId are excluded for security
  }
]
```

**Note:** Reads from `user-events.json` to find user's event IDs, then loads full event data from `events.json`.

**Error Codes:**

- `UNAUTHORIZED` (401): Not authenticated
- `INTERNAL_ERROR` (500): Server error

---

## Data Schema

### User Model

```typescript
interface User {
  id: string; // Format: usr_<32-char-hex>
  email: string; // Unique email address
  name: string | null; // Optional display name
  avatarUrl: string | null; // Optional profile picture URL
  emailVerified: boolean; // Email verification status (always false in Phase 1)
  defaultAddress: string | null; // User's home/default address
  defaultPlaceId: string | null; // Google Places ID for address
  defaultFuzzyLocation: boolean; // Privacy setting (hide exact location)
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}
```

**Example:**

```json
{
  "id": "usr_e89463b23013c0cc513503832cd93d12",
  "email": "john@example.com",
  "name": "John Doe",
  "avatarUrl": null,
  "emailVerified": false,
  "defaultAddress": "123 Main St, San Francisco, CA",
  "defaultPlaceId": "ChIJIQBpAG2ahYAR_6128GcTUEo",
  "defaultFuzzyLocation": false,
  "createdAt": "2025-12-25T23:33:19.277Z",
  "updatedAt": "2025-12-26T10:15:30.123Z"
}
```

---

### UserIdentity Model

Supports multiple authentication providers per user (Phase 2: OAuth).

```typescript
interface UserIdentity {
  id: string; // Format: ident_<32-char-hex>
  userId: string; // References User.id
  provider: 'email' | 'google' | 'github'; // Auth provider
  providerId: string; // Provider-specific identifier
  passwordHash?: string; // bcrypt hash (email provider only)
  createdAt: string; // ISO 8601 timestamp
}
```

**Example (Email Provider):**

```json
{
  "id": "ident_af737000553efad217f41d232a3caa22",
  "userId": "usr_e89463b23013c0cc513503832cd93d12",
  "provider": "email",
  "providerId": "john@example.com",
  "passwordHash": "$2b$12$2arCY0C9l/t51STxN.hgsuq/pnmHa.j91E2C3xiso5gVypAWXwI..",
  "createdAt": "2025-12-25T23:33:19.277Z"
}
```

**Future OAuth Example:**

```json
{
  "id": "ident_xyz789",
  "userId": "usr_e89463b23013c0cc513503832cd93d12",
  "provider": "google",
  "providerId": "109876543210", // Google user ID
  "createdAt": "2025-12-26T08:00:00.000Z"
}
```

---

### Session Model

```typescript
interface Session {
  id: string; // Format: ses_<32-char-hex>
  userId: string; // References User.id
  sessionToken: string; // 64-char hex (crypto.randomBytes(32))
  expiresAt: string; // ISO 8601 timestamp (7 days from creation)
  createdAt: string; // ISO 8601 timestamp
}
```

**Example:**

```json
{
  "id": "ses_19ee366721b01bc2d99bb9a4243fed41",
  "userId": "usr_e89463b23013c0cc513503832cd93d12",
  "sessionToken": "aa782e6cd57f2373d7052b5b5a855cbe7129a5469fe4aed6922f558628b15c64",
  "expiresAt": "2026-01-02T04:08:14.361Z",
  "createdAt": "2025-12-26T04:08:14.361Z"
}
```

---

### PasswordResetToken Model

```typescript
interface PasswordResetToken {
  id: string; // Format: prt_<32-char-hex>
  userId: string; // References User.id
  token: string; // 64-char hex (crypto.randomBytes(32))
  expiresAt: string; // ISO 8601 timestamp (1 hour from creation)
  createdAt: string; // ISO 8601 timestamp
}
```

**Example:**

```json
{
  "id": "prt_abc123def456",
  "userId": "usr_e89463b23013c0cc513503832cd93d12",
  "token": "f7a3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
  "expiresAt": "2025-12-26T05:15:00.000Z",
  "createdAt": "2025-12-26T04:15:00.000Z"
}
```

---

### UserEvent Model

Links users to events they've created or participated in.

```typescript
interface UserEvent {
  id: string; // Format: ue_<32-char-hex>
  userId: string; // References User.id
  eventId: string; // References Event.id
  participantId: string | null; // References Participant.id
  role: 'organizer' | 'participant'; // User's role in event
  createdAt: string; // ISO 8601 timestamp
}
```

**Example:**

```json
{
  "id": "ue_001",
  "userId": "usr_e89463b23013c0cc513503832cd93d12",
  "eventId": "evt_abc123",
  "participantId": "prt_xyz789",
  "role": "organizer",
  "createdAt": "2025-12-26T04:15:00.000Z"
}
```

---

### File Structure (.mock-data/)

**users.json:**

```json
{
  "users": {
    "usr_<id>": {
      /* User object */
    }
  },
  "identities": {
    "ident_<id>": {
      /* UserIdentity object */
    }
  }
}
```

**sessions.json:**

```json
{
  "sessions": {
    "ses_<id>": {
      /* Session object */
    }
  }
}
```

**user-events.json:**

```json
{
  "userEvents": {
    "ue_<id>": {
      /* UserEvent object */
    }
  }
}
```

**password-reset-tokens.json:**

```json
{
  "tokens": {
    "prt_<id>": {
      /* PasswordResetToken object */
    }
  }
}
```

---

## Authentication Flow

### Registration Flow

```
1. User submits email + password + name (optional)
   └─> POST /api/auth/register

2. Backend validates input
   ├─> Email format check
   ├─> Password length ≥8 chars
   └─> Email uniqueness check

3. Create user records
   ├─> Generate userId (usr_<hex>)
   ├─> Hash password with bcrypt (12 rounds)
   ├─> Create User object
   ├─> Create UserIdentity (provider: email)
   └─> Save to users.json

4. Create session
   ├─> Generate sessionId (ses_<hex>)
   ├─> Generate sessionToken (64-char hex)
   ├─> Set expiresAt (+7 days)
   └─> Save to sessions.json

5. Set cookie & return user
   ├─> Set session_token HTTP-only cookie
   └─> Return User object (without password)

6. Frontend updates auth store
   ├─> Set user state
   ├─> Set isAuthenticated = true
   └─> Redirect to /dashboard
```

---

### Login Flow

```
1. User submits email + password
   └─> POST /api/auth/login

2. Backend validates credentials
   ├─> Find UserIdentity by email + provider='email'
   ├─> Verify password with bcrypt.compare()
   └─> Retrieve User object

3. Create new session
   ├─> Generate sessionId (ses_<hex>)
   ├─> Generate sessionToken (64-char hex)
   ├─> Set expiresAt (+7 days)
   └─> Save to sessions.json

4. Set cookie & return user
   ├─> Set session_token HTTP-only cookie
   └─> Return User object

5. Frontend updates auth store
   ├─> Set user state
   ├─> Set isAuthenticated = true
   └─> Redirect to /dashboard
```

---

### Session Validation Flow

```
1. App loads or protected route accessed
   └─> GET /api/auth/session

2. Backend validates session
   ├─> Extract session_token from cookie
   ├─> Find session in sessions.json
   ├─> Check expiresAt > now
   │   ├─> If expired: delete session, return 401
   │   └─> If valid: continue
   └─> Retrieve User by userId

3. Return user or error
   ├─> If valid: return User object
   └─> If invalid/expired: return 401

4. Frontend handles response
   ├─> Success: set user state
   └─> Error: clear user state, redirect to login (protected routes)
```

---

### Password Reset Flow

```
1. Request reset
   └─> POST /api/auth/recovery/request { email }

2. Backend processes request
   ├─> Find user by email (silently fails if not found)
   ├─> Generate reset token (64-char hex)
   ├─> Set 1-hour expiration
   ├─> Save to password-reset-tokens.json
   └─> Log reset link to console (mock email)

3. User receives link (console in dev)
   └─> http://localhost:3000/auth/reset-password?token=<token>

4. User submits new password
   └─> POST /api/auth/recovery/reset { token, newPassword }

5. Backend resets password
   ├─> Validate token exists and not expired
   ├─> Hash new password with bcrypt
   ├─> Update UserIdentity.passwordHash
   ├─> INVALIDATE ALL USER SESSIONS (security)
   ├─> Delete reset token
   └─> Return success

6. Frontend redirects to login
   └─> User must sign in with new password
```

---

### Token Claiming Flow

```
1. Anonymous user creates/joins event
   ├─> Event created with organizerToken
   └─> Tokens stored in localStorage:
       ├─> organizer_token_<eventId>
       ├─> organizer_participant_id_<eventId>
       ├─> participant_token_<eventId>
       └─> participant_id_<eventId>

2. User registers or logs in
   └─> Auth store triggers token scan

3. Frontend scans localStorage
   ├─> Find all organizer_token_* and participant_token_* keys
   └─> Collect { eventId, token, tokenType }[]

4. Auto-claim tokens (background)
   └─> For each token:
       ├─> POST /api/auth/claim-token
       ├─> Backend creates UserEvent record
       └─> Frontend clears localStorage tokens

5. Manual claim (dashboard banner)
   ├─> ClaimEventsBanner shows unclaimed count
   ├─> User clicks "Claim All"
   └─> Same process as auto-claim

6. Events appear in dashboard
   └─> GET /api/users/me/events returns claimed events
```

---

## Frontend Components

### Auth Pages

#### `/auth/signin` - Sign In Page

**Features:**

- Email and password inputs
- Form validation
- Error display
- "Forgot password?" link
- "Sign up" link
- Loading state during authentication

**File:** `src/app/auth/signin/page.tsx`

---

#### `/auth/signup` - Sign Up Page

**Features:**

- Name input (optional)
- Email and password inputs
- Password confirmation with matching validation
- Minimum 8 character requirement
- Error display
- Loading state during registration
- "Sign in" link

**File:** `src/app/auth/signup/page.tsx`

---

#### `/auth/forgot-password` - Password Recovery Request

**Features:**

- Email input
- Success state with email confirmation
- Link back to sign in
- Error handling
- Console instructions for mock email

**File:** `src/app/auth/forgot-password/page.tsx`

---

#### `/auth/reset-password` - Password Reset

**Features:**

- Token extraction from URL query parameter
- New password input
- Password confirmation
- Minimum 8 character validation
- Success state with auto-redirect (3 seconds)
- Error handling for invalid/expired tokens
- Disabled state if token missing

**File:** `src/app/auth/reset-password/page.tsx`

---

### Dashboard Pages

#### `/dashboard` - Main Dashboard

**Features:**

- Personalized greeting with user name
- Event list with EventCard components
- ClaimEventsBanner for unclaimed events
- **Liked Venues Section** - Display all venues you've liked across all events
  - Shows venue photos, names, ratings, and categories
  - Venue count summary
  - Responsive grid layout
  - Only appears when you have liked venues
- "Create New Event" button
- Empty state with call-to-action
- Loading spinner
- Header with logo, settings link, sign out button

**File:** `src/app/dashboard/page.tsx`

**Protected:** Yes (wrapped with ProtectedRoute)

**Liked Venues Feature:**
The dashboard now includes a dedicated section showing all venues you've liked across different events. This feature:

- Aggregates all your liked venues from the `likedVenueData` store
- Displays venue cards with photos, names, addresses, ratings, and categories
- Shows a count of total liked venues
- Automatically hides when you have no liked venues
- Provides a quick overview of your favorite meeting spots

---

#### `/dashboard/settings` - User Settings

**Features:**

- Account information section:
  - Email display (read-only)
  - Name editing
- Default preferences section:
  - **Address autocomplete with Google Places** - Search and select addresses with autocomplete
  - **"Locate Me" button** - Automatically detect current location via geolocation
  - **Address verification indicator** - Shows checkmark when address has valid Place ID
  - **Place ID storage** - Stores both address string and Google Place ID for accuracy
  - Fuzzy location toggle
- Connected accounts section (OAuth):
  - Google account linking/unlinking
  - GitHub account linking/unlinking
  - Minimum one authentication method required
- Save/cancel buttons
- Success/error messages
- Header with dashboard link, sign out button

**File:** `src/app/dashboard/settings/page.tsx`

**Protected:** Yes (wrapped with ProtectedRoute)

**Default Address Feature:**
The Settings page includes a Google Places autocomplete component that:

- Provides real-time address suggestions as you type
- Stores both the formatted address and the Google Place ID
- Validates that addresses are selected from the dropdown (not just typed)
- Supports geolocation with the "Locate Me" button
- Shows a verification checkmark (✓) when a valid Place ID is stored
- Prevents saving partial or invalid addresses

This default address can be used to quickly pre-fill your location when joining events.

---

### UI Components

#### `SignInButton` - Authentication CTA

**Location:** Header (when not authenticated)

**Features:**

- "Sign In" and "Sign Up" buttons
- Navigation to auth pages

**File:** `src/components/header/sign-in-button.tsx`

---

#### `UserMenu` - User Account Dropdown

**Location:** Header (when authenticated)

**Features:**

- Avatar with user initials
- Dropdown menu:
  - User name and email display
  - Dashboard link
  - Settings link
  - Sign out button
- Click-outside detection to close
- Smooth animations

**File:** `src/components/header/user-menu.tsx`

---

#### `EventCard` - Event Display Component

**Features:**

- Event title
- Meeting date/time (formatted)
- Participant count
- Published status badge
- Published date (if applicable)
- Created date
- Click to navigate to event page

**File:** `src/components/dashboard/event-card.tsx`

---

#### `ClaimEventsBanner` - Unclaimed Events Notification

**Features:**

- Shows count of unclaimed events
- Separates organizer vs participant roles
- "Claim All" button
- Loading state during claim
- Auto-hides when no unclaimed events

**File:** `src/components/dashboard/claim-events-banner.tsx`

**Hook:** `useTokenClaimer` (src/hooks/useTokenClaimer.ts)

---

#### `ProtectedRoute` - Route Protection Wrapper

**Features:**

- Checks authentication state
- Shows loading spinner during auth check
- Redirects to /auth/signin if not authenticated
- Prevents content flash with null return

**File:** `src/components/auth/protected-route.tsx`

**Usage:**

```tsx
// Wrap dashboard layout
<ProtectedRoute>{children}</ProtectedRoute>
```

---

#### `SessionProvider` - Session Initialization

**Features:**

- Checks session on app mount
- Calls `checkSession()` from auth store
- Runs once per app load

**File:** `src/components/auth/session-provider.tsx`

**Usage:**

```tsx
// In root layout
<SessionProvider>{children}</SessionProvider>
```

---

## State Management

### Auth Store (Zustand)

**File:** `src/store/auth-store.ts`

**State:**

```typescript
{
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
```

**Actions:**

- `login(email, password)` - Authenticate user
- `register(data)` - Create account
- `logout()` - Clear session
- `checkSession()` - Validate session on app load
- `updateProfile(data)` - Update user info
- `setUser(user)` - Internal setter
- `clearError()` - Clear error message

**Persistence:**

```typescript
persist(storeConfig, {
  name: 'auth-storage',
  partialize: (state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  }),
});
```

**Note:** Only persists UI state; backend cookie is source of truth.

---

### Token Claimer Hook

**File:** `src/hooks/useTokenClaimer.ts`

**Interface:**

```typescript
{
  unclaimedEvents: UnclaimedEvent[];
  isScanning: boolean;
  claimEvent: (eventId, tokenType) => Promise<void>;
  claimAllEvents: () => Promise<void>;
}
```

**UnclaimedEvent:**

```typescript
{
  eventId: string;
  tokenType: 'organizer' | 'participant';
  token: string;
}
```

**Behavior:**

- Scans localStorage on user authentication
- Detects tokens with prefixes: `organizer_token_*`, `participant_token_*`
- Provides claim functions for UI
- Auto-cleans localStorage after successful claim

---

## Security Features

### Password Security

✅ **bcrypt Hashing** - 12 rounds (cost factor)
✅ **Minimum Length** - 8 characters enforced
✅ **Server-Side Only** - Passwords never sent to client
✅ **Hash Storage** - Only hashes stored in database

### Session Security

✅ **HTTP-Only Cookies** - Not accessible via JavaScript (XSS protection)
✅ **SameSite=Lax** - CSRF protection
✅ **Secure Flag** - HTTPS only in production
✅ **7-Day Expiration** - Automatic session timeout
✅ **Opaque Tokens** - 64-char cryptographic random strings

### Token Security

✅ **Cryptographic Randomness** - `crypto.randomBytes(32)`
✅ **Single-Use Reset Tokens** - Deleted after password reset
✅ **1-Hour Expiration** - Reset tokens expire quickly
✅ **Session Invalidation** - All sessions cleared on password reset

### Privacy & Anti-Enumeration

✅ **Email Enumeration Prevention** - Password reset always returns success
✅ **Fuzzy Location** - Optional location privacy setting
✅ **Token Exclusion** - Sensitive tokens excluded from API responses

---

## User Experience Flows

### Anonymous User Journey

```
1. Visit home page (/)
   └─> See "Sign In" and "Sign Up" buttons

2. Create event
   ├─> Enter title and meeting time
   ├─> Receive organizerToken (localStorage)
   └─> Navigate to /meet/<eventId>

3. Add participants
   └─> Each gets participantToken (localStorage)

4. Search venues and vote
   └─> Anonymous participation works

5. Decide to create account
   └─> Click "Sign Up" from header
```

---

### New User Registration Journey

```
1. Click "Sign Up" from header
   └─> Navigate to /auth/signup

2. Fill registration form
   ├─> Enter name (optional)
   ├─> Enter email
   ├─> Enter password (≥8 chars)
   └─> Confirm password

3. Submit form
   ├─> Account created
   ├─> Session established
   ├─> Tokens auto-claimed (background)
   └─> Redirected to /dashboard

4. See dashboard
   ├─> ClaimEventsBanner (if unclaimed events)
   ├─> Event list (claimed events)
   └─> Welcome message with name
```

---

### Returning User Login Journey

```
1. Visit home page (/)
   └─> Click "Sign In" from header

2. Enter credentials
   ├─> Email
   └─> Password

3. Submit form
   ├─> Session established
   ├─> Tokens auto-claimed
   └─> Redirected to /dashboard

4. View events
   └─> All claimed events displayed
```

---

### Password Reset Journey

```
1. Click "Forgot password?" on sign in page
   └─> Navigate to /auth/forgot-password

2. Enter email
   └─> Submit request

3. Check console for reset link
   └─> (In production: check email)

4. Click reset link
   └─> Navigate to /auth/reset-password?token=<token>

5. Enter new password
   ├─> Password (≥8 chars)
   └─> Confirm password

6. Submit form
   ├─> Password updated
   ├─> All sessions invalidated
   └─> Redirected to sign in (3 seconds)

7. Sign in with new password
```

---

### Token Claiming Journey

```
SCENARIO A: Auto-Claim

1. User creates event anonymously
   └─> organizerToken saved to localStorage

2. User signs up or logs in
   └─> Auth store triggers token scan

3. Tokens auto-claimed in background
   └─> UserEvent records created

4. User visits dashboard
   └─> Event appears in list immediately

SCENARIO B: Manual Claim

1. User already logged in
   └─> Creates/joins events while authenticated

2. User returns to dashboard later
   └─> ClaimEventsBanner appears (if unclaimed)

3. User clicks "Claim All"
   ├─> All tokens claimed
   ├─> Banner disappears
   └─> Events appear in list
```

---

## File Structure

### API Routes

```
src/app/api/
├── auth/
│   ├── register/route.ts         # POST - Create account
│   ├── login/route.ts            # POST - Authenticate
│   ├── logout/route.ts           # POST - End session
│   ├── session/route.ts          # GET - Validate session
│   ├── claim-token/route.ts      # POST - Link event to user
│   └── recovery/
│       ├── request/route.ts      # POST - Request password reset
│       └── reset/route.ts        # POST - Reset password
└── users/
    └── me/
        ├── route.ts              # GET/PATCH - User profile
        └── events/route.ts       # GET - User's events
```

---

### Frontend Structure

```
src/
├── app/
│   ├── (landing)/
│   │   └── page.tsx              # Home page with auth buttons
│   ├── auth/
│   │   ├── signin/page.tsx       # Sign in form
│   │   ├── signup/page.tsx       # Registration form
│   │   ├── forgot-password/page.tsx  # Password reset request
│   │   └── reset-password/page.tsx   # Password reset form
│   ├── dashboard/
│   │   ├── layout.tsx            # Protected route wrapper
│   │   ├── page.tsx              # Main dashboard
│   │   └── settings/page.tsx    # User settings
│   └── layout.tsx                # Root layout with SessionProvider
├── components/
│   ├── auth/
│   │   ├── protected-route.tsx   # Route protection
│   │   └── session-provider.tsx  # Session initialization
│   ├── dashboard/
│   │   ├── event-card.tsx        # Event display
│   │   └── claim-events-banner.tsx  # Unclaimed events UI
│   └── header/
│       ├── sign-in-button.tsx    # Auth CTA
│       └── user-menu.tsx         # User dropdown
├── hooks/
│   └── useTokenClaimer.ts        # Token claiming logic
├── lib/
│   └── api/
│       ├── auth.ts               # Auth API client
│       ├── users.ts              # User API client
│       └── index.ts              # API exports
├── mock-server/
│   └── auth-persistence.ts       # File-based persistence
├── store/
│   └── auth-store.ts             # Zustand auth state
└── types/
    └── user.ts                   # TypeScript types
```

---

### Mock Data Files

```
.mock-data/
├── users.json                    # Users and identities
├── sessions.json                 # Active sessions
├── user-events.json              # User-event links
├── password-reset-tokens.json    # Reset tokens (on-demand)
└── events.json                   # Events (existing)
```

---

## Future Enhancements (Phase 2)

🔮 **OAuth Integration** - Google and GitHub login
🔮 **Email Verification** - Confirm email before activation
🔮 **Two-Factor Authentication** - TOTP-based 2FA
🔮 **Account Deletion** - Self-serve with data export
🔮 **Event Analytics** - Participation history, voting patterns
🔮 **Team Accounts** - Shared event management for organizations

---

## Deployment Notes

### Development

```bash
npm run dev
```

- Mock backend runs automatically via Next.js API routes
- Data persisted to `.mock-data/` folder (gitignored)
- Password reset links logged to console
- Each developer has isolated user database

### Production

To migrate to real backend:

1. Replace Next.js API routes with external backend calls
2. Update `api.auth.*` and `api.users.*` to use `backendCall()`
3. Configure backend URL in environment variables
4. Implement real email service for password resets
5. Use production database (PostgreSQL, MongoDB, etc.)

**Note:** API contract remains the same for easy migration.

---

## Backend Implementation Guide

This section provides comprehensive guidance for backend developers implementing a production authentication system that's fully compatible with the existing frontend. The guide is technology-agnostic and can be implemented using any backend framework (Node.js, Python, Go, Java, etc.).

### Overview

**Purpose:** Guide backend developers in implementing production-grade authentication that maintains API contract compatibility with the existing frontend.

**Key Principles:**

- **Contract Compatibility**: All endpoints must return the exact response structures documented in the API Reference section
- **Technology Agnostic**: Use any backend framework or database that meets the requirements
- **Security First**: Implement all security measures outlined below
- **Scalability**: Design for horizontal scaling and high availability

---

### Database Schema

Implement the following five tables with proper indexes and foreign key constraints:

#### 1. Users Table

Stores core user account information.

**Schema:**

```sql
CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,              -- Format: usr_<32-char-hex>
  email VARCHAR(255) NOT NULL UNIQUE,      -- User's email address
  name VARCHAR(255),                       -- Display name (nullable)
  avatar_url VARCHAR(512),                 -- Profile picture URL (nullable)
  email_verified BOOLEAN DEFAULT FALSE,    -- Email verification status
  default_address TEXT,                    -- Home/default address (nullable)
  default_place_id VARCHAR(255),           -- Google Places ID (nullable)
  default_fuzzy_location BOOLEAN DEFAULT FALSE,  -- Privacy setting
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

**Notes:**

- Use UUID or generate IDs with format `usr_<32-char-hex>`
- Email must be unique and case-insensitive
- `updated_at` should auto-update on record modification

---

#### 2. User Identities Table

Supports multiple authentication providers per user (email, OAuth).

**Schema:**

```sql
CREATE TABLE user_identities (
  id VARCHAR(64) PRIMARY KEY,              -- Format: ident_<32-char-hex>
  user_id VARCHAR(64) NOT NULL,            -- Foreign key to users.id
  provider VARCHAR(50) NOT NULL,           -- 'email', 'google', 'github'
  provider_id VARCHAR(255) NOT NULL,       -- Email address or OAuth user ID
  password_hash VARCHAR(255),              -- bcrypt hash (email only)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_id)            -- Prevent duplicate identities
);

CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);
CREATE INDEX idx_user_identities_provider ON user_identities(provider, provider_id);
```

**Notes:**

- `password_hash` is only populated for email provider
- Use composite unique constraint on (provider, provider_id)
- OAuth providers will be added in Phase 2

---

#### 3. Sessions Table

Stores active user sessions with expiration.

**Schema:**

```sql
CREATE TABLE sessions (
  id VARCHAR(64) PRIMARY KEY,              -- Format: ses_<32-char-hex>
  user_id VARCHAR(64) NOT NULL,            -- Foreign key to users.id
  session_token VARCHAR(128) NOT NULL UNIQUE,  -- 64-char hex token
  expires_at TIMESTAMP NOT NULL,           -- Session expiration time
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

**Notes:**

- Generate session_token with `crypto.randomBytes(32).toString('hex')`
- Set `expires_at` to 7 days from creation
- Implement background job to delete expired sessions
- Index on `expires_at` optimizes cleanup queries

---

#### 4. Password Reset Tokens Table

Temporary tokens for password reset flow.

**Schema:**

```sql
CREATE TABLE password_reset_tokens (
  id VARCHAR(64) PRIMARY KEY,              -- Format: prt_<32-char-hex>
  user_id VARCHAR(64) NOT NULL,            -- Foreign key to users.id
  token VARCHAR(128) NOT NULL UNIQUE,      -- 64-char hex token
  expires_at TIMESTAMP NOT NULL,           -- Token expiration (1 hour)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
```

**Notes:**

- Generate token with `crypto.randomBytes(32).toString('hex')`
- Set `expires_at` to 1 hour from creation
- Tokens are single-use (delete after successful reset)
- Implement background job to delete expired tokens

---

#### 5. User Events Table

Links users to events they've created or participated in.

**Schema:**

```sql
CREATE TABLE user_events (
  id VARCHAR(64) PRIMARY KEY,              -- Format: ue_<32-char-hex>
  user_id VARCHAR(64) NOT NULL,            -- Foreign key to users.id
  event_id VARCHAR(64) NOT NULL,           -- Foreign key to events.id
  participant_id VARCHAR(64),              -- Foreign key to participants.id (nullable)
  role VARCHAR(20) NOT NULL,               -- 'organizer' or 'participant'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE(user_id, event_id)                -- One record per user-event pair
);

CREATE INDEX idx_user_events_user_id ON user_events(user_id);
CREATE INDEX idx_user_events_event_id ON user_events(event_id);
CREATE INDEX idx_user_events_user_event ON user_events(user_id, event_id);
```

**Notes:**

- `role` enum: 'organizer' or 'participant'
- Composite unique constraint prevents duplicate claims
- Consider adding CHECK constraint: `role IN ('organizer', 'participant')`

---

### API Endpoints to Implement

Implement all 10 endpoints with responses matching the API Reference section exactly:

**Authentication Endpoints:**

1. `POST /api/auth/register` - Create new user account
2. `POST /api/auth/login` - Authenticate user
3. `POST /api/auth/logout` - Invalidate session
4. `GET /api/auth/session` - Validate session and return user
5. `POST /api/auth/claim-token` - Link anonymous event to user
6. `POST /api/auth/recovery/request` - Request password reset
7. `POST /api/auth/recovery/reset` - Reset password with token

**User Management Endpoints:** 8. `GET /api/users/me` - Get current user profile 9. `PATCH /api/users/me` - Update user profile 10. `GET /api/users/me/events` - Get user's events

**Critical:** Response structures must match the documented API contract exactly to maintain frontend compatibility.

---

### Authentication & Session Management

#### Password Hashing

**Requirements:**

- **Algorithm**: bcrypt with cost factor 12 (or Argon2id for better security)
- **Never** store plaintext passwords
- **Hash on write**, verify on read with constant-time comparison

**Example (Node.js with bcrypt):**

```javascript
const bcrypt = require('bcrypt');
const BCRYPT_ROUNDS = 12;

// Hash password
const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

// Verify password
const isValid = await bcrypt.compare(password, passwordHash);
```

---

#### Session Token Generation

**Requirements:**

- Generate cryptographically secure random tokens
- Format: 64-character hex string (32 random bytes)
- Tokens must be unpredictable and collision-resistant

**Example (Node.js):**

```javascript
const crypto = require('crypto');

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}
```

---

#### Session Storage & Validation

**Session Creation:**

```javascript
const session = {
  id: `ses_${generateId()}`,
  userId: user.id,
  sessionToken: generateSessionToken(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  createdAt: new Date(),
};
```

**Session Validation:**

1. Extract `session_token` from HTTP-only cookie
2. Query database: `SELECT * FROM sessions WHERE session_token = ? AND expires_at > NOW()`
3. If expired, delete session and return 401
4. If valid, load associated user
5. Return user object

---

#### Cookie Configuration

Set session cookie with these parameters:

```javascript
res.cookie('session_token', sessionToken, {
  httpOnly: true, // Prevent JavaScript access (XSS protection)
  sameSite: 'lax', // CSRF protection
  secure: true, // HTTPS only in production
  path: '/', // Available on all routes
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
});
```

**Important:**

- `httpOnly: true` is **mandatory** for security
- `secure: true` in production, `false` in development
- `sameSite: 'lax'` prevents CSRF attacks

---

#### Session Cleanup

Implement a background job to delete expired sessions:

```sql
DELETE FROM sessions WHERE expires_at < NOW();
```

**Recommendations:**

- Run every 15-60 minutes
- Use database scheduler (PostgreSQL: `pg_cron`) or application cron job
- Also cleanup expired password reset tokens

---

### Security Requirements

#### 1. Password Security

✅ **Minimum Length**: Enforce 8 characters minimum (even if frontend validates)
✅ **Secure Hashing**: Use bcrypt (cost 12) or Argon2id
✅ **Never** store plaintext passwords
✅ **Constant-Time Comparison**: Use bcrypt.compare() or equivalent to prevent timing attacks

**Example validation:**

```javascript
if (!password || password.length < 8) {
  return res.status(400).json({
    error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' },
  });
}
```

---

#### 2. Token Security

✅ **Cryptographic Randomness**: Use `crypto.randomBytes(32)` or OS-level entropy
✅ **Single-Use Reset Tokens**: Delete after successful password reset
✅ **Auto-Expire**: Sessions expire in 7 days, reset tokens in 1 hour
✅ **Never Expose Tokens**: Don't include session tokens in API responses

---

#### 3. CORS Configuration

Configure Cross-Origin Resource Sharing properly:

```javascript
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // Whitelist specific domain
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
```

**Critical:**

- **Never** use `origin: '*'` with `credentials: true`
- Whitelist specific frontend domain(s)
- Set `credentials: true` to allow cookies

---

#### 4. Rate Limiting

Implement rate limiting to prevent brute force attacks:

| Endpoint                        | Limit      | Window            |
| ------------------------------- | ---------- | ----------------- |
| POST /api/auth/login            | 5 attempts | 15 minutes per IP |
| POST /api/auth/register         | 3 attempts | 1 hour per IP     |
| POST /api/auth/recovery/request | 3 attempts | 1 hour per email  |
| POST /api/auth/recovery/reset   | 5 attempts | 1 hour per IP     |

**Implementation Options:**

- **Express**: Use `express-rate-limit` middleware
- **Redis**: Store rate limit counters in Redis for distributed systems
- **Database**: Store attempts in database with cleanup job

**Example (Express):**

```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { error: { code: 'RATE_LIMIT', message: 'Too many login attempts' } },
});

app.post('/api/auth/login', loginLimiter, loginHandler);
```

---

#### 5. Input Validation

**Server-Side Validation is Mandatory:**

- Never trust client-side validation
- Validate all inputs on the backend
- Sanitize inputs to prevent injection attacks

**Email Validation:**

```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({
    error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' },
  });
}
```

**SQL Injection Prevention:**

- Use parameterized queries or ORM (Sequelize, Prisma, TypeORM)
- **Never** concatenate user input into SQL strings

**Example (Parameterized Query):**

```javascript
// ✅ CORRECT
const user = await db.query('SELECT * FROM users WHERE email = ?', [email]);

// ❌ WRONG - SQL injection vulnerability!
const user = await db.query(`SELECT * FROM users WHERE email = '${email}'`);
```

---

#### 6. Email Enumeration Prevention

**Password reset endpoint must not reveal if email exists:**

```javascript
// Always return success, even if email doesn't exist
res.json({ success: true });

// Only send email if user exists (internal logic)
if (user) {
  await sendPasswordResetEmail(user.email, resetToken);
}
```

---

#### 7. Session Security

✅ **Invalidate All Sessions on Password Reset**: Force re-authentication after password change
✅ **Session Revocation**: Allow users to revoke sessions from settings
✅ **Device Tracking** (Optional): Track device/browser for security notifications

**Example (Invalidate All Sessions):**

```javascript
// After successful password reset
await db.query('DELETE FROM sessions WHERE user_id = ?', [userId]);
```

---

### Business Logic Requirements

#### User Registration

**Flow:**

1. Validate input (email format, password length, email uniqueness)
2. **Use transaction** to create user and identity atomically
3. Hash password with bcrypt
4. Generate user ID (`usr_<32-char-hex>`)
5. Create user record
6. Create user_identity record (provider='email', providerId=email)
7. Create session
8. Set session cookie
9. Return user object (without password hash)

**Critical:** Use database transaction to ensure user and identity are created atomically.

---

#### User Login

**Flow:**

1. Validate input (email and password required)
2. Query user_identities: `SELECT * FROM user_identities WHERE provider = 'email' AND provider_id = ?`
3. If not found, return 401 Invalid Credentials
4. Verify password: `bcrypt.compare(password, identity.password_hash)`
5. If invalid, return 401 Invalid Credentials
6. Load user record from users table
7. Create new session
8. Set session cookie
9. Return user object

**Security:** Never reveal whether email exists or password is wrong - always return "Invalid credentials".

---

#### Session Validation

**Flow:**

1. Extract `session_token` from cookie
2. If no cookie, return 401 Unauthorized
3. Query session: `SELECT * FROM sessions WHERE session_token = ? AND expires_at > NOW()`
4. If not found or expired, return 401 Unauthorized
5. If expired, delete session (auto-cleanup)
6. Load user record
7. Return user object

**Performance:** Consider caching sessions in Redis for high-traffic applications.

---

#### Password Reset

**Request Flow:**

1. Receive email address
2. **Always return success** (prevent enumeration)
3. If user exists:
   - Generate reset token: `crypto.randomBytes(32).toString('hex')`
   - Set expiration: 1 hour from now
   - Save to password_reset_tokens table
   - Send email with reset link: `https://yourdomain.com/auth/reset-password?token={token}`

**Reset Flow:**

1. Receive token and new password
2. Validate token exists and not expired
3. If expired, delete token and return 400 Token Expired
4. Hash new password
5. Update user_identities.password_hash
6. **Invalidate ALL user sessions** (security measure)
7. Delete reset token (single-use)
8. Return success

**Security:** Invalidating all sessions forces attacker to re-authenticate if they gained unauthorized access.

---

#### Token Claiming

**Flow:**

1. Validate user is authenticated (check session)
2. Validate input (eventId, token, tokenType)
3. Verify event exists
4. Create user_events record:
   - userId: from session
   - eventId: from request
   - participantId: from event participant
   - role: from tokenType ('organizer' or 'participant')
5. Handle duplicate claims gracefully (idempotent)
6. Return success with userEvent object

**Idempotency:** If user_events record already exists, return existing record instead of error.

---

#### Profile Updates

**Allowed Fields:**

- ✅ `name`
- ✅ `defaultAddress`
- ✅ `defaultPlaceId`
- ✅ `defaultFuzzyLocation`
- ✅ `avatarUrl`

**Forbidden Fields:**

- ❌ `email` (cannot be changed in Phase 1)
- ❌ `id`
- ❌ `emailVerified`
- ❌ `createdAt`

**Flow:**

1. Validate user is authenticated
2. Extract allowed fields from request body
3. Update users table
4. Set `updated_at = NOW()`
5. Return updated user object

---

### Error Handling Standards

Implement consistent error responses across all endpoints:

**Error Response Format:**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

**Standard Error Codes:**

| Code                  | HTTP Status | Description                                             |
| --------------------- | ----------- | ------------------------------------------------------- |
| `VALIDATION_ERROR`    | 400         | Invalid input (missing required fields, invalid format) |
| `INVALID_TOKEN`       | 400         | Reset token not found or invalid                        |
| `TOKEN_EXPIRED`       | 400         | Reset token has expired                                 |
| `UNAUTHORIZED`        | 401         | Not authenticated or invalid credentials                |
| `SESSION_EXPIRED`     | 401         | Session has expired                                     |
| `INVALID_CREDENTIALS` | 401         | Wrong email or password                                 |
| `FORBIDDEN`           | 403         | Authenticated but not authorized                        |
| `USER_NOT_FOUND`      | 404         | User record not found                                   |
| `EVENT_NOT_FOUND`     | 404         | Event not found                                         |
| `EMAIL_EXISTS`        | 409         | Email already registered                                |
| `INTERNAL_ERROR`      | 500         | Server error (log details, return generic message)      |

**Example:**

```javascript
res.status(400).json({
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Password must be at least 8 characters',
  },
});
```

**Logging:** Always log full error details server-side, but return generic messages to clients for 500 errors.

---

### Email Service Integration

Replace console logging with a real email service for password resets.

#### Service Options

Popular email service providers:

| Service      | Pros                        | Pricing                       |
| ------------ | --------------------------- | ----------------------------- |
| **SendGrid** | Reliable, good free tier    | Free up to 100 emails/day     |
| **AWS SES**  | Low cost, scalable          | $0.10 per 1,000 emails        |
| **Mailgun**  | Developer-friendly API      | Free up to 5,000 emails/month |
| **Postmark** | Fast delivery, templates    | $15/month for 10k emails      |
| **Resend**   | Modern API, React templates | Free up to 100 emails/day     |

---

#### Email Templates

**Password Reset Email:**

**Subject:** Reset your Where2Meet password

**HTML Body:**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Password Reset</title>
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1>Reset Your Password</h1>
    <p>You requested to reset your password for your Where2Meet account.</p>
    <p>Click the button below to reset your password:</p>

    <a
      href="{{resetLink}}"
      style="display: inline-block; padding: 12px 24px; background-color: #F97583; color: white; text-decoration: none; border-radius: 24px; margin: 16px 0;"
    >
      Reset Password
    </a>

    <p>Or copy and paste this link into your browser:</p>
    <p style="color: #666; word-break: break-all;">{{resetLink}}</p>

    <p><strong>This link will expire in 1 hour.</strong></p>

    <p>If you didn't request a password reset, you can safely ignore this email.</p>

    <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;" />

    <p style="color: #999; font-size: 12px;">
      Where2Meet - Find the perfect meeting spot<br />
      <a href="https://yourdomain.com">yourdomain.com</a>
    </p>
  </body>
</html>
```

**Plain Text Version:**

```
Reset Your Password

You requested to reset your password for your Where2Meet account.

Click this link to reset your password:
{{resetLink}}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

---
Where2Meet - Find the perfect meeting spot
https://yourdomain.com
```

---

#### Implementation Example (SendGrid)

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPasswordResetEmail(email, token) {
  const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;

  const msg = {
    to: email,
    from: process.env.EMAIL_FROM_ADDRESS,
    subject: 'Reset your Where2Meet password',
    text: `Click this link to reset your password: ${resetLink}\n\nThis link expires in 1 hour.`,
    html: `<p>Click the link below to reset your password:</p>
           <a href="${resetLink}">Reset Password</a>
           <p>This link expires in 1 hour.</p>`,
  };

  await sgMail.send(msg);
}
```

---

### Environment Variables

Configure the following environment variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/where2meet
# Or individual components:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=where2meet
DB_USER=postgres
DB_PASSWORD=your-secure-password

# Session Configuration
SESSION_SECRET=generate-random-64-char-secret-key
SESSION_EXPIRY_DAYS=7

# Email Service
EMAIL_SERVICE=sendgrid  # or 'ses', 'mailgun', etc.
EMAIL_SERVICE_API_KEY=your-api-key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=Where2Meet

# Frontend URL (for CORS and email links)
FRONTEND_URL=https://yourdomain.com

# Security
BCRYPT_ROUNDS=12
PASSWORD_RESET_TOKEN_EXPIRY_HOURS=1

# Rate Limiting (optional, defaults shown)
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_LOGIN_WINDOW_MINUTES=15
RATE_LIMIT_REGISTER_MAX=3
RATE_LIMIT_REGISTER_WINDOW_MINUTES=60
RATE_LIMIT_PASSWORD_RESET_MAX=3
RATE_LIMIT_PASSWORD_RESET_WINDOW_MINUTES=60

# Environment
NODE_ENV=production  # or 'development'
PORT=3001
```

**Security:**

- Never commit `.env` files to version control
- Use secure secret generation: `openssl rand -hex 32`
- Rotate secrets regularly in production

---

### Migration Strategy

Step-by-step process to migrate from Next.js API routes to production backend:

#### Step 1: Setup Backend

1. **Initialize Backend Project**

   ```bash
   mkdir backend
   cd backend
   npm init -y
   npm install express cors bcrypt cookie-parser
   ```

2. **Setup Database**
   - Create database: `CREATE DATABASE where2meet;`
   - Run schema migrations (create tables with indexes)
   - Test database connectivity

3. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Set all required environment variables
   - Test configuration

4. **Implement All Endpoints**
   - Implement 10 authentication/user endpoints
   - Match API contract exactly
   - Add error handling and logging

---

#### Step 2: Test Backend

1. **Unit Tests**
   - Password hashing/verification
   - Token generation
   - Session validation logic

2. **Integration Tests**
   - Full authentication flows
   - Password reset flow
   - Token claiming
   - Error handling

3. **Manual Testing**
   - Use Postman or curl to test all endpoints
   - Verify response structures match documentation
   - Test error cases

4. **CORS Testing**
   - Test from frontend development server
   - Verify cookies are set correctly
   - Check preflight OPTIONS requests work

---

#### Step 3: Update Frontend API Client

Modify API client to use backend instead of Next.js routes:

**Before (src/lib/api/auth.ts):**

```typescript
export const auth = {
  register: async (data: RegisterData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    // ...
  },
};
```

**After (src/lib/api/auth.ts):**

```typescript
import { backendCall } from './backend';

export const auth = {
  register: async (data: RegisterData) => {
    return backendCall('/api/auth/register', {
      method: 'POST',
      body: data,
    });
  },
};
```

**Create backend client (src/lib/api/backend.ts):**

```typescript
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function backendCall(endpoint: string, options: RequestInit = {}) {
  const url = `${BACKEND_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json();
    throw error;
  }

  return res.json();
}
```

**Update Environment (.env.local):**

```bash
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
```

---

#### Step 4: Deploy

1. **Deploy Backend First**
   - Deploy to cloud provider (AWS, GCP, Azure, DigitalOcean, Heroku)
   - Configure production database
   - Set environment variables
   - Enable HTTPS (required for secure cookies)
   - Test health check endpoint

2. **Deploy Frontend**
   - Update `NEXT_PUBLIC_BACKEND_URL` to production backend
   - Build and deploy frontend
   - Verify CORS configuration works
   - Test full authentication flow in production

3. **Monitor**
   - Check application logs
   - Monitor error rates
   - Verify session creation/validation works
   - Test password reset email delivery

4. **Rollback Plan**
   - Keep Next.js API routes intact temporarily
   - If issues occur, revert frontend to use Next.js routes
   - Fix backend issues and redeploy

---

#### Step 5: Cleanup

Once backend is stable in production:

1. **Remove Next.js API Routes**

   ```bash
   rm -rf src/app/api/auth
   rm -rf src/app/api/users
   ```

2. **Remove Mock Server Code**

   ```bash
   rm -rf src/mock-server
   ```

3. **Remove Mock Data Folder**

   ```bash
   rm -rf .mock-data
   ```

4. **Update .gitignore**
   - Remove `.mock-data` entry

5. **Update Documentation**
   - Update README with new backend setup instructions
   - Document environment variables
   - Add deployment instructions

---

### Testing Recommendations

#### Unit Tests

Test individual functions in isolation:

**Example (Password Hashing):**

```javascript
describe('Password Hashing', () => {
  it('should hash password with bcrypt', async () => {
    const password = 'testPassword123';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(await bcrypt.compare(password, hash)).toBe(true);
  });

  it('should reject invalid password', async () => {
    const hash = await hashPassword('correctPassword');
    expect(await bcrypt.compare('wrongPassword', hash)).toBe(false);
  });
});
```

**Example (Token Generation):**

```javascript
describe('Token Generation', () => {
  it('should generate unique session tokens', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });
});
```

---

#### Integration Tests

Test full API flows:

**Example (Registration Flow):**

```javascript
describe('POST /api/auth/register', () => {
  it('should create user and return session', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'testPassword123',
      name: 'Test User',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.name).toBe('Test User');
    expect(res.headers['set-cookie']).toBeDefined();

    // Verify session cookie
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('session_token');
    expect(cookie).toContain('HttpOnly');
  });

  it('should reject duplicate email', async () => {
    // Create first user
    await request(app).post('/api/auth/register').send({
      email: 'duplicate@example.com',
      password: 'password123',
    });

    // Attempt duplicate
    const res = await request(app).post('/api/auth/register').send({
      email: 'duplicate@example.com',
      password: 'password456',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });
});
```

---

#### Security Tests

Test security measures:

**Example (Rate Limiting):**

```javascript
describe('Rate Limiting', () => {
  it('should block after 5 failed login attempts', async () => {
    const email = 'test@example.com';

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({
        email,
        password: 'wrongPassword',
      });
    }

    // 6th attempt should be blocked
    const res = await request(app).post('/api/auth/login').send({
      email,
      password: 'correctPassword',
    });

    expect(res.status).toBe(429); // Too Many Requests
    expect(res.body.error.code).toBe('RATE_LIMIT');
  });
});
```

**Example (SQL Injection Prevention):**

```javascript
describe('SQL Injection', () => {
  it('should prevent SQL injection in email field', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: "admin' OR '1'='1",
      password: 'password',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
```

---

#### Load Tests

Test performance under load:

**Tools:**

- Apache JMeter
- Artillery
- k6
- Gatling

**Example (k6 load test):**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 100 }, // Stay at 100 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
};

export default function () {
  const res = http.post('https://api.yourdomain.com/api/auth/login', {
    email: 'test@example.com',
    password: 'testPassword123',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

---

### Monitoring & Observability

#### Logging

Implement structured logging with appropriate levels:

**Log Levels:**

- **ERROR**: Authentication failures, database errors, uncaught exceptions
- **WARN**: Rate limit triggers, suspicious activity
- **INFO**: Successful logins, session creation, password resets
- **DEBUG**: Detailed flow information (development only)

**Example (Winston):**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log authentication attempt
logger.info('Login attempt', {
  email: user.email,
  ip: req.ip,
  success: true,
  timestamp: new Date(),
});
```

**What to Log:**

- ✅ Authentication attempts (success/failure)
- ✅ Session creation/validation/expiration
- ✅ Password reset requests and completions
- ✅ API errors with stack traces
- ✅ Rate limiting triggers
- ❌ Passwords (never log passwords!)
- ❌ Session tokens (never log tokens!)

---

#### Metrics

Track key performance indicators:

**Authentication Metrics:**

- Active sessions count
- Login success/failure rates
- Registration count
- Password reset requests
- Token claims

**Performance Metrics:**

- API endpoint latency (p50, p95, p99)
- Database query performance
- Error rates by endpoint
- Request throughput (requests/second)

**Example (Prometheus):**

```javascript
const promClient = require('prom-client');

const loginCounter = new promClient.Counter({
  name: 'auth_login_total',
  help: 'Total login attempts',
  labelNames: ['status'], // 'success' or 'failure'
});

const sessionGauge = new promClient.Gauge({
  name: 'auth_active_sessions',
  help: 'Number of active sessions',
});

// Increment on login
loginCounter.inc({ status: 'success' });

// Update session count
sessionGauge.set(await getActiveSessionCount());
```

---

#### Alerts

Configure alerts for critical issues:

**Alert Rules:**

| Condition                   | Threshold                 | Action                       |
| --------------------------- | ------------------------- | ---------------------------- |
| Error rate > 5%             | 5 errors per 100 requests | Page on-call engineer        |
| API latency > 2s            | p95 > 2000ms              | Send notification            |
| Failed login spike          | 100 failures in 5 min     | Investigate potential attack |
| Database connection failure | Any occurrence            | Page immediately             |
| High memory usage           | > 85%                     | Scale up or investigate leak |

**Example (PagerDuty/Slack):**

```javascript
// Send alert on high error rate
if (errorRate > 0.05) {
  await sendAlert({
    severity: 'high',
    message: 'Authentication error rate exceeded 5%',
    metrics: { errorRate, timestamp: new Date() },
  });
}
```

---

### Performance Optimization

#### Database Indexing

Ensure all foreign keys and frequently queried columns are indexed:

```sql
-- Critical indexes for performance
CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_user_identities_provider ON user_identities(provider, provider_id);
CREATE INDEX idx_user_events_user_id ON user_events(user_id);
```

---

#### Caching Strategy

**Session Caching:**

- Cache active sessions in Redis
- Set TTL to match session expiration
- Fallback to database if cache miss

**Example (Redis):**

```javascript
const redis = require('redis');
const client = redis.createClient();

async function getSession(sessionToken) {
  // Try cache first
  const cached = await client.get(`session:${sessionToken}`);
  if (cached) return JSON.parse(cached);

  // Fallback to database
  const session = await db.query('SELECT * FROM sessions WHERE session_token = ?', [sessionToken]);
  if (session) {
    await client.setex(`session:${sessionToken}`, 7 * 24 * 60 * 60, JSON.stringify(session));
  }

  return session;
}
```

---

#### Connection Pooling

Use database connection pooling for better performance:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout connecting to database
});
```

---

## Support & Documentation

For questions or issues:

1. Check this documentation first
2. Review API error codes in responses
3. Inspect browser console for client-side errors
4. Check server logs for API route errors

---

**End of Documentation**
