import { body } from 'express-validator';

/**
 * Sanitization middleware for user registration
 */
export const sanitizeRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .trim()
    .escape(),
  body('username')
    .isLength({ min: 3, max: 50 })
    .trim()
    .escape()
    .matches(/^[a-zA-Z0-9_]+$/),
  body('password')
    .isLength({ min: 8 })
    .trim(),
  body('fullName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .trim()
    .escape(),
];

/**
 * Sanitization middleware for login
 */
export const sanitizeLogin = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .trim()
    .escape(),
  body('username')
    .optional()
    .isLength({ min: 3, max: 50 })
    .trim()
    .escape()
    .matches(/^[a-zA-Z0-9_]+$/),
  body('password')
    .isLength({ min: 1 })
    .trim(),
];

/**
 * Sanitization middleware for password change
 */
export const sanitizePasswordChange = [
  body('oldPassword')
    .isLength({ min: 1 })
    .trim(),
  body('newPassword')
    .isLength({ min: 8 })
    .trim(),
];

/**
 * Sanitization middleware for password reset
 */
export const sanitizePasswordReset = [
  body('resetToken')
    .isLength({ min: 1 })
    .trim()
    .escape(),
  body('newPassword')
    .isLength({ min: 8 })
    .trim(),
];

/**
 * Sanitization middleware for username update
 */
export const sanitizeUsernameUpdate = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .trim()
    .escape()
    .matches(/^[a-zA-Z0-9_]+$/),
];