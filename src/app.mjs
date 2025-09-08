import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import statesRouter from './routes/states.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Mount states router
app.use('/states', statesRouter);

export default app;