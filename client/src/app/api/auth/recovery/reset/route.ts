/**
 * Password Recovery Reset API Route
 * POST /api/auth/recovery/reset - Reset password with token
 */

import { NextRequest, NextResponse } from 'next/server';
import { authPersistence } from '@/mock-server/auth-persistence';
import {
  PasswordResetTokensData,
  PasswordResetToken,
  UsersData,
  EmailIdentity,
  SessionsData,
  Session,
} from '@/types/user';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Token and new password are required',
          },
        },
        { status: 400 }
      );
    }

    // Validate password requirements
    if (newPassword.length < 8) {
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

    // Find reset token
    const resetTokensData = (await authPersistence.getResetTokens()) as PasswordResetTokensData;
    const tokenEntry = Object.entries(resetTokensData.tokens).find(
      ([_, tokenData]) => tokenData.token === token
    );

    if (!tokenEntry) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired reset token',
          },
        },
        { status: 400 }
      );
    }

    const [tokenId, resetToken] = tokenEntry as [string, PasswordResetToken];

    // Check if token is expired
    if (new Date(resetToken.expiresAt) < new Date()) {
      // Delete expired token
      delete resetTokensData.tokens[tokenId];
      await authPersistence.saveResetTokens(resetTokensData);

      return NextResponse.json(
        {
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Reset token has expired',
          },
        },
        { status: 400 }
      );
    }

    const userId = resetToken.userId;

    // Hash new password
    const newPasswordHash = await authPersistence.hashPassword(newPassword);

    // Update user's password in identity
    const usersData = (await authPersistence.getUsers()) as UsersData;
    const identity = Object.entries(usersData.identities).find(
      ([_, ident]): ident is [string, EmailIdentity] =>
        ident.provider === 'email' && ident.userId === userId
    );

    if (!identity) {
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
    }

    const [identityId, emailIdent] = identity as [string, EmailIdentity];
    (usersData.identities[identityId] as EmailIdentity).passwordHash = newPasswordHash;
    await authPersistence.saveUsers(usersData);

    // Invalidate all sessions for this user
    const sessionsData = (await authPersistence.getSessions()) as SessionsData;
    const sessionIdsToDelete = Object.entries(sessionsData.sessions)
      .filter(([_, session]): session is [string, Session] => session.userId === userId)
      .map(([sessionId]) => sessionId);

    sessionIdsToDelete.forEach((sessionId) => {
      delete sessionsData.sessions[sessionId];
    });
    await authPersistence.saveSessions(sessionsData);

    // Delete reset token
    delete resetTokensData.tokens[tokenId];
    await authPersistence.saveResetTokens(resetTokensData);

    console.warn(`[API] Password reset successful for user ${userId}. All sessions invalidated.`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error resetting password:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to reset password',
        },
      },
      { status: 500 }
    );
  }
}
