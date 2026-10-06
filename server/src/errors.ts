export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "EMAIL_EXISTS"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "EVENT_NOT_FOUND"
  | "PARTICIPANT_NOT_FOUND"
  | "EVENT_ALREADY_PUBLISHED"
  | "EVENT_NOT_PUBLISHED"
  | "ADDRESS_NOT_FOUND"
  | "EXTERNAL_SERVICE_ERROR"
  | "NOT_FOUND"
  | "CONFLICT";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}
