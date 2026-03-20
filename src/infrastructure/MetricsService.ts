import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: 'aegis_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

export const telemetryEventsTotal = new client.Counter({
  name: 'aegis_telemetry_events_total',
  help: 'Total number of eBPF telemetry events received',
  labelNames: ['event_type'] as const,
  registers: [register],
});

export const maliciousEventsTotal = new client.Counter({
  name: 'aegis_malicious_events_total',
  help: 'Total number of events classified as malicious',
  registers: [register],
});

export const benignEventsTotal = new client.Counter({
  name: 'aegis_benign_events_total',
  help: 'Total number of events classified as benign',
  registers: [register],
});

export const ollamaAnalysisDuration = new client.Histogram({
  name: 'aegis_ollama_analysis_duration_seconds',
  help: 'Ollama AI analysis latency in seconds',
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

export const slackAlertsTotal = new client.Counter({
  name: 'aegis_slack_alerts_total',
  help: 'Total number of Slack alerts sent',
  labelNames: ['status'] as const,
  registers: [register],
});

export const attestationsTotal = new client.Counter({
  name: 'aegis_attestations_total',
  help: 'Total number of Sigstore attestations attempted',
  labelNames: ['status'] as const,
  registers: [register],
});

export { register };
