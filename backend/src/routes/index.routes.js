const express = require("express");

const authRoutes = require("../modules/auth/auth.routes");
const userRoutes = require("../modules/users/user.routes");
const agentRoutes = require("../modules/agents/agent.routes");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Aurora API Running",
  });
});

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

const v1 = express.Router();
v1.use("/auth", authRoutes);
v1.use("/users", userRoutes);
v1.use("/agents", agentRoutes);

router.use("/api/v1", v1);

module.exports = router;
