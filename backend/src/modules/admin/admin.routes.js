const { Router } = require("express");
const { requireAuth } = require("../../middleware/auth.middleware");
const { requireSuperAdmin } = require("../../middleware/admin.middleware");
const adminService = require("./admin.service");
const asyncHandler = require("../../utils/asyncHandler");

const router = Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

router.get("/me", (_req, res) => {
  res.json({ platform_role: "super_admin" });
});

router.get("/stats", asyncHandler(async (_req, res) => {
  const stats = await adminService.getStats();
  res.json(stats);
}));

router.get("/recent-signups", asyncHandler(async (_req, res) => {
  const data = await adminService.getRecentSignups();
  res.json(data);
}));

router.get("/recent-errors", asyncHandler(async (_req, res) => {
  const data = await adminService.getRecentErrors();
  res.json(data);
}));

router.get("/users", asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, q = "" } = req.query;
  const result = await adminService.listUsers({ page: +page, limit: +limit, q });
  res.json(result);
}));

router.get("/users/:id", asyncHandler(async (req, res) => {
  const data = await adminService.getUserDetail(req.params.id);
  res.json(data);
}));

router.patch("/users/:id", asyncHandler(async (req, res) => {
  const data = await adminService.updateUser(req.params.id, req.body);
  res.json(data);
}));

router.get("/waitlist", asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, q = "", status = "" } = req.query;
  const result = await adminService.listWaitlist({ page: +page, limit: +limit, q, status });
  res.json(result);
}));

router.patch("/waitlist/:id", asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: { code: "validation_error", message: "Invalid status" } });
  }
  const data = await adminService.updateWaitlistStatus(req.params.id, status);
  res.json(data);
}));

router.post("/waitlist/bulk", asyncHandler(async (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !ids.length || !["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: { code: "validation_error", message: "Invalid request" } });
  }
  const data = await adminService.bulkUpdateWaitlist(ids, status);
  res.json({ updated: data.length });
}));

router.get("/agents", asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, q = "" } = req.query;
  const result = await adminService.listAgents({ page: +page, limit: +limit, q });
  res.json(result);
}));

router.get("/agents/:id", asyncHandler(async (req, res) => {
  const data = await adminService.getAgentDetail(req.params.id);
  res.json(data);
}));

router.get("/billing", asyncHandler(async (req, res) => {
  const { page = 1, limit = 25 } = req.query;
  const result = await adminService.listBilling({ page: +page, limit: +limit });
  res.json(result);
}));

router.get("/logs", asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, severity = "" } = req.query;
  const result = await adminService.listLogs({ page: +page, limit: +limit, severity });
  res.json(result);
}));

router.get("/settings", asyncHandler(async (_req, res) => {
  const data = await adminService.getSettings();
  res.json(data);
}));

router.patch("/settings", asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: { code: "validation_error", message: "Key required" } });
  const data = await adminService.updateSetting(key, value, req.auth.userId);
  res.json(data);
}));

module.exports = router;
