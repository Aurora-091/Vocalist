const express = require("express");

const authMiddleware = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");
const controller = require("./agent.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/", requireRole("owner", "admin", "ops"), controller.list);
router.post("/", requireRole("owner", "admin"), controller.create);

router.get("/:id", requireRole("owner", "admin", "ops"), controller.get);
router.patch("/:id", requireRole("owner", "admin"), controller.update);
router.delete("/:id", requireRole("owner", "admin"), controller.remove);

router.patch("/:id/persona", requireRole("owner", "admin"), controller.updatePersona);

router.get("/:id/voice", requireRole("owner", "admin", "ops"), controller.getVoice);
router.patch("/:id/voice", requireRole("owner", "admin"), controller.updateVoice);

router.get(
  "/:id/configuration",
  requireRole("owner", "admin", "ops"),
  controller.getConfiguration
);

module.exports = router;
