/**
 * Base application error with standardized error codes.
 *
 * All custom errors should extend this class to ensure consistent
 * error handling and response formatting across the application.
 * @example
 * ```typescript
 * throw new AppError("Something went wrong", 500, "CUSTOM_ERROR");
 * ```
 */
export class AppError extends Error {
  /** HTTP status code to return */
  public readonly statusCode: number;
  /** Machine-readable error code */
  public readonly code: string;
  /** Whether this is an expected operational error vs programming error */
  public readonly isOperational: boolean;

  /**
   * Creates a new AppError instance.
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code (e.g., 400, 404, 500)
   * @param code - Machine-readable error code (e.g., "NOT_FOUND")
   * @param isOperational - True for expected errors, false for bugs (default: true)
   */
  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Error for invalid input data (HTTP 400).
 * @example
 * ```typescript
 * throw new ValidationError("Email format is invalid");
 * ```
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

/**
 * Error for resources that don't exist (HTTP 404).
 * @example
 * ```typescript
 * throw new NotFoundError("User");
 * // Results in: "User not found"
 * ```
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

/**
 * Error for missing or invalid authentication (HTTP 401).
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

/**
 * Error for authenticated users lacking permission (HTTP 403).
 */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

/**
 * Error for conflicting resource state (HTTP 409).
 * @example
 * ```typescript
 * throw new ConflictError("Email already registered");
 * ```
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

/**
 * Error for unexpected server failures (HTTP 500).
 * Marked as non-operational since these typically indicate bugs.
 */
export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(message, 500, "INTERNAL_ERROR", false);
  }
}

// ============================================================================
// Business-specific errors
// ============================================================================

/**
 * Error when an event cannot be found by ID.
 * @example
 * ```typescript
 * throw new EventNotFoundError("abc-123");
 * // Results in: "Event abc-123 not found"
 * ```
 */
export class EventNotFoundError extends AppError {
  constructor(eventId?: string) {
    super(
      eventId ? `Event ${eventId} not found` : "Event not found",
      404,
      "EVENT_NOT_FOUND"
    );
  }
}

/**
 * Error when a participant cannot be found by ID.
 */
export class ParticipantNotFoundError extends AppError {
  constructor(participantId?: string) {
    super(
      participantId
        ? `Participant ${participantId} not found`
        : "Participant not found",
      404,
      "PARTICIPANT_NOT_FOUND"
    );
  }
}

/**
 * Error when geocoding fails for an address.
 */
export class AddressNotFoundError extends AppError {
  constructor(address?: string) {
    super(
      address
        ? `Could not geocode address: ${address}`
        : "Address not found",
      400,
      "ADDRESS_NOT_FOUND"
    );
  }
}

/**
 * Error when attempting to modify a published event.
 */
export class EventAlreadyPublishedError extends AppError {
  constructor() {
    super("Event has already been published", 409, "EVENT_ALREADY_PUBLISHED");
  }
}

/**
 * Error when an external service (e.g., Google Maps) fails.
 * @example
 * ```typescript
 * throw new ExternalServiceError("Google Maps", "API quota exceeded");
 * ```
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message ?? `External service error: ${service}`,
      502,
      "EXTERNAL_SERVICE_ERROR"
    );
  }
}

// ============================================================================
// Response types
// ============================================================================

/**
 * Standardized error response format returned by the API.
 */
export interface ErrorResponse {
  error: {
    /** Machine-readable error code */
    code: string;
    /** Human-readable error message */
    message: string;
  };
}

/**
 * Creates a standardized error response object from an AppError.
 * @param error - The AppError to convert
 * @returns Formatted error response object
 * @example
 * ```typescript
 * const response = createErrorResponse(new NotFoundError("User"));
 * // { error: { code: "NOT_FOUND", message: "User not found" } }
 * ```
 */
export function createErrorResponse(error: AppError): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
    },
  };
}
