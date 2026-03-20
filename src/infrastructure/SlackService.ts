import axios, { AxiosError } from 'axios';
import { TelemetryEvent, AnalysisResult } from '../domain/Events';
import { logger } from './Logger';
import { config } from '../config';
import { slackAlertsTotal } from './MetricsService';

const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SlackService {
  constructor(private readonly webhookUrl: string) {}

  async sendAlert(event: TelemetryEvent, analysis: AnalysisResult): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('Slack webhook URL not configured – skipping alert', {
        explanation: analysis.explanation,
      });
      return;
    }

    const confidencePct = (analysis.confidence * 100).toFixed(1);
    const message = {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🚨 Aegis-Flow: Malicious Dependency Detected' },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*PID:* ${event.pid}` },
            { type: 'mrkdwn', text: `*Event Type:* \`${event.event_type}\`` },
            { type: 'mrkdwn', text: `*Confidence:* ${confidencePct}%` },
            ...(event.hostname
              ? [{ type: 'mrkdwn', text: `*Host:* ${event.hostname}` }]
              : []),
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              `*Command:*\n\`\`\`${event.command}\`\`\`\n` +
              `*Explanation:* ${analysis.explanation}\n` +
              `*Remediation:* ${analysis.remediation}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Detected at ${analysis.analyzedAt}`,
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '🔧 One-Click Remediate' },
              style: 'danger',
              value: 'remediate_dependency',
              action_id: 'remediate_dependency',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '✅ Mark as False Positive' },
              style: 'primary',
              value: 'false_positive',
              action_id: 'mark_false_positive',
            },
          ],
        },
      ],
    };

    for (let attempt = 1; attempt <= config.SLACK_RETRY_MAX; attempt++) {
      try {
        await axios.post(this.webhookUrl, message, { timeout: 10000 });
        slackAlertsTotal.inc({ status: 'success' });
        logger.info('Slack alert sent', { command: event.command, confidence: analysis.confidence });
        return;
      } catch (error) {
        const msg = (error as AxiosError).message ?? String(error);
        logger.warn('Slack alert attempt failed', { attempt, maxAttempts: config.SLACK_RETRY_MAX, error: msg });
        if (attempt < config.SLACK_RETRY_MAX) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    slackAlertsTotal.inc({ status: 'error' });
    logger.error('Slack alert failed after all retries', { command: event.command });
  }
}
