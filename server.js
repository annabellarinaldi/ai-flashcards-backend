require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const flashcardRoutes = require('./routes/flashcards')
const userRoutes = require('./routes/user')
const documentRoutes = require('./routes/documents')

// express app
const app = express()

//CORS configuration
app.use(cors({
    origin: [
        'https://ai-flashcards-self.vercel.app', // Replace with your actual Vercel URL
        'http://localhost:3000' // For local development
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))

// middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
    console.log('📥 REQUEST:', req.path, req.method)
    next()
})

// routes
app.use('/api/flashcards', flashcardRoutes)
app.use('/api/user', userRoutes)
app.use('/api/documents', documentRoutes)

// Add a basic health check route
app.get('/', (req, res) => {
    res.json({ message: 'API is running' })
})

const PORT = process.env.PORT || 4000

// Connect to MongoDB first, then start server
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB')
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server listening on port ${PORT}`)
        })
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error)
        process.exit(1)
    })