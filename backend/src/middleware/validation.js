const { body, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const validateRegister = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  handleValidationErrors
];

const validateCreatePost = [
  body('title').trim().isLength({ min: 1 }).withMessage('Title required'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content required'),
  body('category').optional().trim(),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('summary').optional().trim(),
  body('metaDescription').optional().trim(),
  body('status')
    .optional()
    .isIn(['draft', 'pending', 'published', 'rejected'])
    .withMessage('Invalid status'),
  handleValidationErrors,
];

const validateUpdatePost = [
  // Allow partial updates; only validate fields that are present.
  body('title').optional().trim().isLength({ min: 1 }).withMessage('Title required when provided'),
  body('content').optional().trim().isLength({ min: 1 }).withMessage('Content required when provided'),
  body('category').optional().trim(),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('summary').optional().trim(),
  body('metaDescription').optional().trim(),
  body('status')
    .optional()
    .isIn(['draft', 'pending', 'published', 'rejected'])
    .withMessage('Invalid status'),
  handleValidationErrors,
];

const validateComment = [
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Comment must be 1-2000 characters'),
  body('postId').isMongoId().withMessage('Valid post ID required'),
  body('parent').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Valid parent comment ID required'),
  handleValidationErrors
];

const validateCategory = [
  body('name').trim().isLength({ min: 1 }).withMessage('Category name required'),
  body('description').optional().trim(),
  handleValidationErrors
];

const validateAI = [
  body('prompt').trim().isLength({ min: 10 }).withMessage('Prompt must be at least 10 characters'),
  handleValidationErrors
];

const validatePostReaction = [
  body('action')
    .isIn(['like', 'dislike'])
    .withMessage('action must be like or dislike'),
  handleValidationErrors,
];

const validatePostStatus = [
  body('status')
    .isIn(['draft', 'pending', 'published', 'rejected'])
    .withMessage('Invalid status'),
  body('reason').optional().trim().isLength({ max: 1000 }).withMessage('Reason too long'),
  handleValidationErrors,
];

const validateCommentUpdate = [
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Comment must be 1-2000 characters'),
  handleValidationErrors,
];

const validateCommentReaction = [
  body('action')
    .isIn(['like', 'dislike'])
    .withMessage('action must be like or dislike'),
  handleValidationErrors,
];

const validateCommentModerate = [
  body('status').isIn(['visible', 'hidden']).withMessage('Invalid status'),
  handleValidationErrors,
];

const validateUserIdParam = [
  param('id').isMongoId().withMessage('Valid user ID required'),
  handleValidationErrors,
];

const validateRoleUpdate = [
  body('role').isIn(['admin', 'user']).withMessage('role must be admin or user'),
  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateCreatePost,
  validateUpdatePost,
  validateComment,
  validateCategory,
  validateAI,
  validatePostReaction,
  validatePostStatus,
  validateCommentUpdate,
  validateCommentReaction,
  validateCommentModerate,
  validateUserIdParam,
  validateRoleUpdate,
  handleValidationErrors
};
