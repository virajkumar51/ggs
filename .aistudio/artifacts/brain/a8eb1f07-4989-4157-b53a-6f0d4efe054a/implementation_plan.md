# QuantPulse — Live Market Data, Historical OHLCV & Fundamental Accuracy Upgrade

Upgrades QuantPulse from a seeded reference dataset with simulated micro-ticks to an authentic live market data pipeline powered by Yahoo Finance (`v8/finance/chart` and `v10/finance/quoteSummary` / `v7/finance/quote`), eliminating synthetic price noise and ensuring that every displayed quote, historical candlestick, technical indicator, and fundamental ratio reflects verified market data or transparently reports provider limitations.

## User Review & Critical Decisions

> [!IMPORTANT]
> Please review the confirmed architectural decisions below based on your answers before we execute the live data pipeline upgrade.

- **Confirmed Decision 1 — Live Market Data Source**: Use the **Live Yahoo Finance Feed with Validated Fallback** (`query1.finance.yahoo.com` & `query2.finance.yahoo.com`) to retrieve real-time quotes (`regularMarketPrice`, `regularMarketChange`, `regularMarketChangePercent`, `regularMarketDayHigh`, `regularMarketDayLow`, `regularMarketVolume`, `regularMarketTime`) and historical OHLCV candles across all 6 timeframes (`1D`, `1W`, `1M`, `3M`, `6M`, `1Y`). If Yahoo Finance rate-limits or blocks a specific symbol, the system clearly badges the quote as a cached/reference snapshot with its exact timestamp rather than presenting stale data as live.
- **Confirmed Decision 2 — Exchange-Aware Refresh Behavior (No Synthetic Ticks)**: Remove all random/trigonometric price perturbations (`Math.random()` / `Math.sin()`) from the 15-to-30 second refresh cycle. During active market hours, the refresh loop pulls live exchange quotes from the backend proxy; when markets are closed (`POST` / `CLOSED` / `PRE` market state) or prices are unchanged, quotes remain strictly locked to the official closing print with an explicit market-session status indicator (`Market Closed · Last Official Close`).
- **Confirmed Decision 3 — Live Fundamentals & Strict Missing-Value Integrity**: Fetch live company fundamentals (Market Cap, Trailing & Forward P/E, P/S, P/B, EV/EBITDA, Revenue TTM, YoY Revenue Growth, Profit Margins, ROE, Debt/Equity, Free Cash Flow, 52-Week High/Low, and quarterly/annual earnings history) via server-side Yahoo Finance quote/summary endpoints (with on-demand Gemini Google Search grounding verification), and strictly display `Unavailable` whenever a metric is missing from the upstream provider.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms QuantPulse into a verified live market workstation where all 20+ core equities (`AAPL`, `MSFT`, `NVDA`, `TSLA`, `AMZN`, `GOOGL`, `META`, `AMD`, `INTC`, `AVGO`, `JPM`, `WMT`, `COST`, `KO`, `NFLX`, `CRM`, `ORCL`, `BRK-B`, `DIS`, `UBER`, plus `^GSPC` S&P 500 and dynamically searched global tickers) load authentic prices, real historical OHLCV bars, and verified fundamentals from live financial endpoints.
- **Target Audience / Persona**: Retail investors, finance students, and quantitative researchers who require trustworthy numbers, transparent data provenance, and deterministic technical/scenario calculations.
- **Key Value**: Eliminates drift between displayed prices and real-world market prices while preserving fast UI responsiveness through intelligent server-side caching, batch quote hydration, and clear provenance metadata (`Live Yahoo Finance Feed` vs. `Cached Snapshot`).

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Initial Boot & Live Hydration**: On startup, QuantPulse immediately fetches batch live quotes for the tracked universe and active watchlist, updating sidebar prices, percentage changes, and sparklines with real market numbers.
  2. **Timeframe & Symbol Switching**: Selecting any stock or switching timeframes (`1D`, `1W`, `1M`, `3M`, `6M`, `1Y`) fetches the matching resolution of real historical OHLCV candles from the backend (`5m` intraday bars for `1D`, `1h` bars for `1W`, and `1d` daily bars for `1M`/`3M`/`6M`/`1Y`) and recomputes RSI-14, MACD, EMA 50/200, SMA 20/50, Bollinger Bands, and the 30-day Scenario Cone deterministically.
  3. **Live Refresh & Market State Transparency**: Every 15–30 seconds, the auto-refresh engine polls live upstream quotes. The header status bar displays the live exchange market state (`REGULAR SESSION · LIVE`, `AFTER HOURS · OFFICIAL CLOSE`, or `CACHED SNAPSHOT`), the exact exchange quote timestamp, and the data provider source.
  4. **Fundamental Verification**: Opening the Company Fundamentals or Comparison view displays live-retrieved valuation ratios and financial statement metrics with their exact reporting currency and timestamp, marking any unreturned provider field as `Unavailable`.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Dense, high-precision institutional financial terminal modeled after the reference workstation.
  - *Color Palette & Mood*: Near-black main canvas (`#080a0e`), charcoal structural panels (`#0e1218` / `#11161f`), hairline borders (`#1c2331`), crisp white primary typography (`#f1f5f9`), muted slate labels (`#64748b`), neon green (`#00E676`) for positive price action, coral red (`#FF4D4D`) for negative movement, and cyan (`#00E5FF`) for active controls and technical trajectories.
  - *Typography & Hierarchy*: `Plus Jakarta Sans` for crisp structural headers and navigation paired with `JetBrains Mono` (`tabular-nums`) for all prices, OHLCV readouts, indicator values, and timestamps to prevent horizontal jitter during live refreshes.
  - *Component Styling & Layout*: Single-elevation flat cards with 1px borders, compact 36px–44px table row density, and zero-pill unboxed metadata separated by typographic dots (`·`).
