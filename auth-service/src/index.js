require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const { initDB } = require('./db/db');
const authRoutes = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors());
app.use(express.json());

// Morgan: log ทุก request ในรูปแบบที่ Loki อ่านได้
morgan.token('body-size', (req) => {
  return req.body ? JSON.stringify(req.body).length + 'b' : '0b';
});
app.use(morgan(':method :url :status :response-time ms - body::body-size', {
  stream: {
    write: (msg) => console.log(msg.trim())  // stdout → Docker log driver
  }
}));

// ── Routes ──
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ── Start ──
async function start() {
  // รอ DB พร้อม
  let retries = 10;
  while (retries > 0) {
    try {
      await initDB();
      break;
    } catch (err) {
      console.log(`[auth-service] Waiting for DB... (${retries} retries left)`);
      retries--;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  app.listen(PORT, () => {
    console.log(`[auth-service] Running on port ${PORT}`);
    console.log(`[auth-service] JWT_EXPIRES: ${process.env.JWT_EXPIRES || '1h'}`);
  });
}

start();