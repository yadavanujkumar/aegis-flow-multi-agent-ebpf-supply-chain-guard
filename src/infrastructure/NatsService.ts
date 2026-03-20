import { connect, NatsConnection, StringCodec, NatsError } from 'nats';
import { logger } from './Logger';
import { config } from '../config';

export class NatsService {
  private nc!: NatsConnection;
  private readonly sc = StringCodec();

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    this.nc = await connect({
      servers: this.url,
      reconnect: true,
      maxReconnectAttempts: config.NATS_RECONNECT_MAX,
      reconnectTimeWait: 2000,
      waitOnFirstConnect: true,
    });

    logger.info('NATS connected', { server: this.url });

    // Log NATS lifecycle events so operators have full observability
    (async () => {
      for await (const s of this.nc.status()) {
        logger.info('NATS status', { type: s.type, data: s.data });
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
      await this.nc.drain();
      logger.info('NATS connection drained');
    }
  }
}
