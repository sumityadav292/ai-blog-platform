const router = require('express').Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const { uploadImage } = require('../controllers/upload.controller');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  // Prevent memory DoS (in-memory buffer grows with file size).
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    // Only accept image uploads.
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image uploads are allowed'));
  },
});

router.post('/image', protect, upload.single('file'), uploadImage);

module.exports = router;


