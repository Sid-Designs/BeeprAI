import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters.")
    .max(100, "Organization name too long.")
    .trim(),
  industry: z.string().max(100).trim().optional().default(""),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  industry: z.string().max(100).trim().optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "agentManager", "viewer"], {
    errorMap: () => ({ message: "Role must be admin, agentManager, or viewer." }),
  }),
});
