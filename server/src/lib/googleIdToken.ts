/**
 * Google ID token verification.
 *
 * Google Identity Services hands the browser (and later the iOS app) a
 * Google-signed JWT. Checking its signature, issuer, audience and expiry here
 * is the whole proof of identity, so nothing past this module trusts the raw
 * token.
 * @module lib/googleIdToken
 */

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { UnauthorizedError } from "../types/errors.js";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_CERTS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

/**
 * The account a verified Google ID token speaks for.
 */
export interface GoogleIdentity {
  /** Google's stable account ID; emails can change, this cannot. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/**
 * Turns a Google ID token into the identity it proves.
 * Rejects with UnauthorizedError for any token that does not verify.
 */
export type GoogleIdTokenVerifier = (credential: string) => Promise<GoogleIdentity>;

const GoogleIdTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().min(1),
  // Google has sent this claim as the string "true" in some token versions.
  email_verified: z.union([z.boolean(), z.literal("true").transform(() => true)]).default(false),
  name: z.string().optional(),
  picture: z.string().optional(),
});

/**
 * Created on first use and shared, so the key cache survives across requests
 * and tests that inject their own keys never touch the network.
 */
let googleKeys: JWTVerifyGetKey | undefined;

function getGoogleKeys(): JWTVerifyGetKey {
  googleKeys ??= createRemoteJWKSet(GOOGLE_CERTS_URL);
  return googleKeys;
}

/**
 * Creates a verifier bound to our OAuth client ID.
 * @param options - Verifier options
 * @param options.clientId - The OAuth client ID tokens must be issued for
 * @param options.getKey - Signing key lookup; defaults to Google's published keys
 * @returns A verifier for Google ID tokens
 */
export function createGoogleIdTokenVerifier({
  clientId,
  getKey,
}: {
  clientId: string;
  getKey?: JWTVerifyGetKey;
}): GoogleIdTokenVerifier {
  return async (credential) => {
    try {
      const { payload } = await jwtVerify(credential, getKey ?? getGoogleKeys(), {
        issuer: GOOGLE_ISSUERS,
        audience: clientId,
        algorithms: ["RS256"],
      });
      const claims = GoogleIdTokenPayloadSchema.parse(payload);
      return {
        sub: claims.sub,
        email: claims.email,
        emailVerified: claims.email_verified,
        name: claims.name ?? null,
        picture: claims.picture ?? null,
      };
    } catch {
      // The reason (bad signature, wrong audience, expired) stays server-side;
      // the client can do nothing different with it.
      throw new UnauthorizedError("Invalid Google credential");
    }
  };
}
