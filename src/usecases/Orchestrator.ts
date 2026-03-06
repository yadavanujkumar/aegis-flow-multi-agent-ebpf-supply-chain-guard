import { NatsService } from '../infrastructure/NatsService';
import { OllamaService } from '../infrastructure/OllamaService';
import { SlackService } from '../infrastructure/SlackService';
import { SigstoreService } from '../infrastructure/SigstoreService';
import { TelemetryEvent } from '../domain/Events';

export class Orchestrator {
  constructor(
    private readonly natsService: NatsService,
    private readonly ollamaService: OllamaService,
    private readonly slackService: SlackService,
    private readonly sigstoreService: SigstoreService
  ) {}

  async triggerDetonation(repo: string, commit: string, file: string): Promise<void> {
    console.log(`[Detonation] Triggering gVisor sandbox for ${repo}@${commit} evaluating ${file}`);
    // Integration with Kubernetes/Kata/gVisor goes here.
  }

  listenForTelemetry(): void {
    this.natsService.subscribe('aegis.telemetry', async (msg) => {
      const event: TelemetryEvent = JSON.parse(msg);
      console.log(`[Telemetry] Received eBPF event: ${event.command}`);
      await this.processEvent(event);
    });
  }

  private async processEvent(event: TelemetryEvent): Promise<void> {
    try {
      const analysis = await this.ollamaService.analyzeBehavior(event.command);
      if (analysis.isMalicious && analysis.confidence > 0.8) {
        console.warn(`[Security] Malicious behavior detected! Commencing remediation.`);
        await this.slackService.sendAlert(event, analysis);
      } else {
        console.log(`[Security] Event benign. Attesting with Sigstore.`);
        await this.sigstoreService.attestSafeness(event.command);
      }
    } catch (err) {
      console.error(`[Orchestrator Error] Failed to process event:`, err);
    }
  }
}
