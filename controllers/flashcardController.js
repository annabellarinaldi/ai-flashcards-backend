const Flashcard = require('../models/flashcardModel')
const mongoose = require('mongoose')
const { updateFlashcard: updateFlashcardSRS, getDueFlashcards, getDueCount } = require('../utils/srsAlgorithm')
const { scoreResponse } = require('../services/aiScoringService')

// get all flashcards
const getFlashcards = async (req, res) => {
    console.log("🚀 GET ALL FLASHCARDS REQUEST RECEIVED!")
    const user_id = req.user._id

    const flashcards = await Flashcard.find({ user_id }).sort({createdAt: -1})

    res.status(200).json(flashcards)
}

// get a single flashcard
const getFlashcard = async (req, res) => {
    console.log("❌ getFlashcard called instead! ID:", req.params.id)
    const {id} = req.params

    if (!mongoose.Types.ObjectId.isValid(id)){
        return res.status(404).json({error: 'No such flashcard'})
    }

    const flashcard = await Flashcard.findById(id)

    if(!flashcard){
        return res.status(404).json({error: 'No such flashcard'})
    }

    res.status(200).json(flashcard)
}

// create new flashcard
const createFlashcard = async (req, res) => {
    const {term, definition} = req.body
    
    let emptyFields = []

    if(!term){
        emptyFields.push('term')
    }
    if(!definition){
        emptyFields.push('definition')
    }
    if(emptyFields.length > 0) {
        return res.status(400).json({error: 'Please fill in all the fields', emptyFields})
    }

    // add doc to db
    try{
        const user_id = req.user._id
        const flashcard = await Flashcard.create({term, definition, user_id})
        res.status(200).json(flashcard)
    } catch (error) {
        res.status(400).json({error: error.message})
    }
}

// delete a flashcard
const deleteFlashcard = async (req, res) => {
    const {id} = req.params

    if (!mongoose.Types.ObjectId.isValid(id)){
        return res.status(404).json({error: 'No such flashcard'})
    }

    const flashcard = await Flashcard.findOneAndDelete({_id: id})

    if(!flashcard){
        return res.status(400).json({error: 'No such flashcard'})
    }

    res.status(200).json(flashcard)
}

//update a flashcard
const updateFlashcard = async (req, res) => {
    const {id} = req.params

    if (!mongoose.Types.ObjectId.isValid(id)){
        return res.status(404).json({error: 'No such flashcard'})
    }

    const flashcard = await Flashcard.findOneAndUpdate({_id: id}, {
        ...req.body
    })

    if(!flashcard){
        return res.status(400).json({error: 'No such flashcard'})
    }

    res.status(200).json(flashcard)
}

// get count of due flashcards
const getDueFlashcardsCount = async (req, res) => {
    console.log("🎯 getDueFlashcardsCount called - this should appear!")
    try {
        const user_id = req.user._id
        const count = await getDueCount(user_id)
        res.status(200).json({ count })
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

// start review session - get next due flashcard
const getNextReviewCard = async (req, res) => {
    try {
        const user_id = req.user._id
        const dueCards = await getDueFlashcards(user_id)
        
        if (dueCards.length === 0) {
            return res.status(200).json({ 
                message: "No cards due for review",
                completed: true 
            })
        }

        // Return the first due card
        res.status(200).json({
            flashcard: dueCards[0],
            remaining: dueCards.length - 1,
            completed: false
        })
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

// submit review rating for a flashcard
const reviewFlashcard = async (req, res) => {
    console.log('🎯 reviewFlashcard called!')
    console.log('Request body:', req.body)
    console.log('Request headers:', req.headers['content-type'])
    try {
        const { id } = req.params
        const { quality } = req.body // 0=Again, 1=Hard, 2=Good, 3=Easy

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ error: 'Invalid flashcard ID' })
        }

        if (quality === undefined || quality < 0 || quality > 3) {
            return res.status(400).json({ 
                error: 'Quality must be between 0 and 3' 
            })
        }

        const updatedFlashcard = await updateFlashcardSRS(id, quality)
        
        // Get next card for the session
        const user_id = req.user._id
        const remainingCards = await getDueFlashcards(user_id)
        
        res.status(200).json({
            updatedFlashcard,
            remaining: remainingCards.length,
            nextCard: remainingCards.length > 0 ? remainingCards[0] : null,
            completed: remainingCards.length === 0
        })
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

// submit typed answer for review
const submitTypedReview = async (req, res) => {
    try {
        const { id } = req.params
        const { userAnswer } = req.body

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ error: 'Invalid flashcard ID' })
        }

        if (userAnswer === undefined || userAnswer === null) {
            return res.status(400).json({ 
                error: 'Answer is required' 
            })
        }

        const flashcard = await Flashcard.findById(id)
        if (!flashcard) {
            return res.status(404).json({ error: 'Flashcard not found' })
        }

        // Check if answer is correct
        const isCorrect = flashcard.isAnswerCorrect(userAnswer)
        
        // Update performance tracking
        flashcard.totalReviews += 1
        if (isCorrect) {
            flashcard.correctAnswers += 1
        }
        
        await flashcard.save()

        // Auto-determine quality based on correctness
        let quality = isCorrect ? 2 : 0

        // Update SRS scheduling
        const updatedFlashcard = await updateFlashcardSRS(id, quality)
        
        // Get next card for the session
        const user_id = req.user._id
        const remainingCards = await getDueFlashcards(user_id)
        
        // Filter out the card we just reviewed to avoid immediate repetition
        const nextCards = remainingCards.filter(card => card._id.toString() !== id)
        
        // Return detailed feedback
        const correctAnswer = flashcard.reviewType === 'recognition' ? flashcard.definition : flashcard.term
        
        res.status(200).json({
            isCorrect,
            userAnswer: userAnswer.trim(),
            correctAnswer,
            quality, // The auto-assigned quality
            updatedFlashcard,
            remaining: nextCards.length,
            nextCard: nextCards.length > 0 ? nextCards[0] : null,
            completed: nextCards.length === 0,
            // Additional feedback
            feedback: {
                accuracy: updatedFlashcard.getAccuracy(),
                totalReviews: updatedFlashcard.totalReviews,
                correctAnswers: updatedFlashcard.correctAnswers
            }
        })
    } catch (error) {
        console.error('Typed review error:', error)
        res.status(400).json({ error: error.message })
    }
}

