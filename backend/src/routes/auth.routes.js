const router = require('express').Router();
const { register, login, me, updateProfile, logout } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', protect, me);
router.put('/me', protect, updateProfile);
router.post('/logout', logout);

module.exports = router;


