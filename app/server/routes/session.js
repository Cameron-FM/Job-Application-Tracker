const express = require('express');
const session = require('../session');

// Mounted at /api/session. See server/session.js for the lifecycle design.
const router = express.Router();

router.post('/start', (req, res) => {
  res.json({ sessionId: session.registerSession() });
});

router.post('/heartbeat', (req, res) => {
  res.json(session.heartbeat(req.body && req.body.sessionId));
});

module.exports = router;
