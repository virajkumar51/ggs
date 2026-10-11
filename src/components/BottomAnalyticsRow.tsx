import React from 'react';
import {
  AlertConfigItem,
  CrossoverSignalEvent,
  ForecastScenarioResult,
  StockData,
  TechnicalSummary,
  Timeframe,
} from '../types/market';
import { Sparkline } from './Sparkline';
import { Activity, BarChart3, Compass, Gauge, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface BottomAnalyticsRowProps {
  selectedStock: StockData;
  selectedTech: TechnicalSummary;
  timeframe: Timeframe;
  sentiment: {
    bullishPct: number;
    neutralPct: number;
    bearishPct: number;
    methodology: string;
    inputsBreakdown: {
      breadthBullishPct: number;
      technicalScore: string;
      newsBalance: string;
    };
    lastUpdated: string;
  };
  topPredictions: Array<{
    stock: StockData;
    forecast: ForecastScenarioResult;
  }>;
  recentSignals: CrossoverSignalEvent[];
  triggeredAlerts: AlertConfigItem[];
  lastRefreshTimestamp: string;
  onSelectSymbol: (symbol: string) => void;
  onNavigateTab: (tab: 'dashboard' | 'company' | 'predictions' | 'screener' | 'compare' | 'alerts' | 'research') => void;
}

export const BottomAnalyticsRow: React.FC<BottomAnalyticsRowProps> = ({
  selectedStock,
  selectedTech,
  timeframe,
  sentiment,
  topPredictions,
  recentSignals,
  triggeredAlerts,
  lastRefreshTimestamp,
  onSelectSymbol,
  onNavigateTab,
}) => {
  const rsiSeries = selectedTech.series
    .map((s) => s.rsi14)
    .filter((v): v is number => v !== null)
    .slice(-24);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {/* CARD 1: MARKET SENTIMENT */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded p-3.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-[#181f2c] pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-[#00E5FF]" />
              <h3 className="text-xs font-semibold tracking-wide text-slate-200">
                Market Sentiment
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {selectedStock.symbol} + Breadth
            </span>
          </div>

          {/* Horizontal Distribution Bars */}
          <div className="space-y-2.5">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Bullish</span>
                <span className="font-mono font-semibold text-[#00E676]">
                  {sentiment.bullishPct}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#161c28] rounded-xs overflow-hidden">
                <div
                  className="h-full bg-[#00E676]"
                  style={{ width: `${sentiment.bullishPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Neutral</span>
                <span className="font-mono font-semibold text-[#00E5FF]">
                  {sentiment.neutralPct}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#161c28] rounded-xs overflow-hidden">
                <div
                  className="h-full bg-[#00E5FF]"
                  style={{ width: `${sentiment.neutralPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Bearish</span>
                <span className="font-mono font-semibold text-[#FF4D4D]">
                  {sentiment.bearishPct}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#161c28] rounded-xs overflow-hidden">
                <div
                  className="h-full bg-[#FF4D4D]"
                  style={{ width: `${sentiment.bearishPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Inputs Breakdown */}
          <div className="mt-3 pt-2.5 border-t border-[#181f2c] space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span>Universe Breadth:</span>
              <span className="font-mono text-slate-200">
                {sentiment.inputsBreakdown.breadthBullishPct}% Advancing
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Momentum Input:</span>
              <span className="font-mono text-slate-200">
                {sentiment.inputsBreakdown.technicalScore}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>News Balance:</span>
              <span className="font-mono text-slate-200">
                {sentiment.inputsBreakdown.newsBalance}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-[#181f2c] text-[10px] text-slate-500 leading-relaxed">
          Total: {sentiment.bullishPct + sentiment.neutralPct + sentiment.bearishPct}%. Model output from breadth, momentum & news — not an objective probability of profit. Updated{' '}
          {new Date(sentiment.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
        </div>
      </div>

      {/* CARD 2: TECHNICAL INDICATORS */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded p-3.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-[#181f2c] pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-[#00E5FF]" />
              <h3 className="text-xs font-semibold tracking-wide text-slate-200">
                Technical Indicators
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#00E5FF]">
              TF: {timeframe} ({selectedTech.observationCount} bars)
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* RSI Row with Mini Sparkline */}
            <div className="flex items-center justify-between bg-[#121721] px-2.5 py-2 rounded border border-[#1c2433]">
              <div>
                <div className="text-[11px] text-slate-400">RSI (14-Period Wilder)</div>
                <div className="font-mono font-bold text-sm text-white">
                  {selectedTech.latestRsi14 !== null
                    ? selectedTech.latestRsi14.toFixed(1)
                    : 'Unavailable'}
                </div>
                <div className="text-[10px] text-slate-400">{selectedTech.rsiStatus}</div>
              </div>
              {rsiSeries.length > 2 && (
                <Sparkline
                  data={rsiSeries}
                  width={72}
                  height={26}
                  positive={(selectedTech.latestRsi14 ?? 50) >= 50}
                />
              )}
            </div>

            {/* MACD Row */}
            <div className="bg-[#121721] px-2.5 py-1.5 rounded border border-[#1c2433]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">MACD (12, 26, 9)</span>
                <span
                  className={`font-mono text-[11px] font-semibold ${
                    (selectedTech.latestMacd.histogram ?? 0) >= 0
                      ? 'text-[#00E676]'
                      : 'text-[#FF4D4D]'
                  }`}
                >
                  {selectedTech.latestMacd.macd !== null
                    ? `${selectedTech.latestMacd.macd.toFixed(2)} / Sig ${selectedTech.latestMacd.signal?.toFixed(2)}`
                    : 'Insufficient Data'}
                </span>
              </div>
              <div className="text-[10px] text-slate-300 mt-0.5">
                {selectedTech.latestMacd.status}
              </div>
              {selectedTech.latestMacd.crossoverObservation && (
                <div className="text-[10px] font-mono text-[#00E5FF] mt-0.5">
                  {selectedTech.latestMacd.crossoverObservation}
                </div>
              )}
            </div>

            {/* Moving Averages & Bollinger */}
            <div className="bg-[#121721] px-2.5 py-1.5 rounded border border-[#1c2433] space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">MA Alignment:</span>
                <span className="font-mono text-slate-200">
                  EMA50{' '}
                  {selectedTech.movingAverages.ema50
                    ? `$${selectedTech.movingAverages.ema50.toFixed(1)}`
                    : 'N/A'}
                </span>
              </div>
              <div className="text-[10px] text-slate-300">
                {selectedTech.movingAverages.relationshipLabel}
              </div>
              <div className="text-[10px] text-indigo-300 pt-0.5 border-t border-[#1c2433]">
                BB(20,2): {selectedTech.bollinger.positionLabel}
                {selectedTech.bollinger.percentB !== null
                  ? ` (%B: ${selectedTech.bollinger.percentB}%)`
                  : ''}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-[#181f2c] flex items-center justify-between text-[10px] text-slate-500">
          <span>
            Ann. Volatility:{' '}
            <strong className="font-mono text-slate-300">
              {selectedTech.annualizedVolatilityPct !== null
                ? `${selectedTech.annualizedVolatilityPct}%`
                : 'N/A'}
            </strong>
          </span>
          <button
            onClick={() => onNavigateTab('company')}
            className="text-[#00E5FF] hover:underline font-medium whitespace-nowrap shrink-0"
          >
            Full Technicals →
          </button>
        </div>
      </div>

      {/* CARD 3: TOP PREDICTIONS (SCENARIO SIGNALS) */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded p-3.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-[#181f2c] pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#00E676]" />
              <h3 className="text-xs font-semibold tracking-wide text-slate-200">
                Top Predictions
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">30D Scenario Rank</span>
          </div>

          <div className="space-y-1.5">
            {topPredictions.slice(0, 5).map(({ stock, forecast }) => {
              const sparkCloses = (stock.candles['1M'] || []).map((c) => c.close);
              const isObsUp = stock.changePercent >= 0;
              const isProjUp = forecast.projectedCentralReturnPct >= 0;

              return (
                <button
                  key={stock.symbol}
                  onClick={() => onSelectSymbol(stock.symbol)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded border text-left transition-colors ${
                    stock.symbol === selectedStock.symbol
                      ? 'bg-[#162030] border-[#00E5FF]/50'
                      : 'bg-[#121721] border-[#1c2433] hover:border-slate-600'
                  }`}
                >
                  <div className="min-w-[58px]">
                    <div className="font-mono font-bold text-xs text-white">{stock.symbol}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[72px]">
                      {forecast.riskClassification.replace(' Volatility', '')}
                    </div>
                  </div>

                  <Sparkline
                    data={sparkCloses}
                    width={50}
                    height={20}
                    positive={isObsUp}
                    showArea={false}
                  />

                  <div className="text-right font-mono">
                    <div className="text-[10px] text-slate-400">
                      Obs 1D:{' '}
                      <span className={isObsUp ? 'text-[#00E676]' : 'text-[#FF4D4D]'}>
                        {isObsUp ? '+' : ''}
                        {stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold">
                      <span className="text-slate-500 mr-1">30D Est:</span>
                      <span className={isProjUp ? 'text-[#00E5FF]' : 'text-amber-400'}>
                        {isProjUp ? '+' : ''}
                        {forecast.projectedCentralReturnPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-[#181f2c] flex items-center justify-between text-[10px] text-slate-500">
          <span>Ranked by Shrinkage Drift/Vol ratio</span>
          <button
            onClick={() => onNavigateTab('predictions')}
            className="text-[#00E5FF] hover:underline font-medium whitespace-nowrap shrink-0"
          >
            Methodology →
          </button>
        </div>
      </div>

      {/* CARD 4: RECENT MARKET ACTIVITY */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded p-3.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-[#181f2c] pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#00E5FF]" />
              <h3 className="text-xs font-semibold tracking-wide text-slate-200">
                Recent Market Activity
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Verified Events</span>
          </div>

          <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
            {/* Triggered User Alerts */}
            {triggeredAlerts.slice(0, 2).map((al) => (
              <div
                key={al.id}
                onClick={() => onSelectSymbol(al.symbol)}
                className="p-2 rounded bg-[#161c28] border border-amber-500/30 cursor-pointer hover:border-amber-400/60 transition-colors"
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-amber-400 font-semibold">
                    ALERT TRIGGERED · {al.symbol}
                  </span>
                  <span className="text-slate-500">
                    {new Date(al.lastTriggeredAt || al.updatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="text-[11px] text-slate-200 mt-0.5 leading-snug">
                  {al.triggerMessage || `${al.conditionType} threshold (${al.threshold}) crossed`}
                </div>
              </div>
            ))}

            {/* Calculated Technical Crossover Events */}
            {recentSignals.slice(0, 3).map((sig) => (
              <div
                key={sig.id}
                onClick={() => onSelectSymbol(sig.symbol)}
                className="p-2 rounded bg-[#121721] border border-[#1c2433] cursor-pointer hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span
                    className={`flex items-center gap-0.5 font-semibold ${
                      sig.direction === 'bullish' ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                    }`}
                  >
                    {sig.direction === 'bullish' ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {sig.symbol} · {sig.label}
                  </span>
                  <span className="text-slate-500">{sig.observationDate}</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                  {sig.description}
                </div>
              </div>
            ))}

            {/* Latest News Update */}
            {selectedStock.news[0] && (
              <div className="p-2 rounded bg-[#121721] border border-[#1c2433]">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#00E5FF]">
                  <span>NEWS · {selectedStock.symbol}</span>
                  <span className="text-slate-500">{selectedStock.news[0].source}</span>
                </div>
                <div className="text-[11px] text-slate-200 mt-0.5 line-clamp-2">
                  {selectedStock.news[0].headline}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-[#181f2c] flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>
            Feed sync:{' '}
            {new Date(lastRefreshTimestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
          <button
            onClick={() => onNavigateTab('alerts')}
            className="text-[#00E5FF] hover:underline font-sans font-medium whitespace-nowrap shrink-0"
          >
            All Alerts →
          </button>
        </div>
      </div>
    </div>
  );
};
