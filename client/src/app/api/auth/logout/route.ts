/**
 * Logout API Route
 * POST /api/auth/logout - Invalidate session and clear cookie
 */

import { handleLogout } from '@/features/auth/api/handlers/logout';

export { handleLogout as POST };
