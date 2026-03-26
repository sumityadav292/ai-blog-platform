const router = require('express').Router();
const { protect, protectOptional, authorize, canModifyPost } = require('../middleware/auth');
const { loadPostBySlug } = require('../middleware/post');
const { validateCreatePost, validateUpdatePost, validatePostReaction, validatePostStatus } = require('../middleware/validation');
const { createPost, getPosts, getPostBySlug, updatePost, deletePost, toggleReaction, setStatus, incrementViews } = require('../controllers/post.controller');

router.get('/', getPosts);
router.post('/', protect, validateCreatePost, createPost);
router.get('/:slug', getPostBySlug);
router.put('/:slug', protect, loadPostBySlug, canModifyPost, validateUpdatePost, updatePost);
router.delete('/:slug', protect, loadPostBySlug, canModifyPost, deletePost);
router.post('/:slug/react', protect, validatePostReaction, toggleReaction);
router.post('/:slug/views', protectOptional, incrementViews);
router.put('/:slug/status', protect, authorize('admin'), validatePostStatus, setStatus);

module.exports = router;


