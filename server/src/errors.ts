export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "EVENT_NOT_FOUND"
  | "PARTICIPANT_NOT_FOUND"
  | "EVENT_ALREADY_PUBLISHED"
  | "FEATURE_NOT_AVAILABLE"
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
