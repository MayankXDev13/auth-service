import { z } from 'zod';

// Sanitization helpers — previously in express-validator chains (sanitize.middleware.ts)
// Now owned by Zod schemas via transforms (deep module hides sanitization)
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Deep validation: schemas own sanitization (trim, normalize, escape, regex) — single pipeline, no express-validator
export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform(v => escapeHtml(v))
    .pipe(z.string().email('Invalid email format')),
  username: z
    .string()
    .trim()
    .transform(v => escapeHtml(v))
    .pipe(
      z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username cannot exceed 50 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    ),
  password: z
    .string()
    .trim()
    .pipe(
      z
        .string()
        .min(8, 'Password must be at least 8 characters long')
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        )
    ),
});

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .transform(v => escapeHtml(v))
      .pipe(z.string().email('Invalid email format'))
      .optional(),
    username: z
      .string()
      .trim()
      .transform(v => escapeHtml(v))
      .pipe(z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'))
      .optional(),
    password: z.string().trim().pipe(z.string().min(1, 'Password is required')),
  })
  .refine(data => data.email || data.username, {
    message: 'Either email or username is required',
    path: ['email'],
  });

export const changePasswordSchema = z.object({
  oldPassword: z.string().trim().pipe(z.string().min(1, 'Old password is required')),
  newPassword: z
    .string()
    .trim()
    .pipe(
      z
        .string()
        .min(8, 'Password must be at least 8 characters long')
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        )
    ),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().transform(v => escapeHtml(v)).pipe(z.string().email('Invalid email format')),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().trim().pipe(
    z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      )
  ),
});

export const assignRoleSchema = z.object({
  role: z.enum(['admin', 'user'], {
    message: "Role must be either 'admin' or 'user'",
  }),
});

export const avatarUrlSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

export const updateUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .transform(v => escapeHtml(v))
    .pipe(
      z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username cannot exceed 50 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    ),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type AvatarUrlInput = z.infer<typeof avatarUrlSchema>;
export type UpdateUsernameInput = z.infer<typeof updateUsernameSchema>;
