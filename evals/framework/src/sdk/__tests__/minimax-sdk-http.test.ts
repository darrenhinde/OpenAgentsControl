import { afterEach, describe, expect, it, vi } from 'vitest';
import { join } from 'path';
import { ClientManager } from '../client-manager.js';
import { PromptManager } from '../prompt-manager.js';

const root = join(__dirname, '..', '..', '..', '..', '..');

// Keep the real SDK serializer; intercept only its HTTP transport.
function captureRequests(): Request[] {
  const requests: Request[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request.clone());
    return new Response(JSON.stringify({ info: { id: 'message-test' }, parts: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }));
  return requests;
}

afterEach(() => vi.unstubAllGlobals());

describe('MiniMax SDK HTTP boundary', () => {
  it('sends the prompt variant default as Flash through the real SDK', async () => {
    const requests = captureRequests();
    const manager = new PromptManager(root);
    const selected = manager.getRecommendedModel('core/openagent', 'minimax');
    expect(selected).toBe('minimax/MiniMax-M3.1-Flash');
    const [providerID, modelID] = selected!.split('/');
    const client = new ClientManager({ baseUrl: 'http://opencode.test' });

    await client.sendPrompt('session-test', {
      text: 'Explain this code', agent: 'OpenAgent', model: { providerID, modelID },
      directory: '/project', noReply: false,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('POST');
    expect(new URL(requests[0].url).pathname).toBe('/session/session-test/message');
    expect(new URL(requests[0].url).searchParams.get('directory')).toBe('/project');
    expect(await requests[0].json()).toEqual({
      parts: [{ type: 'text', text: 'Explain this code' }],
      agent: 'OpenAgent', model: { providerID: 'minimax', modelID: 'MiniMax-M3.1-Flash' },
      noReply: false,
    });
  });

  it.each([
    ['minimax', 'MiniMax-M3'],
    ['minimax', 'MiniMax-M2.7'],
    ['minimax', 'MiniMax-M2.7-highspeed'],
    ['minimax', 'saved-custom-model'],
    ['custom-region', 'MiniMax-M3.1-Flash'],
    ['other-provider', 'saved-model'],
  ])('preserves an explicit %s/%s selection', async (providerID, modelID) => {
    const requests = captureRequests();
    const client = new ClientManager({ baseUrl: 'http://opencode.test' });
    await client.sendPrompt('session-test', {
      text: 'Continue', model: { providerID, modelID },
    });
    expect(await requests[0].json()).toEqual({
      parts: [{ type: 'text', text: 'Continue' }], model: { providerID, modelID },
    });
  });

  it('leaves the server model selection untouched when no model is supplied', async () => {
    const requests = captureRequests();
    const client = new ClientManager({ baseUrl: 'http://opencode.test' });
    await client.sendPrompt('session-test', { text: 'Continue' });
    expect(await requests[0].json()).toEqual({ parts: [{ type: 'text', text: 'Continue' }] });
  });
});