- **Interactive Feedback & Motion**:
  - Subtle 150ms opacity/color transitions on quote refreshes, skeleton/spinner feedback in the header sync badge while live requests are in flight, and explicit provenance banners when markets are closed or a symbol has partial fundamental coverage.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Side Yahoo Finance Proxy with Cookie/Crumb & Multi-Endpoint Resilience**
  - *Chosen Approach*: Route all Yahoo Finance requests through the Express backend (`/api/market/live-batch`, `/api/market/history/:symbol`, `/api/market/fundamentals/:symbol`) with automatic crumb/cookie negotiation and fallback between Yahoo Finance `v8/finance/chart`, `v7/finance/quote`, and `v10/finance/quoteSummary` endpoints, backed by a 15-second in-memory TTL cache.
  - *Why*: Calling Yahoo Finance from the browser fails due to CORS restrictions, and uncached per-component requests can trigger HTTP 429 rate limits. Centralizing requests on the server with a 15-second cache guarantees CORS-free execution, low latency, and protection against upstream rate limits.
  - *Alternatives Considered*: Client-side direct fetch (blocked by browser CORS policies) or simulated client ticks (rejected because synthetic ticks distort real market prices).
- **Decision 2: Strict Separation of Market Session State (`REGULAR` vs. `CLOSED`)**
  - *Chosen Approach*: Parse `marketState` (`REGULAR`, `PRE`, `POST`, `CLOSED`) and `regularMarketTime` directly from the Yahoo Finance payload. When the exchange is closed, the 15–30s refresh loop still checks upstream for any after-hours/pre-market updates but never mutates the price with artificial random noise.
  - *Why*: Financial research demands that a closed market shows the exact closing price across every refresh cycle.
  - *Alternatives Considered*: Adding micro-random noise after hours to make the UI look "active" (explicitly rejected per your confirmation and data integrity rules).
- **Decision 3: Live Fundamental Extraction with On-Demand Grounded Verification**
  - *Chosen Approach*: Extract live valuation and financial ratios (`marketCap`, `trailingPE`, `forwardPE`, `priceToSalesTrailing12Months`, `priceToBook`, `enterpriseToEbitda`, `totalRevenue`, `revenueGrowth`, `profitMargins`, `operatingMargins`, `grossMargins`, `returnOnEquity`, `debtToEquity`, `totalCash`, `totalDebt`, `freeCashflow`, `dividendYield`, `beta`, `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`) from the upstream quote summary, nulling out any field not returned by the API rather than substituting fake defaults.
  - *Why*: Ensures every ratio in the Fundamentals tab, Screener, and Comparison table is authentic and traceable.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL MARKET & AI PROVIDERS                      │
