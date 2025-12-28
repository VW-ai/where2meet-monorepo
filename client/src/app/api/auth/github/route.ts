/**
 * GitHub OAuth Initiation API Route
 * GET /api/auth/github - Initiate GitHub OAuth flow
 */

import { handleGitHubOAuth } from '@/features/auth/api/handlers/oauth-github';

export { handleGitHubOAuth as GET };
