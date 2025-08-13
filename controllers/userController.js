const User = require('../models/userModel')
const jwt = require('jsonwebtoken')
const { sendEmail } = require('../services/emailService')

// Create token
const createToken = (_id) => {
    return jwt.sign({_id}, process.env.SECRET, { expiresIn: '7d'})
}

// Login user
const loginUser = async (req, res) => {
    const {emailOrUsername, password} = req.body

    try {
        const user = await User.login(emailOrUsername, password)

        const token = createToken(user._id)

        res.status(200).json({
            email: user.email,
            username: user.username,
            token
        })
    } catch (error){
        res.status(400).json({error: error.message})
    }
}

// Signup user - NEW: Send verification email instead of auto-login
const signupUser = async (req, res) => {
    const {username, email, password} = req.body

    try {
        // Create user (will be unverified)
        const user = await User.signup(username, email, password)

        // Generate verification token
        const verificationToken = user.generateEmailVerificationToken()
        await user.save()

        // Create verification link
        const verificationLink = `${process.env.FRONTEND_URL}/verify/${verificationToken}`

        // Send verification email
        const emailResult = await sendEmail(
            user.email,
            'verification',
            {
                username: user.username,
                link: verificationLink
            }
        )

        if (emailResult.success) {
            res.status(201).json({
                message: 'Account created successfully! Please check your email to verify your account.',
                email: user.email,
                verificationEmailSent: true
            })
        } else {
            // If email fails, still create account but inform user
            res.status(201).json({
                message: 'Account created but verification email failed to send. Please contact support.',
                email: user.email,
                verificationEmailSent: false,
                emailError: emailResult.error
            })
        }

    } catch (error){
        res.status(400).json({error: error.message})
    }
}

// NEW: Email verification endpoint
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params

        if (!token) {
            return res.status(400).json({
                error: 'Verification token is required'
            })
        }

        // Find user with this token that hasn't expired
        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: new Date() }
        })

        if (!user) {
            return res.status(400).json({
                error: 'Invalid or expired verification token'
            })
        }

        // Mark email as verified and clear token
        user.isEmailVerified = true
        user.clearEmailVerificationToken()
        await user.save()

        res.status(200).json({
            message: 'Email verified successfully! You can now log in.',
            verified: true
        })

    } catch (error) {
        console.error('Email verification error:', error)
        res.status(500).json({
            error: 'Server error during email verification'
        })
    }
}

// NEW: Resend verification email
const resendVerification = async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({
                error: 'Email is required'
            })
        }

        // Find unverified user with this email
        const user = await User.findOne({
            email: email.toLowerCase(),
            isEmailVerified: false
        })

        if (!user) {
            return res.status(400).json({
                error: 'No unverified account found with this email'
            })
        }

        // Generate new verification token
        const verificationToken = user.generateEmailVerificationToken()
        await user.save()

        // Create verification link
        const verificationLink = `${process.env.FRONTEND_URL}/verify/${verificationToken}`

        // Send verification email
        const emailResult = await sendEmail(
            user.email,
            'verification',
            {
                username: user.username,
                link: verificationLink
            }
        )

        if (emailResult.success) {
            res.status(200).json({
                message: 'Verification email sent successfully!',
                email: user.email
            })
        } else {
            res.status(500).json({
                error: 'Failed to send verification email'
            })
        }

    } catch (error) {
        console.error('Resend verification error:', error)
        res.status(500).json({
            error: 'Server error'
        })
    }
}

module.exports = {
    loginUser, 
    signupUser, 
    verifyEmail, 
    resendVerification
}