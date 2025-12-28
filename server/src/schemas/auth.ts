/**
 * Authentication validation schemas (Request DTOs).
 *
 * Zod schemas for validating auth-related API requests.
 * Response DTOs are defined in dto/.
 * @module schemas/auth
 */

import { z } from "zod";

/**
 * Minimum password length requirement.
 */
const PASSWORD_MIN_LENGTH = 8;

/**
 * Schema for user registration.
 */
export const RegisterSchema = z.object({
  email: z
    .email("Invalid email format")
    .max(255, "Email must be 255 characters or less")
    .transform((email) => email.toLowerCase().trim()),
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${String(PASSWORD_MIN_LENGTH)} characters`
    ),
  name: z.string().max(255, "Name must be 255 characters or less").optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

/**
 * Schema for user login.
 */
export const LoginSchema = z.object({
  email: z.email("Invalid email format").transform((email) => email.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