│  ┌────────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ Yahoo Finance API (v8 Chart / v10  │  │ Google Gemini API            │  │
│  │ QuoteSummary / v7 Batch Quotes)    │  │ (Search Grounding & Pro)     │  │
│  └─────────────────┬──────────────────┘  └──────────────┬───────────────┘  │
└────────────────────┼────────────────────────────────────┼──────────────────┘
                     │ HTTPS (Server-Side Only)           │
                     ▼                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   EXPRESS BACKEND PROXY & CACHE ENGINE                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Live Market Data Service (Crumb/Session + 15s In-Memory TTL Cache)   │  │
│  │  • GET  /api/market/bootstrap     -> Batch live quotes for universe  │  │
│  │  • POST /api/market/refresh       -> Live upstream quote poll (0 RNG)│  │
│  │  • GET  /api/market/symbol/:sym   -> Real OHLCV (1D..1Y) + Fund.     │  │
│  │  • GET  /api/market/discover      -> Live Yahoo Finance search API   │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────────┘
                                      │ JSON (Verified Quotes, OHLCV, MarketState)
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     QUANTPULSE FRONTEND WORKSTATION                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Central Market State Controller                                      │  │
│  │  • Hydrates 26+ universe stocks with real prices & marketState       │  │
│  │  • Fetches real timeframe candles on symbol/timeframe selection      │  │
│  │  • Runs 15s/30s live polling loop (no synthetic price mutation)      │  │
│  └────────┬─────────────────────────┬──────────────────────────┬────────┘  │
│           ▼                         ▼                          ▼           │
│  ┌─────────────────┐     ┌─────────────────────┐    ┌───────────────────┐  │
│  │ Deterministic   │     │ Primary Financial   │    │ Company, Screener │  │
│  │ Technicals &    │────▶│ Chart & Scenario    │    │ Comparison, Alert │  │
│  │ Sentiment Model │     │ Cone Visualization  │    │ & AI Workspaces   │  │
│  └─────────────────┘     └─────────────────────┘    └───────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State
- **Live Quote Payload**: Includes `symbol`, `price`, `previousClose`, `change`, `changePercent`, `dayHigh`, `dayLow`, `dayOpen`, `volume`, `avgVolume`, `quoteTimestamp` (ISO string converted from exchange `regularMarketTime`), `marketState` (`REGULAR` | `PRE` | `POST` | `CLOSED`), and `dataSource` (`Yahoo Finance Live Exchange Feed` or `Reference Snapshot (Offline Fallback)`).
- **Historical Candle Cache**: Keyed by `symbol` and `timeframe` (`1D` -> `range=1d&interval=5m`, `1W` -> `range=5d&interval=60m`, `1M` -> `range=1mo&interval=1d`, `3M` -> `range=3mo&interval=1d`, `6M` -> `range=6mo&interval=1d`, `1Y` -> `range=1y&interval=1d`), filtering out incomplete/null bars before passing to the technical analysis engine.
- **Fundamental Record**: Maps Yahoo Finance `summaryDetail`, `defaultKeyStatistics`, and `financialData` modules directly to `CompanyFundamentals`, setting any unprovided field to `null` so the UI renders `Unavailable`.

### Interactive Component & State Mapping
- **Initial Universe Hydration (`App` mount)**: Calls `/api/market/bootstrap` to replace seeded prices with live Yahoo Finance quotes and `1Y` daily history for the core universe, immediately recalculating all screener metrics, technical summaries, top predictions, and market sentiment.
- **Symbol & Timeframe Selection (`PrimaryFinancialChart` / `CompanyWorkspaceView`)**: Selecting a ticker or switching between `1D`, `1W`, `1M`, `3M`, `6M`, and `1Y` fetches `/api/market/symbol/:symbol?timeframe=...` to load real interval candles and live fundamentals for that symbol, displaying a non-blocking loading indicator while preserving layout stability.
- **Auto-Refresh Loop (`triggerMarketRefresh`)**: Calls `POST /api/market/refresh` every 15 or 30 seconds. The server fetches fresh quotes from Yahoo Finance and returns the exact exchange price, volume, `marketState`, and `regularMarketTime`. If `marketState !== 'REGULAR'` and price is unchanged, the UI displays `Market Closed · Official Close ($XXX.XX)` without fabricating price ticks.
- **Global Search Discovery (`GlobalSearchBar`)**: Queries Yahoo Finance's live search endpoint (`query2.finance.yahoo.com/v1/finance/search`) alongside quote hydration so searching any global ticker returns its real live price, exchange, and percentage change.
