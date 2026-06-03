const { z } = require("zod");

const createContactSchema = z.object({
  phone: z.string().min(4).max(40),
  default_country: z.string().length(2).optional(),
  name: z.string().max(160).optional(),
  email: z.string().email().optional(),
  source: z.enum(["shopify", "crm", "upload", "inbound"]).default("upload"),
  crm_ref: z.string().max(120).optional(),
});

const updateContactSchema = z.object({
  name: z.string().max(160).optional(),
  email: z.string().email().nullable().optional(),
  crm_ref: z.string().max(120).nullable().optional(),
});

const bulkCreateSchema = z.object({
  default_country: z.string().length(2).optional(),
  source: z.enum(["shopify", "crm", "upload", "inbound"]).default("upload"),
  contacts: z
    .array(
      z.object({
        phone: z.string().min(4).max(40),
        name: z.string().max(160).optional(),
        email: z.string().email().optional(),
        crm_ref: z.string().max(120).optional(),
      })
    )
    .min(1)
    .max(5000),
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  consent_status: z.enum(["granted", "none", "revoked"]).optional(),
  q: z.string().max(120).optional(),
});

module.exports = { createContactSchema, updateContactSchema, bulkCreateSchema, listSchema };
