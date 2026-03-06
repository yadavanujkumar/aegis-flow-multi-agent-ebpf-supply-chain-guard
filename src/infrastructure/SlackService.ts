import axios from 'axios';
import { TelemetryEvent, AnalysisResult } from '../domain/Events';

export class SlackService {
  constructor(private readonly webhookUrl: string) {}

  async sendAlert(event: TelemetryEvent, analysis: AnalysisResult): Promise<void> {
    if (!this.webhookUrl) {
      console.log('[Slack] Webhook URL not configured. Skipping alert.', analysis.explanation);
      return;
    }

    const message = {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🚨 Aegis-Flow: Malicious Dependency Detected' }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Process:* 
\`\`\`${event.command}\`\`\`\n*Explanation:* ${analysis.explanation}\n*Confidence:* ${analysis.confidence * 100}%` }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'One-Click Remediate' },
              style: 'danger',
              value: 'remediate_dependency'
            }
          ]
        }
      ]
    };

    await axios.post(this.webhookUrl, message);
  }
}
