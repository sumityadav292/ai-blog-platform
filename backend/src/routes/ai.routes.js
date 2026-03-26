const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validateAI } = require('../middleware/validation');
const { generate, testConnection } = require('../controllers/ai.controller');

router.post('/generate', protect, validateAI, generate);
router.get('/test', protect, testConnection);

module.exports = router;


