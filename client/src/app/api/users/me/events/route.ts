/**
 * User Events API Route
 * GET /api/users/me/events - Get all events for current user
 */

import { handleGetUserEvents } from '@/features/user/api/handlers/events';

export { handleGetUserEvents as GET };
