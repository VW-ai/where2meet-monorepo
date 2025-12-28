/**
 * User Identities API Route
 * GET /api/users/me/identities - Get all identities for current user
 */

import { NextRequest } from 'next/server';
import { handleGetIdentities } from '@/features/user/api/handlers/identities';

export async function GET(request: NextRequest) {
  return handleGetIdentities(request);
}
