const { z } = require("zod");

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  org_name: z.string().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(10),
});

const resetSchema = z.object({
  email: z.string().email(),
  redirect_to: z.string().url().optional(),
});

module.exports = { signupSchema, loginSchema, refreshSchema, resetSchema };
