import { NextResponse } from 'next/server';
import { authPersistence } from '@/mock-server/auth-persistence';
import { cookies } from 'next/headers';
import { SessionsData, Session, UsersData, UserIdentity } from '@/types/user';

export async function GET() {
  try {
    // Get session token from cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Find session
    const sessionsData = (await authPersistence.getSessions()) as SessionsData;
    const session = Object.values(sessionsData.sessions).find(
      (s: Session) => s.sessionToken === sessionToken
    );

    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid session' } },
        { status: 401 }
      );
    }

    // Check if session expired
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: { code: 'SESSION_EXPIRED', message: 'Session has expired' } },
        { status: 401 }
      );
    }

    const userId = session.userId;

    // Get user's identities
    const usersData = (await authPersistence.getUsers()) as UsersData;
    const identities = Object.values(usersData.identities)
      .filter((ident: UserIdentity) => ident.userId === userId)
      .map((ident: UserIdentity) => ({
        id: ident.id,
        provider: ident.provider,
        providerId: ident.providerId,
        createdAt: ident.createdAt,
      }));

    return NextResponse.json({ identities });
  } catch (error) {
    console.error('Error fetching identities:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch identities' } },
      { status: 500 }
    );
  }
}
