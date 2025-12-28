/**
 * Claim Token API Route
 * POST /api/auth/claim-token - Link an event to user account via token
 */

import { handleClaimToken } from '@/features/auth/api/handlers/claim-token';

export { handleClaimToken as POST };
