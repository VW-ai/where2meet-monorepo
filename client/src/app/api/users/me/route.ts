/**
 * User Profile API Routes
 * GET /api/users/me - Get current user profile
 * PATCH /api/users/me - Update user profile
 */

import { handleGetProfile, handleUpdateProfile } from '@/features/user/api/handlers/profile';

export { handleGetProfile as GET, handleUpdateProfile as PATCH };
