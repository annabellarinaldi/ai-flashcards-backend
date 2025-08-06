require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const flashcardRoutes = require('./routes/flashcards')
const userRoutes = require('./routes/user')
const documentRoutes = require('./routes/documents')



// express app
const app = express()

// middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
    console.log('📥 REQUEST:', req.path, req.method) // Make it more obvious
    next()
})


// routes
app.use('/api/flashcards',flashcardRoutes)
app.use('/api/user',userRoutes)
app.use('/api/documents', documentRoutes)

const PORT = process.env.PORT || 4000

app.listen(PORT, '0.0.0.0', () => {
    console.log(`connected to db & listening on port ${PORT}`)
})

