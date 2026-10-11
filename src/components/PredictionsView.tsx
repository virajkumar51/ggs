import React, { useState, useMemo } from 'react';
import { ForecastScenarioResult, StockData } from '../types/market';
import { calculateForecastScenarios } from '../utils/technicals';
import { Sparkline } from './Sparkline';
import { Compass, ShieldAlert, Sliders, CheckCircle2 } from 'lucide-react';

interface PredictionsViewProps {
  selectedStock: StockData;
  allStocks: StockData[];
  onSelectSymbol: (symbol: string) => void;
}

export const PredictionsView: React.FC<PredictionsViewProps> = ({
  selectedStock,
  allStocks,
  onSelectSymbol,
}) => {
  const [horizonDays, setHorizonDays] = useState<number>(30);
  const baseForecast = useMemo(
    () => calculateForecastScenarios(selectedStock, horizonDays),
    [selectedStock, horizonDays]
  );

  const [customDrift, setCustomDrift] = useState<number | undefined>(undefined);
  const [customVol, setCustomVol] = useState<number | undefined>(undefined);

  const activeForecast: ForecastScenarioResult = useMemo(
    () =>
      calculateForecastScenarios(
        selectedStock,
        horizonDays,
        customDrift,
        customVol
      ),
    [selectedStock, horizonDays, customDrift, customVol]
  );

  const universeForecasts = useMemo(() => {
    return allStocks
      .filter((s) => !s.isIndex)
      .map((stock) => ({
        stock,
        forecast: calculateForecastScenarios(stock, horizonDays),
      }))
      .sort((a, b) => b.forecast.compositeSignalScore - a.forecast.compositeSignalScore);
  }, [allStocks, horizonDays]);

  return (
    <div className="space-y-4">
      {/* Methodology & Out-of-Sample Evaluation Header */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181f2c] pb-3">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#00E676]" />
            <div>
              <h2 className="text-sm font-bold text-white">
                Quantitative Scenario Engine & Out-of-Sample Model Evaluation
              </h2>
              <p className="text-xs text-slate-400">
                Separates Historical Observations, Model-Generated Statistical Envelopes, and User-Defined Hypothetical Stress Scenarios.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#090c10] p-1 rounded border border-[#1e2636]">
            {[14, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setHorizonDays(d)}
                className={`px-2.5 py-1 text-xs font-mono rounded ${
                  horizonDays === d
                    ? 'bg-[#00E5FF]/15 text-[#00E5FF] font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {d}D Horizon
              </button>
            ))}
          </div>
        </div>

        {/* Selected Stock Scenario Deep Dive + Interactive Assumption Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left 2 Columns: Scenario Outcomes & Backtest Validation */}
          <div className="lg:col-span-2 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="bg-[#121721] p-3 rounded border border-[#1c2433]">
                <div className="text-[10px] text-slate-400 font-sans">
                  Observed Price ({selectedStock.symbol})
                </div>
                <div className="text-base font-bold text-white mt-0.5">
                  ${activeForecast.currentPrice.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Input: {activeForecast.historicalWindowUsed} daily bars
                </div>
              </div>

              <div className="bg-[#121721] p-3 rounded border border-[#00E676]/30">
                <div className="text-[10px] text-slate-400 font-sans">
                  Upside Scenario (+1.25σ)
                </div>
                <div className="text-base font-bold text-[#00E676] mt-0.5">
                  ${activeForecast.projectedUpsideEnd.toFixed(2)}
                </div>
                <div className="text-[10px] text-[#00E676] mt-0.5">
                  +{activeForecast.projectedUpsideReturnPct.toFixed(2)}% ({horizonDays}D)
                </div>
              </div>

              <div className="bg-[#121721] p-3 rounded border border-[#00E5FF]/30">
                <div className="text-[10px] text-slate-400 font-sans">
                  Central Drift Trajectory
                </div>
                <div className="text-base font-bold text-[#00E5FF] mt-0.5">
                  ${activeForecast.projectedCentralEnd.toFixed(2)}
                </div>
                <div className="text-[10px] text-[#00E5FF] mt-0.5">
                  {activeForecast.projectedCentralReturnPct >= 0 ? '+' : ''}
                  {activeForecast.projectedCentralReturnPct.toFixed(2)}% ({horizonDays}D)
                </div>
              </div>

              <div className="bg-[#121721] p-3 rounded border border-[#FF4D4D]/30">
                <div className="text-[10px] text-slate-400 font-sans">
                  Downside Scenario (-1.25σ)
                </div>
                <div className="text-base font-bold text-[#FF4D4D] mt-0.5">
                  ${activeForecast.projectedDownsideEnd.toFixed(2)}
                </div>
                <div className="text-[10px] text-[#FF4D4D] mt-0.5">
                  {activeForecast.projectedDownsideReturnPct.toFixed(2)}% ({horizonDays}D)
                </div>
              </div>
            </div>

            {/* Out-of-Sample Holdout Validation vs Naive Baseline */}
            <div className="bg-[#11161f] p-3.5 rounded border border-[#1c2433] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <CheckCircle2 className="w-4 h-4 text-[#00E5FF]" />
                  <span>
                    Out-of-Sample Holdout Validation (No Look-Ahead Bias · Final{' '}
                    {activeForecast.evaluation.holdoutWindowDays} Observations)
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  5-Day Rolling Forecast vs. Random-Walk Baseline
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 font-mono text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">Model Out-of-Sample RMSE</div>
                  <div className="text-slate-200 font-bold">
                    ${activeForecast.evaluation.modelRmse.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Naive Baseline: ${activeForecast.evaluation.baselineNaiveRmse.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">Model Out-of-Sample MAE</div>
                  <div className="text-slate-200 font-bold">
                    ${activeForecast.evaluation.modelMae.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Naive Baseline: ${activeForecast.evaluation.baselineNaiveMae.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">
                    Holdout Directional Hit Rate
                  </div>
                  <div className="text-[#00E5FF] font-bold">
                    {activeForecast.evaluation.outOfSampleDirectionalHitRatePct.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-500">Unseen test window</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">Trend R² & Risk Regime</div>
                  <div className="text-amber-400 font-bold">
                    R² {activeForecast.evaluation.rSquared.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {activeForecast.riskClassification}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Stress-Test Sliders & Assumptions */}
          <div className="bg-[#121721] p-3.5 rounded border border-[#1c2433] flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#1c2433] pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#00E5FF]" />
                  Scenario Stress-Test Overrides
                </span>
                {(customDrift !== undefined || customVol !== undefined) && (
                  <button
                    onClick={() => {
                      setCustomDrift(undefined);
                      setCustomVol(undefined);
                    }}
                    className="text-[11px] text-[#00E5FF] hover:underline"
                  >
                    Reset to Historical
                  </button>
                )}
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Annualized Drift Assumption:</span>
                  <span className="font-mono text-white">
                    {activeForecast.annualizedDriftUsedPct.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={50}
                  step={1}
                  value={customDrift ?? baseForecast.annualizedDriftUsedPct}
                  onChange={(e) => setCustomDrift(Number(e.target.value))}
                  className="w-full accent-[#00E5FF]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Annualized Volatility Assumption:</span>
                  <span className="font-mono text-amber-400">
                    {activeForecast.annualizedVolatilityUsedPct.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={85}
                  step={1}
                  value={customVol ?? baseForecast.annualizedVolatilityUsedPct}
                  onChange={(e) => setCustomVol(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#090c11] border border-[#1c2433] text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-200 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Model Limitations Disclosure:
              </div>
              <p>{activeForecast.limitations[0]}</p>
              <p>{activeForecast.limitations[1]}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Company Scenario Comparison Table */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded overflow-hidden">
        <div className="px-4 py-3 bg-[#11161f] border-b border-[#1c2331] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-white">
              Universe Scenario Matrix ({horizonDays}-Day Horizon)
            </h3>
            <p className="text-[11px] text-slate-400">
              Clearly separates Observed Historical Movement from Model-Generated Scenario Ranges. Click any row to load into the primary workstation.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1c2433] bg-[#0b0e14] text-slate-400 font-sans">
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3">Observed 1M Trend</th>
                <th className="py-2.5 px-3 text-right">Observed Price</th>
                <th className="py-2.5 px-3 text-right">Observed 1D %</th>
                <th className="py-2.5 px-3 text-right">Downside (-1.25σ)</th>
                <th className="py-2.5 px-3 text-right">Central Drift ({horizonDays}D)</th>
                <th className="py-2.5 px-3 text-right">Upside (+1.25σ)</th>
                <th className="py-2.5 px-3 text-right">Realized Vol</th>
                <th className="py-2.5 px-3 text-right">Holdout RMSE</th>
                <th className="py-2.5 px-3">Volatility Regime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181f2c]">
              {universeForecasts.map(({ stock, forecast }) => {
                const isUp = stock.changePercent >= 0;
                const spark = (stock.candles['1M'] || []).map((c) => c.close);
                return (
                  <tr
                    key={stock.symbol}
                    onClick={() => onSelectSymbol(stock.symbol)}
                    className={`hover:bg-[#141b27] cursor-pointer transition-colors ${
                      stock.symbol === selectedStock.symbol ? 'bg-[#141e2e]' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white">{stock.symbol}</div>
                      <div className="text-[11px] text-slate-400 font-sans truncate max-w-[140px]">
                        {stock.name}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <Sparkline
                        data={spark}
                        width={60}
                        height={20}
                        positive={isUp}
                        showArea={false}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right text-white font-semibold">
                      ${stock.price.toFixed(2)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right ${
                        isUp ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                      }`}
                    >
                      {isUp ? '+' : ''}
                      {stock.changePercent.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#FF4D4D]">
                      ${forecast.projectedDownsideEnd.toFixed(2)} (
                      {forecast.projectedDownsideReturnPct.toFixed(1)}%)
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#00E5FF] font-semibold">
                      ${forecast.projectedCentralEnd.toFixed(2)} (
                      {forecast.projectedCentralReturnPct >= 0 ? '+' : ''}
                      {forecast.projectedCentralReturnPct.toFixed(1)}%)
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#00E676]">
                      ${forecast.projectedUpsideEnd.toFixed(2)} (+
                      {forecast.projectedUpsideReturnPct.toFixed(1)}%)
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-400">
                      {forecast.annualizedVolatilityUsedPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      ${forecast.evaluation.modelRmse.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[11px] text-slate-300">
                      {forecast.riskClassification}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
