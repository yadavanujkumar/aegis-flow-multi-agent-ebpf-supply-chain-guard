import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { AttestationRecord } from '../domain/Events';
import { logger } from './Logger';
import { attestationsTotal } from './MetricsService';

const execAsync = promisify(exec);

interface SlsaProvenancePredicate {
  builder: { id: string };
  buildType: string;
  invocation: {
    configSource: { uri: string; digest: Record<string, string> };
  };
  metadata: {
    buildStartedOn: string;
    completeness: { parameters: boolean; environment: boolean; materials: boolean };
    reproducible: boolean;
  };
  materials: Array<{ uri: string; digest: Record<string, string> }>;
}

export class SigstoreService {
  /**
   * Attests that an artifact is safe by generating a SLSA provenance predicate
   * and invoking Cosign for keyless OIDC attestation.
   *
   * In environments without Cosign or OIDC tokens the attestation is recorded
   * in-process and logged at INFO level so the pipeline is never blocked.
   */
  async attestSafeness(artifactName: string): Promise<AttestationRecord> {
    const attestedAt = new Date().toISOString();
    const record: AttestationRecord = {
      artifactName,
      attestedAt,
      status: 'skipped',
    };

    const predicate: SlsaProvenancePredicate = {
      builder: { id: 'https://aegis-flow.security/builders/v1' },
      buildType: 'https://aegis-flow.security/build-types/dependency-scan/v1',
      invocation: {
        configSource: {
          uri: `artifact://${artifactName}`,
          digest: { sha256: '' },
        },
      },
      metadata: {
        buildStartedOn: attestedAt,
        completeness: { parameters: false, environment: false, materials: false },
        reproducible: false,
      },
      materials: [{ uri: `artifact://${artifactName}`, digest: { sha256: '' } }],
    };

    const tmpFile = path.join(os.tmpdir(), `aegis-predicate-${Date.now()}.json`);
    try {
      await writeFile(tmpFile, JSON.stringify(predicate, null, 2), 'utf-8');

      const { stdout } = await execAsync(
        `cosign attest --predicate "${tmpFile}" --type slsaprovenance --yes "${artifactName}"`,
        { timeout: 30000 }
      );

      record.status = 'success';
      attestationsTotal.inc({ status: 'success' });
      logger.info('Sigstore attestation successful', { artifactName, stdout: stdout.trim() });
    } catch (error) {
      const msg = String((error as Error).message ?? error);

      if (msg.includes('command not found') || msg.includes('not found')) {
        // Cosign not installed – record but don't fail the pipeline
        record.status = 'skipped';
        attestationsTotal.inc({ status: 'skipped' });
        logger.warn('Cosign not available – attestation skipped', { artifactName });
      } else {
        record.status = 'failed';
        attestationsTotal.inc({ status: 'failed' });
        logger.error('Sigstore attestation failed', { artifactName, error: msg });
      }
    } finally {
      await unlink(tmpFile).catch(() => undefined);
    }

    return record;
  }
}
