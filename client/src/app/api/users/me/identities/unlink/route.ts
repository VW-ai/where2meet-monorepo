/**
 * Unlink Identity API Route
 * POST /api/users/me/identities/unlink - Unlink an authentication provider
 */

import { handleUnlinkIdentity } from '@/features/user/api/handlers/unlink';

export { handleUnlinkIdentity as POST };
