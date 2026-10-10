import OpenAI from 'openai';
import { GROQ_API_KEY, LLM_MODEL } from '../src/config/index.js';

async function testJson() {
  const client = new OpenAI({
    apiKey: GROQ_API_KEY.trim(),
    baseURL: 'https://openrouter.ai/api/v1',
  });

  console.log('Sending chat completion to OpenRouter with Llama 3.3 70B...');
  const t0 = Date.now();
  const res = await client.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: 'You are a legal assistant. Respond strictly in valid JSON: {"contractType": "NDA", "summary": "test"}' },
      { role: 'user', content: 'Analyze this sample NDA' }
    ],
    // Let's test without response_format first
  });

  console.log(`Received in ${Date.now() - t0}ms:`, res.choices[0]?.message?.content);
}

testJson().catch(console.error);
