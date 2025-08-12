const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Use AI to score a flashcard response on the SRS quality scale
 * @param {string} question - The question/term that was asked
 * @param {string} correctAnswer - The correct answer/definition
 * @param {string} userAnswer - The user's response
 * @param {string} reviewType - 'recognition' or 'recall'
 * @returns {Promise<Object>} AI scoring result with quality, reasoning, and confidence
 */
const scoreResponse = async (question, correctAnswer, userAnswer, reviewType = 'recognition') => {
  try {
    const prompt = `You are an expert educational assessment AI. Please evaluate a student's flashcard response using the spaced repetition system (SRS) quality scale:

**SRS Quality Scale:**
- 0 (Again): Completely wrong, no understanding shown, needs immediate review
- 1 (Hard): Partially correct but significant errors or missing key information
- 2 (Good): Mostly correct with minor errors or slight imprecision
- 3 (Easy): Perfect or near-perfect answer showing complete understanding

**Context:**
- Review Type: ${reviewType === 'recognition' ? 'Show term → recall definition' : 'Show definition → recall term'}
- Question: "${question}"
- Correct Answer: "${correctAnswer}"
- Student's Answer: "${userAnswer}"

**Evaluation Criteria:**
1. Factual accuracy and completeness
2. Understanding of key concepts
3. Appropriate level of detail
4. Semantic similarity even with different wording

**Important Guidelines:**
- Be generous with partial credit for conceptually correct answers
- Focus on understanding over exact wording
- Consider synonyms and alternative phrasings
- Account for minor spelling/grammar mistakes
- Reward answers that capture the essential meaning

Please respond with ONLY a JSON object in this exact format:
{
  "quality": 0,
  "reasoning": "Brief explanation of why this score was assigned",
  "confidence": 0.95,
  "isCorrect": false
}

Confidence should be 0.0-1.0 representing how certain you are about the scoring.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert educational assessment AI that evaluates student responses fairly and accurately. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.1, // Low temperature for consistent scoring
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Parse the JSON response
    let aiScore;
    try {
      aiScore = JSON.parse(responseText);
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiScore = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI scoring response');
      }
    }

    // Validate the response structure
    if (typeof aiScore.quality !== 'number' || 
        aiScore.quality < 0 || 
        aiScore.quality > 3 ||
        !Number.isInteger(aiScore.quality)) {
      throw new Error('Invalid quality score from AI');
    }

    if (typeof aiScore.confidence !== 'number' || 
        aiScore.confidence < 0 || 
        aiScore.confidence > 1) {
      aiScore.confidence = 0.8; // Default confidence
    }

    if (typeof aiScore.reasoning !== 'string') {
      aiScore.reasoning = 'AI assessment completed';
    }

    if (typeof aiScore.isCorrect !== 'boolean') {
      aiScore.isCorrect = aiScore.quality >= 2;
    }

    console.log(`🤖 AI Scoring: ${aiScore.quality} (confidence: ${aiScore.confidence.toFixed(2)})`);
    console.log(`📝 Reasoning: ${aiScore.reasoning}`);

    return {
      quality: aiScore.quality,
      reasoning: aiScore.reasoning,
      confidence: aiScore.confidence,
      isCorrect: aiScore.isCorrect,
      aiScored: true
    };

  } catch (error) {
    console.error('AI scoring error:', error);
    
    // Fallback to simple string matching if AI fails
    const fallbackScore = getFallbackScore(correctAnswer, userAnswer);
    
    return {
      quality: fallbackScore.quality,
      reasoning: `AI scoring unavailable, used fallback method: ${fallbackScore.reasoning}`,
      confidence: 0.6,
      isCorrect: fallbackScore.isCorrect,
      aiScored: false
    };
  }
};

/**
 * Fallback scoring method when AI is unavailable
 * @param {string} correctAnswer - The correct answer
 * @param {string} userAnswer - The user's response
 * @returns {Object} Fallback scoring result
 */
const getFallbackScore = (correctAnswer, userAnswer) => {
  if (!userAnswer || typeof userAnswer !== 'string') {
    return { quality: 0, reasoning: 'No answer provided', isCorrect: false };
  }
  
  const normalizeAnswer = (answer) => {
    return answer.toLowerCase()
      .trim()
      .replace(/[.,!?;:]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  };
  
  const normalizedUserAnswer = normalizeAnswer(userAnswer);
  const normalizedCorrectAnswer = normalizeAnswer(correctAnswer);
  
  // Exact match
  if (normalizedUserAnswer === normalizedCorrectAnswer) {
    return { quality: 3, reasoning: 'Exact match', isCorrect: true };
  }
  
  // Check if user answer is contained in correct answer or vice versa
  if (normalizedCorrectAnswer.includes(normalizedUserAnswer) || 
      normalizedUserAnswer.includes(normalizedCorrectAnswer)) {
    return { quality: 2, reasoning: 'Partial match found', isCorrect: true };
  }
  
  // Check word overlap
  const userWords = normalizedUserAnswer.split(' ').filter(word => word.length > 2);
  const correctWords = normalizedCorrectAnswer.split(' ').filter(word => word.length > 2);
  
  if (userWords.length === 0 || correctWords.length === 0) {
    return { quality: 0, reasoning: 'Insufficient content to evaluate', isCorrect: false };
  }
  
  // Calculate word overlap
  const matchedWords = userWords.filter(word => 
    correctWords.some(correctWord => 
      correctWord.includes(word) || word.includes(correctWord)
    )
  );
  
  const overlapRatio = matchedWords.length / correctWords.length;
  
  if (overlapRatio >= 0.7) {
    return { quality: 2, reasoning: 'Good word overlap (70%+)', isCorrect: true };
  } else if (overlapRatio >= 0.4) {
    return { quality: 1, reasoning: 'Some word overlap (40-70%)', isCorrect: false };
  } else {
    return { quality: 0, reasoning: 'Low word overlap (<40%)', isCorrect: false };
  }
};

module.exports = {
  scoreResponse,
  getFallbackScore
};