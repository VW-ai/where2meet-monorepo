/**
 * Register Handler
 * POST /api/auth/register - Create new user account
 */

import { NextRequest, NextResponse } from 'next/server';
import { authPersistence } from '@/mock-server/auth-persistence';
import { User, UsersData, EmailIdentity } from '@/features/auth/types';

export async function handleRegister(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required',
          },
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
          },
        },
        { status: 400 }
      );
    }

    // Validate password requirements (min 8 characters)
    if (password.length < 8) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Password must be at least 8 characters',
          },
        },
        { status: 400 }
      );
    }

    // Load existing users
    const usersData = (await authPersistence.getUsers()) as UsersData;

    // Check if email already exists
    const existingIdentity = Object.values(usersData.identities).find(
      (identity): identity is EmailIdentity =>
        identity.provider === 'email' && identity.providerId === email
    );

    if (existingIdentity) {
      return NextResponse.json(
        {
          error: {
            code: 'EMAIL_EXISTS',
            message: 'An account with this email already exists',
          },
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await authPersistence.hashPassword(password);

    // Create user
    const userId = authPersistence.generateId('usr');
    const now = new Date().toISOString();

    const user: User = {
      id: userId,
      email,
      name: name || null,
      avatarUrl: null,
      emailVerified: false,
      defaultAddress: null,
      defaultPlaceId: null,
      defaultFuzzyLocation: false,
      createdAt: now,
      updatedAt: now,
    };

    // Create identity
    const identityId = authPersistence.generateId('ident');
    const identity: EmailIdentity = {
      id: identityId,
      userId,
      provider: 'email',
      providerId: email,
      passwordHash,
      createdAt: now,
    };

    // Save user and identity
    usersData.users[userId] = user;
    usersData.identities[identityId] = identity;
    await authPersistence.saveUsers(usersData);

    // Create session
    const sessionId = authPersistence.generateId('ses');
    const sessionToken = authPersistence.generateSessionToken();
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

    // Set HTTP-only session cookie
    const response = NextResponse.json({ user });
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return response;
  } catch (error) {
    console.error('[API] Error registering user:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to register user',
        },
      },
      { status: 500 }
    );
  }
}
