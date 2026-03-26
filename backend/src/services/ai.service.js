const { GoogleGenerativeAI } = require('@google/generative-ai');

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment variables');
  return new GoogleGenerativeAI(apiKey);
}

// Retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      const is503Error = error.message?.includes('503') || error.message?.includes('overloaded');
      const is429Error = error.message?.includes('429') || error.message?.includes('Rate limit');
      
      if (isLastAttempt || (!is503Error && !is429Error)) {
        throw error;
      }
      
      const delay = initialDelay * Math.pow(2, i);
      console.log(`⏳ Retry attempt ${i + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function generateBlogFromPrompt(prompt) {
  try {
    const genAI = getClient();

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });
    
    // ✅ FIXED STRONG PROMPT
    const systemPrompt = `You are a professional blog generator.

IMPORTANT RULES:
- Return ONLY valid JSON (no markdown, no explanation)
- Start with { and end with }
- NEVER leave any field empty

JSON FORMAT:
{
  "title": "string",
  "content": "HTML formatted blog content",
  "summary": "short summary",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "Technology"
}

If unsure, still fill all fields with reasonable defaults.

Topic: ${prompt}`;

    const fullPrompt = `${systemPrompt}\n\nGenerate blog now.`;
    
    // ✅ FIX: Response validation added
    const text = await retryWithBackoff(async () => {
      console.log('📡 Calling Gemini API...');
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const output = response.text();

      if (!output || output.length < 50) {
        throw new Error("Weak or empty AI response");
      }

      return output;
    }, 3, 1000);
    
    console.log('✅ Gemini API call successful');
    return text;

  } catch (error) {
    console.error('Gemini API Error (Full):', error);
    console.error('Error message:', error.message);
    console.error('Error status:', error.status);
    console.error('Error details:', error.details);
    
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('invalid API key')) {
      throw new Error('Gemini API key is invalid. Please check your GEMINI_API_KEY');
    }
    
    if (error.message?.includes('503') || error.message?.includes('overloaded')) {
      throw new Error('AI service overloaded. Try again.');
    }
    
    if (error.message?.includes('quota')) {
      throw new Error('API quota exceeded.');
    }
    
    if (error.message?.includes('429')) {
      throw new Error('Rate limit exceeded.');
    }
    
    throw new Error(`AI generation failed: ${error.message}`);
  }
}

module.exports = { generateBlogFromPrompt };