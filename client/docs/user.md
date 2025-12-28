# User Authentication & Management API Guide

> **Last verified:** 2025-12-27 against codebase (Milestone 8 complete)

This guide documents the user authentication system (Milestone 8) for frontend integration.

## Overview

The backend now supports **user accounts** with:

- Email/password registration and login
- Session-based authentication via HttpOnly cookies
- User profile management
- Event claiming (linking anonymous participant tokens to user accounts)

## Session Management

### How It Works

1. User registers or logs in
2. Backend sets an **HttpOnly cookie** named `session_token`
3. Browser automatically sends this cookie with subsequent requests
4. No need to manually manage tokens in localStorage for auth

### Cookie Configuration

```typescript
// Cookie is set automatically by backend
{
  name: "session_token",
  httpOnly: true,          // Not accessible via JavaScript
  secure: true,            // HTTPS only in production
  sameSite: "lax",         // CSRF protection
  maxAge: 604800,          // 7 days in seconds
  path: "/"
}
```

### Important: CORS Credentials

Your fetch/axios calls must include `credentials: 'include'`:

```typescript
// Fetch API
const response = await fetch('/api/auth/session', {
  credentials: 'include', // REQUIRED for cookies
});

// Axios
axios.defaults.withCredentials = true;
// or per-request:
axios.get('/api/users/me', { withCredentials: true });
```

---

## API Endpoints

### Authentication

#### POST /api/auth/register

Create a new user account.

**Request:**

```typescript
interface RegisterRequest {
  email: string; // Will be normalized to lowercase
  password: string; // Min 8 characters
  name?: string; // Optional display name
}
```

**Response (201 Created):**

```typescript
interface AuthResponse {
  user: {
    id: string; // "usr_..."
    email: string;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean; // Always false initially
    defaultAddress: string | null;
    defaultPlaceId: string | null;
    defaultFuzzyLocation: boolean;
    createdAt: string; // ISO 8601
    updatedAt: string;
  };
}
// + Sets session_token cookie
```

**Errors:**

- `400` - Invalid email format or password too short (`VALIDATION_ERROR`)
- `409` - Email already registered (`EMAIL_EXISTS`)

**Example:**

```typescript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword123',
    name: 'John Doe',
  }),
});

if (response.status === 201) {
  const { user } = await response.json();
  // User is now logged in, cookie is set
  console.log(`Welcome, ${user.name || user.email}!`);
} else if (response.status === 409) {
  // Email already exists
  showError('This email is already registered');
}
```

---

#### POST /api/auth/login

Authenticate with existing credentials.

**Request:**

```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

**Response (200 OK):**

```typescript
interface AuthResponse {
  user: {
    /* same as register */
  };
}
// + Sets session_token cookie
```

**Errors:**

- `400` - Invalid input format (`VALIDATION_ERROR`)
- `401` - Invalid credentials (`INVALID_CREDENTIALS`)

**Example:**

```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword123',
  }),
});

if (response.status === 200) {
  const { user } = await response.json();
  // Redirect to dashboard
} else if (response.status === 401) {
  showError('Invalid email or password');
}
```

---

#### POST /api/auth/logout

Invalidate the current session.

**Request:** None (uses cookie)

**Response (200 OK):**

```typescript
interface LogoutResponse {
  success: true;
}
// + Clears session_token cookie
```

**Example:**

```typescript
await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include',
});
// Redirect to home page
```

---

#### GET /api/auth/session

Check if current session is valid and get user info.

**Request:** None (uses cookie)

**Response (200 OK):**

```typescript
interface SessionResponse {
  user: {
    /* same as register */
  };
}
```

**Errors:**

- `401` - No session or invalid/expired session

**Example (App initialization):**

```typescript
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/session', {
      credentials: 'include',
    });

    if (response.ok) {
      const { user } = await response.json();
      return { isAuthenticated: true, user };
    }
    return { isAuthenticated: false, user: null };
  } catch {
    return { isAuthenticated: false, user: null };
  }
}

