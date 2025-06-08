// server.js
require('dotenv').config();

const express      = require('express');
const http         = require('http');
const path         = require('path');
const session      = require('express-session');
const SQLiteStore  = require('connect-sqlite3')(session);
const cookieParser = require('cookie-parser');
const bodyParser   = require('body-parser');
const csurf        = require('csurf');
const rateLimit    = require('express-rate-limit');
const helmet       = require('helmet');

const { Server }   = require('socket.io');

const initDb            = require('./db/migrations');
const { dbGet, dbRun, dbAll } = require('./db');
const checkAuth         = require('./middlewares/auth');
const authRoutes        = require('./routes/authRoutes');
const userRoutes        = require('./routes/userRoutes');
const companyRoutes     = require('./routes/companyRoutes');
const countryRoutes     = require('./routes/countryRoutes');
const tradeRoutes       = require('./routes/tradeRoutes');
const priceRoutes       = require('./routes/priceRoutes');
const rankingRoutes     = require('./routes/rankingRoutes');
const badgeRoutes       = require('./routes/badgeRoutes');
const { setupMarketLoops } = require('./services/marketService');

const app = express();

// ─── 1) Sécurité HTTP headers ───────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
      scriptSrc:  ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc:   ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ─── 2) Session Express ─────────────────────────────────────────────────────
// Use a default secret during development if none provided.
// Make sure to set SESSION_SECRET in production.
const SESSION_SECRET = process.env.SESSION_SECRET || 'insecure-dev-secret';

const sessionMiddleware = session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: './db' }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 60 * 1000 // 30 min
  }
});
app.use(sessionMiddleware);

// ─── 3) Parsers & CSRF & Rate-Limit ──────────────────────────────────────────
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const authLimiter  = rateLimit({ windowMs: 15*60*1000, max: 20 });
const tradeLimiter = rateLimit({ windowMs: 1_000,         max: 5  });
app.use('/login',  authLimiter);
app.use('/signup', authLimiter);
app.use('/api/trade', tradeLimiter);

app.use(csurf({ cookie: true }));
app.use((req, res, next) => {
  res.cookie('XSRF-TOKEN', req.csrfToken());
  next();
});

// ─── 4) Routes API ──────────────────────────────────────────────────────────
app.use('/',             authRoutes);            // POST /login, /signup
app.use('/api/user',     userRoutes);            // /api/user/*
app.use('/api/companies', companyRoutes);
app.use('/api/countries', countryRoutes);
app.use('/api/trade',    tradeRoutes(dbGet, dbRun, dbAll, checkAuth));
app.use('/api/rankings', rankingRoutes);
app.use('/api',          priceRoutes);
app.use('/api/badges',   badgeRoutes);

// ─── 5) Protection des pages privées ────────────────────────────────────────
const protectedPages = [
  '/dashboard.html',
  '/profile.html',
  '/trade.html',
  '/snake.html',
  '/pong.html'
];
app.get(protectedPages, checkAuth, (req, res, next) => next());

// ─── 6) Fichiers statiques ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/avatars', express.static(path.join(__dirname, 'public/avatars')));

// ─── 7) SSE pour le marché (inchangé) ──────────────────────────────────────
let sseClients = [];
const HEARTBEAT = 30_000;
app.get('/api/stream', checkAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection:      'keep-alive'
  });
  res.write('retry: 1000\n\n');

  const client = { userId: req.session.userId, res };
  sseClients.push(client);

  const hb = setInterval(() => {
    try { res.write('event: heartbeat\n\n'); } catch {}
  }, HEARTBEAT);

  req.on('close', () => {
    clearInterval(hb);
    sseClients = sseClients.filter(c => c !== client);
  });
});

function broadcastPrice(assetType, assetId, open, high, low, close, timestamp) {
  const d = JSON.stringify({ assetType, assetId, open, high, low, close, x: timestamp });
  sseClients.forEach(c => {
    try { c.res.write(`data: ${d}\n\n`); } catch {}
  });
}

// ─── 8) Buffer & WebSocket pour le chat ─────────────────────────────────────
let nextChatMessageId = 1;
const chatHistory     = [];
const MAX_HISTORY     = 100;

// Créez le serveur HTTP pour Express + Socket.IO
const server = http.createServer(app);
const io     = new Server(server, {
  path: '/socket.io',
  cors: { origin: false, credentials: true }
});

// Partagez la session Express dans Socket.IO
io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// Authentification WS
io.use((socket, next) => {
  const sess = socket.request.session;
  if (sess && sess.userId) {
    socket.userId   = sess.userId;
    socket.username = sess.username; // stockez username dans la session à la connexion
    return next();
  }
  next(new Error('Unauthorized'));
});

io.on('connection', socket => {
  // envoyer le backlog
  chatHistory.forEach(m => socket.emit('chat', m));

  // recevoir et rebroadcast
  socket.on('chat', ({ message }) => {
    const text = String(message).trim().slice(0, 500);
    if (!text) return;
    const msg = {
      id:        nextChatMessageId++,
      userId:    socket.userId,
      username:  socket.username,
      message:   text,
      timestamp: Date.now()
    };
    chatHistory.push(msg);
    if (chatHistory.length > MAX_HISTORY) chatHistory.shift();
    io.emit('chat', msg);
  });
});

// ─── 9) Lancement migrations, marché & écoute ───────────────────────────────
initDb()
  .then(() => {
    console.log('✅ Migrations OK');
    setupMarketLoops(dbGet, dbRun, dbAll, broadcastPrice, 1000);
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => console.log(`Écoute sur http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ Échec migrations:', err);
    process.exit(1);
  });

// ─── 10) Déconnexion ─────────────────────────────────────────────────────────
app.post('/logout', checkAuth, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'logout_failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});
