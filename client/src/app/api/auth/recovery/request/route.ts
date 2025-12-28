/**
 * Password Recovery Request API Route
 * POST /api/auth/recovery/request - Request password reset email
 */

import { handleRecoveryRequest } from '@/features/auth/api/handlers/recovery-request';

export { handleRecoveryRequest as POST };
