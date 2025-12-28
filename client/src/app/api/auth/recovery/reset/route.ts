/**
 * Password Recovery Reset API Route
 * POST /api/auth/recovery/reset - Reset password with token
 */

import { handleRecoveryReset } from '@/features/auth/api/handlers/recovery-reset';

export { handleRecoveryReset as POST };
