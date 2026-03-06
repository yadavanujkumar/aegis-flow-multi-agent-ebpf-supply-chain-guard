import axios from 'axios';
import { AnalysisResult } from '../domain/Events';

export class OllamaService {
  constructor(private readonly baseUrl: string) {}

  async analyzeBehavior(command: string): Promise<AnalysisResult> {
    const prompt = `Analyze the following command executed during a CI/CD dependency installation. Determine if it is malicious. Command: "${command}". Respond in strictly valid JSON format with keys: isMalicious (boolean), confidence (number 0-1), explanation (string), remediation (string).`;

    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: 'llama3',
        prompt,
        stream: false,
        format: 'json'
      });

      const result = JSON.parse(response.data.response);
      return {
        isMalicious: result.isMalicious || false,
        confidence: result.confidence || 0,
        explanation: result.explanation || 'No explanation provided.',
        remediation: result.remediation || 'No remediation provided.'
      };
    } catch (error) {
      console.error('[Ollama] Analysis failed, defaulting to safe to prevent pipeline blockage', error);
      return { isMalicious: false, confidence: 0, explanation: 'Failed to analyze', remediation: '' };
    }
  }
}
