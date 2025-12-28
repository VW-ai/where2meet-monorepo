/**
 * Login Handler
 * POST /api/auth/login - Authenticate user and create session
 */

import { NextRequest, NextResponse } from 'next/server';
import { authPersistence } from '@/mock-server/auth-persistence';
import { UsersData, EmailIdentity } from '@/features/auth/types';

export async function handleLogin(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

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

    // Load users and identities
    const usersData = (await authPersistence.getUsers()) as UsersData;

    // Find identity by email
    const identity = Object.values(usersData.identities).find(
      (ident): ident is EmailIdentity => ident.provider === 'email' && ident.providerId === email
    );

    if (!identity) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await authPersistence.verifyPassword(password, identity.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    // Get user
    const user = usersData.users[identity.userId];

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User account not found',
          },
        },
        { status: 404 }
      );
    }

    // Create new session
    const sessionId = authPersistence.generateId('ses');
    const sessionToken = authPersistence.generateSessionToken();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const session = {
      id: sessionId,
      userId: user.id,
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
    console.error('[API] Error logging in user:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to log in',
        },
      },
      { status: 500 }
    );
  }
}
