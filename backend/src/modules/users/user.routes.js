const express = require("express");

const authMiddleware = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");
const controller = require("./user.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/", requireRole("owner", "admin", "ops"), controller.list);
router.post("/invite", requireRole("owner", "admin"), controller.invite);
router.patch("/:id/role", requireRole("owner"), controller.updateRole);
router.delete("/:id", requireRole("owner", "admin"), controller.remove);

module.exports = router;
