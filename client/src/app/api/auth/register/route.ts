/**
 * Register API Route
 * POST /api/auth/register - Create new user account
 */

import { handleRegister } from '@/features/auth/api/handlers/register';

export { handleRegister as POST };
