import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables FIRST before importing routes
dotenv.config();

// Import only the relevant route for the AI Analyzer
import analyzeRoutes from './routes/analyze';
import reportsRoutes from './routes/reports';
import { connectDB } from './config/database';

const app = express();
const server = http.createServer(app);

// Keep middlewares basic for analyzing
app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json({ limit: '10mb' }));

// Set up the API
const API = '/api/v1';

import authRoutes from './routes/auth';
import { initializeAuth } from './models/User';
import { authenticate } from './middleware/auth';

app.use(`${API}/auth`, authRoutes);

// Analyze (same handler persisted to MongoDB — no raw file retention)
// Protected routes
app.use(`${API}/analyze`, authenticate, analyzeRoutes);
app.use(`${API}/analyze-and-save`, authenticate, analyzeRoutes);
app.use(`${API}/reports`, authenticate, reportsRoutes);

// Health Endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', api: 'analyze-endpoint-ready' });
});

app.use((_req, res) => { res.status(404).json({ error: 'Route not found' }); });

// Default error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UNHANDLED ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT ?? 4000;

// Initialize Databases
connectDB();
initializeAuth().then(() => {
  server.listen(PORT, () => {
    console.log(`\n  🏥 Analyzer API running on http://localhost:${PORT}`);
    console.log(`  🔑 GEMINI_API_KEY detected: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}\n`);
  });
});

export default app;
