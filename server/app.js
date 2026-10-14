const express = require('express');
const cors = require('cors');
const connect = require('./db');
const routes = require('./routes');

const origins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()) : true;

const app = express();
app.use(cors({ origin: origins }));

// The tracker posts as text/plain so the browser skips a CORS preflight and sendBeacon works.
const jsonParser = express.json({ type: ['application/json', 'text/plain'], limit: '256kb' });
app.use((req, res, next) => (req.body !== undefined ? next() : jsonParser(req, res, next)));
app.use((req, res, next) => {
  // If the platform already parsed the body as a string, turn it into an object.
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      return res.status(400).json({ error: 'Body is not valid JSON.' });
    }
  }
  next();
});

// Make sure MongoDB is connected before any API route runs.
app.use('/api', async (_req, res, next) => {
  try {
    await connect();
    next();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    res.status(500).json({ error: 'Database connection failed.' });
  }
});

app.use('/api', routes);

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body is not valid JSON.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

module.exports = app;
