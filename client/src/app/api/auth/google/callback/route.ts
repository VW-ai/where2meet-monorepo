/**
 * Google OAuth Callback API Route
 * GET /api/auth/google/callback - Handle Google OAuth callback
 */

import { handleGoogleOAuthCallback } from '@/features/auth/api/handlers/oauth-google-callback';

export { handleGoogleOAuthCallback as GET };
