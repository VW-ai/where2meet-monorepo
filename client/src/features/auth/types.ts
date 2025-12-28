export interface User {
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

export interface RegisterDTO {
  email: string;
  password: string;
  name?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface UpdateUserDTO {
  name?: string;
  defaultAddress?: string;
  defaultPlaceId?: string;
  defaultFuzzyLocation?: boolean;
  avatarUrl?: string;
}

export interface ClaimTokenDTO {
  eventId: string;
  participantToken: string;
}

// For future OAuth support (Phase 2)
export interface UserIdentity {
  id: string;
  userId: string;
  provider: 'email' | 'google' | 'github';
  providerId: string;
  createdAt: string;
}

export interface EmailIdentity extends UserIdentity {
  provider: 'email';
  passwordHash: string;
}

export interface Session {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: string;
  createdAt: string;
}

export interface UserEvent {
  id: string;
  userId: string;
  eventId: string;
  participantId: string | null;
  role: 'organizer' | 'participant';
  createdAt: string;
}

export interface OAuthState {
  id: string;
  provider: 'google' | 'github';
  state: string;
  redirectUrl: string;
  expiresAt: string;
  createdAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  used: boolean;
}

export interface UsersData {
  users: Record<string, User>;
  identities: Record<string, UserIdentity | EmailIdentity>;
}

export interface SessionsData {
  sessions: Record<string, Session>;
}

export interface UserEventsData {
  userEvents: Record<string, UserEvent>;
}

export interface OAuthStatesData {
  states: Record<string, OAuthState>;
}

export interface PasswordResetTokensData {
  tokens: Record<string, PasswordResetToken>;
}
