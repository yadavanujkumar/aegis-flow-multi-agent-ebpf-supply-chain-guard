import { NatsService } from '../infrastructure/NatsService';
import { OllamaService } from '../infrastructure/OllamaService';
import { SlackService } from '../infrastructure/SlackService';
import { SigstoreService } from '../infrastructure/SigstoreService';
import { TelemetryEvent, TelemetryEventSchema } from '../domain/Events';
import { logger } from '../infrastructure/Logger';
import { config } from '../config';
import {
  telemetryEventsTotal,
  maliciousEventsTotal,
  benignEventsTotal,
} from '../infrastructure/MetricsService';

export class Orchestrator {
  constructor(
    private readonly natsService: NatsService,
    private readonly ollamaService: OllamaService,
    private readonly slackService: SlackService,
    private readonly sigstoreService: SigstoreService
  ) {}

  async triggerDetonation(repo: string, commit: string, file: string): Promise<void> {
    logger.info('Triggering gVisor sandbox detonation', { repo, commit, file });
    // Integration with Kubernetes/Kata/gVisor goes here.
  }

  listenForTelemetry(): void {
    this.natsService.subscribe('aegis.telemetry', async (msg) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(msg);
      } catch {
        logger.warn('Received unparseable NATS message – discarding', { raw: msg.slice(0, 200) });
        return;
      }

      const result = TelemetryEventSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn('Received invalid telemetry event – discarding', { issues: result.error.issues });
        return;
      }

      const event: TelemetryEvent = result.data;
      telemetryEventsTotal.inc({ event_type: event.event_type });
      logger.info('Received eBPF telemetry event', { pid: event.pid, command: event.command, event_type: event.event_type });
      await this.processEvent(event);
    });
    logger.info('Orchestrator listening for telemetry on aegis.telemetry');
  }

  async processEvent(event: TelemetryEvent): Promise<void> {
    try {
      const analysis = await this.ollamaService.analyzeBehavior(event.command);
      if (analysis.isMalicious && analysis.confidence > config.MALICIOUS_CONFIDENCE_THRESHOLD) {
        maliciousEventsTotal.inc();
        logger.warn('Malicious behavior detected – alerting and blocking', {
          command: event.command,
          confidence: analysis.confidence,
          explanation: analysis.explanation,
        });
        await this.slackService.sendAlert(event, analysis);
      } else {
        benignEventsTotal.inc();
        logger.info('Event classified as benign – attesting with Sigstore', {
          command: event.command,
          confidence: analysis.confidence,
        });
        await this.sigstoreService.attestSafeness(event.command);
      }
    } catch (err) {
      logger.error('Failed to process telemetry event', { error: err, command: event.command });
    }
  }
}
