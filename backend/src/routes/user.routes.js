const router = require('express').Router();
const { listMyPosts, getUserById, listUsers, updateUserRole, deleteUser } = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth');
const { validateRoleUpdate, validateUserIdParam } = require('../middleware/validation');

// Admin user management
router.get('/', protect, authorize('admin'), listUsers);
router.patch('/:id/role', protect, authorize('admin'), validateUserIdParam, validateRoleUpdate, updateUserRole);
router.delete('/:id', protect, authorize('admin'), validateUserIdParam, deleteUser);

// Existing user endpoints
router.get('/me/posts', protect, listMyPosts);
router.get('/:id', protect, getUserById);

module.exports = router;


