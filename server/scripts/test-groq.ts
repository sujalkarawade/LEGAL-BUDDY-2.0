import { GROQ_API_KEY, LLM_MODEL } from '../src/config/index.js';

async function main() {
  console.log('Testing OpenRouter endpoint with fetch:');
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Legal Buddy 2.0',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: [{ role: 'user', content: 'Say hello in 3 words' }],
        max_tokens: 20,
      }),
    });

    console.log('OpenRouter HTTP Status:', res.status);
    const data = await res.json();
    console.log('OpenRouter Response:', JSON.stringify(data));
  } catch (err: any) {
    console.error('Fetch error:', err.message);
  }
}

main().catch(console.error);
