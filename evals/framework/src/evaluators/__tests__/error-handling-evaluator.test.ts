/**
 * ErrorHandlingEvaluator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorHandlingEvaluator } from '../error-handling-evaluator.js';
import { TimelineEvent, SessionInfo } from '../../types/index.js';

describe('ErrorHandlingEvaluator', () => {
  let evaluator: ErrorHandlingEvaluator;

  beforeEach(() => {
    evaluator = new ErrorHandlingEvaluator();
  });

  describe('Basic functionality', () => {
    it('should pass when no code is written', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'assistant_message',
          data: { text: 'Hello' }
        }
      ];

      const sessionInfo: SessionInfo = {
        id: 'test-session',
        version: '1.0',
        title: 'Test Session',
        time: { created: 1000, updated: 1000 }
      };

      const result = await evaluator.evaluate(timeline, sessionInfo);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.violations).toHaveLength(0);
      expect(result.metadata.codeWriteEventCount).toBe(0);
    });
  });

  describe('JavaScript/TypeScript error handling', () => {
    it('should detect unprotected API calls', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'write',
            input: {
              filePath: 'api.js',
              content: `
function fetchData() {
  return fetch('/api/data');
}

function getUser() {
  return axios.get('/api/user');
}
`
            }
          }
        }
      ];

      const sessionInfo: SessionInfo = {
        id: 'test-session',
        version: '1.0',
        title: 'Test Session',
        time: { created: 1000, updated: 1000 }
      };

      const result = await evaluator.evaluate(timeline, sessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations.filter(v => v.type === 'missing-error-handling')).toHaveLength(2);
    });
  });

  describe('Async operations', () => {
    it('should detect unprotected async operations', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'write',
            input: {
              filePath: 'async-ops.js',
              content: `
async function processItems(items) {
  const promises = items.map(item => processItem(item));
  return Promise.all(promises);
}

async function fetchAndProcess() {
  const data = await fetchData();
  return processData(data);
}
`
            }
          }
        }
      ];

      const sessionInfo: SessionInfo = {
        id: 'test-session',
        version: '1.0',
        title: 'Test Session',
        time: { created: 1000, updated: 1000 }
      };

      const result = await evaluator.evaluate(timeline, sessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations.filter(v => v.type === 'missing-error-handling')).toHaveLength(2);
    });
  });

  describe('Python error handling', () => {
    it('should detect unprotected operations in Python', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'write',
            input: {
              filePath: 'script.py',
              content: `
import requests

def fetch_data():
    response = requests.get('https://api.example.com/data')
    return response.json()

def read_file(path):
    with open(path, 'r') as f:
        return f.read()
`
            }
          }
        }
      ];

      const sessionInfo: SessionInfo = {
        id: 'test-session',
        version: '1.0',
        title: 'Test Session',
        time: { created: 1000, updated: 1000 }
      };

      const result = await evaluator.evaluate(timeline, sessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations.filter(v => v.type === 'missing-error-handling')).toHaveLength(1); // Only requests.get, not the with open
    });

    it('should pass when Python operations have error handling', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'write',
            input: {
              filePath: 'script.py',
              content: `
import requests

def fetch_data():
    try:
        response = requests.get('https://api.example.com/data')
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Failed to fetch data: {e}")
        raise

def read_file(path):
    try:
        with open(path, 'r') as f:
            return f.read()
    except IOError as e:
        print(f"Failed to read file: {e}")
        raise
`
            }
          }
        }
      ];

      const sessionInfo: SessionInfo = {
        id: 'test-session',
        version: '1.0',
        title: 'Test Session',
        time: { created: 1000, updated: 1000 }
      };

      const result = await evaluator.evaluate(timeline, sessionInfo);

      expect(result.violations.filter(v => v.type === 'missing-error-handling')).toHaveLength(0);
    });
  });

  describe('Edit operations', () => {
    it('should analyze code from edit operations', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'edit',
            input: {
              filePath: 'component.tsx',
              oldString: '// old code',
              newString: `
function MyComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(response => response.json())
      .then(setData);
  }, []);

  return <div>{data}</div>;
}
`
            }
          }
        }
      ];

      const sessionInfo: SessionInfo = {
        id: 'test-session',
        version: '1.0',
        title: 'Test Session',
        time: { created: 1000, updated: 1000 }
      };

      const result = await evaluator.evaluate(timeline, sessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations.filter(v => v.type === 'missing-error-handling')).toHaveLength(1);
    });
  });

  describe('Language detection', () => {
    it('should detect JavaScript from .js extension', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'write',
            input: {
              filePath: 'test.js',
              content: 'console.log("test");'
            }
          }
        }
      ];

      const sessionInfo: SessionInfo = {
        id: 'test-session',
        version: '1.0',
        title: 'Test Session',
        time: { created: 1000, updated: 1000 }
      };

      const result = await evaluator.evaluate(timeline, sessionInfo);

      expect(result.metadata.analysisCount).toBe(1);
    });

    it('should detect TypeScript from .ts extension', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'write',
            input: {
              filePath: 'test.ts',
              content: 'const x: string = "test";'
            }
          }
        }
      ];

      const sessionInfo: SessionInfo = {
        id: 'test-session',
        version: '1.0',
        title: 'Test Session',
        time: { created: 1000, updated: 1000 }
      };

      const result = await evaluator.evaluate(timeline, sessionInfo);

      expect(result.metadata.analysisCount).toBe(1);
    });

    it('should detect Python from .py extension', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'write',
            input: {
              filePath: 'test.py',
              content: 'print("test")'
            }
          }
        }
      ];

      const sessionInfo: SessionInfo = {
        id: 'test-session',
        version: '1.0',
        title: 'Test Session',
        time: { created: 1000, updated: 1000 }
      };

      const result = await evaluator.evaluate(timeline, sessionInfo);

      expect(result.metadata.analysisCount).toBe(1);
    });
  });
});