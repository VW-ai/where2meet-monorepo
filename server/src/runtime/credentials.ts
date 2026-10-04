import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newParticipantCredential() {
  const token = `pt_${randomBytes(32).toString("hex")}`;
  return { token, hash: hashToken(token), participantId: randomUUID() };
}

export function newEventId(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const suffix = Array.from({ length: 16 }, () => alphabet.charAt(randomInt(alphabet.length))).join(
    ""
  );
  return `evt_${String(Date.now())}_${suffix}`;
}