// submit typed answer for AI scoring
const submitTypedReviewWithAI = async (req, res) => {
    try {
        const { id } = req.params
        const { userAnswer } = req.body

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ error: 'Invalid flashcard ID' })
        }

        if (userAnswer === undefined || userAnswer === null) {
            return res.status(400).json({ 
                error: 'Answer is required' 
            })
        }

        const flashcard = await Flashcard.findById(id)
        if (!flashcard) {
            return res.status(404).json({ error: 'Flashcard not found' })
        }

        // Determine question and correct answer based on review type
        const question = flashcard.reviewType === 'recognition' ? flashcard.term : flashcard.definition
        const correctAnswer = flashcard.reviewType === 'recognition' ? flashcard.definition : flashcard.term

        // Get AI scoring
        const aiScore = await scoreResponse(
            question,
            correctAnswer,
            userAnswer.trim(),
            flashcard.reviewType
        )

        // Update performance tracking
        flashcard.totalReviews += 1
        if (aiScore.isCorrect) {
            flashcard.correctAnswers += 1
        }
        
        await flashcard.save()

        // Update SRS scheduling with AI-determined quality
        const updatedFlashcard = await updateFlashcardSRS(id, aiScore.quality)
        
        // Get next card for the session
        const user_id = req.user._id
        const remainingCards = await getDueFlashcards(user_id)
        
        // Filter out the card we just reviewed to avoid immediate repetition
        const nextCards = remainingCards.filter(card => card._id.toString() !== id)
        
        // Return detailed feedback with AI scoring
        res.status(200).json({
            isCorrect: aiScore.isCorrect,
            userAnswer: userAnswer.trim(),
            correctAnswer,
            quality: aiScore.quality, // AI-assigned quality
            aiScore: {
                quality: aiScore.quality,
                reasoning: aiScore.reasoning,
                confidence: aiScore.confidence,
                aiScored: aiScore.aiScored
            },
            updatedFlashcard,
            remaining: nextCards.length,
            nextCard: nextCards.length > 0 ? nextCards[0] : null,
            completed: nextCards.length === 0,
            // Additional feedback
            feedback: {
                accuracy: updatedFlashcard.getAccuracy(),
                totalReviews: updatedFlashcard.totalReviews,
                correctAnswers: updatedFlashcard.correctAnswers
            }
        })
    } catch (error) {
        console.error('AI typed review error:', error)
        res.status(400).json({ error: error.message })
    }
}

// Allow manual quality override after seeing result
const overrideQuality = async (req, res) => {
    try {
        const { id } = req.params
        const { quality } = req.body // 0=Again, 1=Hard, 2=Good, 3=Easy

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ error: 'Invalid flashcard ID' })
        }

        if (quality === undefined || quality < 0 || quality > 3) {
            return res.status(400).json({ 
                error: 'Quality must be between 0 and 3' 
            })
        }

        // Update SRS scheduling with new quality
        const updatedFlashcard = await updateFlashcardSRS(id, quality)
        
        // Get next card for the session
        const user_id = req.user._id
        const remainingCards = await getDueFlashcards(user_id)
        
        res.status(200).json({
            message: 'Quality updated successfully',
            updatedFlashcard,
            remaining: remainingCards.length,
            nextCard: remainingCards.length > 0 ? remainingCards[0] : null,
            completed: remainingCards.length === 0
        })
    } catch (error) {
        console.error('Quality override error:', error)
        res.status(400).json({ error: error.message })
    }
}

module.exports = {
    getFlashcards,
    getFlashcard,
    createFlashcard,
    deleteFlashcard,
    updateFlashcard,
    getDueFlashcardsCount,
    getNextReviewCard,
    reviewFlashcard,
    submitTypedReview,
    submitTypedReviewWithAI,
    overrideQuality
}