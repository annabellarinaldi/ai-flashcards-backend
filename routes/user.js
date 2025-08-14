const express = require('express')

//controller functions - ADD the missing functions here:
const {
    signupUser, 
    loginUser, 
    verifyEmail, 
    resendVerification,
    forgotPassword,
    resetPassword
} = require('../controllers/userController')

const router = express.Router()

//login route
router.post('/login', loginUser)

//signup route
router.post('/signup', signupUser)

// Email verification routes
router.get('/verify/:token', verifyEmail)
router.post('/resend-verification', resendVerification)

// Password reset routes
router.post('/forgot-password', forgotPassword)
router.post('/reset-password/:token', resetPassword)

module.exports = router