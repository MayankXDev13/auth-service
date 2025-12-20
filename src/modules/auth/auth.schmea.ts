import { z } from "zod";

export const registerSchema = z.object({
  email: z.string(),
  password: z.string().min(8),
  name: z.string().min(2),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
