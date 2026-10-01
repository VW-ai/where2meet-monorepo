/**
 * Error redaction for logs.
 *
 * Driver errors can carry secrets and user data: ioredis attaches the failed
 * command to a ReplyError (an AUTH failure includes the password in
 * `command.args`, cache commands include keys and cached values), and connection
 * errors may embed URLs with credentials. These helpers keep what is useful for
 * debugging (type, message, stack, command name) and drop those values.
 * @module lib/log-redaction
 */

import pino from "pino";

type SerializedError = ReturnType<typeof pino.stdSerializers.err>;

/** Matches the userinfo part of URLs such as redis://default:secret@host */
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi;

/**
 * Masks credentials embedded in URLs.
 * @param text - Text that may contain connection URLs
 * @returns The text with any `user:password@` replaced by `***@`
 */
export function scrubCredentials(text: string): string {
  return text.replace(URL_CREDENTIALS, "$1***@");
}

function redactSerialized(serialized: SerializedError): SerializedError {
  const safe: Record<string, unknown> = { ...serialized };

  if (typeof safe.message === "string") safe.message = scrubCredentials(safe.message);
  if (typeof safe.stack === "string") safe.stack = scrubCredentials(safe.stack);

  // Keep which command failed, never its arguments
  const command = safe.command;
  if (command && typeof command === "object") {
    safe.command = { name: (command as { name?: unknown }).name };
  }

  if (safe.cause && typeof safe.cause === "object") {
    safe.cause = redactSerialized(safe.cause as SerializedError);
  }

  return safe as SerializedError;
}

/**
 * Pino `err` serializer: the standard error serializer with secrets removed.
 * @param err - Value logged under the `err` key
 * @returns Serialized error safe to write to logs
 */
export function serializeError(err: unknown): unknown {
  if (!(err instanceof Error)) return err;
  return redactSerialized(pino.stdSerializers.err(err));
}

/**
 * One-line, credential-free description of an error for console logging.
 * @param err - Caught value
 * @returns `Name: message` with any URL credentials masked
 */
export function describeError(err: unknown): string {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return scrubCredentials(text);
}
