import axios, { AxiosError } from 'axios';
import { AnalysisResult, AnalysisResultSchema } from '../domain/Events';
import { logger } from './Logger';
import { config } from '../config';
import { ollamaAnalysisDuration } from './MetricsService';

const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OllamaService {
  constructor(private readonly baseUrl: string) {}

  async analyzeBehavior(command: string): Promise<AnalysisResult> {
    const prompt =
      `You are a supply-chain security expert. Analyze the command below that was executed ` +
      `inside a CI/CD dependency installation sandbox. Determine whether it is malicious.\n\n` +
      `Command: "${command}"\n\n` +
      `Respond ONLY in valid JSON with these exact keys:\n` +
      `- isMalicious (boolean)\n` +
      `- confidence (number 0-1)\n` +
      `- explanation (string, ≤200 chars)\n` +
      `- remediation (string, ≤200 chars)`;

    const end = ollamaAnalysisDuration.startTimer();

    for (let attempt = 1; attempt <= config.OLLAMA_RETRY_MAX; attempt++) {
      try {
        const response = await axios.post(
          `${this.baseUrl}/api/generate`,
          { model: config.OLLAMA_MODEL, prompt, stream: false, format: 'json' },
          { timeout: config.OLLAMA_TIMEOUT_MS }
        );

        const raw = JSON.parse(response.data.response);
        const parsed = AnalysisResultSchema.safeParse({
          ...raw,
          analyzedAt: new Date().toISOString(),
        });

        if (!parsed.success) {
          logger.warn('Ollama response failed schema validation – using safe defaults', {
            issues: parsed.error.issues,
          });
          end();
          return this.safeDefault();
        }

        end({ success: 'true' });
        logger.debug('Ollama analysis complete', {
          command,
          isMalicious: parsed.data.isMalicious,
          confidence: parsed.data.confidence,
        });
        return parsed.data;
      } catch (error) {
        const isAxiosError = (error as AxiosError).isAxiosError;
        logger.warn('Ollama analysis attempt failed', {
          attempt,
          maxAttempts: config.OLLAMA_RETRY_MAX,
          error: isAxiosError
            ? (error as AxiosError).message
            : String(error),
        });
        if (attempt < config.OLLAMA_RETRY_MAX) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    end({ success: 'false' });
    logger.error('Ollama analysis failed after all retries – defaulting to safe to prevent pipeline blockage');
    return this.safeDefault();
  }

  private safeDefault(): AnalysisResult {
    return {
      isMalicious: false,
      confidence: 0,
      explanation: 'Analysis unavailable.',
      remediation: '',
      analyzedAt: new Date().toISOString(),
    };
  }
}
