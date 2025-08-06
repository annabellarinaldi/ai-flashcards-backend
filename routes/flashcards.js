const express = require('express')
const {
    getFlashcards,
    getFlashcard, 
    createFlashcard,
    deleteFlashcard,
    updateFlashcard,
    getDueFlashcardsCount,
    getNextReviewCard,
    reviewFlashcard,
    submitTypedReview,
    overrideQuality
} = require('../controllers/flashcardController')
const requireAuth = require('../middleware/requireAuth')

const router = express.Router()

//require auth for all flashcard routes
router.use(requireAuth)

// GET all flashcards
router.get('/', getFlashcards)

// GET count of due flashcards
router.get('/due-count', getDueFlashcardsCount)

// GET next flashcard for review
router.get('/review-session', getNextReviewCard)

// POST review rating for a flashcard
router.post('/review/:id', reviewFlashcard)

// GET a single flashcard
router.get('/:id', getFlashcard)

// POST a new flashcard
router.post('/', createFlashcard)

// DELETE a flashcard
router.delete('/:id', deleteFlashcard)

// UPDATE a flashcard
router.patch('/:id', updateFlashcard)

// submit typed review
router.post('/typed-review/:id', submitTypedReview)

//override quality using typed review
router.post('/override-quality/:id', overrideQuality)

module.exports = router