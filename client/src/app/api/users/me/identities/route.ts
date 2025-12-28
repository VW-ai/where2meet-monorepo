/**
 * User Identities API Route
 * GET /api/users/me/identities - Get all identities for current user
 */

import { handleGetIdentities } from '@/features/user/api/handlers/identities';

export { handleGetIdentities as GET };
