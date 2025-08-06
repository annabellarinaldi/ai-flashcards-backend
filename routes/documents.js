const express = require('express');
const { uploadDocument, saveFlashcards } = require('../controllers/documentController');
const { upload, handleUploadError } = require('../middleware/upload');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// Require authentication for all document routes
router.use(requireAuth);

// POST upload document and generate flashcards
router.post('/upload', 
  upload.single('document'), // 'document' is the field name for the file
  handleUploadError,
  uploadDocument
);

// POST save generated flashcards to database
router.post('/save-flashcards', saveFlashcards);

module.exports = router;