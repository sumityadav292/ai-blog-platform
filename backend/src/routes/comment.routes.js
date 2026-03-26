const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { validateComment, validateCommentUpdate, validateCommentReaction, validateCommentModerate } = require('../middleware/validation');
const { addComment, getComments, toggleReaction, updateComment, deleteComment, moderate, getAllComments } = require('../controllers/comment.controller');

// Admin route to get all comments - must be before /:postId
router.get('/', protect, authorize('admin'), getAllComments);
router.get('/:postId', getComments);
router.post('/', protect, validateComment, addComment);
router.put('/:id', protect, validateCommentUpdate, updateComment);
router.delete('/:id', protect, deleteComment);
router.post('/:id/react', protect, validateCommentReaction, toggleReaction);
router.put('/:id/moderate', protect, authorize('admin'), validateCommentModerate, moderate);

module.exports = router;


