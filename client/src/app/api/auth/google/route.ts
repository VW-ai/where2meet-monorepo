/**
 * Google OAuth Initiation API Route
 * GET /api/auth/google - Initiate Google OAuth flow
 */

import { handleGoogleOAuth } from '@/features/auth/api/handlers/oauth-google';

export { handleGoogleOAuth as GET };
