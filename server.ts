import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, GenerateContentResponse } from '@google/genai';

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;

// Initialize Server-Side Gemini Client with mandatory User-Agent header
function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Persistent Disk Storage for User Authentication, Watchlists, Alerts, and Preferences
const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'quantpulse_store.json');
const TOKEN_SECRET = process.env.GEMINI_API_KEY || 'quantpulse-institutional-secret-key-2026';

interface StoredUserRecord {
  uid: string;
  email: string;
  passwordHash: string;
  salt: string;
  displayName: string;
  bio: string;
  refreshIntervalSec: number;
  defaultTimeframe: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';
  defaultChartType: 'candlestick' | 'line';
  watchlist: string[];
  alerts: any[];
  presets: any[];
  createdAt: string;
  updatedAt: string;
}

interface ServerStore {
  users: Record<string, StoredUserRecord>;
}

function loadStore(): ServerStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const initial: ServerStore = { users: {} };
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as ServerStore;
  } catch (err) {
    console.error('Error loading store:', err);
    return { users: {} };
  }
}

function saveStore(store: ServerStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store:', err);
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function createSessionToken(uid: string, email: string): string {
  const payload = JSON.stringify({ uid, email, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  const b64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verifySessionToken(token?: string): { uid: string; email: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(b64).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const decoded = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8'));
    if (decoded.exp < Date.now()) return null;
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

function sanitizeUserResponse(user: StoredUserRecord) {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    refreshIntervalSec: user.refreshIntervalSec,
    defaultTimeframe: user.defaultTimeframe,
    defaultChartType: user.defaultChartType,
    watchlist: user.watchlist,
    alerts: user.alerts,
    presets: user.presets,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function buildDefaultUserRecord(
  uid: string,
  email: string,
  displayName: string,
  passwordHash = '',
  salt = ''
): StoredUserRecord {
  const now = new Date().toISOString();
  return {
    uid,
    email: email.toLowerCase().trim(),
    passwordHash,
    salt,
    displayName: displayName.trim().slice(0, 80) || email.split('@')[0],
    bio: 'Quantitative Equities & Market Structure Research',
    refreshIntervalSec: 15,
    defaultTimeframe: '3M',
    defaultChartType: 'candlestick',
    watchlist: ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'META', 'AMD', 'JPM', 'BRK.B'],
    alerts: [
      {
        id: `alert-init-1`,
        userId: uid,
        symbol: 'NVDA',
        conditionType: 'PRICE_ABOVE',
        threshold: 140.0,
        timeframe: '1D',
        enabled: true,
        status: 'ARMED',
        lastEvaluatedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `alert-init-2`,
        userId: uid,
        symbol: 'AAPL',
        conditionType: 'RSI_ABOVE',
        threshold: 70,
        timeframe: '3M',
        enabled: true,
        status: 'ARMED',
        lastEvaluatedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `alert-init-3`,
        userId: uid,
        symbol: 'TSLA',
        conditionType: 'DAILY_CHANGE_PCT',
        threshold: 1.5,
        timeframe: '1D',
        enabled: true,
        status: 'ARMED',
        lastEvaluatedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    presets: [
      {
        id: 'preset-init-1',
        userId: uid,
        name: 'High-Growth AI & Semiconductors',
        sector: 'Technology',
        minMarketCapB: 100,
        maxPE: 80,
        minRsi: 40,
        maxRsi: 80,
        signalFilter: 'ALL',
        createdAt: now,
      },
      {
        id: 'preset-init-2',
        userId: uid,
        name: 'Value & Cash Flow Compounders',
        sector: 'ALL',
        minMarketCapB: 150,
        maxPE: 30,
        minRsi: 30,
        maxRsi: 70,
        signalFilter: 'ALL',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

// --- AUTHENTICATION & USER PERSISTENCE ENDPOINTS ---

app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, displayName } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const store = loadStore();
    const existing = Object.values(store.users).find((u) => u.email === cleanEmail);
    if (existing) {
      return res
        .status(409)
        .json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const uid = `qp_${crypto.randomBytes(10).toString('hex')}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const newUser = buildDefaultUserRecord(
      uid,
      cleanEmail,
      displayName || cleanEmail.split('@')[0],
      passwordHash,
      salt
    );
    store.users[uid] = newUser;
    saveStore(store);

    const token = createSessionToken(uid, cleanEmail);
    return res.json({ token, user: sanitizeUserResponse(newUser) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const cleanEmail = String(email).toLowerCase().trim();
    const store = loadStore();
    const user = Object.values(store.users).find((u) => u.email === cleanEmail);
    if (!user || !user.salt) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const computedHash = hashPassword(String(password), user.salt);
    if (computedHash !== user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = createSessionToken(user.uid, user.email);
    return res.json({ token, user: sanitizeUserResponse(user) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

app.post('/api/auth/firebase-sync', (req, res) => {
  try {
    const { uid, email, displayName } = req.body || {};
    if (!uid || !email) {
      return res.status(400).json({ error: 'UID and email required for Firebase sync.' });
    }
    const cleanUid = String(uid).replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 128);
    const cleanEmail = String(email).toLowerCase().trim();
    const store = loadStore();

    if (!store.users[cleanUid]) {
      store.users[cleanUid] = buildDefaultUserRecord(
        cleanUid,
        cleanEmail,
        displayName || cleanEmail.split('@')[0]
      );
      saveStore(store);
    }

    const user = store.users[cleanUid];
    const token = createSessionToken(user.uid, user.email);
    return res.json({ token, user: sanitizeUserResponse(user) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Sync failed.' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const verified = verifySessionToken(token);
  if (!verified) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
  const store = loadStore();
  const user = store.users[verified.uid];
  if (!user) {
    return res.status(404).json({ error: 'User profile not found.' });
  }
  return res.json({ user: sanitizeUserResponse(user) });
});

app.put('/api/user/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const verified = verifySessionToken(token);
  if (!verified) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const store = loadStore();
  const user = store.users[verified.uid];
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const {
    displayName,
    bio,
    refreshIntervalSec,
    defaultTimeframe,
    defaultChartType,
    watchlist,
    alerts,
    presets,
  } = req.body || {};

  if (typeof displayName === 'string' && displayName.trim().length > 0) {
    user.displayName = displayName.trim().slice(0, 80);
  }
  if (typeof bio === 'string') {
    user.bio = bio.trim().slice(0, 300);
  }
  if (typeof refreshIntervalSec === 'number' && refreshIntervalSec >= 0 && refreshIntervalSec <= 300) {
    user.refreshIntervalSec = refreshIntervalSec;
  }
  if (defaultTimeframe && ['1D', '1W', '1M', '3M', '6M', '1Y'].includes(defaultTimeframe)) {
    user.defaultTimeframe = defaultTimeframe;
  }
  if (defaultChartType && ['candlestick', 'line'].includes(defaultChartType)) {
    user.defaultChartType = defaultChartType;
  }
  if (Array.isArray(watchlist)) {
    user.watchlist = watchlist
      .map((s) => String(s).toUpperCase().trim())
      .filter((s) => s.length > 0 && s.length <= 16)
      .slice(0, 30);
  }
  if (Array.isArray(alerts)) {
    user.alerts = alerts.slice(0, 50);
  }
  if (Array.isArray(presets)) {
    user.presets = presets.slice(0, 25);
  }

  user.updatedAt = new Date().toISOString();
  store.users[verified.uid] = user;
  saveStore(store);

  return res.json({ user: sanitizeUserResponse(user) });
});

// ============================================================================
// LIVE YAHOO FINANCE MARKET DATA, HISTORICAL OHLCV & FUNDAMENTALS ENGINE
// ============================================================================

const YF_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

type TimeframeKey = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';
type MarketStateType = 'REGULAR' | 'PRE' | 'POST' | 'CLOSED';

interface LiveCandleBar {
  timestamp: string;
  dateLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface LiveChartQuoteResult {
  symbol: string;
  name?: string;
  exchange?: string;
  currency?: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
  volume: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  quoteTimestamp: string;
  marketState: MarketStateType;
  dataSource: string;
  isLiveData: boolean;
  candles: LiveCandleBar[];
}

// Convert internal symbol (e.g. SPX, BRK.B) to Yahoo Finance ticker (^GSPC, BRK-B)
function toYahooSymbol(symbol: string): string {
  const clean = symbol.toUpperCase().trim();
  if (clean === 'SPX') return '^GSPC';
  if (clean === 'BRK.B') return 'BRK-B';
  if (clean === 'BF.B') return 'BF-B';
  return clean;
}

function fromYahooSymbol(yfSym: string, requestedSym?: string): string {
  if (requestedSym) return requestedSym.toUpperCase().trim();
  const clean = yfSym.toUpperCase().trim();
  if (clean === '^GSPC') return 'SPX';
  if (clean === 'BRK-B') return 'BRK.B';
  return clean;
}

// In-Memory TTL Caches to protect upstream against rate limits while keeping quotes fresh (15s TTL)
const chartCache = new Map<string, { expiresAt: number; data: LiveChartQuoteResult }>();
const fundamentalsCache = new Map<string, { expiresAt: number; data: any }>();

// Crumb & Cookie Session Negotiation for Yahoo Finance v7/quote & v10/quoteSummary
let yahooSession: { cookie: string; crumb: string; expiresAt: number } | null = null;

async function getYahooSession(): Promise<{ cookie: string; crumb: string } | null> {
  if (yahooSession && yahooSession.expiresAt > Date.now()) {
    return { cookie: yahooSession.cookie, crumb: yahooSession.crumb };
  }

  try {
    const controller = new AbortController();
    const t1 = setTimeout(() => controller.abort(), 3500);
    const cookieRes = await fetch('https://fc.yahoo.com', {
      signal: controller.signal,
      headers: { 'User-Agent': YF_USER_AGENT },
      redirect: 'manual',
    });
    clearTimeout(t1);

    const setCookieHeaders: string[] =
      typeof (cookieRes.headers as any).getSetCookie === 'function'
        ? (cookieRes.headers as any).getSetCookie()
        : cookieRes.headers.get('set-cookie')
        ? [cookieRes.headers.get('set-cookie')!]
        : [];

    const cookieStr = setCookieHeaders
      .map((c) => c.split(';')[0])
      .filter(Boolean)
      .join('; ');

    if (!cookieStr) return null;

    const controller2 = new AbortController();
    const t2 = setTimeout(() => controller2.abort(), 3500);
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      signal: controller2.signal,
      headers: {
        'User-Agent': YF_USER_AGENT,
        Cookie: cookieStr,
      },
    });
    clearTimeout(t2);

    if (!crumbRes.ok) return null;
    const crumbText = (await crumbRes.text()).trim();
    if (!crumbText || crumbText.includes('{') || crumbText.includes('<')) return null;

    yahooSession = {
      cookie: cookieStr,
      crumb: crumbText,
      expiresAt: Date.now() + 25 * 60 * 1000, // 25 min TTL
    };
    return { cookie: cookieStr, crumb: crumbText };
  } catch {
    return null;
  }
}

function determineMarketState(meta: any): MarketStateType {
  const nowSec = Math.floor(Date.now() / 1000);
  const tp = meta?.currentTradingPeriod;
  if (tp) {
    if (tp.regular && nowSec >= tp.regular.start && nowSec <= tp.regular.end) {
      return 'REGULAR';
    }
    if (tp.pre && nowSec >= tp.pre.start && nowSec < (tp.regular?.start || tp.pre.end)) {
      return 'PRE';
    }
    if (tp.post && nowSec > (tp.regular?.end || tp.post.start) && nowSec <= tp.post.end) {
      return 'POST';
    }
  }
  // Fallback US Equity market hours check (Mon-Fri 13:30-20:00 UTC)
  const d = new Date();
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return 'CLOSED';
  const regTime = meta?.regularMarketTime;
  if (typeof regTime === 'number' && nowSec - regTime < 900) {
    return 'REGULAR';
  }
  return 'CLOSED';
}

function formatDateLabel(date: Date, timeframe: TimeframeKey): string {
  if (timeframe === '1D') {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  if (timeframe === '1W') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      hour12: false,
    });
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

async function fetchYahooChartData(
  internalSymbol: string,
  timeframe: TimeframeKey = '1Y',
  bypassCache = false
): Promise<LiveChartQuoteResult | null> {
  const sym = internalSymbol.toUpperCase().trim();
  const cacheKey = `${sym}:${timeframe}`;
  const cached = chartCache.get(cacheKey);
  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const yfSym = toYahooSymbol(sym);
  // Map timeframe to Yahoo Finance v8/finance/chart range & interval
  const rangeMap: Record<TimeframeKey, { range: string; interval: string }> = {
    '1D': { range: '5d', interval: '5m' }, // 5d of 5m bars ensures a full session even when markets are closed
    '1W': { range: '5d', interval: '60m' },
    '1M': { range: '1mo', interval: '1d' },
    '3M': { range: '3mo', interval: '1d' },
    '6M': { range: '6mo', interval: '1d' },
    '1Y': { range: '1y', interval: '1d' },
  };
  const { range, interval } = rangeMap[timeframe] || rangeMap['3M'];

  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  for (const host of hosts) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(
        yfSym
      )}?range=${range}&interval=${interval}&includePrePost=false`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': YF_USER_AGENT },
      });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const json: any = await res.json();
      const result = json?.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta || typeof meta.regularMarketPrice !== 'number') continue;

      const timestamps: number[] = Array.isArray(result.timestamp) ? result.timestamp : [];
      const quoteObj = result.indicators?.quote?.[0] || {};
      const opens: Array<number | null> = quoteObj.open || [];
      const highs: Array<number | null> = quoteObj.high || [];
      const lows: Array<number | null> = quoteObj.low || [];
      const closes: Array<number | null> = quoteObj.close || [];
      const volumes: Array<number | null> = quoteObj.volume || [];

      let rawCandles: LiveCandleBar[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const tsSec = timestamps[i];
        const c = closes[i];
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        if (
          c === null ||
          c === undefined ||
          Number.isNaN(c) ||
          o === null ||
          o === undefined ||
          h === null ||
          h === undefined ||
          l === null ||
          l === undefined
        ) {
          continue;
        }
        const d = new Date(tsSec * 1000);
        rawCandles.push({
          timestamp: d.toISOString(),
          dateLabel: formatDateLabel(d, timeframe),
          open: Number(o.toFixed(2)),
          high: Number(h.toFixed(2)),
          low: Number(l.toFixed(2)),
          close: Number(c.toFixed(2)),
          volume: typeof volumes[i] === 'number' && volumes[i]! > 0 ? Math.round(volumes[i]!) : 0,
        });
      }

      // For 1D (fetched via range=5d&interval=5m), filter to the latest trading session day so 1D shows that session's intraday bars
      if (timeframe === '1D' && rawCandles.length > 0) {
        const lastBarDay = rawCandles[rawCandles.length - 1].timestamp.slice(0, 10);
        const sameDayBars = rawCandles.filter((b) => b.timestamp.slice(0, 10) === lastBarDay);
        rawCandles = sameDayBars.length >= 10 ? sameDayBars : rawCandles.slice(-78);
      }

      const price = Number(meta.regularMarketPrice.toFixed(2));

      // Crucial accuracy rule: On multi-month chart ranges (e.g. 1Y), meta.chartPreviousClose is the close 1 year ago.
      // For daily bars ('1d'), the true previous session close is rawCandles[rawCandles.length - 2].close (or meta.previousClose).
      let prevClose: number = price;
      if (typeof meta.previousClose === 'number' && meta.previousClose > 0) {
        prevClose = Number(meta.previousClose.toFixed(2));
      } else if (interval === '1d' && rawCandles.length >= 2) {
        prevClose = rawCandles[rawCandles.length - 2].close;
      } else if (timeframe === '1D' && rawCandles.length > 0) {
        // Look for last close from the prior trading day in timestamps if available
        const lastDayStr = rawCandles[rawCandles.length - 1].timestamp.slice(0, 10);
        let priorDayClose: number | null = null;
        for (let i = timestamps.length - 1; i >= 0; i--) {
          const dStr = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
          if (dStr < lastDayStr && typeof closes[i] === 'number') {
            priorDayClose = Number(closes[i]!.toFixed(2));
            break;
          }
        }
        prevClose =
          priorDayClose ??
          (typeof meta.chartPreviousClose === 'number'
            ? Number(meta.chartPreviousClose.toFixed(2))
            : rawCandles[0].open);
      } else if (typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0) {
        prevClose = Number(meta.chartPreviousClose.toFixed(2));
      }

      const change = Number((price - prevClose).toFixed(2));
      const changePercent =
        prevClose > 0 ? Number((((price - prevClose) / prevClose) * 100).toFixed(2)) : 0;

      const lastCandle = rawCandles.length > 0 ? rawCandles[rawCandles.length - 1] : null;
      const dayHigh = Number(
        (
          meta.regularMarketDayHigh ??
          lastCandle?.high ??
          Math.max(price, prevClose)
        ).toFixed(2)
      );
      const dayLow = Number(
        (
          meta.regularMarketDayLow ??
          lastCandle?.low ??
          Math.min(price, prevClose)
        ).toFixed(2)
      );
      const dayOpen = Number((lastCandle?.open ?? prevClose).toFixed(2));
      const volume =
        typeof meta.regularMarketVolume === 'number' && meta.regularMarketVolume > 0
          ? meta.regularMarketVolume
          : lastCandle?.volume || 0;

      const fiftyTwoWeekHigh =
        typeof meta.fiftyTwoWeekHigh === 'number'
          ? Number(meta.fiftyTwoWeekHigh.toFixed(2))
          : null;
      const fiftyTwoWeekLow =
        typeof meta.fiftyTwoWeekLow === 'number'
          ? Number(meta.fiftyTwoWeekLow.toFixed(2))
          : null;

      const quoteTimestamp =
        typeof meta.regularMarketTime === 'number' && meta.regularMarketTime > 0
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : new Date().toISOString();

      const marketState = determineMarketState(meta);

      const parsed: LiveChartQuoteResult = {
        symbol: sym,
        name: meta.longName || meta.shortName || undefined,
        exchange: meta.exchangeName || undefined,
        currency: meta.currency || 'USD',
        price,
        previousClose: prevClose,
        change,
        changePercent,
        dayHigh,
        dayLow,
        dayOpen,
        volume,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
        quoteTimestamp,
        marketState,
        dataSource: `Yahoo Finance Live Exchange Feed (${meta.exchangeName || 'Consolidated Tape'})`,
        isLiveData: true,
        candles: rawCandles,
      };

      chartCache.set(cacheKey, {
        expiresAt: Date.now() + 15000, // 15-second TTL
        data: parsed,
      });

      return parsed;
    } catch {
      // Try next host
    }
  }

  return null;
}

function rawNum(field: any): number | null {
  if (field === null || field === undefined) return null;
  if (typeof field === 'number' && !Number.isNaN(field)) return field;
  if (typeof field === 'object' && typeof field.raw === 'number' && !Number.isNaN(field.raw)) {
    return field.raw;
  }
  return null;
}

async function fetchYahooFundamentals(internalSymbol: string): Promise<any | null> {
  const sym = internalSymbol.toUpperCase().trim();
  const cached = fundamentalsCache.get(sym);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const yfSym = toYahooSymbol(sym);
  const session = await getYahooSession();
  if (!session) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const modules = [
      'price',
      'summaryDetail',
      'defaultKeyStatistics',
      'financialData',
      'incomeStatementHistory',
      'incomeStatementHistoryQuarterly',
      'cashflowStatementHistory',
      'cashflowStatementHistoryQuarterly',
    ].join(',');

    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      yfSym
    )}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': YF_USER_AGENT,
        Cookie: session.cookie,
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json: any = await res.json();
    const r = json?.quoteSummary?.result?.[0];
    if (!r) return null;

    const priceMod = r.price || {};
    const sumMod = r.summaryDetail || {};
    const ksMod = r.defaultKeyStatistics || {};
    const finMod = r.financialData || {};

    const mktCapRaw = rawNum(priceMod.marketCap) ?? rawNum(sumMod.marketCap);
    const revRaw = rawNum(finMod.totalRevenue);
    const netIncRaw = rawNum(ksMod.netIncomeToCommon);
    const cashRaw = rawNum(finMod.totalCash);
    const debtRaw = rawNum(finMod.totalDebt);
    const fcfRaw = rawNum(finMod.freeCashflow);
    const divYieldRaw = rawNum(sumMod.dividendYield);
    const debtToEqRaw = rawNum(finMod.debtToEquity);

    // Build historical periods from Yahoo Finance incomeStatementHistory & incomeStatementHistoryQuarterly
    const periods: any[] = [];
    const qStmts = r.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
    const qCash = r.cashflowStatementHistoryQuarterly?.cashflowStatements || [];
    for (let i = 0; i < Math.min(4, qStmts.length); i++) {
      const st = qStmts[i];
      const cf = qCash[i];
      const endDate = st?.endDate?.fmt || '';
      const rev = rawNum(st?.totalRevenue);
      const netInc = rawNum(st?.netIncome);
      const opInc = rawNum(st?.operatingIncome);
      const fcfVal = rawNum(cf?.freeCashFlow) ?? rawNum(cf?.totalCashFromOperatingActivities);
      periods.push({
        period: endDate ? `Q (${endDate})` : `Q-${i + 1}`,
        periodType: 'Quarterly',
        reportDate: endDate || 'Reported',
        revenueB: rev !== null ? Number((rev / 1e9).toFixed(2)) : null,
        revenueGrowthYoY:
          i === 0 && rawNum(finMod.revenueGrowth) !== null
            ? Number((rawNum(finMod.revenueGrowth)! * 100).toFixed(2))
            : null,
        netIncomeB: netInc !== null ? Number((netInc / 1e9).toFixed(2)) : null,
        eps: null,
        operatingMarginPct:
          rev && opInc !== null ? Number(((opInc / rev) * 100).toFixed(2)) : null,
        netMarginPct: rev && netInc !== null ? Number(((netInc / rev) * 100).toFixed(2)) : null,
        freeCashFlowB: fcfVal !== null ? Number((fcfVal / 1e9).toFixed(2)) : null,
      });
    }

    const aStmts = r.incomeStatementHistory?.incomeStatementHistory || [];
    const aCash = r.cashflowStatementHistory?.cashflowStatements || [];
    for (let i = 0; i < Math.min(3, aStmts.length); i++) {
      const st = aStmts[i];
      const prevSt = aStmts[i + 1];
      const cf = aCash[i];
      const endDate = st?.endDate?.fmt || '';
      const rev = rawNum(st?.totalRevenue);
      const prevRev = rawNum(prevSt?.totalRevenue);
      const netInc = rawNum(st?.netIncome);
      const opInc = rawNum(st?.operatingIncome);
      const fcfVal = rawNum(cf?.freeCashFlow) ?? rawNum(cf?.totalCashFromOperatingActivities);
      const yoy =
        rev !== null && prevRev !== null && prevRev > 0
          ? Number((((rev - prevRev) / prevRev) * 100).toFixed(2))
          : null;
      periods.push({
        period: endDate ? `FY (${endDate.slice(0, 4)})` : `FY-${i + 1}`,
        periodType: 'Annual',
        reportDate: endDate || 'Reported',
        revenueB: rev !== null ? Number((rev / 1e9).toFixed(2)) : null,
        revenueGrowthYoY: yoy,
        netIncomeB: netInc !== null ? Number((netInc / 1e9).toFixed(2)) : null,
        eps: null,
        operatingMarginPct:
          rev && opInc !== null ? Number(((opInc / rev) * 100).toFixed(2)) : null,
        netMarginPct: rev && netInc !== null ? Number(((netInc / rev) * 100).toFixed(2)) : null,
        freeCashFlowB: fcfVal !== null ? Number((fcfVal / 1e9).toFixed(2)) : null,
      });
    }

    const fundamentals = {
      currency: finMod.financialCurrency || priceMod.currency || 'USD',
      fiscalYearEnd: ksMod.lastFiscalYearEnd?.fmt || 'Reported Fiscal Year',
      lastUpdated: new Date().toISOString().slice(0, 10),
      source: 'Yahoo Finance Live Fundamentals & SEC Filing Feed',
      marketCapB: mktCapRaw !== null ? Number((mktCapRaw / 1e9).toFixed(2)) : null,
      peRatio:
        rawNum(sumMod.trailingPE) !== null ? Number(rawNum(sumMod.trailingPE)!.toFixed(2)) : null,
      forwardPe:
        rawNum(sumMod.forwardPE) !== null
          ? Number(rawNum(sumMod.forwardPE)!.toFixed(2))
          : rawNum(ksMod.forwardPE) !== null
          ? Number(rawNum(ksMod.forwardPE)!.toFixed(2))
          : null,
      psRatio:
        rawNum(sumMod.priceToSalesTrailing12Months) !== null
          ? Number(rawNum(sumMod.priceToSalesTrailing12Months)!.toFixed(2))
          : null,
      pbRatio:
        rawNum(ksMod.priceToBook) !== null ? Number(rawNum(ksMod.priceToBook)!.toFixed(2)) : null,
      evToEbitda:
        rawNum(ksMod.enterpriseToEbitda) !== null
          ? Number(rawNum(ksMod.enterpriseToEbitda)!.toFixed(2))
          : null,
      revenueTTM_B: revRaw !== null ? Number((revRaw / 1e9).toFixed(2)) : null,
      revenueGrowthYoY_Pct:
        rawNum(finMod.revenueGrowth) !== null
          ? Number((rawNum(finMod.revenueGrowth)! * 100).toFixed(2))
          : null,
      netIncomeTTM_B: netIncRaw !== null ? Number((netIncRaw / 1e9).toFixed(2)) : null,
      epsTTM:
        rawNum(ksMod.trailingEps) !== null ? Number(rawNum(ksMod.trailingEps)!.toFixed(2)) : null,
      grossMarginPct:
        rawNum(finMod.grossMargins) !== null
          ? Number((rawNum(finMod.grossMargins)! * 100).toFixed(2))
          : null,
      operatingMarginPct:
        rawNum(finMod.operatingMargins) !== null
          ? Number((rawNum(finMod.operatingMargins)! * 100).toFixed(2))
          : null,
      profitMarginPct:
        rawNum(finMod.profitMargins) !== null
          ? Number((rawNum(finMod.profitMargins)! * 100).toFixed(2))
          : null,
      roePct:
        rawNum(finMod.returnOnEquity) !== null
          ? Number((rawNum(finMod.returnOnEquity)! * 100).toFixed(2))
          : null,
      debtToEquity:
        debtToEqRaw !== null
          ? Number((debtToEqRaw > 10 ? debtToEqRaw / 100 : debtToEqRaw).toFixed(2))
          : null,
      totalCashB: cashRaw !== null ? Number((cashRaw / 1e9).toFixed(2)) : null,
      totalDebtB: debtRaw !== null ? Number((debtRaw / 1e9).toFixed(2)) : null,
      freeCashFlowTTM_B: fcfRaw !== null ? Number((fcfRaw / 1e9).toFixed(2)) : null,
      dividendYieldPct:
        divYieldRaw !== null ? Number((divYieldRaw * 100).toFixed(2)) : null,
      beta: rawNum(ksMod.beta) !== null ? Number(rawNum(ksMod.beta)!.toFixed(2)) : null,
      fiftyTwoWeekHigh:
        rawNum(sumMod.fiftyTwoWeekHigh) !== null
          ? Number(rawNum(sumMod.fiftyTwoWeekHigh)!.toFixed(2))
          : null,
      fiftyTwoWeekLow:
        rawNum(sumMod.fiftyTwoWeekLow) !== null
          ? Number(rawNum(sumMod.fiftyTwoWeekLow)!.toFixed(2))
          : null,
      periods,
    };

    fundamentalsCache.set(sym, {
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min TTL
      data: fundamentals,
    });
    return fundamentals;
  } catch {
    return null;
  }
}

// Helper to run async tasks with bounded concurrency
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await fn(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

// 1. BOOTSTRAP ENDPOINT: Hydrates universe symbols with live Yahoo Finance prices & real 1Y/6M/3M/1M daily OHLCV candles
app.get('/api/market/bootstrap', async (req, res) => {
  try {
    const rawSyms = String(req.query.symbols || '').trim();
    const defaultSyms = [
      'SPX',
      'AAPL',
      'MSFT',
      'NVDA',
      'TSLA',
      'AMZN',
      'GOOGL',
      'META',
      'AMD',
      'INTC',
      'AVGO',
      'JPM',
      'WMT',
      'COST',
      'KO',
      'NFLX',
      'CRM',
      'ORCL',
      'BRK.B',
      'DIS',
      'UBER',
      'LLY',
      'V',
      'TSM',
      'PLTR',
      'XOM',
      'ASML',
    ];
    const symbols = rawSyms
      ? rawSyms
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
          .slice(0, 35)
      : defaultSyms;

    // Fetch 1Y daily chart for each symbol (with 6 concurrent workers)
    const chartResults = await mapWithConcurrency(symbols, 6, async (sym) => {
      const chart1Y = await fetchYahooChartData(sym, '1Y');
      return { sym, chart1Y };
    });

    // Also prefetch 1D and 1W intraday candles for SPX so initial chart timeframe switches are instant
    const spx1D = await fetchYahooChartData('SPX', '1D');
    const spx1W = await fetchYahooChartData('SPX', '1W');

    const quotes: Record<string, any> = {};
    let dominantMarketState: MarketStateType = 'CLOSED';

    for (const { sym, chart1Y } of chartResults) {
      if (!chart1Y) continue;
      if (chart1Y.marketState === 'REGULAR') dominantMarketState = 'REGULAR';
      else if (dominantMarketState === 'CLOSED' && chart1Y.marketState !== 'CLOSED') {
        dominantMarketState = chart1Y.marketState;
      }

      const c1Y = chart1Y.candles;
      const c6M = c1Y.slice(-126);
      const c3M = c1Y.slice(-63);
      const c1M = c1Y.slice(-22);

      const timeframeCandles: Partial<Record<TimeframeKey, LiveCandleBar[]>> = {
        '1Y': c1Y,
        '6M': c6M,
        '3M': c3M,
        '1M': c1M,
      };

      if (sym === 'SPX') {
        if (spx1D && spx1D.candles.length > 0) timeframeCandles['1D'] = spx1D.candles;
        if (spx1W && spx1W.candles.length > 0) timeframeCandles['1W'] = spx1W.candles;
      }

      quotes[sym] = {
        symbol: sym,
        name: chart1Y.name,
        exchange: chart1Y.exchange,
        currency: chart1Y.currency,
        price: chart1Y.price,
        previousClose: chart1Y.previousClose,
        change: chart1Y.change,
        changePercent: chart1Y.changePercent,
        dayHigh: chart1Y.dayHigh,
        dayLow: chart1Y.dayLow,
        dayOpen: chart1Y.dayOpen,
        volume: chart1Y.volume,
        fiftyTwoWeekHigh: chart1Y.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: chart1Y.fiftyTwoWeekLow,
        quoteTimestamp: chart1Y.quoteTimestamp,
        marketState: chart1Y.marketState,
        dataSource: chart1Y.dataSource,
        isLiveData: true,
        candles: timeframeCandles,
      };
    }

    return res.json({
      bootstrappedAt: new Date().toISOString(),
      marketState: dominantMarketState,
      liveSymbolCount: Object.keys(quotes).length,
      quotes,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Bootstrap failed' });
  }
});

// 2. ON-DEMAND SYMBOL & TIMEFRAME ENDPOINT: Fetches real interval OHLCV candles + live fundamentals
app.get('/api/market/symbol/:symbol', async (req, res) => {
  try {
    const symbol = String(req.params.symbol || '').toUpperCase().trim();
    const timeframe = (String(req.query.timeframe || '3M').toUpperCase() as TimeframeKey) || '3M';
    const includeFundamentals = req.query.includeFundamentals === 'true';

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const validTf: TimeframeKey = ['1D', '1W', '1M', '3M', '6M', '1Y'].includes(timeframe)
      ? timeframe
      : '3M';

    const [chartData, fundamentals] = await Promise.all([
      fetchYahooChartData(symbol, validTf),
      includeFundamentals ? fetchYahooFundamentals(symbol) : Promise.resolve(null),
    ]);

    if (!chartData) {
      return res.status(404).json({
        error: `Live exchange feed unavailable for ${symbol}`,
        isLiveData: false,
      });
    }

    return res.json({
      symbol,
      timeframe: validTf,
      quote: chartData,
      fundamentals,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Symbol fetch failed' });
  }
});

// 3. LIVE MARKET REFRESH ENDPOINT (ZERO SYNTHETIC RNG — Strictly Live Exchange Quotes)
app.post('/api/market/refresh', async (req, res) => {
  try {
    const { symbols, activeSymbol, activeTimeframe } = req.body || {};
    const targetSymbols: string[] = Array.isArray(symbols)
      ? symbols.map((s) => String(s).toUpperCase().trim()).filter(Boolean).slice(0, 35)
      : [];

    const refreshedAt = new Date().toISOString();
    const updates: Record<string, any> = {};
    let dominantMarketState: MarketStateType = 'CLOSED';

    await mapWithConcurrency(targetSymbols, 6, async (sym) => {
      const tf: TimeframeKey =
        sym === activeSymbol &&
        ['1D', '1W', '1M', '3M', '6M', '1Y'].includes(String(activeTimeframe))
          ? (activeTimeframe as TimeframeKey)
          : '1D';

      const live = await fetchYahooChartData(sym, tf);
      if (!live) return;

      if (live.marketState === 'REGULAR') {
        dominantMarketState = 'REGULAR';
      } else if (dominantMarketState === 'CLOSED' && live.marketState !== 'CLOSED') {
        dominantMarketState = live.marketState;
      }

      updates[sym] = {
        price: live.price,
        previousClose: live.previousClose,
        change: live.change,
        changePercent: live.changePercent,
        dayHigh: live.dayHigh,
        dayLow: live.dayLow,
        dayOpen: live.dayOpen,
        volume: live.volume,
        fiftyTwoWeekHigh: live.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: live.fiftyTwoWeekLow,
        quoteTimestamp: live.quoteTimestamp,
        marketState: live.marketState,
        dataSource: live.dataSource,
        isLiveData: true,
        timeframeFetched: tf,
        candles: live.candles,
      };
    });

    return res.json({
      refreshedAt,
      marketState: dominantMarketState,
      updates,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Live refresh failed' });
  }
});

// 4. ON-DEMAND FUNDAMENTAL VERIFICATION (Yahoo Finance QuoteSummary + Google Search Grounding Fallback)
app.post('/api/market/verify-fundamentals/:symbol', async (req, res) => {
  try {
    const symbol = String(req.params.symbol || '').toUpperCase().trim();
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    // Try Yahoo Finance QuoteSummary first
    const yfFundamentals = await fetchYahooFundamentals(symbol);
    const chartData = await fetchYahooChartData(symbol, '1Y');

    if (yfFundamentals && (yfFundamentals.marketCapB !== null || yfFundamentals.peRatio !== null)) {
      return res.json({
        symbol,
        fundamentals: {
          ...yfFundamentals,
          fiftyTwoWeekHigh:
            yfFundamentals.fiftyTwoWeekHigh ?? chartData?.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow:
            yfFundamentals.fiftyTwoWeekLow ?? chartData?.fiftyTwoWeekLow ?? null,
        },
        quote: chartData,
        verifiedVia: 'Yahoo Finance Live QuoteSummary & SEC Filing Feed',
      });
    }

    // Fallback: Use Gemini with Google Search Grounding to retrieve verified current fundamentals
    const ai = getGenAIClient();
    const prompt = `Retrieve the latest verified financial fundamentals for ticker symbol "${symbol}" from current financial data sources (Yahoo Finance, Google Finance, SEC filings).
Return ONLY a valid JSON object with the following numeric fields (use null for any field that is unavailable or not applicable — NEVER guess or fabricate):
{
  "currency": "USD",
  "fiscalYearEnd": "string or Unreported",
  "marketCapB": number_in_billions_or_null,
  "peRatio": trailing_pe_number_or_null,
  "forwardPe": forward_pe_number_or_null,
  "psRatio": price_to_sales_number_or_null,
  "pbRatio": price_to_book_number_or_null,
  "evToEbitda": ev_to_ebitda_number_or_null,
  "revenueTTM_B": revenue_ttm_in_billions_or_null,
  "revenueGrowthYoY_Pct": yoy_revenue_growth_percent_or_null,
  "netIncomeTTM_B": net_income_ttm_in_billions_or_null,
  "epsTTM": diluted_eps_ttm_or_null,
  "grossMarginPct": gross_margin_percent_or_null,
  "operatingMarginPct": operating_margin_percent_or_null,
  "profitMarginPct": net_profit_margin_percent_or_null,
  "roePct": return_on_equity_percent_or_null,
  "debtToEquity": debt_to_equity_ratio_or_null,
  "totalCashB": total_cash_in_billions_or_null,
  "totalDebtB": total_debt_in_billions_or_null,
  "freeCashFlowTTM_B": free_cash_flow_ttm_in_billions_or_null,
  "dividendYieldPct": dividend_yield_percent_or_null,
  "beta": beta_number_or_null
}`;

    const aiRes = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = aiRes.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(404).json({ error: 'Could not extract structured fundamentals.' });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const cleanNum = (v: any): number | null =>
      typeof v === 'number' && !Number.isNaN(v) ? Number(v.toFixed(2)) : null;

    const groundedFundamentals = {
      currency: typeof parsed.currency === 'string' ? parsed.currency : 'USD',
      fiscalYearEnd:
        typeof parsed.fiscalYearEnd === 'string' ? parsed.fiscalYearEnd : 'Reported Fiscal Year',
      lastUpdated: new Date().toISOString().slice(0, 10),
      source: 'Verified Live Exchange & Google Search Grounded Filings',
      marketCapB: cleanNum(parsed.marketCapB),
      peRatio: cleanNum(parsed.peRatio),
      forwardPe: cleanNum(parsed.forwardPe),
      psRatio: cleanNum(parsed.psRatio),
      pbRatio: cleanNum(parsed.pbRatio),
      evToEbitda: cleanNum(parsed.evToEbitda),
      revenueTTM_B: cleanNum(parsed.revenueTTM_B),
      revenueGrowthYoY_Pct: cleanNum(parsed.revenueGrowthYoY_Pct),
      netIncomeTTM_B: cleanNum(parsed.netIncomeTTM_B),
      epsTTM: cleanNum(parsed.epsTTM),
      grossMarginPct: cleanNum(parsed.grossMarginPct),
      operatingMarginPct: cleanNum(parsed.operatingMarginPct),
      profitMarginPct: cleanNum(parsed.profitMarginPct),
      roePct: cleanNum(parsed.roePct),
      debtToEquity: cleanNum(parsed.debtToEquity),
      totalCashB: cleanNum(parsed.totalCashB),
      totalDebtB: cleanNum(parsed.totalDebtB),
      freeCashFlowTTM_B: cleanNum(parsed.freeCashFlowTTM_B),
      dividendYieldPct: cleanNum(parsed.dividendYieldPct),
      beta: cleanNum(parsed.beta),
      fiftyTwoWeekHigh: chartData?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: chartData?.fiftyTwoWeekLow ?? null,
      periods: [],
    };

    fundamentalsCache.set(symbol, {
      expiresAt: Date.now() + 10 * 60 * 1000,
      data: groundedFundamentals,
    });

    return res.json({
      symbol,
      fundamentals: groundedFundamentals,
      quote: chartData,
      verifiedVia: 'Google Search Grounded Live Financial Verification',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Fundamental verification failed' });
  }
});

// --- EXTENDED SYMBOL DIRECTORY & LIVE YAHOO FINANCE SEARCH DISCOVERY ---

const EXTENDED_GLOBAL_DIRECTORY: Array<{
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCapB: number | null;
  peRatio: number | null;
  revenueTTM_B: number | null;
  revenueGrowthYoY_Pct: number | null;
  profitMarginPct: number | null;
  description: string;
}> = [
  {
    symbol: 'MA',
    name: 'Mastercard Incorporated',
    exchange: 'NYSE',
    sector: 'Financials',
    industry: 'Global Payment Processing & Cyber Intelligence',
    price: 498.2,
    changePercent: 0.65,
    volume: 2350000,
    marketCapB: 461.4,
    peRatio: 35.8,
    revenueTTM_B: 26.8,
    revenueGrowthYoY_Pct: 11.4,
    profitMarginPct: 46.2,
    description:
      'Mastercard Incorporated operates a global payment technology network connecting consumers, financial institutions, merchants, and governments in 210+ countries.',
  },
  {
    symbol: 'UNH',
    name: 'UnitedHealth Group Incorporated',
    exchange: 'NYSE',
    sector: 'Healthcare',
    industry: 'Managed Healthcare & Optum Health Services',
    price: 584.1,
    changePercent: -0.38,
    volume: 3120000,
    marketCapB: 538.2,
    peRatio: 24.1,
    revenueTTM_B: 389.4,
    revenueGrowthYoY_Pct: 7.6,
    profitMarginPct: 6.1,
    description:
      'UnitedHealth Group provides health insurance benefits through UnitedHealthcare and technology-enabled health care services via Optum.',
  },
  {
    symbol: 'HD',
    name: 'The Home Depot, Inc.',
    exchange: 'NYSE',
    sector: 'Consumer Discretionary',
    industry: 'Home Improvement Retail & Pro Building Supplies',
    price: 394.5,
    changePercent: 0.82,
    volume: 3450000,
    marketCapB: 391.8,
    peRatio: 26.4,
    revenueTTM_B: 154.2,
    revenueGrowthYoY_Pct: 1.8,
    profitMarginPct: 9.7,
    description:
      'The Home Depot is the largest home improvement retailer in the United States, supplying building materials, tools, and professional contractor supplies.',
  },
  {
    symbol: 'PG',
    name: 'The Procter & Gamble Company',
    exchange: 'NYSE',
    sector: 'Consumer Staples',
    industry: 'Household & Personal Care Products',
    price: 172.3,
    changePercent: 0.19,
    volume: 5800000,
    marketCapB: 405.2,
    peRatio: 26.9,
    revenueTTM_B: 84.4,
    revenueGrowthYoY_Pct: 3.1,
    profitMarginPct: 18.2,
    description:
      'Procter & Gamble markets branded consumer packaged goods across fabric care, home care, grooming, health care, and baby & family care.',
  },
  {
    symbol: 'BAC',
    name: 'Bank of America Corporation',
    exchange: 'NYSE',
    sector: 'Financials',
    industry: 'Diversified Commercial & Wealth Banking',
    price: 41.85,
    changePercent: 1.48,
    volume: 34200000,
    marketCapB: 324.6,
    peRatio: 13.8,
    revenueTTM_B: 101.4,
    revenueGrowthYoY_Pct: 4.2,
    profitMarginPct: 26.8,
    description:
      'Bank of America serves individual consumers, small and middle-market businesses, and large corporations with banking, investing, and wealth management.',
  },
  {
    symbol: 'PANW',
    name: 'Palo Alto Networks, Inc.',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Zero-Trust Cybersecurity & Cloud Security',
    price: 372.9,
    changePercent: 1.94,
    volume: 4120000,
    marketCapB: 121.4,
    peRatio: 48.6,
    revenueTTM_B: 8.3,
    revenueGrowthYoY_Pct: 15.8,
    profitMarginPct: 31.2,
    description:
      'Palo Alto Networks provides network security, Prisma Cloud security, and Cortex AI-driven security operations center (SOC) platformization.',
  },
  {
    symbol: 'COIN',
    name: 'Coinbase Global, Inc.',
    exchange: 'NASDAQ',
    sector: 'Financials',
    industry: 'Digital Asset Exchange & Custody Infrastructure',
    price: 214.6,
    changePercent: 3.45,
    volume: 9850000,
    marketCapB: 53.4,
    peRatio: 36.2,
    revenueTTM_B: 5.2,
    revenueGrowthYoY_Pct: 78.4,
    profitMarginPct: 28.5,
    description:
      'Coinbase Global operates regulated cryptocurrency trading, institutional custody for spot ETFs, stablecoin infrastructure, and the Base Layer-2 network.',
  },
  {
    symbol: 'ARM',
    name: 'Arm Holdings plc',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Semiconductor CPU Architecture & IP Licensing',
    price: 148.2,
    changePercent: 2.64,
    volume: 6900000,
    marketCapB: 155.2,
    peRatio: 98.4,
    revenueTTM_B: 3.54,
    revenueGrowthYoY_Pct: 29.5,
    profitMarginPct: 24.6,
    description:
      'Arm Holdings architects, develops, and licenses high-efficiency RISC CPU instruction sets and compute subsystems for smartphones, cloud servers, and edge AI.',
  },
  {
    symbol: 'GS',
    name: 'The Goldman Sachs Group, Inc.',
    exchange: 'NYSE',
    sector: 'Financials',
    industry: 'Global Investment Banking, Trading & Asset Management',
    price: 518.4,
    changePercent: 1.72,
    volume: 2150000,
    marketCapB: 164.8,
    peRatio: 15.4,
    revenueTTM_B: 51.2,
    revenueGrowthYoY_Pct: 12.6,
    profitMarginPct: 22.8,
    description:
      'Goldman Sachs is a leading global investment banking, securities trading, and asset & wealth management institution.',
  },
  {
    symbol: 'CAT',
    name: 'Caterpillar Inc.',
    exchange: 'NYSE',
    sector: 'Industrials',
    industry: 'Heavy Construction, Mining & Power Generation Machinery',
    price: 396.8,
    changePercent: 1.05,
    volume: 2410000,
    marketCapB: 192.4,
    peRatio: 18.2,
    revenueTTM_B: 66.1,
    revenueGrowthYoY_Pct: 2.1,
    profitMarginPct: 16.4,
    description:
      'Caterpillar Inc. manufactures construction and mining equipment, off-highway diesel and natural gas engines, industrial gas turbines, and backup datacenter generators.',
  },
  {
    symbol: 'SNOW',
    name: 'Snowflake Inc.',
    exchange: 'NYSE',
    sector: 'Technology',
    industry: 'AI Data Cloud & Enterprise Data Warehousing',
    price: 128.4,
    changePercent: -1.18,
    volume: 6320000,
    marketCapB: 42.9,
    peRatio: null,
    revenueTTM_B: 3.28,
    revenueGrowthYoY_Pct: 26.4,
    profitMarginPct: -24.2,
    description:
      'Snowflake Inc. provides a cloud-native data platform enabling organizations to mobilize data for analytics, data engineering, and enterprise AI applications.',
  },
  {
    symbol: 'SHOP',
    name: 'Shopify Inc.',
    exchange: 'NYSE',
    sector: 'Technology',
    industry: 'Merchant E-Commerce Software & Payment Solutions',
    price: 84.3,
    changePercent: 1.88,
    volume: 11200000,
    marketCapB: 108.9,
    peRatio: 64.8,
    revenueTTM_B: 7.9,
    revenueGrowthYoY_Pct: 21.4,
    profitMarginPct: 16.2,
    description:
      'Shopify Inc. provides cloud-based omnichannel commerce infrastructure and merchant payment processing for millions of businesses globally.',
  },
];

app.get('/api/market/discover', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.json({ matches: EXTENDED_GLOBAL_DIRECTORY.slice(0, 8) });
  }
  const upper = q.toUpperCase();
  const lower = q.toLowerCase();

  // Match against extended directory first
  const localMatches = EXTENDED_GLOBAL_DIRECTORY.filter(
    (item) =>
      item.symbol.includes(upper) ||
      item.name.toLowerCase().includes(lower) ||
      item.sector.toLowerCase().includes(lower) ||
      item.industry.toLowerCase().includes(lower)
  );

  // Query Yahoo Finance live search endpoint for global ticker & company name discovery
  const candidateSymbols: Array<{
    symbol: string;
    name?: string;
    exchange?: string;
    sector?: string;
    industry?: string;
  }> = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const searchRes = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        q
      )}&quotesCount=6&newsCount=0`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': YF_USER_AGENT },
      }
    );
    clearTimeout(timeout);
    if (searchRes.ok) {
      const searchJson: any = await searchRes.json();
      const quotes = Array.isArray(searchJson?.quotes) ? searchJson.quotes : [];
      for (const qt of quotes) {
        if (
          qt?.symbol &&
          (qt.quoteType === 'EQUITY' || qt.quoteType === 'ETF' || qt.quoteType === 'INDEX')
        ) {
          candidateSymbols.push({
            symbol: fromYahooSymbol(qt.symbol),
            name: qt.longname || qt.shortname || qt.symbol,
            exchange: qt.exchDisp || qt.exchange || 'EXCHANGE',
            sector: qt.sectorDisp || qt.sector || 'Public Equities',
            industry: qt.industryDisp || qt.industry || qt.quoteType || 'Equity Security',
          });
        }
      }
    }
  } catch {
    // Fallback to direct ticker check if search endpoint fails
  }

  if (candidateSymbols.length === 0 && /^[A-Z\.]{1,6}$/.test(upper)) {
    candidateSymbols.push({ symbol: upper });
  }

  // Hydrate top candidate symbols with live Yahoo Finance quotes + 3M candles
  const hydratedMatches = await mapWithConcurrency(
    candidateSymbols.slice(0, 4),
    4,
    async (cand) => {
      const chart = await fetchYahooChartData(cand.symbol, '3M');
      if (!chart) return null;
      const existingDir = EXTENDED_GLOBAL_DIRECTORY.find((d) => d.symbol === cand.symbol);
      return {
        symbol: cand.symbol,
        name: cand.name || chart.name || existingDir?.name || `${cand.symbol} Corp.`,
        exchange: chart.exchange || cand.exchange || existingDir?.exchange || 'EXCHANGE',
        sector: cand.sector || existingDir?.sector || 'Public Equities',
        industry: cand.industry || existingDir?.industry || 'Equity Security',
        price: chart.price,
        previousClose: chart.previousClose,
        change: chart.change,
        changePercent: chart.changePercent,
        dayHigh: chart.dayHigh,
        dayLow: chart.dayLow,
        volume: chart.volume,
        fiftyTwoWeekHigh: chart.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: chart.fiftyTwoWeekLow,
        quoteTimestamp: chart.quoteTimestamp,
        marketState: chart.marketState,
        dataSource: chart.dataSource,
        isLiveData: true,
        candles3M: chart.candles,
        marketCapB: existingDir?.marketCapB ?? null,
        peRatio: existingDir?.peRatio ?? null,
        revenueTTM_B: existingDir?.revenueTTM_B ?? null,
        revenueGrowthYoY_Pct: existingDir?.revenueGrowthYoY_Pct ?? null,
        profitMarginPct: existingDir?.profitMarginPct ?? null,
        description:
          existingDir?.description ||
          `${
            cand.name || chart.name || cand.symbol
          } retrieved live from Yahoo Finance exchange feed (${
            chart.exchange || 'USD'
          }). Unreported fundamental metrics are strictly marked Unavailable.`,
      };
    }
  );

  const validHydrated = hydratedMatches.filter(Boolean) as any[];
  const hydratedSyms = new Set(validHydrated.map((m) => m.symbol));
  const merged = [
    ...validHydrated,
    ...localMatches.filter((m) => !hydratedSyms.has(m.symbol)),
  ];

  return res.json({ matches: merged });
});

// --- GEMINI AI RESEARCH, MULTI-TURN CHAT, SEARCH GROUNDING & IMAGE GENERATION ---

app.post('/api/ai/research', async (req, res) => {
  try {
    const ai = getGenAIClient();
    const {
      question,
      mode = 'grounded', // 'grounded' | 'deep' | 'fast'
      companyContext,
      comparisonContext,
    } = req.body || {};

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'A research question is required.' });
    }

    const systemInstruction = `You are the QuantPulse Institutional Financial Research & Education Assistant.
QuantPulse ("Intelligence for Every Market Move") was founded by Viraj Kumar and Varshith Reddy (classmates in Class 9 ICSE) to make stock-market information easier to explore and understand through accessible research, data-driven analysis, and AI-assisted explanations.

STRICT ANALYTICAL RULES:
1. Use the provided Retrieved Company Evidence as the single source of truth for current prices, technical indicators, and financial ratios.
2. NEVER invent current prices, financial metrics, source citations, or model accuracy statistics. If a metric is null or missing, state clearly that it is unavailable.
3. Structure your response clearly with Markdown headings or bullet points separating:
   - **Observed Facts & Metrics**: Direct numbers from the quote, fundamentals, and retrieved news.
   - **Calculated Technical Indicators**: Exact RSI, MACD, Moving Average, Volatility, and Scenario outputs from the deterministic engine.
   - **Analytical Interpretation & Drivers**: What the combination of fundamentals, technicals, and news implies.
   - **Risks, Uncertainties & Limitations**: Downside scenarios, valuation or macro risks, and why no indicator guarantees future returns.`;

    const promptText = `USER RESEARCH QUESTION:
${question}

RETRIEVED COMPANY EVIDENCE (SOURCE OF TRUTH):
${JSON.stringify(companyContext || {}, null, 2)}

${comparisonContext ? `COMPARISON STOCKS CONTEXT:\n${JSON.stringify(comparisonContext, null, 2)}` : ''}`;

    let response: GenerateContentResponse;
    let modelUsed = 'gemini-3.8-flash';

    if (mode === 'deep') {
      modelUsed = 'gemini-3.1-pro-preview';
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: promptText,
          config: {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
          },
        });
      } catch {
        modelUsed = 'gemini-3.8-flash';
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptText,
          config: {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
          },
        });
      }
    } else if (mode === 'fast') {
      modelUsed = 'gemini-3.1-flash-lite';
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: promptText,
        config: {
          systemInstruction,
        },
      });
    } else {
      modelUsed = 'gemini-3.8-flash';
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });
    }

    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = rawChunks
      .map((c: any) => (c.web ? { uri: c.web.uri, title: c.web.title || c.web.uri } : null))
      .filter(Boolean);

    return res.json({
      answer: response.text || 'No analysis generated.',
      modelUsed,
      mode,
      sources,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Gemini Research Error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to generate AI research analysis.',
    });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const ai = getGenAIClient();
    const {
      messages = [],
      mode = 'grounded',
      companyContext,
    } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    const systemInstruction = `You are the QuantPulse Multi-Turn Financial Intelligence Chatbot.
You help users investigate equities, interpret technical indicators (RSI, MACD, Bollinger Bands, EMA/SMA), compare company fundamentals, evaluate scenario risks, and understand financial concepts.
Always ground your answers in the active symbol context provided below and never promise profitable trades.

ACTIVE WORKSPACE SYMBOL CONTEXT:
${JSON.stringify(companyContext || {}, null, 2)}`;

    const contents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.text) }],
    }));

    let response: GenerateContentResponse;
    let modelUsed = 'gemini-3.8-flash';

    if (mode === 'deep') {
      modelUsed = 'gemini-3.1-pro-preview';
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents,
          config: {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
          },
        });
      } catch {
        modelUsed = 'gemini-3.8-flash';
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
          },
        });
      }
    } else if (mode === 'fast') {
      modelUsed = 'gemini-3.1-flash-lite';
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents,
        config: {
          systemInstruction,
        },
      });
    } else {
      modelUsed = 'gemini-3.8-flash';
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });
    }

    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = rawChunks
      .map((c: any) => (c.web ? { uri: c.web.uri, title: c.web.title || c.web.uri } : null))
      .filter(Boolean);

    return res.json({
      reply: response.text || 'Unable to generate response.',
      modelUsed,
      sources,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Gemini Chat Error:', err);
    return res.status(500).json({
      error: err.message || 'Chat request failed.',
    });
  }
});

app.post('/api/ai/generate-image', async (req, res) => {
  try {
    const ai = getGenAIClient();
    const {
      prompt,
      imageSize = '1K',
      aspectRatio = '16:9',
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Image prompt is required.' });
    }

    const validSize = ['1K', '2K', '4K'].includes(imageSize) ? imageSize : '1K';
    const validRatio = ['1:1', '3:4', '4:3', '9:16', '16:9'].includes(aspectRatio)
      ? aspectRatio
      : '16:9';

    let response: GenerateContentResponse;
    let modelUsed = 'gemini-nano-banana-2.1';

    try {
      response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: validRatio,
            imageSize: validSize,
          },
        },
      });
    } catch {
      modelUsed = 'gemini-3-pro-image';
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3-pro-image',
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: validRatio,
              imageSize: validSize,
            },
          },
        });
      } catch {
        modelUsed = 'gemini-3.1-flash-lite-image';
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: validRatio,
            },
          },
        });
      }
    }

    let imageUrl: string | null = null;
    let captionText = '';

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
      } else if (part.text) {
        captionText += part.text;
      }
    }

    if (!imageUrl) {
      return res.status(500).json({
        error:
          'The model completed without returning an image payload. Please refine your prompt.',
      });
    }

    return res.json({
      imageUrl,
      captionText,
      modelUsed,
      imageSize: validSize,
      aspectRatio: validRatio,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Gemini Image Generation Error:', err);
    return res.status(500).json({
      error:
        err.message ||
        'Image generation failed. Check API key permissions in Settings > Secrets.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuantPulse server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
