/**
 * Claim Event API Route
 * POST /api/users/me/events/claim - Link anonymous event to user account
 */

import { handleClaimEvent } from '@/features/user/api/handlers/claim-event';

export { handleClaimEvent as POST };
