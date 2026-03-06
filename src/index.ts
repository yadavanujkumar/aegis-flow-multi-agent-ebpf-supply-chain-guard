import express from 'express';
import { Orchestrator } from './usecases/Orchestrator';
import { NatsService } from './infrastructure/NatsService';
import { OllamaService } from './infrastructure/OllamaService';
import { SlackService } from './infrastructure/SlackService';
import { SigstoreService } from './infrastructure/SigstoreService';

const app = express();
app.use(express.json());

const natsService = new NatsService(process.env.NATS_URL || 'nats://localhost:4222');
const ollamaService = new OllamaService(process.env.OLLAMA_URL || 'http://localhost:11434');
const slackService = new SlackService(process.env.SLACK_WEBHOOK_URL || '');
const sigstoreService = new SigstoreService();

const orchestrator = new Orchestrator(natsService, ollamaService, slackService, sigstoreService);

app.post('/api/webhook/cicd', async (req, res) => {
  try {
    const { repository, commit, dependencyFile } = req.body;
    await orchestrator.triggerDetonation(repository, commit, dependencyFile);
    res.status(202).json({ message: 'Detonation triggered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await natsService.connect();
  orchestrator.listenForTelemetry();
  
  app.listen(PORT, () => {
    console.log(`Aegis-Flow Orchestrator listening on port ${PORT}`);
  });
}

bootstrap().catch(console.error);
