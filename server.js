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

// connect to db
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        // listen for requests
        app.listen(process.env.PORT, () => {
            console.log('connected to db & listening on port', process.env.PORT)
            console.log('🔥 CONSOLE TEST - THIS SHOULD SHOW UP')
        })
    })
    .catch((error) => {
        console.log(error)
    })

