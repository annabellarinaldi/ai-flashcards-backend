// backend/utils/srsAlgorithm.js - True Anki Algorithm
const Flashcard = require('../models/flashcardModel')

/**
 * Calculate next review based on true Anki SM-2+ algorithm
 * @param {number} quality - User rating (0=Again, 1=Hard, 2=Good, 3=Easy)
 * @param {number} interval - Current interval in days
 * @param {number} easeFactor - Current ease factor
 * @param {number} repetitions - Number of successful repetitions
 * @param {boolean} isLearning - Whether card is in learning phase
 * @returns {object} Updated SRS values
 */
const calculateNextReview = (quality, interval, easeFactor, repetitions, isLearning = false) => {
    let newInterval = interval
    let newEaseFactor = easeFactor
    let newRepetitions = repetitions
    let newIsLearning = isLearning

    // Anki's learning steps (in minutes): 1, 10
    const learningSteps = [1, 10] // minutes
    
    // Anki's graduating interval: 1 day
    const graduatingInterval = 1 // day
    
    // Anki's easy interval: 4 days
    const easyInterval = 4 // days

    if (quality === 0) {
        // Again - Back to first learning step
        newIsLearning = true
        newRepetitions = 0
        newInterval = learningSteps[0] / (24 * 60) // Convert to days
        newEaseFactor = Math.max(1.3, easeFactor - 0.2)
    }
    else if (quality === 1) {
        // Hard
        if (isLearning) {
            // In learning: go back one step or repeat current step
            const currentStepIndex = learningSteps.findIndex(step => 
                Math.abs(interval * 24 * 60 - step) < 0.1
            )
            if (currentStepIndex > 0) {
                newInterval = learningSteps[currentStepIndex - 1] / (24 * 60)
            } else {
                newInterval = learningSteps[0] / (24 * 60)
            }
            newIsLearning = true
        } else {
            // Graduated card: multiply interval by 1.2, decrease ease
            newInterval = Math.max(1, Math.ceil(interval * 1.2))
            newEaseFactor = Math.max(1.3, easeFactor - 0.15)
        }
    }
    else if (quality === 2) {
        // Good
        if (isLearning) {
            // Move to next learning step or graduate
            const currentStepIndex = learningSteps.findIndex(step => 
                Math.abs(interval * 24 * 60 - step) < 0.1
            )
            
            if (currentStepIndex < learningSteps.length - 1) {
                // Next learning step
                newInterval = learningSteps[currentStepIndex + 1] / (24 * 60)
                newIsLearning = true
            } else {
                // Graduate the card
                newInterval = graduatingInterval
                newIsLearning = false
                newRepetitions = 1
            }
        } else {
            // Graduated card: use ease factor
            newRepetitions = repetitions + 1
            if (newRepetitions === 1) {
                newInterval = graduatingInterval
            } else if (newRepetitions === 2) {
                newInterval = Math.max(graduatingInterval, Math.ceil(interval * easeFactor))
            } else {
                newInterval = Math.ceil(interval * easeFactor)
            }
        }
    }
    else if (quality === 3) {
        // Easy
        if (isLearning) {
            // Graduate immediately with easy interval
            newInterval = easyInterval
            newIsLearning = false
            newRepetitions = 1
        } else {
            // Graduated card: bonus multiplier + ease increase
            newRepetitions = repetitions + 1
            newInterval = Math.ceil(interval * easeFactor * 1.3)
            newEaseFactor = Math.min(2.5, easeFactor + 0.15)
        }
    }

    // Anki's constraints
    newInterval = Math.max(1 / (24 * 60), newInterval) // Minimum 1 minute
    newInterval = Math.min(36500, newInterval) // Maximum ~100 years
    newEaseFactor = Math.max(1.3, Math.min(2.5, newEaseFactor))

    // Calculate due date
    const dueDate = new Date()
    if (newInterval < 1) {
        // For intervals less than 1 day, add minutes
        dueDate.setTime(dueDate.getTime() + (newInterval * 24 * 60 * 60 * 1000))
    } else {
        // For intervals 1+ days, add days
        dueDate.setDate(dueDate.getDate() + Math.ceil(newInterval))
    }

    console.log(`📅 Anki scheduling: ${quality === 0 ? 'Again' : quality === 1 ? 'Hard' : quality === 2 ? 'Good' : 'Easy'} → ${newInterval.toFixed(4)} days (${newIsLearning ? 'Learning' : 'Review'})`)

    return {
        interval: newInterval,
        easeFactor: newEaseFactor,
        repetitions: newRepetitions,
        dueDate: dueDate,
        lastReviewed: new Date(),
        isLearning: newIsLearning
    }
}

/**
 * Update flashcard with new SRS values
 * @param {string} flashcardId - MongoDB ObjectId
 * @param {number} quality - User rating (0-3)
 * @returns {object} Updated flashcard
 */
const updateFlashcard = async (flashcardId, quality) => {
    try {
        const flashcard = await Flashcard.findById(flashcardId)
        if (!flashcard) {
            throw new Error('Flashcard not found')
        }

        // Determine if card is currently in learning phase
        const isLearning = flashcard.isLearning || flashcard.repetitions === 0 || flashcard.interval < 1

        const updates = calculateNextReview(
            quality,
            flashcard.interval,
            flashcard.easeFactor,
            flashcard.repetitions,
            isLearning
        )

        const updatedFlashcard = await Flashcard.findByIdAndUpdate(
            flashcardId,
            updates,
            { new: true }
        )

        return updatedFlashcard
    } catch (error) {
        throw error
    }
}

/**
 * Get flashcards due for review
 * @param {string} userId - User ID
 * @returns {array} Flashcards due now
 */
const getDueFlashcards = async (userId) => {
    try {
        const now = new Date()
        
        const dueFlashcards = await Flashcard.find({
            user_id: userId,
            dueDate: { $lte: now }
        }).sort({ 
            // Prioritize learning cards, then by due date
            isLearning: -1,
            dueDate: 1 
        })

        return dueFlashcards
    } catch (error) {
        throw error
    }
}

/**
 * Get count of due flashcards
 * @param {string} userId - User ID
 * @returns {number} Count of due flashcards
 */
const getDueCount = async (userId) => {
    try {
        const now = new Date()
        
        const count = await Flashcard.countDocuments({
            user_id: userId,
            dueDate: { $lte: now }
        })

        return count
    } catch (error) {
        throw error
    }
}

/**
 * Get learning cards specifically
 * @param {string} userId - User ID
 * @returns {array} Learning flashcards
 */
const getLearningCards = async (userId) => {
    try {
        const now = new Date()
        
        const learningCards = await Flashcard.find({
            user_id: userId,
            dueDate: { $lte: now },
            $or: [
                { isLearning: true },
                { interval: { $lt: 1 } },
                { repetitions: 0 }
            ]
        }).sort({ dueDate: 1 })

        return learningCards
    } catch (error) {
        throw error
    }
}

module.exports = {
    calculateNextReview,
    updateFlashcard,
    getDueFlashcards,
    getDueCount,
    getLearningCards
}