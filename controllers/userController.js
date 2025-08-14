const User = require('../models/userModel')
const jwt = require('jsonwebtoken')
const { sendEmail } = require('../services/emailService')
const validator = require('validator')

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
        console.error('Login error:', error.message)
        res.status(400).json({error: error.message})
    }
}

// Signup user - Send verification email instead of auto-login
const signupUser = async (req, res) => {
    const {username, email, password} = req.body

    try {
        // Create user (will be unverified)
        const user = await User.signup(username, email, password)
        console.log(`📝 User created: ${user.email} (${user.username})`)

        // Generate verification token
        const verificationToken = user.generateEmailVerificationToken()
        await user.save()
        console.log(`🔐 Verification token generated: ${verificationToken.substring(0, 8)}...`)

        // Create verification link
        const verificationLink = `${process.env.FRONTEND_URL}/verify/${verificationToken}`
        console.log(`🔗 Verification link: ${verificationLink}`)

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
            console.log(`✅ Verification email sent to ${user.email}`)
            res.status(201).json({
                message: 'Account created successfully! Please check your email to verify your account.',
                email: user.email,
                verificationEmailSent: true
            })
        } else {
            console.error(`❌ Email failed to send: ${emailResult.error}`)
            // If email fails, still create account but inform user
            res.status(201).json({
                message: 'Account created but verification email failed to send. Please contact support.',
                email: user.email,
                verificationEmailSent: false,
                emailError: emailResult.error
            })
        }

    } catch (error){
        console.error('Signup error:', error.message)
        res.status(400).json({error: error.message})
    }
}

// Email verification endpoint
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params
        console.log(`🔍 Verifying token: ${token}`)

        if (!token) {
            console.log('❌ No token provided')
            // Redirect to frontend with error
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_token`)
        }

        // Find user with this token that hasn't expired
        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: new Date() }
        })

        if (!user) {
            console.log(`❌ Invalid or expired token: ${token}`)
            // Redirect to frontend with error
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=expired_token`)
        }

        console.log(`✅ Token valid for user: ${user.email}`)

        // Mark email as verified and clear token
        user.isEmailVerified = true
        user.clearEmailVerificationToken()
        await user.save()

        console.log(`🎉 Email verified successfully for: ${user.email}`)

        // Redirect to login with success message
        res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`)

    } catch (error) {
        console.error('❌ Email verification error:', error)
        // Redirect to frontend with error
        res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`)
    }
}

// Resend verification email
const resendVerification = async (req, res) => {
    try {
        const { email } = req.body
        console.log(`🔄 Resending verification to: ${email}`)

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
            console.log(`❌ No unverified account found for: ${email}`)
            return res.status(400).json({
                error: 'No unverified account found with this email'
            })
        }

        // Generate new verification token
        const verificationToken = user.generateEmailVerificationToken()
        await user.save()
        console.log(`🔐 New verification token generated for: ${email}`)

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
            console.log(`✅ Verification email resent to: ${email}`)
            res.status(200).json({
                message: 'Verification email sent successfully!',
                email: user.email
            })
        } else {
            console.error(`❌ Failed to resend email to: ${email}`)
            res.status(500).json({
                error: 'Failed to send verification email'
            })
        }

    } catch (error) {
        console.error('❌ Resend verification error:', error)
        res.status(500).json({
            error: 'Server error'
        })
    }
}

// Add these functions to your userController.js

// Forgot password - send reset email
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body
        console.log(`🔑 Password reset requested for: ${email}`)

        if (!email) {
            return res.status(400).json({
                error: 'Email is required'
            })
        }

        // Find user with this email
        const user = await User.findOne({
            email: email.toLowerCase()
        })

        if (!user) {
            console.log(`❌ No user found with email: ${email}`)
            // Don't reveal if email exists for security
            return res.status(200).json({
                message: 'If an account with that email exists, we sent a password reset link.'
            })
        }

        // Check if email is verified
        if (!user.isEmailVerified) {
            console.log(`❌ User email not verified: ${email}`)
            return res.status(400).json({
                error: 'Please verify your email address first before resetting password.'
            })
        }

        // Generate password reset token
        const resetToken = user.generatePasswordResetToken()
        await user.save()
        console.log(`🔐 Password reset token generated for: ${email}`)

        // Create reset link
        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`
        console.log(`🔗 Reset link: ${resetLink}`)

        // Send password reset email
        const emailResult = await sendEmail(
            user.email,
            'passwordReset',
            {
                username: user.username,
                link: resetLink
            }
        )

        if (emailResult.success) {
            console.log(`✅ Password reset email sent to ${user.email}`)
            res.status(200).json({
                message: 'If an account with that email exists, we sent a password reset link.',
                email: user.email
            })
        } else {
            console.error(`❌ Password reset email failed: ${emailResult.error}`)
            res.status(500).json({
                error: 'Failed to send password reset email. Please try again.'
            })
        }

    } catch (error) {
        console.error('❌ Forgot password error:', error)
        res.status(500).json({
            error: 'Server error'
        })
    }
}

// Reset password with token
const resetPassword = async (req, res) => {
    try {
        const { token } = req.params
        const { password } = req.body
        console.log(`🔄 Password reset attempt with token: ${token.substring(0, 8)}...`)

        if (!token) {
            return res.status(400).json({
                error: 'Reset token is required'
            })
        }

        if (!password) {
            return res.status(400).json({
                error: 'New password is required'
            })
        }

        // Validate password strength
        if (!validator.isStrongPassword(password)) {
            return res.status(400).json({
                error: 'Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character'
            })
        }

        // Find user with valid reset token
        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: new Date() }
        })

        if (!user) {
            console.log(`❌ Invalid or expired reset token: ${token}`)
            return res.status(400).json({
                error: 'Password reset token is invalid or has expired'
            })
        }

        console.log(`✅ Valid reset token for user: ${user.email}`)

        // Update password and clear reset token
        user.password = password // This will be hashed by the pre-save hook
        user.clearPasswordResetToken()
        await user.save()

        console.log(`🎉 Password reset successful for: ${user.email}`)

        res.status(200).json({
            message: 'Password reset successful! You can now log in with your new password.',
            email: user.email
        })

    } catch (error) {
        console.error('❌ Reset password error:', error)
        res.status(500).json({
            error: 'Server error'
        })
    }
}

module.exports = {
    loginUser, 
    signupUser, 
    verifyEmail, 
    resendVerification,
    forgotPassword,
    resetPassword
}