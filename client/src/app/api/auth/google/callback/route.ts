import { NextRequest, NextResponse } from 'next/server';
import { authPersistence } from '@/mock-server/auth-persistence';
import { User, OAuthState, UsersData, UserIdentity } from '@/types/user';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateToken = searchParams.get('state');

    // Validate parameters
    if (!code || !stateToken) {
      return NextResponse.redirect(new URL('/auth/signin?error=oauth_error', request.url));
    }

    // Validate OAuth state
    const oauthState = await authPersistence.validateOAuthState(stateToken, 'google');
    if (!oauthState) {
      return NextResponse.redirect(new URL('/auth/signin?error=oauth_state_invalid', request.url));
    }

    const { id: stateId, redirectUrl: stateRedirectUrl } = oauthState as OAuthState;

    // Decode mock OAuth profile from code
    let mockProfile;
    try {
      mockProfile = JSON.parse(atob(code));
    } catch {
      return NextResponse.redirect(new URL('/auth/signin?error=oauth_error', request.url));
    }

    const { email, name, providerId } = mockProfile;

    // Load users data
    const usersData = (await authPersistence.getUsers()) as UsersData;

    // Check if identity already exists with this provider + providerId
    const existingOAuthIdentity = Object.values(usersData.identities).find(
      (ident): ident is UserIdentity =>
        ident.provider === 'google' && ident.providerId === providerId
    );

    let userId: string;
    let user: User;

    if (existingOAuthIdentity) {
      // User already has Google identity - just log them in
      userId = existingOAuthIdentity.userId;
      user = usersData.users[userId];

      if (!user) {
        return NextResponse.redirect(new URL('/auth/signin?error=user_not_found', request.url));
      }
    } else {
      // Check if user exists with this email (any provider)
      const existingEmailIdentity = Object.values(usersData.identities).find(
        (ident): ident is UserIdentity => ident.provider === 'email' && ident.providerId === email
      );

      if (existingEmailIdentity) {
        // User exists with email - link Google identity to existing user
        userId = existingEmailIdentity.userId;
        user = usersData.users[userId];

        if (!user) {
          return NextResponse.redirect(new URL('/auth/signin?error=user_not_found', request.url));
        }

        // Create new Google identity linked to existing user
        const now = new Date().toISOString();
        const identityId = authPersistence.generateId('ident');
        const newIdentity: UserIdentity = {
          id: identityId,
          userId,
          provider: 'google',
          providerId,
          createdAt: now,
        };

        usersData.identities[identityId] = newIdentity;
        await authPersistence.saveUsers(usersData);
      } else {
        // New user - create user and Google identity
        const now = new Date().toISOString();
        userId = authPersistence.generateId('usr');

        user = {
          id: userId,
          email,
          name: name || null,
          avatarUrl: null,
          emailVerified: true, // OAuth emails are pre-verified
          defaultAddress: null,
          defaultPlaceId: null,
          defaultFuzzyLocation: false,
          createdAt: now,
          updatedAt: now,
        };

        const identityId = authPersistence.generateId('ident');
        const identity: UserIdentity = {
          id: identityId,
          userId,
          provider: 'google',
          providerId,
          createdAt: now,
        };

        usersData.users[userId] = user;
        usersData.identities[identityId] = identity;
        await authPersistence.saveUsers(usersData);
      }
    }

    // Create session
    const sessionId = authPersistence.generateId('ses');
    const sessionToken = authPersistence.generateSessionToken();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const session = {
      id: sessionId,
      userId,
      sessionToken,
      expiresAt,
      createdAt: now,
    };

    const sessionsData = await authPersistence.getSessions();
    sessionsData.sessions[sessionId] = session;
    await authPersistence.saveSessions(sessionsData);

    // Delete OAuth state (single-use)
    await authPersistence.deleteOAuthState(stateId);

    // Redirect to dashboard with session cookie
    const redirectUrl = new URL(stateRedirectUrl, request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return response;
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    return NextResponse.redirect(new URL('/auth/signin?error=oauth_error', request.url));
  }
}
