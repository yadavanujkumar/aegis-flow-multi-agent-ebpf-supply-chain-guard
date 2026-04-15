# Aegis-Flow: Multi-Agent eBPF Supply Chain Guard

> **Zero-trust, real-time supply chain security for CI/CD pipelines.**

Aegis-Flow intercepts dependency installations, detonates them in hardened sandboxes (gVisor/Kata), and uses Rust-based eBPF probes for deep kernel-level telemetry. Telemetry is analyzed by a local Llama 3 AI instance to detect malicious behaviors, triggering automated Slack remediation alerts and cryptographic attestation via Sigstore (Cosign).

[![CI](https://github.com/yadavanujkumar/aegis-flow-multi-agent-ebpf-supply-chain-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/yadavanujkumar/aegis-flow-multi-agent-ebpf-supply-chain-guard/actions/workflows/ci.yml)

---

## Table of Contents

1. [Architecture](#architecture)
2. [Feature Highlights](#feature-highlights)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [Configuration Reference](#configuration-reference)
6. [API Reference](#api-reference)
7. [Security Model](#security-model)
8. [Observability](#observability)
9. [Development](#development)
10. [Contributing](#contributing)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CI/CD Pipeline Host                           │
│                                                                      │
│  ┌───────────────────┐    eBPF tracepoints    ┌──────────────────┐  │
│  │  Dependency Sandbox│◄──────────────────────│  eBPF Agent (Rust)│  │
│  │ (gVisor / Kata)   │                        │  (Aya + Tokio)   │  │
│  └───────────────────┘                        └────────┬─────────┘  │
│                                                         │ NATS pub   │
└─────────────────────────────────────────────────────────┼────────────┘
                                                          │
                                                   ┌──────▼──────┐
                                                   │    NATS 2.x  │
                                                   │  (JetStream) │
                                                   └──────┬──────┘
                                                          │ subscribe
                                          ┌───────────────▼──────────────────┐
                                          │     Orchestrator (TypeScript)     │
                                          │                                   │
                                          │  ┌─────────────────────────────┐  │
                                          │  │  Zod schema validation       │  │
                                          │  │  Rate limiting + Helmet      │  │
                                          │  │  API-key authentication      │  │
                                          │  │  Prometheus metrics          │  │
                                          │  │  Winston structured logging  │  │
                                          │  └─────────────────────────────┘  │
                                          │         │              │           │
                                          │  ┌──────▼──────┐ ┌────▼────────┐  │
                                          │  │  Ollama API  │ │  Sigstore   │  │
                                          │  │  (Llama 3)   │ │  (Cosign)   │  │
                                          │  └─────────────┘ └─────────────┘  │
                                          │         │                          │
                                          │  ┌──────▼──────┐                  │
                                          │  │  Slack Alerts│                  │
                                          │  └─────────────┘                  │
                                          └───────────────────────────────────┘
```

### Components

| Component | Language / Runtime | Role |
|---|---|---|
| **Orchestrator** | TypeScript / Node.js 20 | Webhooks, AI orchestration, alerting |
| **eBPF Agent** | Rust / Aya | Kernel-level syscall telemetry |
| **NATS** | Go (external) | High-throughput telemetry message bus |
| **Ollama / Llama 3** | Python (external) | Local XAI behavior analysis |
| **Sigstore / Cosign** | Go (external CLI) | Supply-chain attestation |

---

## Feature Highlights

| Feature | Status |
|---|---|
| CI/CD webhook ingestion | ✅ |
| gVisor / Kata sandbox detonation | 🔧 (integration point) |
| Rust eBPF kernel probe (execve) | ✅ (stub; real BPF loading wired) |
| NATS telemetry pipeline | ✅ |
| Llama 3 AI behavior analysis | ✅ |
| Retry logic (Ollama + Slack) | ✅ |
| Structured JSON logging (Winston) | ✅ |
| Prometheus metrics endpoint | ✅ |
| API-key authentication (timing-safe) | ✅ |
| Request correlation IDs (`X-Request-Id`) | ✅ |
| Zod request/response validation | ✅ |
| Security headers (Helmet) | ✅ |
| Rate limiting | ✅ |
| Graceful shutdown (SIGTERM) with timeout | ✅ |
| NATS reconnect / drain | ✅ |
| Live NATS health reporting | ✅ |
| Slack Block Kit alerts + buttons | ✅ |
| Sigstore SLSA provenance predicate | ✅ |
| Container health checks | ✅ |
| Non-root Docker user | ✅ |
| `npm audit` / `cargo audit` in CI | ✅ |
| Trivy container image scan | ✅ |

---

## Prerequisites

- **Docker** ≥ 24 and **Docker Compose** ≥ 2.20
- **Node.js** ≥ 20 and **npm** ≥ 10
- **Rust** nightly (for eBPF agent compilation)
- **Ollama** with `llama3` model (pulled automatically by Compose)

---

## Quick Start

### 1 – Clone & install

```bash
git clone https://github.com/yadavanujkumar/aegis-flow-multi-agent-ebpf-supply-chain-guard.git
cd aegis-flow-multi-agent-ebpf-supply-chain-guard
npm install
```

### 2 – Configure environment

Copy the example file and fill in secrets:

```bash
cp .env.example .env
# Edit .env with your SLACK_WEBHOOK_URL and API_KEY
```

### 3 – Start all services

```bash
docker compose up -d --build
```

### 4 – Verify

```bash
curl http://localhost:3000/health
# → {"status":"ok","version":"...","uptime":...,"services":{...}}

curl http://localhost:3000/metrics
# → Prometheus text metrics
```

---

## Configuration Reference

All configuration is injected via environment variables and validated at startup using Zod.  
The application **refuses to start** if required variables are invalid.

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `3000` | HTTP server port |
| `NATS_URL` | `nats://localhost:4222` | NATS broker connection string |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama base URL |
| `OLLAMA_MODEL` | `llama3` | Model name to use for analysis |
| `OLLAMA_TIMEOUT_MS` | `30000` | Per-request timeout (ms) |
| `SLACK_WEBHOOK_URL` | *(empty)* | Incoming webhook URL; alerts disabled if empty |
| `API_KEY` | *(empty)* | 32-character minimum API key; auth disabled if empty |
| `MALICIOUS_CONFIDENCE_THRESHOLD` | `0.8` | Min AI confidence to treat event as malicious |
| `LOG_LEVEL` | `info` | Winston log level |
| `METRICS_ENABLED` | `true` | Expose `/metrics` endpoint |
| `NATS_RECONNECT_MAX` | `10` | Max NATS reconnect attempts |
| `OLLAMA_RETRY_MAX` | `3` | Max retries for Ollama analysis |
| `SLACK_RETRY_MAX` | `3` | Max retries for Slack webhook |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |

---

## API Reference

### `POST /api/webhook/cicd`

Triggers a gVisor/Kata sandbox detonation for a CI/CD dependency installation event.

**Authentication:** `X-API-Key: <your-key>` header (if `API_KEY` is configured)

**Request body:**

```jsonc
{
  "repository": "owner/repo",          // required – alphanumeric + _ . - /
  "commit": "abc1234def567890",         // required – hex SHA
  "dependencyFile": "package.json",    // required – safe file path
  "ref": "refs/heads/main",            // optional
  "triggeredBy": "github-actions"      // optional
}
```

**Responses:**

| Code | Meaning |
|---|---|
| `202` | Detonation queued |
| `401` | Missing or invalid `X-API-Key` |
| `422` | Request body validation failed (returns field-level errors) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

### `GET /health`

Returns live status information about the orchestrator and its connected services.
Returns `200 OK` when all services are healthy, or `503 Service Unavailable`
when a critical dependency (e.g. NATS) is degraded.

```jsonc
{
  "status": "ok",           // "ok" | "degraded"
  "version": "1.0.0",
  "uptime": 42.3,
  "timestamp": "2025-01-01T00:00:00.000Z",
  "services": {
    "nats": "connected",    // "connected" | "disconnected" | "reconnecting" | …
    "ollama": "http://ollama:11434",
    "slack": "configured"
  }
}
```

---

### `GET /metrics`

Prometheus-compatible metrics.  Expose this only on an internal network.

Key metrics:

| Metric | Type | Description |
|---|---|---|
| `aegis_http_request_duration_seconds` | Histogram | HTTP request latency by method/route/status |
| `aegis_telemetry_events_total` | Counter | eBPF events received |
| `aegis_malicious_events_total` | Counter | Events classified as malicious |
| `aegis_benign_events_total` | Counter | Events classified as benign |
| `aegis_ollama_analysis_duration_seconds` | Histogram | AI analysis latency |
| `aegis_slack_alerts_total` | Counter | Slack alerts sent (labeled by status) |
| `aegis_attestations_total` | Counter | Sigstore attestations (labeled by status) |

---

## Security Model

### Zero-Trust Principles

1. **Verify every dependency** – all packages run in an isolated sandbox before they reach the build.
2. **Assume breach** – eBPF probes record every syscall; any deviation triggers analysis.
3. **Least privilege** – the orchestrator container runs as a non-root user; the eBPF agent is the only privileged container.
4. **Signed provenance** – benign artifacts receive a SLSA provenance attestation via Cosign.

### Threat Model

| Threat | Mitigation |
|---|---|
| Malicious `postinstall` scripts | Sandboxed execution + eBPF telemetry |
| Prompt injection via `command` field | Cosine-distance filtering; Ollama runs locally (no external exfiltration) |
| Unauthenticated webhook calls | `X-API-Key` middleware (timing-safe comparison) |
| Oversized payloads | 100 KB body limit |
| Brute-force / flooding | Rate limiting (100 req/min by default) |
| Dependency confusion | `npm audit` + Trivy in CI |

---

## Observability

### Logging

All logs are structured JSON (Winston) with the following fields:

```jsonc
{
  "level": "info",
  "message": "CI/CD webhook received",
  "service": "aegis-flow-orchestrator",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "repository": "owner/repo",
  "commit": "abc123"
}
```

Set `LOG_LEVEL=debug` for verbose output during development.

### Metrics

Scrape `GET /metrics` with Prometheus.  A sample `prometheus.yml` scrape config:

```yaml
scrape_configs:
  - job_name: aegis-flow
    static_configs:
      - targets: ['orchestrator:3000']
```

---

## Development

```bash
# Install dependencies
npm install

# Start in watch mode
npm run dev

# Run tests (with coverage)
npm test

# Type-check only
npx tsc --noEmit

# Lint
npm run lint
```

### Running tests

```bash
npm test
# 20 tests, ~92 % coverage
```

### Project structure

```
src/
├── config.ts                    # Env validation (Zod)
├── index.ts                     # App bootstrap, middleware, routes
├── domain/
│   └── Events.ts                # Domain interfaces + Zod schemas
├── infrastructure/
│   ├── Logger.ts                # Winston structured logger
│   ├── MetricsService.ts        # Prometheus counters / histograms
│   ├── NatsService.ts           # NATS client (reconnect, drain)
│   ├── OllamaService.ts         # Ollama AI client (retry, timeout)
│   ├── SlackService.ts          # Slack webhook client (retry)
│   └── SigstoreService.ts       # Cosign / SLSA attestation
├── middleware/
│   ├── auth.ts                  # API-key authentication (timing-safe)
│   ├── requestId.ts             # Request correlation ID (X-Request-Id)
│   └── validate.ts              # Zod body validation factory
└── usecases/
    └── Orchestrator.ts          # Core business logic
tests/
├── Orchestrator.test.ts         # Unit tests (Jest + ts-jest)
├── auth.test.ts                 # API-key auth middleware tests
├── validate.test.ts             # Zod validation middleware tests
└── requestId.test.ts            # Request correlation ID tests
ebpf-agent/
└── src/main.rs                  # Rust eBPF agent (Aya)
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push (`git push origin feat/my-feature`)
5. Open a Pull Request

All PRs must pass CI (lint, build, test, `npm audit`, Trivy scan) before merging.

