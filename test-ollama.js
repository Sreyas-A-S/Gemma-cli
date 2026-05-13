import ollama from 'ollama';

async function test() {
  console.log('Testing connection to Ollama...');
  try {
    const response = await ollama.chat({
      model: 'gemma4',
      messages: [{ role: 'user', content: 'hi' }],
    });
    console.log('Response received:', response.message.content);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
