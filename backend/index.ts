import express from 'express';
import apiRouter from './server/index';
import { PORT, HOST } from './server/config';

async function startServer() {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount API Router under /api
  app.use('/api', apiRouter);

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Backend API Server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
