const express = require('express')

//controller functions
const {signupUser, loginUser} = require('../controllers/userController')

const router = express.Router()

//login route
router.post('/login', loginUser)

//signup route
router.post('/signup', signupUser)

// NEW: Email verification routes
router.get('/verify/:token', verifyEmail)
router.post('/resend-verification', resendVerification)

module.exports = router