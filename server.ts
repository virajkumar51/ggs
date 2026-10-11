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

function buildDefaultUserRecord(uid: string, email: string, displayName: string, passwordHash = '', salt = ''): StoredUserRecord {
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
        status: 'TRIGGERED',
        lastEvaluatedAt: now,
        lastTriggeredAt: now,
        triggerMessage: 'TSLA daily absolute movement (-1.65%) exceeded 1.50% threshold.',
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
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
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

// --- EXTENDED SYMBOL DIRECTORY & REAL-TIME REFRESH ENGINE ---

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
    price: 498.20,
    changePercent: 0.65,
    volume: 2350000,
    marketCapB: 461.4,
    peRatio: 35.8,
    revenueTTM_B: 26.8,
    revenueGrowthYoY_Pct: 11.4,
    profitMarginPct: 46.2,
    description: 'Mastercard Incorporated operates a global payment technology network connecting consumers, financial institutions, merchants, and governments in 210+ countries.',
  },
  {
    symbol: 'UNH',
    name: 'UnitedHealth Group Incorporated',
    exchange: 'NYSE',
    sector: 'Healthcare',
    industry: 'Managed Healthcare & Optum Health Services',
    price: 584.10,
    changePercent: -0.38,
    volume: 3120000,
    marketCapB: 538.2,
    peRatio: 24.1,
    revenueTTM_B: 389.4,
    revenueGrowthYoY_Pct: 7.6,
    profitMarginPct: 6.1,
    description: 'UnitedHealth Group provides health insurance benefits through UnitedHealthcare and technology-enabled health care services via Optum.',
  },
  {
    symbol: 'HD',
    name: 'The Home Depot, Inc.',
    exchange: 'NYSE',
    sector: 'Consumer Discretionary',
    industry: 'Home Improvement Retail & Pro Building Supplies',
    price: 394.50,
    changePercent: 0.82,
    volume: 3450000,
    marketCapB: 391.8,
    peRatio: 26.4,
    revenueTTM_B: 154.2,
    revenueGrowthYoY_Pct: 1.8,
    profitMarginPct: 9.7,
    description: 'The Home Depot is the largest home improvement retailer in the United States, supplying building materials, tools, and professional contractor supplies.',
  },
  {
    symbol: 'PG',
    name: 'The Procter & Gamble Company',
    exchange: 'NYSE',
    sector: 'Consumer Staples',
    industry: 'Household & Personal Care Products',
    price: 172.30,
    changePercent: 0.19,
    volume: 5800000,
    marketCapB: 405.2,
    peRatio: 26.9,
    revenueTTM_B: 84.4,
    revenueGrowthYoY_Pct: 3.1,
    profitMarginPct: 18.2,
    description: 'Procter & Gamble markets branded consumer packaged goods across fabric care, home care, grooming, health care, and baby & family care.',
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
    description: 'Bank of America serves individual consumers, small and middle-market businesses, and large corporations with banking, investing, and wealth management.',
  },
  {
    symbol: 'PANW',
    name: 'Palo Alto Networks, Inc.',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Zero-Trust Cybersecurity & Cloud Security',
    price: 372.90,
    changePercent: 1.94,
    volume: 4120000,
    marketCapB: 121.4,
    peRatio: 48.6,
    revenueTTM_B: 8.3,
    revenueGrowthYoY_Pct: 15.8,
    profitMarginPct: 31.2,
    description: 'Palo Alto Networks provides network security, Prisma Cloud security, and Cortex AI-driven security operations center (SOC) platformization.',
  },
  {
    symbol: 'COIN',
    name: 'Coinbase Global, Inc.',
    exchange: 'NASDAQ',
    sector: 'Financials',
    industry: 'Digital Asset Exchange & Custody Infrastructure',
    price: 214.60,
    changePercent: 3.45,
    volume: 9850000,
    marketCapB: 53.4,
    peRatio: 36.2,
    revenueTTM_B: 5.2,
    revenueGrowthYoY_Pct: 78.4,
    profitMarginPct: 28.5,
    description: 'Coinbase Global operates regulated cryptocurrency trading, institutional custody for spot ETFs, stablecoin infrastructure, and the Base Layer-2 network.',
  },
  {
    symbol: 'ARM',
    name: 'Arm Holdings plc',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Semiconductor CPU Architecture & IP Licensing',
    price: 148.20,
    changePercent: 2.64,
    volume: 6900000,
    marketCapB: 155.2,
    peRatio: 98.4,
    revenueTTM_B: 3.54,
    revenueGrowthYoY_Pct: 29.5,
    profitMarginPct: 24.6,
    description: 'Arm Holdings architects, develops, and licenses high-efficiency RISC CPU instruction sets and compute subsystems for smartphones, cloud servers, and edge AI.',
  },
  {
    symbol: 'GS',
    name: 'The Goldman Sachs Group, Inc.',
    exchange: 'NYSE',
    sector: 'Financials',
    industry: 'Global Investment Banking, Trading & Asset Management',
    price: 518.40,
    changePercent: 1.72,
    volume: 2150000,
    marketCapB: 164.8,
    peRatio: 15.4,
    revenueTTM_B: 51.2,
    revenueGrowthYoY_Pct: 12.6,
    profitMarginPct: 22.8,
    description: 'Goldman Sachs is a leading global investment banking, securities trading, and asset & wealth management institution.',
  },
  {
    symbol: 'CAT',
    name: 'Caterpillar Inc.',
    exchange: 'NYSE',
    sector: 'Industrials',
    industry: 'Heavy Construction, Mining & Power Generation Machinery',
    price: 396.80,
    changePercent: 1.05,
    volume: 2410000,
    marketCapB: 192.4,
    peRatio: 18.2,
    revenueTTM_B: 66.1,
    revenueGrowthYoY_Pct: 2.1,
    profitMarginPct: 16.4,
    description: 'Caterpillar Inc. manufactures construction and mining equipment, off-highway diesel and natural gas engines, industrial gas turbines, and backup datacenter generators.',
  },
  {
    symbol: 'SNOW',
    name: 'Snowflake Inc.',
    exchange: 'NYSE',
    sector: 'Technology',
    industry: 'AI Data Cloud & Enterprise Data Warehousing',
    price: 128.40,
    changePercent: -1.18,
    volume: 6320000,
    marketCapB: 42.9,
    peRatio: null,
    revenueTTM_B: 3.28,
    revenueGrowthYoY_Pct: 26.4,
    profitMarginPct: -24.2,
    description: 'Snowflake Inc. provides a cloud-native data platform enabling organizations to mobilize data for analytics, data engineering, and enterprise AI applications.',
  },
  {
    symbol: 'SHOP',
    name: 'Shopify Inc.',
    exchange: 'NYSE',
    sector: 'Technology',
    industry: 'Merchant E-Commerce Software & Payment Solutions',
    price: 84.30,
    changePercent: 1.88,
    volume: 11200000,
    marketCapB: 108.9,
    peRatio: 64.8,
    revenueTTM_B: 7.9,
    revenueGrowthYoY_Pct: 21.4,
    profitMarginPct: 16.2,
    description: 'Shopify Inc. provides cloud-based omnichannel commerce infrastructure and merchant payment processing for millions of businesses globally.',
  },
];

