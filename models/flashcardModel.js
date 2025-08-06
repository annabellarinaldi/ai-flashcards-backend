const mongoose = require('mongoose')

const Schema = mongoose.Schema

const flashcardSchema = new Schema({
    term: {
        type: String,
        required: true
    },
    definition: {
        type: String,
        required: true
    },
    user_id: {
        type: String,
        required: true
    },
    // SRS (Spaced Repetition System) fields
    interval: {
        type: Number,
        default: 1 / (24 * 60) // Days until next review
    },
    easeFactor: {
        type: Number,
        default: 2.5 // SM-2 algorithm ease factor
    },
    repetitions: {
        type: Number,
        default: 0 // Number of successful reviews
    },
    dueDate: {
        type: Date,
        default: Date.now // Next review date
    },
    lastReviewed: {
        type: Date,
        default: null // Track when last reviewed
    },
    // Anki-specific fields
    isLearning: {
        type: Boolean,
        default: true // New cards start in learning mode
    },
    // Typed response settings
    reviewType: {
        type: String,
        enum: ['recognition', 'recall'], // recognition = show term->recall definition, recall = show definition->recall term
        default: 'recognition'
    },
    // Performance tracking
    totalReviews: {
        type: Number,
        default: 0
    },
    correctAnswers: {
        type: Number,
        default: 0
    },
    // Alternative acceptable answers (for typed responses)
    acceptableAnswers: {
        type: [String],
        default: []
    }
}, { timestamps: true })

// Helper method to calculate accuracy
flashcardSchema.methods.getAccuracy = function() {
    if (this.totalReviews === 0) return 0
    return Math.round((this.correctAnswers / this.totalReviews) * 100)
}

// Helper method to check if answer is correct
flashcardSchema.methods.isAnswerCorrect = function(userAnswer) {
    if (!userAnswer || typeof userAnswer !== 'string') return false
    
    const normalizeAnswer = (answer) => {
        return answer.toLowerCase()
            .trim()
            .replace(/[.,!?;:]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ') // Normalize whitespace
    }
    
    const normalizedUserAnswer = normalizeAnswer(userAnswer)
    const correctAnswer = this.reviewType === 'recognition' ? this.definition : this.term
    const normalizedCorrectAnswer = normalizeAnswer(correctAnswer)
    
    // Check exact match
    if (normalizedUserAnswer === normalizedCorrectAnswer) return true
    
    // Check acceptable alternatives
    for (const acceptable of this.acceptableAnswers) {
        if (normalizeAnswer(acceptable) === normalizedUserAnswer) return true
    }
    
    // Check if user answer contains key words (basic fuzzy matching)
    const userWords = normalizedUserAnswer.split(' ').filter(word => word.length > 2)
    const correctWords = normalizedCorrectAnswer.split(' ').filter(word => word.length > 2)
    
    if (userWords.length === 0 || correctWords.length === 0) return false
    
    // Calculate word overlap
    const matchedWords = userWords.filter(word => 
        correctWords.some(correctWord => 
            correctWord.includes(word) || word.includes(correctWord)
        )
    )
    
    // Consider correct if 70% of important words match
    const overlapRatio = matchedWords.length / correctWords.length
    return overlapRatio >= 0.7
}

module.exports = mongoose.model('Flashcard', flashcardSchema)