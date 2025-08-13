require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const flashcardRoutes = require('./routes/flashcards')
const userRoutes = require('./routes/user')
const documentRoutes = require('./routes/documents')

// express app
const app = express()

// Enhanced CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    'https://ai-flashcards-self.vercel.app',
    // Add all possible Vercel URLs patterns
    /^https:\/\/ai-flashcards-.*\.vercel\.app$/,
    // Your custom domain if you have one
    process.env.FRONTEND_URL
].filter(Boolean) // Remove any undefined values

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true)
        
        // Check if origin is in allowed list
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (typeof allowedOrigin === 'string') {
                return allowedOrigin === origin
            }
            if (allowedOrigin instanceof RegExp) {
                return allowedOrigin.test(origin)
            }
            return false
        })
        
        if (isAllowed) {
            console.log('✅ CORS allowed for origin:', origin)
            callback(null, true)
        } else {
            console.log('❌ CORS blocked origin:', origin)
            console.log('🔍 Allowed origins:', allowedOrigins)
            callback(new Error('Not allowed by CORS'))
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With', 
        'Content-Type', 
        'Accept', 
        'Authorization',
        'Cache-Control'
    ]
}))

// Handle preflight requests explicitly
app.options('*', cors())

// Add manual CORS headers as backup
app.use((req, res, next) => {
    const origin = req.headers.origin
    console.log('📡 Request from origin:', origin)
    console.log('📡 Request to:', req.method, req.path)
    
    if (origin && allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') return allowed === origin
        if (allowed instanceof RegExp) return allowed.test(origin)
        return false
    })) {
        res.setHeader('Access-Control-Allow-Origin', origin)
    }
    
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control')
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        console.log('🔄 Handling preflight request')
        res.status(200).end()
        return
    }
    
    next()
})

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
            console.log('🌐 CORS configured for origins:', allowedOrigins)
        })
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error)
        process.exit(1)
    })