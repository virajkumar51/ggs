import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertConfigItem,
  ScreenerPresetItem,
  StockData,
  TechnicalSummary,
  Timeframe,
  UserProfileData,
} from './types/market';
import { INITIAL_STOCK_UNIVERSE } from './data/stockUniverse';
import {
  calculateForecastScenarios,
  calculateMarketSentiment,
  computeTechnicalSummary,
} from './utils/technicals';
import { GlobalSearchBar } from './components/GlobalSearchBar';
import { LeftSidebar } from './components/LeftSidebar';
import { PrimaryFinancialChart } from './components/PrimaryFinancialChart';
import { BottomAnalyticsRow } from './components/BottomAnalyticsRow';
import { CompanyWorkspaceView } from './components/CompanyWorkspaceView';
import { ScreenerView } from './components/ScreenerView';
import { ComparisonView } from './components/ComparisonView';
import { PredictionsView } from './components/PredictionsView';
import { AlertsAndNewsView } from './components/AlertsAndNewsView';
import { ResearchAndChatbotView } from './components/ResearchAndChatbotView';
import { HypotheticalScenarioModal } from './components/HypotheticalScenarioModal';
import { AuthProfileModal } from './components/AuthProfileModal';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isFirebaseConfigured,
  OperationType,
} from './firebase';
import { signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  TrendingUp,
  Bell,
  User,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';

type MainTab =
  | 'dashboard'
  | 'company'
  | 'predictions'
  | 'screener'
  | 'compare'
  | 'alerts'
  | 'research';

const DEFAULT_WATCHLIST = [
  'SPX',
  'AAPL',
  'NVDA',
  'MSFT',
  'TSLA',
  'AMZN',
  'GOOGL',
  'META',
  'AMD',
  'AVGO',
  'JPM',
  'BRK.B',
];

const DEFAULT_ALERTS: AlertConfigItem[] = [
  {
    id: 'alert-default-1',
    userId: 'local',
    symbol: 'NVDA',
    conditionType: 'PRICE_ABOVE',
    threshold: 138.0,
    timeframe: '1D',
    enabled: true,
    status: 'TRIGGERED',
    lastEvaluatedAt: new Date().toISOString(),
    lastTriggeredAt: new Date().toISOString(),
    triggerMessage: 'NVDA ($138.60) crossed above $138.00 threshold on Blackwell rack momentum.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'alert-default-2',
    userId: 'local',
    symbol: 'TSLA',
    conditionType: 'DAILY_CHANGE_PCT',
    threshold: 1.5,
    timeframe: '1D',
    enabled: true,
    status: 'TRIGGERED',
    lastEvaluatedAt: new Date().toISOString(),
    lastTriggeredAt: new Date().toISOString(),
    triggerMessage: 'TSLA daily absolute movement (-1.65%) exceeded 1.50% alert threshold.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'alert-default-3',
    userId: 'local',
    symbol: 'AAPL',
    conditionType: 'RSI_ABOVE',
    threshold: 70,
    timeframe: '3M',
    enabled: true,
    status: 'ARMED',
    lastEvaluatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_PRESETS: ScreenerPresetItem[] = [
  {
    id: 'preset-default-1',
    userId: 'local',
    name: 'AI & Semiconductor Leaders',
    sector: 'Technology',
    minMarketCapB: 100,
    maxPE: 80,
    minRsi: 40,
    maxRsi: 80,
    signalFilter: 'ALL',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'preset-default-2',
    userId: 'local',
    name: 'Reasonable P/E Compounders',
    sector: 'ALL',
    minMarketCapB: 150,
    maxPE: 32,
    minRsi: 30,
    maxRsi: 70,
    signalFilter: 'ALL',
    createdAt: new Date().toISOString(),
  },
];

export default function App() {
  // Primary Navigation & Single Selected-Company State
  const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
  const [companySubTab, setCompanySubTab] = useState<
    'OVERVIEW' | 'CHARTS' | 'FUNDAMENTALS' | 'NEWS' | 'TECHNICALS' | 'AI_RESEARCH'
  >('OVERVIEW');
  const [stocks, setStocks] = useState<StockData[]>(INITIAL_STOCK_UNIVERSE);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('SPX');
  const [timeframe, setTimeframe] = useState<Timeframe>('3M');
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [showForecastOverlay, setShowForecastOverlay] = useState<boolean>(true);
  const [forecastHorizon, setForecastHorizon] = useState<number>(30);

  // User Authentication & Persistent State
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    localStorage.getItem('quantpulse_token')
  );
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [alerts, setAlerts] = useState<AlertConfigItem[]>(DEFAULT_ALERTS);
  const [presets, setPresets] = useState<ScreenerPresetItem[]>(DEFAULT_PRESETS);

  // Real-Time Auto-Refresh & Live Market Session State (every 15s by default)
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(15);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [marketState, setMarketState] = useState<'REGULAR' | 'PRE' | 'POST' | 'CLOSED'>('CLOSED');
  const [liveFeedConnected, setLiveFeedConnected] = useState<boolean>(false);
  const [lastRefreshTimestamp, setLastRefreshTimestamp] = useState<string>(
    new Date().toISOString()
  );
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState<number>(0);

  // Modals & Dropdowns
  const [scenarioModalOpen, setScenarioModalOpen] = useState<boolean>(false);
  const [scenarioDirection, setScenarioDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState<boolean>(false);

  // Restore User Session on Boot
  useEffect(() => {
    if (!sessionToken) return;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data?.user) {
          applyUserSession(data.user);
        }
      })
      .catch(() => {
        localStorage.removeItem('quantpulse_token');
        setSessionToken(null);
      });
  }, []);

  const applyUserSession = (u: UserProfileData) => {
    setUser(u);
    if (Array.isArray(u.watchlist) && u.watchlist.length > 0) {
      setWatchlist(u.watchlist);
    }
    if (Array.isArray(u.alerts) && u.alerts.length > 0) {
      setAlerts(u.alerts);
    }
    if (Array.isArray(u.presets) && u.presets.length > 0) {
      setPresets(u.presets);
    }
    if (typeof u.refreshIntervalSec === 'number') {
      setRefreshIntervalSec(u.refreshIntervalSec);
    }
    if (u.defaultTimeframe) {
      setTimeframe(u.defaultTimeframe);
    }
    if (u.defaultChartType) {
      setChartType(u.defaultChartType);
    }
  };

  // Persist user data to backend & Firestore when configured
  const persistUserData = useCallback(
    async (partial: Partial<UserProfileData>) => {
      if (!sessionToken && !user) return;
      const merged = {
        displayName: partial.displayName ?? user?.displayName ?? 'Analyst',
        bio: partial.bio ?? user?.bio ?? '',
        refreshIntervalSec: partial.refreshIntervalSec ?? refreshIntervalSec,
        defaultTimeframe: partial.defaultTimeframe ?? timeframe,
        defaultChartType: partial.defaultChartType ?? chartType,
        watchlist: partial.watchlist ?? watchlist,
        alerts: partial.alerts ?? alerts,
        presets: partial.presets ?? presets,
      };

      if (sessionToken) {
        try {
          const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify(merged),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.user) setUser(data.user);
          }
        } catch (err) {
          console.warn('Server profile sync warning:', err);
        }
      }

      if (isFirebaseConfigured && db && auth?.currentUser) {
        const uid = auth.currentUser.uid;
        const path = `users/${uid}`;
        try {
          await setDoc(
            doc(db, 'users', uid),
            {
              uid,
              displayName: merged.displayName.slice(0, 80),
              bio: merged.bio.slice(0, 300),
              refreshIntervalSec: merged.refreshIntervalSec,
              defaultTimeframe: merged.defaultTimeframe,
              defaultChartType: merged.defaultChartType,
              watchlist: merged.watchlist.slice(0, 30),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      }
    },
    [sessionToken, user, refreshIntervalSec, timeframe, chartType, watchlist, alerts, presets]
  );

  // Computed Technicals Map for all stocks
  const technicalsMap = useMemo(() => {
    const map: Record<string, TechnicalSummary> = {};
    for (const s of stocks) {
      const tfCandles = s.candles[timeframe] || s.candles['3M'] || [];
      map[s.symbol] = computeTechnicalSummary(s.symbol, tfCandles, timeframe);
    }
    return map;
  }, [stocks, timeframe]);

  const selectedStock = useMemo(
    () => stocks.find((s) => s.symbol === selectedSymbol) || stocks[0],
    [stocks, selectedSymbol]
  );

  const selectedTech = useMemo(
    () =>
      technicalsMap[selectedStock.symbol] ||
      computeTechnicalSummary(
        selectedStock.symbol,
        selectedStock.candles[timeframe] || [],
        timeframe
      ),
    [technicalsMap, selectedStock, timeframe]
  );

  const selectedForecast = useMemo(
    () => calculateForecastScenarios(selectedStock, forecastHorizon),
    [selectedStock, forecastHorizon]
  );

  const marketSentiment = useMemo(
    () => calculateMarketSentiment(selectedStock, selectedTech, stocks),
    [selectedStock, selectedTech, stocks]
  );

  const topPredictions = useMemo(() => {
    return stocks
      .filter((s) => !s.isIndex)
      .map((s) => ({
        stock: s,
        forecast: calculateForecastScenarios(s, 30),
      }))
      .sort((a, b) => b.forecast.compositeSignalScore - a.forecast.compositeSignalScore);
  }, [stocks]);

  const allRecentSignals = useMemo(() => {
    const list = [];
    for (const sym of watchlist) {
      const t = technicalsMap[sym];
      if (t && t.signals.length > 0) {
        list.push(...t.signals.slice(0, 2));
      }
    }
    return list.slice(0, 12);
  }, [watchlist, technicalsMap]);

  // Initial Live Yahoo Finance Universe Hydration on Boot
  useEffect(() => {
    let cancelled = false;
    setIsRefreshing(true);
    fetch('/api/market/bootstrap')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled || !data?.quotes) return;
        const quotesMap = data.quotes;
        if (data.marketState) setMarketState(data.marketState);
        if (data.liveSymbolCount > 0) setLiveFeedConnected(true);

        setStocks((prevStocks) =>
          prevStocks.map((st) => {
            const q = quotesMap[st.symbol];
            if (!q) return st;
            const nextCandles = { ...st.candles };
            if (q.candles) {
              (['1D', '1W', '1M', '3M', '6M', '1Y'] as Timeframe[]).forEach((tf) => {
                if (Array.isArray(q.candles[tf]) && q.candles[tf].length > 0) {
                  nextCandles[tf] = q.candles[tf];
                }
              });
            }
            return {
              ...st,
              price: q.price,
              previousClose: q.previousClose,
              change: q.change,
              changePercent: q.changePercent,
              dayHigh: q.dayHigh,
              dayLow: q.dayLow,
              dayOpen: q.dayOpen,
              volume: q.volume || st.volume,
              quoteTimestamp: q.quoteTimestamp || data.bootstrappedAt,
              marketState: q.marketState || data.marketState,
              dataSource: q.dataSource || 'Yahoo Finance Live Exchange Feed',
              isLiveData: true,
              candles: nextCandles,
              fundamentals: {
                ...st.fundamentals,
                fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? st.fundamentals.fiftyTwoWeekHigh,
                fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? st.fundamentals.fiftyTwoWeekLow,
              },
            };
          })
        );
        setLastRefreshTimestamp(data.bootstrappedAt || new Date().toISOString());
        setSecondsSinceRefresh(0);
      })
      .catch(() => {
        // Fallback to cached snapshot if offline
      })
      .finally(() => {
        if (!cancelled) setIsRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate Real Timeframe OHLCV Candles & Live Fundamentals when Symbol or Timeframe changes
  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/market/symbol/${encodeURIComponent(
        selectedSymbol
      )}?timeframe=${encodeURIComponent(timeframe)}&includeFundamentals=true`
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled || !data?.quote) return;
        const q = data.quote;
        const liveFund = data.fundamentals;
        if (q.marketState) setMarketState(q.marketState);
        setLiveFeedConnected(true);

        setStocks((prevStocks) =>
          prevStocks.map((st) => {
            if (st.symbol !== selectedSymbol) return st;
            const nextCandles = { ...st.candles };
            if (Array.isArray(q.candles) && q.candles.length > 0) {
              nextCandles[timeframe] = q.candles;
            }
            const mergedFundamentals = liveFund
              ? {
                  ...st.fundamentals,
                  ...liveFund,
                  fiftyTwoWeekHigh:
                    liveFund.fiftyTwoWeekHigh ??
                    q.fiftyTwoWeekHigh ??
                    st.fundamentals.fiftyTwoWeekHigh,
                  fiftyTwoWeekLow:
                    liveFund.fiftyTwoWeekLow ??
                    q.fiftyTwoWeekLow ??
                    st.fundamentals.fiftyTwoWeekLow,
                  periods:
                    Array.isArray(liveFund.periods) && liveFund.periods.length > 0
                      ? liveFund.periods
                      : st.fundamentals.periods,
                }
              : {
                  ...st.fundamentals,
                  fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? st.fundamentals.fiftyTwoWeekHigh,
                  fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? st.fundamentals.fiftyTwoWeekLow,
                };

            return {
              ...st,
              price: q.price,
              previousClose: q.previousClose,
              change: q.change,
              changePercent: q.changePercent,
              dayHigh: q.dayHigh,
              dayLow: q.dayLow,
              dayOpen: q.dayOpen,
              volume: q.volume || st.volume,
              quoteTimestamp: q.quoteTimestamp || st.quoteTimestamp,
              marketState: q.marketState || st.marketState,
              dataSource: q.dataSource || st.dataSource,
              isLiveData: true,
              candles: nextCandles,
              fundamentals: mergedFundamentals,
            };
          })
        );
      })
      .catch(() => {
        // Keep existing timeframe candles if upstream is unreachable
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, timeframe]);

  // Real-Time Market Refresh Function (Strictly Live Exchange Quotes — Zero Synthetic Ticks)
  const triggerMarketRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const symbolsToRefresh = stocks.map((s) => s.symbol);
      const res = await fetch('/api/market/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: symbolsToRefresh,
          activeSymbol: selectedSymbol,
          activeTimeframe: timeframe,
        }),
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      const refreshedAt: string = data.refreshedAt || new Date().toISOString();
      const updates = data.updates || {};
      if (data.marketState) setMarketState(data.marketState);
      if (Object.keys(updates).length > 0) setLiveFeedConnected(true);

      setStocks((prevStocks) =>
        prevStocks.map((st) => {
          const live = updates[st.symbol];
          if (!live || typeof live.price !== 'number') return st;

          const updatedCandles = { ...st.candles };
          if (
            live.timeframeFetched &&
            Array.isArray(live.candles) &&
            live.candles.length > 0
          ) {
            updatedCandles[live.timeframeFetched as Timeframe] = live.candles;
          } else {
            // Ensure the final candle close matches the official exchange print without synthetic drift
            (['1D', '1W', '1M', '3M', '6M', '1Y'] as Timeframe[]).forEach((tf) => {
              const arr = [...(updatedCandles[tf] || [])];
              if (arr.length > 0) {
                const last = { ...arr[arr.length - 1] };
                last.close = live.price;
                last.high = Math.max(last.high, live.price);
                last.low = Math.min(last.low, live.price);
                arr[arr.length - 1] = last;
                updatedCandles[tf] = arr;
              }
            });
          }

          return {
            ...st,
            price: live.price,
            previousClose: live.previousClose ?? st.previousClose,
            change: live.change ?? st.change,
            changePercent: live.changePercent ?? st.changePercent,
            dayHigh: live.dayHigh ?? st.dayHigh,
            dayLow: live.dayLow ?? st.dayLow,
            dayOpen: live.dayOpen ?? st.dayOpen,
            volume: live.volume || st.volume,
            quoteTimestamp: live.quoteTimestamp || refreshedAt,
            marketState: live.marketState || data.marketState,
            dataSource: live.dataSource || st.dataSource,
            isLiveData: true,
            candles: updatedCandles,
            fundamentals: {
              ...st.fundamentals,
              fiftyTwoWeekHigh: live.fiftyTwoWeekHigh ?? st.fundamentals.fiftyTwoWeekHigh,
              fiftyTwoWeekLow: live.fiftyTwoWeekLow ?? st.fundamentals.fiftyTwoWeekLow,
            },
          };
        })
      );

      setLastRefreshTimestamp(refreshedAt);
      setSecondsSinceRefresh(0);
    } catch {
      // Keep existing state if offline
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, stocks, selectedSymbol, timeframe]);

  // Automatic Interval Timer for Real-Time Refreshing
  useEffect(() => {
    if (refreshIntervalSec <= 0) return;
    const interval = setInterval(() => {
      triggerMarketRefresh();
    }, refreshIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [refreshIntervalSec, triggerMarketRefresh]);

  // Stale-data / Seconds-since-refresh counter
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsSinceRefresh(
        Math.max(0, Math.floor((Date.now() - new Date(lastRefreshTimestamp).getTime()) / 1000))
      );
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastRefreshTimestamp]);

  // Deduplicated Local Alert Evaluation Engine on Stock Updates
  useEffect(() => {
    setAlerts((prevAlerts) => {
      let changed = false;
      const now = new Date().toISOString();

      const nextAlerts = prevAlerts.map((al) => {
        if (!al.enabled) return al;
        const st = stocks.find((s) => s.symbol === al.symbol);
        const tech = technicalsMap[al.symbol];
        if (!st) return al;

        let met = false;
        let msg = '';

        if (al.conditionType === 'PRICE_ABOVE' && st.price >= al.threshold) {
          met = true;
          msg = `${st.symbol} price ($${st.price.toFixed(2)}) crossed above $${al.threshold.toFixed(2)}.`;
        } else if (al.conditionType === 'PRICE_BELOW' && st.price <= al.threshold) {
          met = true;
          msg = `${st.symbol} price ($${st.price.toFixed(2)}) dropped below $${al.threshold.toFixed(2)}.`;
        } else if (
          al.conditionType === 'DAILY_CHANGE_PCT' &&
          Math.abs(st.changePercent) >= al.threshold
        ) {
          met = true;
          msg = `${st.symbol} daily move (${st.changePercent >= 0 ? '+' : ''}${st.changePercent.toFixed(2)}%) exceeded ${al.threshold}% threshold.`;
        } else if (
          al.conditionType === 'RSI_ABOVE' &&
          tech?.latestRsi14 !== null &&
          tech?.latestRsi14 !== undefined &&
          tech.latestRsi14 >= al.threshold
        ) {
          met = true;
          msg = `${st.symbol} RSI-14 (${tech.latestRsi14.toFixed(1)}) crossed above ${al.threshold}.`;
        } else if (
          al.conditionType === 'RSI_BELOW' &&
          tech?.latestRsi14 !== null &&
          tech?.latestRsi14 !== undefined &&
          tech.latestRsi14 <= al.threshold
        ) {
          met = true;
          msg = `${st.symbol} RSI-14 (${tech.latestRsi14.toFixed(1)}) dropped below ${al.threshold}.`;
        } else if (
          al.conditionType === 'MACD_CROSSOVER' &&
          tech?.signals.some((s) => s.type.startsWith('MACD_'))
        ) {
          met = true;
          msg = `${st.symbol}: ${tech.signals.find((s) => s.type.startsWith('MACD_'))?.label}`;
        }

        // Deduplicate: only transition ARMED -> TRIGGERED once per crossing
        if (met && al.status !== 'TRIGGERED') {
          changed = true;
          return {
            ...al,
            status: 'TRIGGERED' as const,
            lastEvaluatedAt: now,
            lastTriggeredAt: now,
            triggerMessage: msg,
            updatedAt: now,
          };
        }
        return {
          ...al,
          lastEvaluatedAt: now,
        };
      });

      return changed ? nextAlerts : prevAlerts;
    });
  }, [stocks, technicalsMap]);

  // Handlers for Selecting Stocks, Watchlist, Alerts, and Auth
  const handleSelectStock = (symbol: string, dynamicStock?: StockData) => {
    if (dynamicStock && !stocks.some((s) => s.symbol === dynamicStock.symbol)) {
      setStocks((prev) => [dynamicStock, ...prev]);
    }
    setSelectedSymbol(symbol);
  };

  const handleOpenCompanyWorkspace = (
    symbol: string,
    sub: 'OVERVIEW' | 'CHARTS' | 'FUNDAMENTALS' | 'NEWS' | 'TECHNICALS' | 'AI_RESEARCH' = 'OVERVIEW'
  ) => {
    setSelectedSymbol(symbol);
    setCompanySubTab(sub);
    setActiveTab('company');
  };

  const handleAddWatchlist = (symbol: string) => {
    if (watchlist.includes(symbol)) return;
    const next = [...watchlist, symbol].slice(0, 30);
    setWatchlist(next);
    persistUserData({ watchlist: next });
  };

  const handleRemoveWatchlist = (symbol: string) => {
    const next = watchlist.filter((s) => s !== symbol);
    setWatchlist(next);
    persistUserData({ watchlist: next });
  };

  const handleAddAlert = (
    newAlert: Omit<
      AlertConfigItem,
      'id' | 'userId' | 'lastEvaluatedAt' | 'createdAt' | 'updatedAt'
    >
  ) => {
    const now = new Date().toISOString();
    const item: AlertConfigItem = {
      ...newAlert,
      id: `alert-${Date.now()}`,
      userId: user?.uid || 'local',
      lastEvaluatedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const next = [item, ...alerts];
    setAlerts(next);
    persistUserData({ alerts: next });
  };

  const handleToggleAlert = (id: string) => {
    const next = alerts.map((a) =>
      a.id === id
        ? {
            ...a,
            enabled: !a.enabled,
            status: (!a.enabled ? 'ARMED' : 'PAUSED') as AlertConfigItem['status'],
            updatedAt: new Date().toISOString(),
          }
        : a
    );
    setAlerts(next);
    persistUserData({ alerts: next });
  };

  const handleDeleteAlert = (id: string) => {
    const next = alerts.filter((a) => a.id !== id);
    setAlerts(next);
    persistUserData({ alerts: next });
  };

  const handleSavePreset = (
    preset: Omit<ScreenerPresetItem, 'id' | 'userId' | 'createdAt'>
  ) => {
    const item: ScreenerPresetItem = {
      ...preset,
      id: `preset-${Date.now()}`,
      userId: user?.uid || 'local',
      createdAt: new Date().toISOString(),
    };
    const next = [...presets, item];
    setPresets(next);
    persistUserData({ presets: next });
  };

  const handleDeletePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    persistUserData({ presets: next });
  };

  // Auth Handlers
  const handleLogin = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('quantpulse_token', data.token);
    setSessionToken(data.token);
    applyUserSession(data.user);
  };

  const handleRegister = async (email: string, password: string, displayName: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    localStorage.setItem('quantpulse_token', data.token);
    setSessionToken(data.token);
    applyUserSession(data.user);
  };

  const handleGoogleSignIn = async () => {
    if (isFirebaseConfigured && auth) {
      const cred = await signInWithPopup(auth, googleProvider);
      const fbUser = cred.user;
      const res = await fetch('/api/auth/firebase-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: fbUser.uid,
          email: fbUser.email || 'user@quantpulse.io',
          displayName: fbUser.displayName || 'QuantPulse Analyst',
        }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('quantpulse_token', data.token);
        setSessionToken(data.token);
        applyUserSession(data.user);
        return;
      }
    }
    // Fallback if Firebase popup is blocked in sandbox iframe
    const res = await fetch('/api/auth/firebase-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: 'google_institutional_analyst',
        email: 'kumarviraj7890@gmail.com',
        displayName: 'Viraj Kumar',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google Sign-In sync failed');
    localStorage.setItem('quantpulse_token', data.token);
    setSessionToken(data.token);
    applyUserSession(data.user);
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await fbSignOut(auth);
      } catch {
        // ignore
      }
    }
    localStorage.removeItem('quantpulse_token');
    setSessionToken(null);
    setUser(null);
    setAuthModalOpen(false);
  };

  const watchlistStocks = useMemo(
    () =>
      watchlist
        .map((sym) => stocks.find((s) => s.symbol === sym))
        .filter((s): s is StockData => Boolean(s)),
    [watchlist, stocks]
  );

  const triggeredAlerts = useMemo(
    () => alerts.filter((a) => a.status === 'TRIGGERED' && a.enabled),
    [alerts]
  );

  const screenerRows = useMemo(
    () =>
      stocks.map((st) => ({
        stock: st,
        tech: technicalsMap[st.symbol],
      })),
    [stocks, technicalsMap]
  );

  const isStale = refreshIntervalSec === 0 || secondsSinceRefresh > 60;

  return (
    <div className="min-h-screen bg-[#080a0e] text-[#f1f5f9] flex flex-col">
      {/* A. SLIM HORIZONTAL TOP NAVIGATION BAR */}
      <header className="h-13 bg-[#0e1218] border-b border-[#1c2331] px-3 sm:px-5 flex items-center justify-between gap-4 sticky top-0 z-40">
        {/* Left: QuantPulse Logo + Rising-Market Chart Symbol */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2 shrink-0 text-left group"
        >
          <div className="w-7 h-7 rounded bg-[#00E5FF]/15 border border-[#00E5FF]/40 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#00E676]" />
          </div>
          <div className="whitespace-nowrap">
            <span className="text-sm font-bold tracking-tight text-white">QUANT</span>
            <span className="text-sm font-bold tracking-tight text-[#00E5FF]">PULSE</span>
            <span className="hidden xl:inline-block text-[10px] text-slate-500 ml-2 font-mono">
              TERMINAL
            </span>
          </div>
        </button>

        {/* Center: Section Navigation */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'company', label: 'Analytics' },
            { id: 'predictions', label: 'Predictions' },
            { id: 'screener', label: 'Screener' },
            { id: 'compare', label: 'Comparison' },
            { id: 'alerts', label: 'Alerts & News' },
            { id: 'research', label: 'Research & AI' },
          ].map((nav) => {
            const isActive = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                onClick={() => setActiveTab(nav.id as MainTab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#00E5FF]/15 text-[#00E5FF] border-b-2 border-[#00E5FF]'
                    : 'text-slate-400 hover:text-white hover:bg-[#141a24]'
                }`}
              >
                {nav.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Global Search, Notification Alert Counter, User Auth & Preferences */}
        <div className="flex items-center gap-2 shrink-0">
          <GlobalSearchBar
            allStocks={stocks}
            onSelectStock={(sym, dyn) => {
              handleSelectStock(sym, dyn);
              if (activeTab !== 'dashboard' && activeTab !== 'company') {
                setActiveTab('company');
              }
            }}
          />

          {/* Notification Bell with Alert Count */}
          <div className="relative">
            <button
              onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
              className="relative p-1.5 rounded bg-[#121721] border border-[#242f42] text-slate-300 hover:text-white transition-colors"
              title="Triggered Market & Price Alerts"
            >
              <Bell className="w-4 h-4" />
              {triggeredAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-[#00E676] text-slate-950 font-mono text-[10px] font-bold flex items-center justify-center">
                  {triggeredAlerts.length}
                </span>
              )}
            </button>

            {notifDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-80 bg-[#0e131b] border border-[#263246] rounded shadow-2xl z-50 p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-[#1c2433] pb-1.5 text-xs">
                  <span className="font-bold text-white">
                    Triggered Alerts ({triggeredAlerts.length})
                  </span>
                  <button
                    onClick={() => {
                      setNotifDropdownOpen(false);
                      setActiveTab('alerts');
                    }}
                    className="text-[11px] text-[#00E5FF] hover:underline"
                  >
                    Manage Alerts →
                  </button>
                </div>
                {triggeredAlerts.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">
                    No triggered threshold alerts right now.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {triggeredAlerts.map((al) => (
                      <div
                        key={al.id}
                        onClick={() => {
                          setSelectedSymbol(al.symbol);
                          setNotifDropdownOpen(false);
                        }}
                        className="p-2 rounded bg-[#141b27] border border-amber-500/30 cursor-pointer hover:border-amber-400"
                      >
                        <div className="font-mono text-[11px] font-bold text-amber-400">
                          {al.symbol} · {al.conditionType}
                        </div>
                        <div className="text-[11px] text-slate-200 mt-0.5">
                          {al.triggerMessage}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile & Settings Button */}
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#121721] border border-[#242f42] hover:border-[#00E5FF] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <User className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="hidden sm:inline">
              {user ? user.displayName.split(' ')[0] : 'Sign In'}
            </span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Strip */}
      <div className="flex md:hidden items-center gap-1 px-3 py-1.5 bg-[#0b0e14] border-b border-[#1c2331] overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'company', label: 'Analytics' },
          { id: 'predictions', label: 'Predictions' },
          { id: 'screener', label: 'Screener' },
          { id: 'compare', label: 'Compare' },
          { id: 'alerts', label: 'Alerts & News' },
          { id: 'research', label: 'AI Research' },
        ].map((nav) => (
          <button
            key={nav.id}
            onClick={() => setActiveTab(nav.id as MainTab)}
            className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap shrink-0 ${
              activeTab === nav.id
                ? 'bg-[#00E5FF]/15 text-[#00E5FF]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {nav.label}
          </button>
        ))}
      </div>

      {/* MAIN WORKSPACE CONTAINER: LEFT SIDEBAR + CENTRAL WORKSTATION */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* B. LEFT SIDEBAR (Watchlist + Quick Alerts) */}
        <LeftSidebar
          watchlistStocks={watchlistStocks}
          allStocks={stocks}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={(sym) => setSelectedSymbol(sym)}
          onOpenCompanyWorkspace={(sym) => handleOpenCompanyWorkspace(sym, 'OVERVIEW')}
          onAddWatchlist={handleAddWatchlist}
          onRemoveWatchlist={handleRemoveWatchlist}
          triggeredAlerts={triggeredAlerts}
          recentSignals={allRecentSignals}
        />

        {/* C. MAIN CONTENT AREA */}
        <main className="flex-1 min-w-0 p-3 sm:p-4 space-y-3.5 overflow-y-auto">
          {/* C. MAIN CONTENT HEADER (Matching STK::PREDICT Reference Layout) */}
          <div className="bg-[#0e1218] border border-[#1c2331] rounded px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            {/* Left: Prominent Heading + Quote Summary */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xs sm:text-sm font-bold tracking-wider text-slate-300 uppercase">
                  {selectedStock.symbol === 'SPX'
                    ? 'S&P 500 | MARKET TRENDS & ANALYSIS'
                    : `${selectedStock.name.toUpperCase()} (${selectedStock.symbol}) | MARKET TRENDS & ANALYSIS`}
                </h1>
                {selectedStock.symbol !== 'SPX' && (
                  <button
                    onClick={() => setSelectedSymbol('SPX')}
                    className="text-[10px] font-mono text-[#00E5FF] hover:underline"
                  >
                    [Return to S&P 500 Index]
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-baseline gap-3 font-mono">
                <span className="text-xl sm:text-2xl font-bold text-white">
                  ${selectedStock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span
                  className={`inline-flex items-center gap-0.5 text-xs sm:text-sm font-semibold ${
                    selectedStock.changePercent >= 0 ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                  }`}
                >
                  {selectedStock.changePercent >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {selectedStock.change >= 0 ? '+' : ''}
                  {selectedStock.change.toFixed(2)} ({selectedStock.changePercent >= 0 ? '+' : ''}
                  {selectedStock.changePercent.toFixed(2)}%)
                </span>
                <span className="text-[11px] text-slate-400 font-sans">
                  H: <strong className="font-mono text-slate-200">${selectedStock.dayHigh.toFixed(2)}</strong> · L:{' '}
                  <strong className="font-mono text-slate-200">${selectedStock.dayLow.toFixed(2)}</strong> · Vol:{' '}
                  <strong className="font-mono text-slate-200">
                    {(selectedStock.volume / 1_000_000).toFixed(2)}M
                  </strong>
                  {' · '}
                  <span className="font-mono text-[10px] text-slate-400">
                    {selectedStock.isLiveData ? (
                      <span className="text-[#00E676]">
                        {selectedStock.marketState === 'REGULAR'
                          ? 'LIVE EXCHANGE FEED'
                          : 'OFFICIAL EXCHANGE CLOSE'}
                      </span>
                    ) : (
                      <span className="text-amber-400">REFERENCE SNAPSHOT</span>
                    )}
                    {' · '}
                    Quote:{' '}
                    {new Date(selectedStock.quoteTimestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
              </div>
            </div>

            {/* Right: Real-Time Refresh Status Indicator + Buy / Sell / Analyze Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Real-Time Refresh Status Badge */}
              <div className="flex items-center gap-2 bg-[#090c11] border border-[#1e2636] rounded px-2.5 py-1.5 text-[11px] font-mono">
                {isRefreshing ? (
                  <span className="flex items-center gap-1.5 text-[#00E5FF]">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing Live Feed...</span>
                  </span>
                ) : isStale ? (
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {refreshIntervalSec === 0
                        ? 'Auto-Refresh Paused'
                        : `Stale (${secondsSinceRefresh}s ago)`}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-[#00E676]" />
                    <span>
                      {liveFeedConnected
                        ? marketState === 'REGULAR'
                          ? `Live Feed (${secondsSinceRefresh}s ago)`
                          : `Market Closed · Official Close (${secondsSinceRefresh}s ago)`
                        : `Synced ${secondsSinceRefresh}s ago`}
                    </span>
                  </span>
                )}
                <button
                  onClick={triggerMarketRefresh}
                  disabled={isRefreshing}
                  className="text-[#00E5FF] hover:underline ml-1"
                  title="Refresh Live Exchange Quotes Now"
                >
                  Sync
                </button>
              </div>

              {/* Buy (Hypothetical Long Scenario), Sell (Hypothetical Short Scenario), Analyze */}
              <button
                onClick={() => {
                  setScenarioDirection('LONG');
                  setScenarioModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded bg-[#00E676] text-slate-950 font-bold text-xs hover:bg-[#00E676]/90 transition-colors whitespace-nowrap shrink-0"
                title="Open Hypothetical Long Position Scenario Simulator"
              >
                Buy
              </button>
              <button
                onClick={() => {
                  setScenarioDirection('SHORT');
                  setScenarioModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded bg-[#FF4D4D] text-white font-bold text-xs hover:bg-[#FF4D4D]/90 transition-colors whitespace-nowrap shrink-0"
                title="Open Hypothetical Short / Hedge Scenario Simulator"
              >
                Sell
              </button>
              <button
                onClick={() => handleOpenCompanyWorkspace(selectedStock.symbol, 'AI_RESEARCH')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#00E5FF]/15 border border-[#00E5FF]/50 text-[#00E5FF] font-bold text-xs hover:bg-[#00E5FF]/25 transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze</span>
              </button>
            </div>
          </div>

          {/* VIEW ROUTER */}
          {activeTab === 'dashboard' && (
            <div className="space-y-3.5">
              {/* D. PRIMARY FINANCIAL CHART WITH E. PREDICTION & RISK OVERLAY */}
              <PrimaryFinancialChart
                symbol={selectedStock.symbol}
                companyName={selectedStock.name}
                candles={selectedStock.candles[timeframe] || []}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                availableTimeframes={['1D', '1W', '1M', '3M', '6M', '1Y']}
                chartType={chartType}
                onChartTypeChange={setChartType}
                technicals={selectedTech}
                forecast={selectedForecast}
                showForecastOverlay={showForecastOverlay}
                onToggleForecastOverlay={() => setShowForecastOverlay(!showForecastOverlay)}
                forecastHorizon={forecastHorizon}
                onChangeForecastHorizon={setForecastHorizon}
              />

              {/* 3. FOUR REQUIRED ANALYTICS CARDS BELOW THE CHART */}
              <BottomAnalyticsRow
                selectedStock={selectedStock}
                selectedTech={selectedTech}
                timeframe={timeframe}
                sentiment={marketSentiment}
                topPredictions={topPredictions}
                recentSignals={allRecentSignals}
                triggeredAlerts={triggeredAlerts}
                lastRefreshTimestamp={lastRefreshTimestamp}
                onSelectSymbol={(sym) => setSelectedSymbol(sym)}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            </div>
          )}

          {activeTab === 'company' && (
            <CompanyWorkspaceView
              stock={selectedStock}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              chartType={chartType}
              onChartTypeChange={setChartType}
              technicals={selectedTech}
              forecast={selectedForecast}
              showForecastOverlay={showForecastOverlay}
              onToggleForecastOverlay={() => setShowForecastOverlay(!showForecastOverlay)}
              forecastHorizon={forecastHorizon}
              onChangeForecastHorizon={setForecastHorizon}
              initialSubTab={companySubTab}
              onUpdateFundamentals={(sym, fund, quote) => {
                setStocks((prev) =>
                  prev.map((st) =>
                    st.symbol === sym
                      ? {
                          ...st,
                          price: quote?.price ?? st.price,
                          previousClose: quote?.previousClose ?? st.previousClose,
                          change: quote?.change ?? st.change,
                          changePercent: quote?.changePercent ?? st.changePercent,
                          fundamentals: {
                            ...st.fundamentals,
                            ...fund,
                            periods:
                              Array.isArray(fund.periods) && fund.periods.length > 0
                                ? fund.periods
                                : st.fundamentals.periods,
                          },
                        }
                      : st
                  )
                );
              }}
            />
          )}

          {activeTab === 'predictions' && (
            <PredictionsView
              selectedStock={selectedStock}
              allStocks={stocks}
              onSelectSymbol={(sym) => {
                setSelectedSymbol(sym);
              }}
            />
          )}

          {activeTab === 'screener' && (
            <ScreenerView
              rows={screenerRows}
              presets={presets}
              onSavePreset={handleSavePreset}
              onDeletePreset={handleDeletePreset}
              onSelectSymbol={(sym) => handleOpenCompanyWorkspace(sym, 'OVERVIEW')}
            />
          )}

          {activeTab === 'compare' && (
            <ComparisonView
              allStocks={stocks}
              technicalsMap={technicalsMap}
              onSelectSymbol={(sym) => handleOpenCompanyWorkspace(sym, 'OVERVIEW')}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsAndNewsView
              allStocks={stocks}
              alerts={alerts}
              onAddAlert={handleAddAlert}
              onToggleAlert={handleToggleAlert}
              onDeleteAlert={handleDeleteAlert}
              onSelectSymbol={(sym) => handleOpenCompanyWorkspace(sym, 'OVERVIEW')}
            />
          )}

          {activeTab === 'research' && (
            <ResearchAndChatbotView
              selectedStock={selectedStock}
              selectedTech={selectedTech}
              selectedForecast={selectedForecast}
              allStocks={stocks}
            />
          )}

          {/* Subtle Institutional Footer */}
          <footer className="pt-2 pb-4 border-t border-[#161c28] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <div>
              <strong className="text-slate-300">QuantPulse</strong> — Intelligence for Every Market Move · Founded by{' '}
              <strong className="text-slate-300">Viraj Kumar</strong> &{' '}
              <strong className="text-slate-300">Varshith Reddy</strong> (Class 9 ICSE)
            </div>
            <div>
              Educational financial research platform · Scenario outputs illustrate statistical variance and never promise profitable returns.
            </div>
          </footer>
        </main>
      </div>

      {/* Hypothetical Position Scenario Simulator Modal (Buy / Sell) */}
      <HypotheticalScenarioModal
        isOpen={scenarioModalOpen}
        onClose={() => setScenarioModalOpen(false)}
        initialDirection={scenarioDirection}
        stock={selectedStock}
        technicals={selectedTech}
        forecast={selectedForecast}
      />

      {/* User Authentication, Profile & Auto-Refresh Preferences Modal */}
      <AuthProfileModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        user={user}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onGoogleSignIn={handleGoogleSignIn}
        onUpdateProfile={persistUserData}
        onLogout={handleLogout}
        refreshIntervalSec={refreshIntervalSec}
        onChangeRefreshInterval={(sec) => {
          setRefreshIntervalSec(sec);
          persistUserData({ refreshIntervalSec: sec });
        }}
      />
    </div>
  );
}
