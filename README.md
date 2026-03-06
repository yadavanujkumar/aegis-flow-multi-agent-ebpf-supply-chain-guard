# Aegis-Flow: Multi-Agent eBPF Supply Chain Guard

A zero-trust security orchestration system designed to secure CI/CD pipelines. Aegis-Flow intercepts dependency installations, detonates them in hardened sandboxes (gVisor/Kata), and uses Rust-based eBPF probes for deep kernel-level telemetry. Telemetry is analyzed by a local Llama 3 instance to detect malicious behaviors, enabling automated Slack remediation and cryptographic attestation via Sigstore (Cosign).

## Architecture

- **Orchestrator (TypeScript/Node.js)**: A Domain-Driven Design (DDD) service that handles CI/CD webhooks, communicates with NATS, prompts Llama 3 (Ollama), and interfaces with Slack and Cosign.
- **eBPF Agent (Rust/Aya)**: A low-overhead agent running in privileged mode on the host (or within the sandbox manager) that hooks into kernel tracepoints (e.g., `sys_enter_execve`) and streams events to NATS.
- **Message Broker (NATS)**: Decouples the high-throughput eBPF telemetry from the orchestrator.
- **XAI (Ollama/Llama 3)**: Analyzes behavioral traces (e.g., unexpected network calls during `npm install`) to provide human-readable explainability and remediation steps.

## Prerequisites
- Docker & Docker Compose
- Rust toolchain (nightly required for eBPF compilation)
- Node.js 20+ & pnpm
- Ollama running locally or via Docker with the `llama3` model pulled.

## Quick Start

1. Install dependencies for the orchestrator:
   ```bash
   npm install
   ```
2. Start the infrastructure (NATS, Ollama, Orchestrator):
   ```bash
   docker-compose up -d --build
   ```
3. Run tests:
   ```bash
   npm run test
   ```

## API Endpoints
- `POST /api/webhook/cicd`: Ingests CI/CD events to trigger a detonation sandbox.
- `GET /health`: Health check.
