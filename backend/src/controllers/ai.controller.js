const { generateBlogFromPrompt } = require('../services/ai.service');

async function generate(req, res, next) {
  try {
    const { prompt } = req.body;

    if (!prompt) { 
      res.status(400); 
      throw new Error('Prompt is required for AI generation'); 
    }
    
    // Validate prompt length
    if (prompt.length < 10) {
      res.status(400);
      throw new Error('Prompt is too short. Please provide a more detailed description (at least 10 characters).');
    }
    
    if (prompt.length > 1000) {
      res.status(400);
      throw new Error('Prompt is too long. Please keep it under 1000 characters.');
    }
    
    console.log('🤖 Generating AI content for prompt:', prompt.substring(0, 100) + '...');
    
    // ✅ FIX 1: Service error handling
    let text;
    try {
      text = await generateBlogFromPrompt(prompt);
    } catch (serviceError) {
      console.error('❌ Service Error:', serviceError.message);
      return res.status(500).json({
        message: 'AI service failed',
        error: serviceError.message
      });
    }

    if (!text || typeof text !== 'string') {
      return res.status(500).json({
        message: 'AI returned empty or invalid response'
      });
    }

    console.log('📄 Raw AI response length:', text.length, 'characters');
    console.log('📄 First 200 chars:', text.substring(0, 200) + '...');
    console.log('📡 Full raw response:', text); // ✅ DEBUG

    // Parse the AI response
    let parsed;
    try {
      let cleanText = text
        .replace(/```json\s*/gi, '')
        .replace(/```javascript\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
      }
      
      console.log('🔍 Attempting to parse cleaned text:', cleanText.substring(0, 300));
      
      parsed = JSON.parse(cleanText);
      console.log('✅ Successfully parsed AI response');
      
      if (!parsed.title || !parsed.content) {
        console.warn('⚠️ Missing required fields, adding defaults');
        parsed.title = parsed.title || 'AI Generated Post';
        parsed.content = parsed.content || '<p>Content generation incomplete. Please try again.</p>';
      }
      
      if (!parsed.summary) {
        const plainText = parsed.content.replace(/<[^>]*>/g, '').trim();
        parsed.summary = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : '');
      }
      
      if (!parsed.category) {
        parsed.category = 'General';
      }
      
      if (!parsed.tags) {
        parsed.tags = [];
      } else if (!Array.isArray(parsed.tags)) {
        if (typeof parsed.tags === 'string') {
          parsed.tags = parsed.tags.split(',').map(t => t.trim().toLowerCase());
        } else {
          parsed.tags = [];
        }
      } else {
        parsed.tags = parsed.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean);
      }
      
      if (!parsed.content.includes('<')) {
        parsed.content = `<p>${parsed.content}</p>`;
      }
      
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError.message);
      console.log('📄 Problematic text:', text.substring(0, 500));

      // ✅ FIX 2: Safe fallback instead of crash
      parsed = {
        title: 'AI Generated Content',
        content: `<p>${text.substring(0, 1000)}</p>`,
        summary: text.substring(0, 150),
        category: 'General',
        tags: []
      };

      console.log('⚠️ Fallback content used');
    }
    
    console.log('📤 Sending parsed result to frontend');

    // ✅ FIX 3: Consistent response format
    res.json({
      success: true,
      data: parsed
    });

  } catch (e) { 
    console.error('❌ AI generation error:', e.message);
    next(e); 
  }
}

async function testConnection(req, res, next) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        error: 'GEMINI_API_KEY not configured',
        suggestion: 'Add your Gemini API key to the .env file'
      });
    }
    
    const text = await generateBlogFromPrompt('Write a single sentence about AI');

    res.json({ 
      status: 'success',
      message: 'Gemini API is working correctly',
      sample: text.substring(0, 100),
      apiKeyConfigured: true
    });

  } catch (e) {
    res.status(500).json({ 
      error: e.message,
      suggestion: 'Check your Gemini API key'
    });
  }
}

module.exports = { generate, testConnection };