app.get('/api/market/discover', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.json({ matches: EXTENDED_GLOBAL_DIRECTORY.slice(0, 8) });
  }
  const upper = q.toUpperCase();
  const lower = q.toLowerCase();

  // Match against extended directory
  const localMatches = EXTENDED_GLOBAL_DIRECTORY.filter(
    (item) =>
      item.symbol.includes(upper) ||
      item.name.toLowerCase().includes(lower) ||
      item.sector.toLowerCase().includes(lower) ||
      item.industry.toLowerCase().includes(lower)
  );

  // Also try live Yahoo Finance symbol search if user typed a specific ticker not in localMatches
  if (localMatches.length === 0 && /^[A-Z\.]{1,6}$/.test(upper)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const yfRes = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upper)}?interval=1d&range=5d`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }
      );
      clearTimeout(timeout);
      if (yfRes.ok) {
        const yfData: any = await yfRes.json();
        const meta = yfData?.chart?.result?.[0]?.meta;
        if (meta && typeof meta.regularMarketPrice === 'number') {
          const price = Number(meta.regularMarketPrice.toFixed(2));
          const prev = Number((meta.chartPreviousClose || price).toFixed(2));
          const changePct = prev > 0 ? Number((((price - prev) / prev) * 100).toFixed(2)) : 0;
          localMatches.push({
            symbol: meta.symbol || upper,
            name: meta.longName || meta.shortName || `${upper} Corp.`,
            exchange: meta.exchangeName || 'EXCHANGE',
            sector: 'Public Equities',
            industry: meta.instrumentType || 'Equity Security',
            price,
            changePercent: changePct,
            volume: meta.regularMarketVolume || 5000000,
            marketCapB: null,
            peRatio: null,
            revenueTTM_B: null,
            revenueGrowthYoY_Pct: null,
            profitMarginPct: null,
            description: `${meta.longName || upper} retrieved live from exchange market feed (${meta.exchangeName || 'USD'}).`,
          });
        }
      }
    } catch {
      // Ignore network sandbox errors; return empty if symbol is unknown
    }
  }

  return res.json({ matches: localMatches });
});

// Real-Time Market Refresh Endpoint: Generates realistic micro-ticks and returns fresh server timestamps
app.post('/api/market/refresh', (req, res) => {
  const { symbols } = req.body || {};
  const timestamp = new Date().toISOString();
  const updates: Record<
    string,
    {
      deltaPct: number;
      volumeDelta: number;
      timestamp: string;
    }
  > = {};

  const targetSymbols: string[] = Array.isArray(symbols) ? symbols : [];
  for (const sym of targetSymbols) {
    // Deterministic + micro-stochastic market tick (-0.35% to +0.38%)
    const hash = sym.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const wave = Math.sin(Date.now() / 15000 + hash) * 0.14;
    const micro = (Math.random() - 0.492) * 0.28;
    const deltaPct = Number((wave + micro).toFixed(3));
    const volumeDelta = Math.round(18000 + Math.random() * 95000);
    updates[sym] = {
      deltaPct,
      volumeDelta,
      timestamp,
    };
  }

  return res.json({
    refreshedAt: timestamp,
    updates,
  });
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
        // Fallback if pro preview is restricted on current key tier
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
      // 'grounded' mode with Google Search tool
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
      mode = 'grounded', // 'grounded' | 'deep' | 'fast'
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
      imageSize = '1K', // '1K' | '2K' | '4K'
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
        error: 'The model completed without returning an image payload. Please refine your prompt.',
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
      error: err.message || 'Image generation failed. Check API key permissions in Settings > Secrets.',
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
