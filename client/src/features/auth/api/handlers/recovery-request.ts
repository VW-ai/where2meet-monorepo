/**
 * Password Recovery Request Handler
 * POST /api/auth/recovery/request - Request password reset email
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeAuthUserRequest } from '@/lib/api/auth-user-router';
import { authPersistence } from '@/mock-server/auth-persistence';
import { UsersData, EmailIdentity, PasswordResetTokensData } from '@/features/auth/types';

/**
 * Mock implementation - uses local file storage
 */
async function handleRecoveryRequestMock(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email is required',
          },
        },
        { status: 400 }
      );
    }

    // Load users
    const usersData = (await authPersistence.getUsers()) as UsersData;

    // Find user by email
    const identity = Object.values(usersData.identities).find(
      (ident): ident is EmailIdentity => ident.provider === 'email' && ident.providerId === email
    );

    // Always return success to prevent email enumeration
    if (identity) {
      const userId = identity.userId;

      // Generate reset token
      const resetTokenId = authPersistence.generateId('prt');
      const resetToken = authPersistence.generateSessionToken();
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      const tokenData = {
        id: resetTokenId,
        userId,
        token: resetToken,
        expiresAt,
        createdAt: now,
        used: false,
      };

      // Save reset token
      const resetTokensData = (await authPersistence.getResetTokens()) as PasswordResetTokensData;
      resetTokensData.tokens[resetTokenId] = tokenData;
      await authPersistence.saveResetTokens(resetTokensData);

      // Mock email - log reset link to console
      const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
      console.warn('\n=== PASSWORD RESET EMAIL (MOCK) ===');
      console.warn(`To: ${email}`);
      console.warn(`Reset link: ${resetLink}`);
      console.warn(`Token expires in 1 hour`);
      console.warn('===================================\n');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error requesting password reset:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to request password reset',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Main handler - routes to mock or real backend based on configuration
 */
export async function handleRecoveryRequest(request: NextRequest): Promise<NextResponse> {
  return routeAuthUserRequest(request, 'auth', '/recovery/request', handleRecoveryRequestMock);
}
