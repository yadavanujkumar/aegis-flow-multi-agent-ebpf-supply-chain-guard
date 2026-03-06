export interface TelemetryEvent {
  pid: number;
  command: string;
  event_type: string;
}

export interface AnalysisResult {
  isMalicious: boolean;
  confidence: number;
  explanation: string;
  remediation: string;
}
