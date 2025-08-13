const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const validator = require('validator')

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
    }
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

    const user = await this.create({ username, email, password })
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

    const match = await user.comparePassword(password)

    if (!match) {
        throw Error('Invalid credentials')
    }

    return user
}

module.exports = mongoose.model('User', userSchema)