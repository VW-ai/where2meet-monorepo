import { NextRequest, NextResponse } from 'next/server';
import { authPersistence } from '@/mock-server/auth-persistence';

export async function GET(request: NextRequest) {
  try {
    // Get redirect URL from query params (where to send user after OAuth completes)
    const redirectUrl = request.nextUrl.searchParams.get('redirect') || '/dashboard';

    // Create OAuth state token for CSRF protection
    const oauthState = await authPersistence.createOAuthState('github', redirectUrl);

    // Redirect to mock OAuth consent page
    const mockOAuthUrl = new URL('/auth/oauth-mock', request.url);
    mockOAuthUrl.searchParams.set('provider', 'github');
    mockOAuthUrl.searchParams.set('state', oauthState.state);

    return NextResponse.redirect(mockOAuthUrl);
  } catch (error) {
    console.error('Error initiating GitHub OAuth:', error);
    return NextResponse.json(
      { error: { code: 'OAUTH_ERROR', message: 'Failed to initiate OAuth' } },
      { status: 500 }
    );
  }
}
