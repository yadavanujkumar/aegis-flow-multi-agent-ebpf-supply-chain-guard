import { connect, NatsConnection, StringCodec, NatsError } from 'nats';
import { logger } from './Logger';
import { config } from '../config';

export type NatsConnectionStatus = 'disconnected' | 'connected' | 'reconnecting' | 'draining' | 'closed';

export class NatsService {
  private nc!: NatsConnection;
  private readonly sc = StringCodec();
  private _status: NatsConnectionStatus = 'disconnected';

  constructor(private readonly url: string) {}

  /** Current connection status (useful for health checks). */
  get connectionStatus(): NatsConnectionStatus {
    return this._status;
  }

  async connect(): Promise<void> {
    this.nc = await connect({
      servers: this.url,
      reconnect: true,
      maxReconnectAttempts: config.NATS_RECONNECT_MAX,
      reconnectTimeWait: 2000,
      waitOnFirstConnect: true,
    });

    this._status = 'connected';
    logger.info('NATS connected', { server: this.url });

    // Track NATS lifecycle events for observability and health reporting
    (async () => {
      for await (const s of this.nc.status()) {
        logger.info('NATS status', { type: s.type, data: s.data });
        if (s.type === 'reconnect') this._status = 'connected';
        else if (s.type === 'reconnecting') this._status = 'reconnecting';
        else if (s.type === 'disconnect') this._status = 'disconnected';
      }
    })().catch((err: NatsError) => logger.error('NATS status monitor error', { error: err }));
  }

  subscribe(subject: string, callback: (msg: string) => void): void {
    const sub = this.nc.subscribe(subject);
    (async () => {
      for await (const m of sub) {
        callback(this.sc.decode(m.data));
      }
    })().catch((err) => logger.error('NATS subscription error', { subject, error: err }));
    logger.info('NATS subscribed', { subject });
  }

  publish(subject: string, data: string): void {
    this.nc.publish(subject, this.sc.encode(data));
  }

  async drain(): Promise<void> {
    if (this.nc) {
      this._status = 'draining';
      await this.nc.drain();
      this._status = 'closed';
      logger.info('NATS connection drained');
    }
  }
}
