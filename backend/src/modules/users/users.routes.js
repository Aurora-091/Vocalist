const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { requireAdmin } = require("../../config/supabase");
const { Conflict, NotFound, BadRequest } = require("../../utils/errors");

const router = express.Router();

router.use(requireAuth, requireOrg);

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "ops"]).default("ops"),
});

const updateRoleSchema = z.object({
  role: z.enum(["owner", "admin", "ops"]),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("users")
      .select("id, email, role, created_at")
      .eq("org_id", req.auth.orgId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json({ users: data || [] });
  })
);

router.post(
  "/invite",
  requireRole("owner", "admin"),
  validate({ body: inviteSchema }),
  asyncHandler(async (req, res) => {
    const admin = requireAdmin();
    const { email, role } = req.body;

    const { data: created, error: createErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { org_id: req.auth.orgId, role },
    });
    if (createErr) {
      if (createErr.message?.toLowerCase().includes("already")) throw Conflict("User already exists");
      throw new Error(createErr.message);
    }

    const userId = created.user.id;
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { org_id: req.auth.orgId, role },
    });

    const { error: linkErr } = await admin
      .from("users")
      .upsert({ id: userId, org_id: req.auth.orgId, email, role });
    if (linkErr) throw new Error(linkErr.message);

    res.status(201).json({ user: { id: userId, email, role, org_id: req.auth.orgId } });
  })
);

router.patch(
  "/:id/role",
  requireRole("owner"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: updateRoleSchema,
  }),
  asyncHandler(async (req, res) => {
    const admin = requireAdmin();
    const { id } = req.params;

    const { data: existing, error: getErr } = await req.supabase
      .from("users")
      .select("id, org_id")
      .eq("id", id)
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!existing) throw NotFound("User not found");

    await admin.auth.admin.updateUserById(id, {
      app_metadata: { org_id: req.auth.orgId, role: req.body.role },
    });

    const { data, error } = await req.supabase
      .from("users")
      .update({ role: req.body.role })
      .eq("id", id)
      .eq("org_id", req.auth.orgId)
      .select("id, email, role")
      .single();
    if (error) throw error;
    res.json({ user: data });
  })
);

router.delete(
  "/:id",
  requireRole("owner"),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.auth.userId) {
      throw BadRequest("Cannot remove yourself");
    }

    const { data: existing, error: getErr } = await req.supabase
      .from("users")
      .select("id")
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!existing) throw NotFound("User not found in organization");

    const admin = requireAdmin();
    const { error } = await admin.auth.admin.deleteUser(req.params.id);
    if (error) throw new Error(error.message);
    res.status(204).end();
  })
);

module.exports = router;