// On app load
const { isAuthenticated, user } = await checkAuthStatus();
if (isAuthenticated) {
  showDashboard(user);
} else {
  showLoginPage();
}
```

---

### User Profile

#### GET /api/users/me

Get current user's profile.

**Request:** None (uses cookie)

**Response (200 OK):**

```typescript
interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  defaultAddress: string | null;
  defaultPlaceId: string | null;
  defaultFuzzyLocation: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Errors:**

- `401` - Not authenticated (`UNAUTHORIZED`)

---

#### PATCH /api/users/me

Update current user's profile.

**Request:**

```typescript
interface UpdateUserRequest {
  name?: string | null; // null clears the field
  avatarUrl?: string | null;
  defaultAddress?: string | null;
  defaultPlaceId?: string | null;
  defaultFuzzyLocation?: boolean;
}
// At least one field required
```

**Response (200 OK):**

```typescript
interface UserResponse {
  /* same as GET */
}
```

**Errors:**

- `400` - Empty body or invalid data (`VALIDATION_ERROR`)
- `401` - Not authenticated (`UNAUTHORIZED`)

**Example:**

```typescript
// Update user's default location preferences
await fetch('/api/users/me', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    name: 'Jane Doe',
    defaultAddress: '123 Main St, City',
    defaultPlaceId: 'ChIJ...',
    defaultFuzzyLocation: true,
  }),
});
```

---

### Event Management

#### GET /api/users/me/events

List all events linked to the current user.

**Request:** None (uses cookie)

**Errors:**

- `401` - Not authenticated (`UNAUTHORIZED`)

**Response (200 OK):**

```typescript
interface UserEventsListResponse {
  events: Array<{
    id: string; // UserEvent ID ("ue_...")
    role: 'organizer' | 'participant';
    participantId: string | null; // UUID of linked participant
    createdAt: string;
    event: {
      id: string; // Event ID ("evt_...")
      title: string;
      meetingTime: string | null;
      publishedAt: string | null;
      createdAt: string;
      participantCount: number;
      participants: Array<{
        id: string;
        name: string;
        color: string;
        isOrganizer: boolean;
      }>;
    };
  }>;
}
```

**Example:**

```typescript
const response = await fetch('/api/users/me/events', {
  credentials: 'include',
});
const { events } = await response.json();

// Display user's events
events.forEach(({ event, role }) => {
  console.log(`${event.title} - ${role}`);
});
```

---

#### POST /api/users/me/events/claim

Link an anonymous participant token to the user's account.

**Use case:** User created or joined an event without being logged in, then creates an account. They can claim their anonymous participant identity.

**Request:**

```typescript
interface ClaimEventRequest {
  eventId: string; // "evt_..." format
  participantToken: string; // "pt_..." format (from localStorage)
}
```

**Response (201 Created):**

```typescript
interface ClaimEventResponse {
  success: true;
  userEvent: {
    id: string;
    role: 'organizer' | 'participant';
    participantId: string | null;
    eventId: string;
    createdAt: string;
  };
}
```

**Errors:**

- `400` - Invalid event ID or token format (`VALIDATION_ERROR`)
- `401` - Not authenticated (`UNAUTHORIZED`)
- `403` - Invalid participant token (`FORBIDDEN`)
- `404` - Event not found (`EVENT_NOT_FOUND`)

**Example:**

```typescript
// After user logs in, claim their stored tokens
async function claimStoredEvents() {
  const storedTokens = getStoredTokens(); // Your localStorage helper

  for (const { eventId, token } of storedTokens) {
    try {
      const response = await fetch('/api/users/me/events/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventId,
          participantToken: token,
        }),
      });

      if (response.ok) {
        const { userEvent } = await response.json();
        console.log(`Claimed as ${userEvent.role}`);
        // Remove from localStorage after successful claim
        removeStoredToken(eventId);
      }
    } catch (error) {
      console.error(`Failed to claim event ${eventId}`);
    }
  }
}
```

---

## TypeScript Types

Full type definitions for your frontend:

