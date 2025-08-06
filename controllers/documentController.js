const pdf = require('pdf-parse');
const { extractFlashcards, generateSampleFlashcards } = require('../services/openaiService');

/**
 * Extract text from different file types
 * @param {Object} file - Multer file object
 * @returns {Promise<string>} Extracted text content
 */
const extractTextFromFile = async (file) => {
  const { mimetype, buffer } = file;
  
  try {
    switch (mimetype) {
      case 'application/pdf':
        const pdfData = await pdf(buffer);
        return pdfData.text;
      
      case 'text/plain':
        return buffer.toString('utf-8');
      
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // For now, return error for Word docs (can be implemented later with mammoth)
        throw new Error('Word document processing not yet implemented. Please use PDF or TXT files.');
      
      default:
        throw new Error('Unsupported file type');
    }
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw new Error('Failed to extract text from file');
  }
};

/**
 * Upload document and generate flashcards
 */
const uploadDocument = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded. Please select a file.' 
      });
    }

    console.log(`📄 Processing file: ${req.file.originalname} (${req.file.mimetype})`);

    // Extract text from the uploaded file
    const extractedText = await extractTextFromFile(req.file);
    
    if (!extractedText || extractedText.trim().length < 50) {
      return res.status(400).json({ 
        error: 'Document appears to be empty or too short. Please upload a document with more content.' 
      });
    }

    console.log(`📝 Extracted ${extractedText.length} characters from document`);

    // Generate flashcards using OpenAI
    let flashcards;
    try {
      flashcards = await extractFlashcards(extractedText);
      
      if (!flashcards || flashcards.length === 0) {
        throw new Error('No flashcards generated');
      }
      
    } catch (openaiError) {
      console.error('OpenAI error:', openaiError.message);
      
      // Fallback to sample flashcards if OpenAI fails
      console.log('🔄 Falling back to sample flashcards');
      flashcards = generateSampleFlashcards(extractedText);
    }

    // Return the generated flashcards for user review
    res.status(200).json({
      message: `Successfully generated ${flashcards.length} flashcards`,
      flashcards: flashcards,
      originalText: extractedText.substring(0, 500) + '...', // First 500 chars for preview
      filename: req.file.originalname
    });

  } catch (error) {
    console.error('Document upload error:', error);
    
    // Return appropriate error message
    if (error.message.includes('API key')) {
      res.status(500).json({ 
        error: 'OpenAI configuration error. Please contact support.' 
      });
    } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
      res.status(429).json({ 
        error: 'AI service temporarily unavailable. Please try again later.' 
      });
    } else {
      res.status(400).json({ 
        error: error.message || 'Failed to process document' 
      });
    }
  }
};

/**
 * Save generated flashcards to database
 */
const saveFlashcards = async (req, res) => {
  const Flashcard = require('../models/flashcardModel');
  
  try {
    const { flashcards } = req.body;
    const user_id = req.user._id;

    if (!flashcards || !Array.isArray(flashcards) || flashcards.length === 0) {
      return res.status(400).json({ 
        error: 'No flashcards provided' 
      });
    }

    // Validate flashcards structure
    const validFlashcards = flashcards.filter(card => 
      card && card.term && card.definition && 
      card.term.trim().length > 0 && card.definition.trim().length > 0
    );

    if (validFlashcards.length === 0) {
      return res.status(400).json({ 
        error: 'No valid flashcards to save' 
      });
    }

    // Create flashcards in database
    const savedFlashcards = [];
    for (const card of validFlashcards) {
      const flashcard = await Flashcard.create({
        term: card.term.trim(),
        definition: card.definition.trim(),
        user_id: user_id
      });
      savedFlashcards.push(flashcard);
    }

    console.log(`💾 Saved ${savedFlashcards.length} flashcards for user ${user_id}`);

    res.status(200).json({
      message: `Successfully saved ${savedFlashcards.length} flashcards`,
      flashcards: savedFlashcards,
      count: savedFlashcards.length
    });

  } catch (error) {
    console.error('Save flashcards error:', error);
    res.status(500).json({ 
      error: 'Failed to save flashcards to database' 
    });
  }
};

module.exports = {
  uploadDocument,
  saveFlashcards
};