const express = require('express')

//controller functions - ADD the missing functions here:
const {signupUser, loginUser, verifyEmail, resendVerification} = require('../controllers/userController')

const router = express.Router()

//login route
router.post('/login', loginUser)

//signup route
router.post('/signup', signupUser)

// Email verification routes
router.get('/verify/:token', verifyEmail)
router.post('/resend-verification', resendVerification)

module.exports = router