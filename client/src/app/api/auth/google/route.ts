/**
 * Google Sign-In API Route
 * POST /api/auth/google - Exchange a Google ID token for a session
 */

import { handleGoogle } from '@/features/auth/api/handlers/google';

export { handleGoogle as POST };
