/**
 * Session API Route
 * GET /api/auth/session - Get current user from session
 */

import { handleGetSession } from '@/features/auth/api/handlers/session';

export { handleGetSession as GET };
