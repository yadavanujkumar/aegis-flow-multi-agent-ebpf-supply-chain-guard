import { connect, NatsConnection, StringCodec } from 'nats';

export class NatsService {
  private nc!: NatsConnection;
  private sc = StringCodec();

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    this.nc = await connect({ servers: this.url });
    console.log(`[NATS] Connected to ${this.url}`);
  }

  subscribe(subject: string, callback: (msg: string) => void): void {
    const sub = this.nc.subscribe(subject);
    (async () => {
      for await (const m of sub) {
        callback(this.sc.decode(m.data));
      }
    })().catch(console.error);
  }

  publish(subject: string, data: string): void {
    this.nc.publish(subject, this.sc.encode(data));
  }
}
