/**
 * Login API Route
 * POST /api/auth/login - Authenticate user and create session
 */

import { handleLogin } from '@/features/auth/api/handlers/login';

export { handleLogin as POST };
