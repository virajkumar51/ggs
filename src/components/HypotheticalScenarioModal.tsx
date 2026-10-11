import React, { useState } from 'react';
import { ForecastScenarioResult, StockData, TechnicalSummary } from '../types/market';
import { X, ShieldAlert, TrendingUp, TrendingDown, Calculator } from 'lucide-react';

interface HypotheticalScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDirection: 'LONG' | 'SHORT';
  stock: StockData;
  technicals: TechnicalSummary;
  forecast: ForecastScenarioResult;
}

export const HypotheticalScenarioModal: React.FC<HypotheticalScenarioModalProps> = ({
  isOpen,
  onClose,
  initialDirection,
  stock,
  technicals,
  forecast,
}) => {
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>(initialDirection);
  const [shares, setShares] = useState<number>(50);
  const [stopLossPct, setStopLossPct] = useState<number>(6);
  const [targetGainPct, setTargetGainPct] = useState<number>(12);
  const [horizonDays, setHorizonDays] = useState<number>(30);

  if (!isOpen) return null;

  const entryPrice = stock.price;
  const positionNotional = entryPrice * shares;

  const stopPrice =
    direction === 'LONG'
      ? entryPrice * (1 - stopLossPct / 100)
      : entryPrice * (1 + stopLossPct / 100);

  const targetPrice =
    direction === 'LONG'
      ? entryPrice * (1 + targetGainPct / 100)
      : entryPrice * (1 - targetGainPct / 100);

  const maxLossUsd = positionNotional * (stopLossPct / 100);
  const targetProfitUsd = positionNotional * (targetGainPct / 100);
  const riskRewardRatio = stopLossPct > 0 ? (targetGainPct / stopLossPct).toFixed(2) : 'N/A';

  // Volatility-based 95% Value at Risk (1.645 sigma) over selected horizon
  const annualVol = (technicals.annualizedVolatilityPct ?? 25) / 100;
  const horizonVol = annualVol * Math.sqrt(horizonDays / 252);
  const var95Usd = positionNotional * 1.645 * horizonVol;
  const var95Pct = 1.645 * horizonVol * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-[#0e131b] border border-[#242f42] rounded-md w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1c2433] bg-[#131924]">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-[#00E5FF]" />
            <div>
              <h2 className="text-sm font-bold text-white">
                Hypothetical Position Scenario Simulator · {stock.symbol}
              </h2>
              <p className="text-[11px] text-slate-400">
                Educational Risk & Payoff Analysis — No Real Brokerage Execution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Mandatory Non-Brokerage Disclosure Banner */}
          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Research & Educational Simulation Only:</strong> QuantPulse is not a broker-dealer and does not execute trades. This panel models the mathematical payoff, volatility-based Value-at-Risk (VaR), and technical/fundamental evidence for a hypothetical{' '}
              <span className="font-mono font-semibold">{direction}</span> thesis on{' '}
              <span className="font-mono font-semibold">{stock.name} ({stock.symbol})</span>.
            </div>
          </div>

          {/* Direction Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDirection('LONG')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded border font-semibold text-xs transition-colors ${
                direction === 'LONG'
                  ? 'bg-[#00E676]/15 border-[#00E676] text-[#00E676]'
                  : 'bg-[#11161f] border-[#1e2636] text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Hypothetical Long (Bullish Thesis)
            </button>
            <button
              onClick={() => setDirection('SHORT')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded border font-semibold text-xs transition-colors ${
                direction === 'SHORT'
                  ? 'bg-[#FF4D4D]/15 border-[#FF4D4D] text-[#FF4D4D]'
                  : 'bg-[#11161f] border-[#1e2636] text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              Hypothetical Short / Hedge (Bearish Thesis)
            </button>
          </div>

          {/* Scenario Input Parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#11161f] p-3.5 rounded border border-[#1c2433]">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Hypothetical Shares
              </label>
              <input
                type="number"
                min={1}
                max={100000}
                value={shares}
                onChange={(e) => setShares(Math.max(1, Number(e.target.value) || 1))}
                className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Stop-Loss Distance (%)
              </label>
              <input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={stopLossPct}
                onChange={(e) => setStopLossPct(Math.max(0.5, Number(e.target.value) || 1))}
                className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs font-mono text-[#FF4D4D]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Target Objective (%)
              </label>
              <input
                type="number"
                min={0.5}
                max={200}
                step={0.5}
                value={targetGainPct}
                onChange={(e) => setTargetGainPct(Math.max(0.5, Number(e.target.value) || 1))}
                className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs font-mono text-[#00E676]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Holding Horizon (Days)
              </label>
              <select
                value={horizonDays}
                onChange={(e) => setHorizonDays(Number(e.target.value))}
                className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs font-mono text-white"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>
          </div>

          {/* Calculated Payoff & Volatility Risk Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="bg-[#11161f] p-3 rounded border border-[#1c2433]">
              <div className="text-[10px] text-slate-400 font-sans">Reference Entry</div>
              <div className="text-sm font-bold text-white mt-0.5">
                ${entryPrice.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Notional: ${positionNotional.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="bg-[#11161f] p-3 rounded border border-[#1c2433]">
              <div className="text-[10px] text-slate-400 font-sans">Stop-Loss Trigger</div>
              <div className="text-sm font-bold text-[#FF4D4D] mt-0.5">
                ${stopPrice.toFixed(2)}
              </div>
              <div className="text-[10px] text-[#FF4D4D] mt-0.5">
                Max Risk: -${maxLossUsd.toFixed(0)}
              </div>
            </div>

            <div className="bg-[#11161f] p-3 rounded border border-[#1c2433]">
              <div className="text-[10px] text-slate-400 font-sans">Target Exit Level</div>
              <div className="text-sm font-bold text-[#00E676] mt-0.5">
                ${targetPrice.toFixed(2)}
              </div>
              <div className="text-[10px] text-[#00E676] mt-0.5">
                Est. Gain: +${targetProfitUsd.toFixed(0)}
              </div>
            </div>

            <div className="bg-[#11161f] p-3 rounded border border-[#1c2433]">
              <div className="text-[10px] text-slate-400 font-sans">Risk / Reward & VaR</div>
              <div className="text-sm font-bold text-[#00E5FF] mt-0.5">
                1 : {riskRewardRatio}
              </div>
              <div className="text-[10px] text-amber-400 mt-0.5">
                95% {horizonDays}D VaR: ${var95Usd.toFixed(0)} ({var95Pct.toFixed(1)}%)
              </div>
            </div>
          </div>

          {/* Supporting Analytical Evidence vs Downside Risks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#11161f] p-3.5 rounded border border-[#1c2433] space-y-1.5">
              <div className="font-semibold text-slate-200 border-b border-[#1c2433] pb-1.5">
                Observed Technical & Fundamental Context
              </div>
              <p className="text-slate-300">
                • <strong>RSI (14):</strong>{' '}
                {technicals.latestRsi14 !== null ? `${technicals.latestRsi14.toFixed(1)} (${technicals.rsiStatus})` : 'N/A'}
              </p>
              <p className="text-slate-300">
                • <strong>Moving Averages:</strong> {technicals.movingAverages.relationshipLabel}
              </p>
              <p className="text-slate-300">
                • <strong>Valuation:</strong> P/E{' '}
                {stock.fundamentals.peRatio !== null ? `${stock.fundamentals.peRatio.toFixed(1)}x` : 'N/A'} · Rev Growth{' '}
                {stock.fundamentals.revenueGrowthYoY_Pct !== null
                  ? `${stock.fundamentals.revenueGrowthYoY_Pct.toFixed(1)}% YoY`
                  : 'N/A'}
              </p>
            </div>

            <div className="bg-[#11161f] p-3.5 rounded border border-[#1c2433] space-y-1.5">
              <div className="font-semibold text-slate-200 border-b border-[#1c2433] pb-1.5">
                Scenario Risks & Uncertainty Factors
              </div>
              <p className="text-slate-300">
                • <strong>Realized Volatility:</strong> Annualized volatility is{' '}
                <span className="font-mono text-amber-400">
                  {technicals.annualizedVolatilityPct ?? 25}%
                </span>
                ; a {stopLossPct}% stop-loss can be triggered by normal noise if set narrower than the {horizonDays}-day 1σ band ({(horizonVol * 100).toFixed(1)}%).
              </p>
              <p className="text-slate-300">
                • <strong>Gap Risk:</strong> Overnight earnings or macro releases can bypass hypothetical stop levels.
              </p>
              {direction === 'SHORT' && (
                <p className="text-[#FF4D4D]">
                  • <strong>Asymmetric Short Risk:</strong> Short positions carry theoretically uncapped upside loss exposure if the stock rallies sharply.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[#131924] border-t border-[#1c2433]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-[#00E5FF] text-slate-950 rounded hover:bg-[#00E5FF]/90 transition-colors"
          >
            Close Scenario Simulator
          </button>
        </div>
      </div>
    </div>
  );
};
