import { createOpencodeClient } from '@opencode-ai/sdk';

const client = createOpencodeClient({
  baseUrl: 'http://localhost:3721'
});

// Create session
const session = await client.session.create({
  body: { title: 'Manual Agent Test' }
});

console.log('Session created:', session.data.id);

// Send prompt with openagent
const response = await client.session.prompt({
  path: { id: session.data.id },
  body: {
    agent: 'openagent',
    parts: [{
      type: 'text',
      text: 'Create a simple TypeScript function called add that takes two numbers and returns their sum. Save it to src/utils/math.ts'
    }]
  }
});

console.log('\nResponse:', response.data.info);
console.log('\nParts:', response.data.parts.length);
response.data.parts.forEach((p, i) => {
  console.log(`  Part ${i + 1}: ${p.type}`);
  if (p.type === 'tool') {
    console.log(`    Tool: ${p.tool}`);
  }
});
