export type Timeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

export interface CandlePoint {
  timestamp: string;
  dateLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FinancialPeriodMetric {
  period: string; // e.g., "FY 2025", "Q4 2025", "Q1 2026"
  periodType: 'Annual' | 'Quarterly';
  reportDate: string;
  revenueB: number | null; // in USD Billions
  revenueGrowthYoY: number | null; // percentage
  netIncomeB: number | null; // in USD Billions
  eps: number | null; // USD per share
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  freeCashFlowB: number | null;
}

export interface CompanyFundamentals {
  currency: string;
  fiscalYearEnd: string;
  lastUpdated: string;
  source: string;
  marketCapB: number | null;
  peRatio: number | null;
  forwardPe: number | null;
  psRatio: number | null;
  pbRatio: number | null;
  evToEbitda: number | null;
  revenueTTM_B: number | null;
  revenueGrowthYoY_Pct: number | null;
  netIncomeTTM_B: number | null;
  epsTTM: number | null;
  grossMarginPct: number | null;
  operatingMarginPct: number | null;
  profitMarginPct: number | null;
  roePct: number | null;
  debtToEquity: number | null;
  totalCashB: number | null;
  totalDebtB: number | null;
  freeCashFlowTTM_B: number | null;
  dividendYieldPct: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  periods: FinancialPeriodMetric[];
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  relatedSymbols: string[];
  topic: 'Earnings' | 'Macro' | 'AI & Semis' | 'Regulation' | 'Product & Strategy' | 'Market Structure';
  sentimentHints: 'Positive' | 'Neutral' | 'Cautious';
}

export interface StockData {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  description: string;
  headquarters: string;
  founded: string;
  ceo: string;
  employees: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
  volume: number;
  avgVolume: number;
  quoteTimestamp: string;
  dataSource: string;
  marketState?: 'REGULAR' | 'PRE' | 'POST' | 'CLOSED';
  isLiveData?: boolean;
  isIndex?: boolean;
  candles: Record<Timeframe, CandlePoint[]>;
  fundamentals: CompanyFundamentals;
  news: NewsItem[];
}

export interface TechnicalIndicatorPoint {
  timestamp: string;
  dateLabel: string;
  close: number;
  sma20: number | null;
  sma50: number | null;
  ema12: number | null;
  ema26: number | null;
  ema50: number | null;
  ema200: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  rsi14: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHist: number | null;
}

export interface CrossoverSignalEvent {
  id: string;
  symbol: string;
  type: 'MACD_BULLISH' | 'MACD_BEARISH' | 'GOLDEN_CROSS_SMA' | 'DEATH_CROSS_SMA' | 'RSI_OVERBOUGHT' | 'RSI_OVERSOLD' | 'BOLLINGER_BREAKOUT' | 'UNUSUAL_VOLUME';
  label: string;
  description: string;
  observationDate: string;
  triggerPrice: number;
  indicatorValue: string;
  timeframe: Timeframe;
  direction: 'bullish' | 'bearish' | 'neutral';
}

export interface TechnicalSummary {
  symbol: string;
  timeframe: Timeframe;
  observationCount: number;
  lastUpdated: string;
  latestRsi14: number | null;
  rsiStatus: 'Potentially Overbought (>70)' | 'Potentially Oversold (<30)' | 'Bullish Momentum (55-70)' | 'Bearish Momentum (30-45)' | 'Neutral Range (45-55)' | 'Insufficient Data';
  latestMacd: {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
    status: string;
    crossoverObservation?: string;
  };
  movingAverages: {
    sma20: number | null;
    sma50: number | null;
    ema50: number | null;
    ema200: number | null;
    relationshipLabel: string;
  };
  bollinger: {
    upper: number | null;
    middle: number | null;
    lower: number | null;
    percentB: number | null;
    bandwidthPct: number | null;
    positionLabel: string;
  };
  annualizedVolatilityPct: number | null;
  periodReturnPct: number | null;
  series: TechnicalIndicatorPoint[];
  signals: CrossoverSignalEvent[];
}

export interface ForecastScenarioPoint {
  stepIndex: number;
  dateLabel: string;
  centralPrice: number;
  upsidePrice: number;
  downsidePrice: number;
  upperBand1Sigma: number;
  lowerBand1Sigma: number;
}

export interface ForecastEvaluationMetrics {
  holdoutWindowDays: number;
  modelRmse: number;
  baselineNaiveRmse: number;
  modelMae: number;
  baselineNaiveMae: number;
  outOfSampleDirectionalHitRatePct: number;
  rSquared: number;
}

export interface ForecastScenarioResult {
  symbol: string;
  horizonDays: number;
  methodName: string;
  assumptions: string[];
  limitations: string[];
  historicalWindowUsed: number;
  latestInputTimestamp: string;
  currentPrice: number;
  projectedCentralEnd: number;
  projectedCentralReturnPct: number;
  projectedUpsideEnd: number;
  projectedUpsideReturnPct: number;
  projectedDownsideEnd: number;
  projectedDownsideReturnPct: number;
  annualizedDriftUsedPct: number;
  annualizedVolatilityUsedPct: number;
  riskClassification: 'Low Volatility' | 'Moderate Volatility' | 'Elevated Volatility' | 'High Volatility Regime';
  compositeSignalScore: number; // Documented 0-100 analytical score
  points: ForecastScenarioPoint[];
  evaluation: ForecastEvaluationMetrics;
}

export interface AlertConfigItem {
  id: string;
  userId: string;
  symbol: string;
  conditionType: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'DAILY_CHANGE_PCT' | 'RSI_ABOVE' | 'RSI_BELOW' | 'MACD_CROSSOVER' | 'MA_CROSSOVER' | 'COMPANY_NEWS';
  threshold: number;
  timeframe: Timeframe;
  enabled: boolean;
  status: 'ARMED' | 'TRIGGERED' | 'PAUSED';
  lastEvaluatedAt: string;
  lastTriggeredAt?: string;
  triggerMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenerPresetItem {
  id: string;
  userId: string;
  name: string;
  sector: string;
  minMarketCapB: number;
  maxPE: number;
  minRsi: number;
  maxRsi: number;
  signalFilter: string;
  createdAt: string;
}

export interface UserProfileData {
  uid: string;
  email: string;
  displayName: string;
  bio: string;
  refreshIntervalSec: number; // 0 = paused, 15, 30, 60
  defaultTimeframe: Timeframe;
  defaultChartType: 'candlestick' | 'line';
  watchlist: string[];
  alerts: AlertConfigItem[];
  presets: ScreenerPresetItem[];
  createdAt: string;
  updatedAt: string;
}
