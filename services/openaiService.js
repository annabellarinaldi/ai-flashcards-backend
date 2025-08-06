const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract flashcard pairs from text using OpenAI
 * @param {string} text - The text content to process
 * @returns {Promise<Array>} Array of flashcard objects with term and definition
 */
const extractFlashcards = async (text) => {
  try {
    // Limit text length to avoid token limits
    const maxLength = 8000; // Roughly 2000 tokens
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

    const prompt = `
You are an expert at creating educational flashcards. Please analyze the following text and extract key concepts, terms, definitions, facts, and important information that would be valuable to study.

Create flashcards in the following JSON format:
[
  {"term": "concept or question", "definition": "clear, concise explanation or answer"},
  {"term": "another concept", "definition": "another explanation"}
]

Guidelines:
- Focus on the most important concepts, definitions, formulas, facts, and key points
- Make terms clear and specific
- Keep definitions concise but comprehensive (1-3 sentences)
- Include different types of content: definitions, facts, processes, examples
- Aim for 10-20 flashcards depending on content richness
- Ensure each flashcard tests meaningful knowledge
- Use simple, clear language

Text to analyze:
${truncatedText}

Return only the JSON array, no additional text:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates educational flashcards. You always respond with valid JSON arrays containing flashcard objects."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent output
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Try to parse the JSON response
    let flashcards;
    try {
      flashcards = JSON.parse(responseText);
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        flashcards = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse flashcards from AI response');
      }
    }

    // Validate the structure
    if (!Array.isArray(flashcards)) {
      throw new Error('AI response is not an array');
    }

    // Filter and validate flashcards
    const validFlashcards = flashcards
      .filter(card => 
        card && 
        typeof card === 'object' && 
        card.term && 
        card.definition &&
        card.term.trim().length > 0 &&
        card.definition.trim().length > 0
      )
      .map(card => ({
        term: card.term.trim(),
        definition: card.definition.trim()
      }));

    console.log(`✅ Generated ${validFlashcards.length} flashcards from text`);
    return validFlashcards;

  } catch (error) {
    console.error('Error generating flashcards:', error);
    
    // Return a helpful error message
    if (error.message.includes('API key')) {
      throw new Error('OpenAI API key is invalid or missing');
    } else if (error.message.includes('quota')) {
      throw new Error('OpenAI API quota exceeded');
    } else if (error.message.includes('rate limit')) {
      throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.');
    } else {
      throw new Error('Failed to generate flashcards. Please try again.');
    }
  }
};

/**
 * Generate sample flashcards for testing (when OpenAI is not available)
 * @param {string} text - The text content
 * @returns {Array} Sample flashcards
 */
const generateSampleFlashcards = (text) => {
  const words = text.split(' ').slice(0, 50); // First 50 words
  return [
    {
      term: "Sample Concept 1",
      definition: `Based on your document: ${words.slice(0, 15).join(' ')}...`
    },
    {
      term: "Sample Concept 2", 
      definition: `Key point from text: ${words.slice(15, 30).join(' ')}...`
    },
    {
      term: "Sample Concept 3",
      definition: `Important detail: ${words.slice(30, 45).join(' ')}...`
    }
  ];
};

module.exports = {
  extractFlashcards,
  generateSampleFlashcards
};