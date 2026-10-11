import React, { useState, useMemo } from 'react';
import { StockData, TechnicalSummary, Timeframe } from '../types/market';
import { GitCompare, Plus, X, Info } from 'lucide-react';

interface ComparisonViewProps {
  allStocks: StockData[];
  technicalsMap: Record<string, TechnicalSummary>;
  onSelectSymbol: (symbol: string) => void;
}

const COMPARE_COLORS = ['#00E5FF', '#00E676', '#FBBF24', '#C084FC'];

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  allStocks,
  technicalsMap,
  onSelectSymbol,
}) => {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['AAPL', 'MSFT', 'NVDA']);
  const [period, setPeriod] = useState<Timeframe>('3M');
  const [addTickerInput, setAddTickerInput] = useState('');

  const comparedStocks = useMemo(
    () =>
      selectedSymbols
        .map((sym) => allStocks.find((s) => s.symbol === sym))
        .filter((s): s is StockData => Boolean(s)),
    [selectedSymbols, allStocks]
  );

  // Normalized Percentage Return Series (Base = 0% at start of shared period)
  const normalizedChart = useMemo(() => {
    const seriesBySym: Record<string, Array<{ dateLabel: string; pctReturn: number }>> = {};
    let minPct = -5;
    let maxPct = 5;
    let maxLen = 0;

    for (const st of comparedStocks) {
      const candles = st.candles[period] || [];
      if (candles.length < 2) continue;
      const baseClose = candles[0].close || 1;
      const pts = candles.map((c) => {
        const pct = Number((((c.close - baseClose) / baseClose) * 100).toFixed(2));
        if (pct < minPct) minPct = pct;
        if (pct > maxPct) maxPct = pct;
        return { dateLabel: c.dateLabel, pctReturn: pct };
      });
      seriesBySym[st.symbol] = pts;
      if (pts.length > maxLen) maxLen = pts.length;
    }

    return { seriesBySym, minPct: minPct - 2, maxPct: maxPct + 2, maxLen };
  }, [comparedStocks, period]);

  const W = 900;
  const H = 260;
  const padL = 16;
  const padR = 64;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const getY = (pct: number) => {
    const range = normalizedChart.maxPct - normalizedChart.minPct || 1;
    return padT + plotH - ((pct - normalizedChart.minPct) / range) * plotH;
  };

  const fmtVal = (v: number | null | undefined, suffix = '', prefix = '') => {
    if (v === null || v === undefined || Number.isNaN(v)) return 'Unavailable';
    return `${prefix}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
  };

  return (
    <div className="space-y-4">
      {/* Header & Stock Selector Strip */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181f2c] pb-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-[#00E5FF]" />
            <div>
              <h2 className="text-sm font-bold text-white">
                Side-by-Side Equity Comparison Engine
              </h2>
              <p className="text-xs text-slate-400">
                Normalized percentage return across a common period ({period}) · Compatible USD reporting units · Missing metrics are never treated as zero.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#090c10] p-0.5 rounded border border-[#1e2636]">
            {(['1M', '3M', '6M', '1Y'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setPeriod(tf)}
                className={`px-2.5 py-1 text-xs font-mono rounded ${
                  period === tf
                    ? 'bg-[#00E5FF]/15 text-[#00E5FF] font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Stocks & Add Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          {comparedStocks.map((st, idx) => (
            <div
              key={st.symbol}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#121721] border border-[#242f42] text-xs"
            >
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length] }}
              />
              <button
                onClick={() => onSelectSymbol(st.symbol)}
                className="font-mono font-bold text-white hover:text-[#00E5FF]"
              >
                {st.symbol}
              </button>
              <span className="text-slate-400 text-[11px]">{st.name}</span>
              {comparedStocks.length > 2 && (
                <button
                  onClick={() =>
                    setSelectedSymbols((prev) => prev.filter((s) => s !== st.symbol))
                  }
                  className="text-slate-500 hover:text-[#FF4D4D]"
                  title="Remove from comparison"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {comparedStocks.length < 4 && (
            <div className="flex items-center gap-1.5">
              <select
                value={addTickerInput}
                onChange={(e) => {
                  const sym = e.target.value;
                  if (sym && !selectedSymbols.includes(sym)) {
                    setSelectedSymbols([...selectedSymbols, sym]);
                  }
                  setAddTickerInput('');
                }}
                className="bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="">+ Add Stock to Compare (Max 4)...</option>
                {allStocks
                  .filter((s) => !s.isIndex && !selectedSymbols.includes(s.symbol))
                  .map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} — {s.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Normalized Multi-Line Return Chart */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-white">
            Normalized Cumulative Return Comparison ({period} · Base = 0.00%)
          </h3>
          <div className="flex items-center gap-4 text-xs font-mono">
            {comparedStocks.map((st, idx) => {
              const pts = normalizedChart.seriesBySym[st.symbol] || [];
              const endRet = pts.length > 0 ? pts[pts.length - 1].pctReturn : 0;
              return (
                <span key={st.symbol} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 inline-block rounded-xs"
                    style={{ backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length] }}
                  />
                  <strong className="text-white">{st.symbol}:</strong>
                  <span className={endRet >= 0 ? 'text-[#00E676]' : 'text-[#FF4D4D]'}>
                    {endRet >= 0 ? '+' : ''}
                    {endRet.toFixed(2)}%
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[250px] bg-[#090c11] rounded border border-[#181f2c]">
          {/* Zero baseline */}
          <line
            x1={padL}
            y1={getY(0)}
            x2={W - padR}
            y2={getY(0)}
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
          <text
            x={W - padR + 6}
            y={getY(0) + 3}
            fill="#94a3b8"
            fontSize="10"
            fontFamily="JetBrains Mono, monospace"
          >
            0.0%
          </text>

          {/* Top & Bottom Return Ticks */}
          {[normalizedChart.maxPct - 2, normalizedChart.minPct + 2].map((val, i) => (
            <g key={i}>
              <line
                x1={padL}
                y1={getY(val)}
                x2={W - padR}
                y2={getY(val)}
                stroke="#161d2a"
                strokeWidth="1"
              />
              <text
                x={W - padR + 6}
                y={getY(val) + 3}
                fill="#64748b"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {val >= 0 ? '+' : ''}
                {val.toFixed(1)}%
              </text>
            </g>
          ))}

          {/* Stock Normalized Lines */}
          {comparedStocks.map((st, idx) => {
            const pts = normalizedChart.seriesBySym[st.symbol] || [];
            if (pts.length < 2) return null;
            const d = pts
              .map((p, i) => {
                const x = padL + (i / (pts.length - 1)) * plotW;
                const y = getY(p.pctReturn);
                return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <path
                key={st.symbol}
                d={d}
                fill="none"
                stroke={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                strokeWidth="2"
              />
            );
          })}
        </svg>
      </div>

      {/* Side-by-Side Comparison Matrix */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1c2433] bg-[#11161f]">
                <th className="py-3 px-4 font-sans text-slate-400">
                  Metric (Units & Period Verified)
                </th>
                {comparedStocks.map((st, idx) => (
                  <th key={st.symbol} className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-xs"
                        style={{ backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length] }}
                      />
                      <span className="text-white font-bold">{st.symbol}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-sans font-normal">
                      {st.name} ({st.fundamentals.currency})
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181f2c]">
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">Latest Price (USD)</td>
                {comparedStocks.map((st) => (
                  <td key={st.symbol} className="py-2.5 px-4 font-bold text-white">
                    ${st.price.toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">Daily Change (%)</td>
                {comparedStocks.map((st) => (
                  <td
                    key={st.symbol}
                    className={`py-2.5 px-4 font-semibold ${
                      st.changePercent >= 0 ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                    }`}
                  >
                    {st.changePercent >= 0 ? '+' : ''}
                    {st.changePercent.toFixed(2)}%
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">
                  {period} Normalized Return (%)
                </td>
                {comparedStocks.map((st) => {
                  const pts = normalizedChart.seriesBySym[st.symbol] || [];
                  const ret = pts.length > 0 ? pts[pts.length - 1].pctReturn : null;
                  return (
                    <td
                      key={st.symbol}
                      className={`py-2.5 px-4 font-semibold ${
                        (ret ?? 0) >= 0 ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                      }`}
                    >
                      {ret !== null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` : 'Unavailable'}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">Market Capitalization ($B)</td>
                {comparedStocks.map((st) => (
                  <td key={st.symbol} className="py-2.5 px-4 text-slate-200">
                    {fmtVal(st.fundamentals.marketCapB, 'B', '$')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">Revenue TTM ($B)</td>
                {comparedStocks.map((st) => (
                  <td key={st.symbol} className="py-2.5 px-4 text-slate-200">
                    {fmtVal(st.fundamentals.revenueTTM_B, 'B', '$')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">Revenue Growth YoY (%)</td>
                {comparedStocks.map((st) => (
                  <td key={st.symbol} className="py-2.5 px-4 text-slate-200">
                    {fmtVal(st.fundamentals.revenueGrowthYoY_Pct, '%')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">Net Income TTM ($B)</td>
                {comparedStocks.map((st) => (
                  <td key={st.symbol} className="py-2.5 px-4 text-slate-200">
                    {fmtVal(st.fundamentals.netIncomeTTM_B, 'B', '$')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">Net Profit Margin (%)</td>
                {comparedStocks.map((st) => (
                  <td key={st.symbol} className="py-2.5 px-4 text-slate-200">
                    {fmtVal(st.fundamentals.profitMarginPct, '%')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">Trailing P/E Ratio</td>
                {comparedStocks.map((st) => (
                  <td key={st.symbol} className="py-2.5 px-4 text-slate-200">
                    {fmtVal(st.fundamentals.peRatio, 'x')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">Return on Equity (ROE %)</td>
                {comparedStocks.map((st) => (
                  <td key={st.symbol} className="py-2.5 px-4 text-slate-200">
                    {fmtVal(st.fundamentals.roePct, '%')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">RSI (14-Period)</td>
                {comparedStocks.map((st) => (
                  <td key={st.symbol} className="py-2.5 px-4 text-slate-200">
                    {fmtVal(technicalsMap[st.symbol]?.latestRsi14)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">
                  Realized Annual Volatility (%)
                </td>
                {comparedStocks.map((st) => (
                  <td key={st.symbol} className="py-2.5 px-4 text-amber-400">
                    {fmtVal(technicalsMap[st.symbol]?.annualizedVolatilityPct, '%')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-400">Source & Reporting Date</td>
                {comparedStocks.map((st) => (
                  <td key={st.symbol} className="py-2.5 px-4 text-[11px] text-slate-400 font-sans">
                    {st.fundamentals.source} ({st.fundamentals.lastUpdated})
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Objective Comparative Synthesis (No arbitrary winner badges) */}
        <div className="p-4 bg-[#11161f] border-t border-[#1c2331] text-xs text-slate-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#00E5FF] shrink-0 mt-0.5" />
          <div>
            <strong>Analytical Trade-Off Summary:</strong> QuantPulse does not assign arbitrary single-winner labels because investment suitability depends on your mandate. Among the selected equities,{' '}
            {
              [...comparedStocks].sort(
                (a, b) =>
                  (b.fundamentals.revenueGrowthYoY_Pct ?? -99) -
                  (a.fundamentals.revenueGrowthYoY_Pct ?? -99)
              )[0]?.symbol
            }{' '}
            exhibits the highest trailing YoY revenue growth, whereas{' '}
            {
              [...comparedStocks]
                .filter((s) => s.fundamentals.peRatio !== null)
                .sort((a, b) => (a.fundamentals.peRatio ?? 999) - (b.fundamentals.peRatio ?? 999))[0]
                ?.symbol || comparedStocks[0]?.symbol
            }{' '}
            trades at the lowest trailing P/E multiple, and{' '}
            {
              [...comparedStocks].sort(
                (a, b) =>
                  (technicalsMap[a.symbol]?.annualizedVolatilityPct ?? 99) -
                  (technicalsMap[b.symbol]?.annualizedVolatilityPct ?? 99)
              )[0]?.symbol
            }{' '}
            demonstrates the lowest realized historical volatility.
          </div>
        </div>
      </div>
    </div>
  );
};
