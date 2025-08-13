const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const validator = require('validator')
const crypto = require('crypto')

const Schema = mongoose.Schema

const userSchema = new Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [20, 'Username must be less than 20 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String, 
        required: true
    },
    // Email verification fields
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        default: null
    },
    emailVerificationExpires: {
        type: Date,
        default: null
    },
    // Password reset fields (for future use)
    passwordResetToken: {
        type: String,
        default: null
    },
    passwordResetExpires: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
})

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next()
    
    try {
        const salt = await bcrypt.genSalt(12)
        this.password = await bcrypt.hash(this.password, salt)
        next()
    } catch (error) {
        next(error)
    }
})

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password)
}

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
    // Generate random token
    const token = crypto.randomBytes(32).toString('hex')
    
    // Set token and expiration (24 hours from now)
    this.emailVerificationToken = token
    this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    
    return token
}

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
    // Generate random token
    const token = crypto.randomBytes(32).toString('hex')
    
    // Set token and expiration (1 hour from now)
    this.passwordResetToken = token
    this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    
    return token
}

// Clear verification token
userSchema.methods.clearEmailVerificationToken = function() {
    this.emailVerificationToken = null
    this.emailVerificationExpires = null
}

// Clear password reset token
userSchema.methods.clearPasswordResetToken = function() {
    this.passwordResetToken = null
    this.passwordResetExpires = null
}

// Static signup method
userSchema.statics.signup = async function(username, email, password) {
    // Validation
    if (!username || !email || !password) {
        throw Error('All fields must be filled')
    }
    if (!validator.isEmail(email)) {
        throw Error('Email is not valid')
    }
    if (!validator.isStrongPassword(password)) {
        throw Error('Password not strong enough')
    }

    // Check if user already exists (by email or username)
    const existingUser = await this.findOne({
        $or: [{ email }, { username }]
    })

    if (existingUser) {
        const field = existingUser.email === email ? 'email' : 'username'
        throw Error(`User with this ${field} already exists`)
    }

    // Create user (password will be hashed by pre-save hook)
    const user = await this.create({ 
        username, 
        email, 
        password,
        isEmailVerified: false // New users start unverified
    })
    
    return user
}

// Static login method - can login with email or username
userSchema.statics.login = async function(emailOrUsername, password) {
    // Validation
    if (!emailOrUsername || !password) {
        throw Error('All fields must be filled')
    }

    // Find user by email or username
    const user = await this.findOne({
        $or: [
            { email: emailOrUsername.toLowerCase() },
            { username: emailOrUsername }
        ]
    })

    if (!user) {
        throw Error('Invalid credentials')
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
        throw Error('Please verify your email before logging in. Check your inbox for a verification link.')
    }

    const match = await user.comparePassword(password)

    if (!match) {
        throw Error('Invalid credentials')
    }

    return user
}

module.exports = mongoose.model('User', userSchema)