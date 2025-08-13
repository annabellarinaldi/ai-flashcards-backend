const User = require('../models/userModel')
const jwt = require('jsonwebtoken')

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

// Signup user
const signupUser = async (req, res) => {
    const {username, email, password} = req.body

    try {
        const user = await User.signup(username, email, password)

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

module.exports = {loginUser, signupUser}