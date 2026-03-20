import { z } from 'zod';

// ─── Domain Models ────────────────────────────────────────────────────────────

export interface TelemetryEvent {
  pid: number;
  command: string;
  event_type: string;
  timestamp?: string;
  hostname?: string;
  container_id?: string;
}

export interface AnalysisResult {
  isMalicious: boolean;
  confidence: number;
  explanation: string;
  remediation: string;
  analyzedAt?: string;
}

export interface DetonationRequest {
  repository: string;
  commit: string;
  dependencyFile: string;
  ref?: string;
  triggeredBy?: string;
}

export interface AttestationRecord {
  artifactName: string;
  digest?: string;
  attestedAt: string;
  status: 'success' | 'failed' | 'skipped';
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const TelemetryEventSchema = z.object({
  pid: z.number().int().positive(),
  command: z.string().min(1).max(4096),
  event_type: z.string().min(1),
  timestamp: z.string().optional(),
  hostname: z.string().optional(),
  container_id: z.string().optional(),
});

export const DetonationRequestSchema = z.object({
  repository: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9_.\-/]+$/, 'Repository must be a valid name (owner/repo)'),
  commit: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-f0-9]+$/i, 'Commit must be a valid SHA'),
  dependencyFile: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9_.\-/]+$/, 'Dependency file must be a safe path'),
  ref: z.string().optional(),
  triggeredBy: z.string().optional(),
});

export const AnalysisResultSchema = z.object({
  isMalicious: z.boolean(),
  confidence: z.number().min(0).max(1),
  explanation: z.string().max(500),
  remediation: z.string().max(500),
  analyzedAt: z.string().optional(),
});
