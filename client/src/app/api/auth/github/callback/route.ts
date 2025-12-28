/**
 * GitHub OAuth Callback API Route
 * GET /api/auth/github/callback - Handle GitHub OAuth callback
 */

import { handleGitHubOAuthCallback } from '@/features/auth/api/handlers/oauth-github-callback';

export { handleGitHubOAuthCallback as GET };