```typescript
// ============ Auth Types ============

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  defaultAddress: string | null;
  defaultPlaceId: string | null;
  defaultFuzzyLocation: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthResponse {
  user: User;
}

interface SessionResponse {
  user: User;
}

interface LogoutResponse {
  success: true;
}

// ============ User Types ============

interface UpdateUserRequest {
  name?: string | null;
  avatarUrl?: string | null;
  defaultAddress?: string | null;
  defaultPlaceId?: string | null;
  defaultFuzzyLocation?: boolean;
}

// ============ Event Types ============

interface ParticipantSummary {
  id: string;
  name: string;
  color: string;
  isOrganizer: boolean;
}

interface UserEventSummary {
  id: string;
  title: string;
  meetingTime: string | null;
  publishedAt: string | null;
  createdAt: string;
  participantCount: number;
  participants: ParticipantSummary[];
}

interface UserEvent {
  id: string;
  role: 'organizer' | 'participant';
  participantId: string | null;
  createdAt: string;
  event: UserEventSummary;
}

interface UserEventsListResponse {
  events: UserEvent[];
}

interface ClaimEventRequest {
  eventId: string;
  participantToken: string;
}

interface ClaimEventResponse {
  success: true;
  userEvent: {
    id: string;
    role: 'organizer' | 'participant';
    participantId: string | null;
    eventId: string;
    createdAt: string;
  };
}

// ============ Error Types ============

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

type AuthErrorCode =
  | 'EMAIL_EXISTS' // 409 - Registration (email already taken)
  | 'INVALID_CREDENTIALS' // 401 - Login (wrong email/password)
  | 'UNAUTHORIZED' // 401 - Session expired or missing
  | 'VALIDATION_ERROR' // 400 - Invalid input format
  | 'FORBIDDEN' // 403 - Invalid participant token
  | 'EVENT_NOT_FOUND'; // 404 - Event doesn't exist
```

---

## Integration Patterns

### 1. Auth Context (React Example)

```typescript
interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>(null!);

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data?.user ?? null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error('Login failed');
    const { user } = await res.json();
    setUser(user);
  };

  // ... register, logout similar

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### 2. Combining Token Auth and Session Auth

For backwards compatibility, the backend supports both:

- **Token auth** (`Authorization: Bearer pt_...`) for event operations
- **Session auth** (cookie) for user account operations

```typescript
// Event-specific operations still use token header
async function updateEvent(eventId: string, token: string, data: object) {
  return fetch(`/api/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`, // Event token
    },
    credentials: 'include', // Session cookie also sent
    body: JSON.stringify(data),
  });
}

// User operations use session only
async function updateProfile(data: object) {
  return fetch('/api/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Session cookie
    body: JSON.stringify(data),
  });
}
```

### 3. Post-Login Event Claiming

```typescript
async function onLoginSuccess(user: User) {
  // 1. Get stored participant tokens from localStorage
  const storedEvents = getAllStoredEventTokens();

  // 2. Claim each one
  for (const { eventId, participantToken } of storedEvents) {
    try {
      await fetch('/api/users/me/events/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventId, participantToken }),
      });
      // Success - remove from localStorage
      removeEventToken(eventId);
    } catch {
      // Token might be invalid or already claimed - ignore
    }
  }

  // 3. Redirect to dashboard
  router.push('/dashboard');
}
```

---

## Migration Checklist

- [ ] Configure fetch/axios to include credentials
- [ ] Add `/api/auth/session` check on app initialization
- [ ] Create login/register forms
- [ ] Add logout button to user menu
- [ ] Implement user profile page with `/api/users/me`
- [ ] Add event claiming after login
- [ ] Create user events dashboard with `/api/users/me/events`
- [ ] Handle 401 errors globally (redirect to login)

---

## Error Handling

```typescript
async function handleApiCall<T>(request: Promise<Response>): Promise<T> {
  const response = await request;

  if (response.status === 401) {
    // Session expired or not authenticated
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Request failed');
  }

  return response.json();
}
```
