import React, { useState, useMemo, useRef } from 'react';
import {
  CandlePoint,
  ForecastScenarioResult,
  TechnicalSummary,
  Timeframe,
} from '../types/market';
import { BarChart2, TrendingUp, Layers, Eye, ZoomIn, ZoomOut, Info } from 'lucide-react';

interface PrimaryFinancialChartProps {
  symbol: string;
  companyName: string;
  candles: CandlePoint[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  availableTimeframes: Timeframe[];
  chartType: 'candlestick' | 'line';
  onChartTypeChange: (type: 'candlestick' | 'line') => void;
  technicals: TechnicalSummary;
  forecast: ForecastScenarioResult;
  showForecastOverlay: boolean;
  onToggleForecastOverlay: () => void;
  forecastHorizon: number;
  onChangeForecastHorizon: (days: number) => void;
}

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

const TIMEFRAME_RESOLUTION_NOTE: Record<Timeframe, string> = {
  '1D': '6-min Intraday Bars (Regular Session)',
  '1W': '3.5-hr Intraweek Bars (5 Trading Days)',
  '1M': 'Daily OHLCV Bars (24 Trading Days)',
  '3M': 'Daily OHLCV Bars (65 Trading Days)',
  '6M': 'Daily OHLCV Bars (130 Trading Days)',
  '1Y': 'Daily OHLCV Bars (240 Trading Days)',
};

export const PrimaryFinancialChart: React.FC<PrimaryFinancialChartProps> = ({
  symbol,
  companyName,
  candles,
  timeframe,
  onTimeframeChange,
  availableTimeframes,
  chartType,
  onChartTypeChange,
  technicals,
  forecast,
  showForecastOverlay,
  onToggleForecastOverlay,
  forecastHorizon,
  onChangeForecastHorizon,
}) => {
  const [showEma50, setShowEma50] = useState(true);
  const [showEma200, setShowEma200] = useState(true);
  const [showSma20, setShowSma20] = useState(false);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = 100%, 1.5 = recent 67%, 2 = recent 50%
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const visibleData = useMemo(() => {
    const series = technicals.series;
    if (!candles.length || !series.length) return { candles: [], series: [] };
    const total = candles.length;
    const count = Math.max(15, Math.floor(total / zoomLevel));
    const startIdx = Math.max(0, total - count);
    return {
      candles: candles.slice(startIdx),
      series: series.slice(startIdx),
    };
  }, [candles, technicals.series, zoomLevel]);

  const visCandles = visibleData.candles;
  const visSeries = visibleData.series;

  // Include forecast points if enabled
  const forecastPoints = showForecastOverlay ? forecast.points.slice(1) : [];
  const totalSlots = visCandles.length + forecastPoints.length;

  // Compute price and volume bounds
  const bounds = useMemo(() => {
    if (visCandles.length === 0) {
      return { minPrice: 0, maxPrice: 100, maxVol: 1000 };
    }
    let minP = Infinity;
    let maxP = -Infinity;
    let maxV = 0;

    for (let i = 0; i < visCandles.length; i++) {
      const c = visCandles[i];
      const s = visSeries[i];
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
      if (c.volume > maxV) maxV = c.volume;

      if (s) {
        if (showEma50 && s.ema50 !== null) {
          minP = Math.min(minP, s.ema50);
          maxP = Math.max(maxP, s.ema50);
        }
        if (showEma200 && s.ema200 !== null) {
          minP = Math.min(minP, s.ema200);
          maxP = Math.max(maxP, s.ema200);
        }
        if (showSma20 && s.sma20 !== null) {
          minP = Math.min(minP, s.sma20);
          maxP = Math.max(maxP, s.sma20);
        }
        if (showBollinger && s.bbUpper !== null && s.bbLower !== null) {
          minP = Math.min(minP, s.bbLower);
          maxP = Math.max(maxP, s.bbUpper);
        }
      }
    }

    if (showForecastOverlay && forecastPoints.length > 0) {
      for (const fp of forecastPoints) {
        minP = Math.min(minP, fp.downsidePrice);
        maxP = Math.max(maxP, fp.upsidePrice);
      }
    }

    const padding = (maxP - minP) * 0.08 || 1;
    return {
      minPrice: minP - padding,
      maxPrice: maxP + padding,
      maxVol: maxV || 1,
    };
  }, [
    visCandles,
    visSeries,
    showEma50,
    showEma200,
    showSma20,
    showBollinger,
    showForecastOverlay,
    forecastPoints,
  ]);

  const W = 940;
  const H = 370;
  const padLeft = 14;
  const padRight = 68; // Right price scale
  const padTop = 18;
  const padBottom = 28; // Bottom time axis
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const pricePlotH = showVolume ? chartH * 0.78 : chartH;

  const getX = (index: number) => {
    if (totalSlots <= 1) return padLeft + chartW / 2;
    return padLeft + (index / (totalSlots - 1)) * chartW;
  };

  const getYPrice = (price: number) => {
    const range = bounds.maxPrice - bounds.minPrice || 1;
    return padTop + pricePlotH - ((price - bounds.minPrice) / range) * pricePlotH;
  };

  const getYVol = (vol: number) => {
    const volZoneH = chartH * 0.19;
    const h = (vol / bounds.maxVol) * volZoneH;
    return padTop + chartH - h;
  };

  // Build polyline path helper
  const buildLinePath = (values: (number | null)[]) => {
    const pts: string[] = [];
    values.forEach((v, idx) => {
      if (v !== null && !Number.isNaN(v)) {
        pts.push(`${pts.length === 0 ? 'M' : 'L'}${getX(idx).toFixed(1)},${getYPrice(v).toFixed(1)}`);
      }
    });
    return pts.join(' ');
  };

  // Bollinger Band shaded polygon
  const bollingerAreaPoints = useMemo(() => {
    if (!showBollinger) return '';
    const upperPts: string[] = [];
    const lowerPts: string[] = [];
    visSeries.forEach((s, idx) => {
      if (s.bbUpper !== null && s.bbLower !== null) {
        const x = getX(idx).toFixed(1);
        upperPts.push(`${x},${getYPrice(s.bbUpper).toFixed(1)}`);
        lowerPts.unshift(`${x},${getYPrice(s.bbLower).toFixed(1)}`);
      }
    });
    if (upperPts.length < 2) return '';
    return [...upperPts, ...lowerPts].join(' ');
  }, [showBollinger, visSeries, totalSlots, bounds]);

  // Forecast Cone polygons & trajectories
  const forecastPaths = useMemo(() => {
    if (!showForecastOverlay || visCandles.length === 0 || forecast.points.length < 2) {
      return null;
    }
    const startSlot = visCandles.length - 1;
    const pts = forecast.points;

    const centralLine: string[] = [];
    const upsideLine: string[] = [];
    const downsideLine: string[] = [];
    const outerConeUpper: string[] = [];
    const outerConeLower: string[] = [];
    const innerConeUpper: string[] = [];
    const innerConeLower: string[] = [];

    pts.forEach((fp, i) => {
      const x = getX(startSlot + i).toFixed(1);
      const yCentral = getYPrice(fp.centralPrice).toFixed(1);
      const yUp = getYPrice(fp.upsidePrice).toFixed(1);
      const yDown = getYPrice(fp.downsidePrice).toFixed(1);
      const y1Up = getYPrice(fp.upperBand1Sigma).toFixed(1);
      const y1Down = getYPrice(fp.lowerBand1Sigma).toFixed(1);

      centralLine.push(`${i === 0 ? 'M' : 'L'}${x},${yCentral}`);
      upsideLine.push(`${i === 0 ? 'M' : 'L'}${x},${yUp}`);
      downsideLine.push(`${i === 0 ? 'M' : 'L'}${x},${yDown}`);

      outerConeUpper.push(`${x},${yUp}`);
      outerConeLower.unshift(`${x},${yDown}`);
      innerConeUpper.push(`${x},${y1Up}`);
      innerConeLower.unshift(`${x},${y1Down}`);
    });

    return {
      boundaryX: getX(startSlot),
      centralPath: centralLine.join(' '),
      upsidePath: upsideLine.join(' '),
      downsidePath: downsideLine.join(' '),
      outerPolygon: [...outerConeUpper, ...outerConeLower].join(' '),
      innerPolygon: [...innerConeUpper, ...innerConeLower].join(' '),
      endX: getX(startSlot + pts.length - 1),
      endUpsideY: getYPrice(pts[pts.length - 1].upsidePrice),
      endCentralY: getYPrice(pts[pts.length - 1].centralPrice),
      endDownsideY: getYPrice(pts[pts.length - 1].downsidePrice),
    };
  }, [showForecastOverlay, visCandles.length, forecast.points, totalSlots, bounds]);

  // Price grid ticks (6 levels)
  const priceTicks = useMemo(() => {
    const ticks: number[] = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      ticks.push(bounds.minPrice + ((bounds.maxPrice - bounds.minPrice) * i) / steps);
    }
    return ticks.reverse();
  }, [bounds]);

  // Time axis labels (6 evenly spaced)
  const timeTicks = useMemo(() => {
    if (visCandles.length === 0) return [];
    const result: Array<{ x: number; label: string; isForecast?: boolean }> = [];
    const step = Math.max(1, Math.floor(totalSlots / 6));
    for (let i = 0; i < totalSlots; i += step) {
      if (i < visCandles.length) {
        result.push({ x: getX(i), label: visCandles[i].dateLabel });
      } else {
        const fpIdx = i - visCandles.length;
        const fp = forecastPoints[fpIdx];
        if (fp) {
          result.push({ x: getX(i), label: `${fp.dateLabel} (Proj)`, isForecast: true });
        }
      }
    }
    return result;
  }, [visCandles, forecastPoints, totalSlots]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || totalSlots === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    if (relX < padLeft || relX > W - padRight) {
      setHoverIndex(null);
      return;
    }
    const idx = Math.round(((relX - padLeft) / chartW) * (totalSlots - 1));
    setHoverIndex(Math.max(0, Math.min(totalSlots - 1, idx)));
  };

  const activeIdx =
    hoverIndex !== null && hoverIndex < visCandles.length
      ? hoverIndex
      : visCandles.length - 1;
  const activeCandle = visCandles[activeIdx];
  const activeTech = visSeries[activeIdx];
  const activeForecastPoint =
    hoverIndex !== null && hoverIndex >= visCandles.length
      ? forecastPoints[hoverIndex - visCandles.length]
      : null;

  const candleWidth = Math.max(2.5, Math.min(11, (chartW / Math.max(20, totalSlots)) * 0.65));

  return (
    <div className="bg-[#0e1218] border border-[#1c2331] rounded flex flex-col">
      {/* Chart Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[#1c2331] bg-[#11161f]">
        {/* Left: Timeframe & Chart Type Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-[#090c10] border border-[#1e2636] rounded p-0.5">
            {TIMEFRAMES.map((tf) => {
              const isAvail = availableTimeframes.includes(tf);
              const isSelected = timeframe === tf;
              return (
                <button
                  key={tf}
                  disabled={!isAvail}
                  onClick={() => onTimeframeChange(tf)}
                  className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/40'
                      : isAvail
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          <div className="flex items-center bg-[#090c10] border border-[#1e2636] rounded p-0.5">
            <button
              onClick={() => onChartTypeChange('candlestick')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                chartType === 'candlestick'
                  ? 'bg-[#1e293b] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Candlestick OHLC View"
            >
              <BarChart2 className="w-3.5 h-3.5 text-[#00E676]" />
              <span>Candles</span>
            </button>
            <button
              onClick={() => onChartTypeChange('line')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                chartType === 'line'
                  ? 'bg-[#1e293b] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Close Price Line View"
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Line</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-[#090c10] border border-[#1e2636] rounded p-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.min(3, Number((z + 0.5).toFixed(1))))}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Zoom In (Focus Recent Observations)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] font-mono text-slate-400">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Zoom Out (Full Window)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Technical Indicator Overlays & Forecast Scenario Toggle */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-500 flex items-center gap-1 mr-1">
            <Layers className="w-3 h-3" /> Overlays:
          </span>
          <button
            onClick={() => setShowEma50(!showEma50)}
            className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
              showEma50
                ? 'bg-[#00E5FF]/10 border-[#00E5FF]/50 text-[#00E5FF]'
                : 'bg-[#090c10] border-[#1e2636] text-slate-500 hover:text-slate-300'
            }`}
          >
            EMA 50
          </button>
          <button
            onClick={() => setShowEma200(!showEma200)}
            className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
              showEma200
                ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                : 'bg-[#090c10] border-[#1e2636] text-slate-500 hover:text-slate-300'
            }`}
          >
            EMA 200
          </button>
          <button
            onClick={() => setShowSma20(!showSma20)}
            className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
              showSma20
                ? 'bg-purple-500/10 border-purple-500/50 text-purple-300'
                : 'bg-[#090c10] border-[#1e2636] text-slate-500 hover:text-slate-300'
            }`}
          >
            SMA 20
          </button>
          <button
            onClick={() => setShowBollinger(!showBollinger)}
            className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
              showBollinger
                ? 'bg-indigo-500/10 border-indigo-400/50 text-indigo-300'
                : 'bg-[#090c10] border-[#1e2636] text-slate-500 hover:text-slate-300'
            }`}
          >
            BB (20,2)
          </button>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
              showVolume
                ? 'bg-slate-700/40 border-slate-500/50 text-slate-200'
                : 'bg-[#090c10] border-[#1e2636] text-slate-500 hover:text-slate-300'
            }`}
          >
            Vol
          </button>

          {/* Forecast Cone Toggle + Horizon Selector */}
          <div className="flex items-center bg-[#090c10] border border-[#1e2636] rounded p-0.5 ml-1">
            <button
              onClick={onToggleForecastOverlay}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                showForecastOverlay
                  ? 'bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Scenario Cone</span>
            </button>
            {showForecastOverlay && (
              <div className="flex items-center pl-1 pr-0.5 gap-0.5">
                {[14, 30, 60].map((d) => (
                  <button
                    key={d}
                    onClick={() => onChangeForecastHorizon(d)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded whitespace-nowrap shrink-0 ${
                      forecastHorizon === d
                        ? 'bg-[#1e293b] text-[#00E5FF]'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {d}D
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live OHLCV & Active Indicator Readout Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#0b0e14] border-b border-[#181f2c] text-[11px] font-mono">
        {activeForecastPoint ? (
          <div className="flex items-center gap-3 flex-wrap text-slate-300">
            <span className="text-[#00E5FF] font-semibold">
              PROJECTED SCENARIO ({activeForecastPoint.dateLabel} · Step +{activeForecastPoint.stepIndex}D)
            </span>
            <span>
              Upside (+1.25σ):{' '}
              <strong className="text-[#00E676]">${activeForecastPoint.upsidePrice.toFixed(2)}</strong>
            </span>
            <span>
              Central Drift:{' '}
              <strong className="text-[#00E5FF]">${activeForecastPoint.centralPrice.toFixed(2)}</strong>
            </span>
            <span>
              Downside (-1.25σ):{' '}
              <strong className="text-[#FF4D4D]">${activeForecastPoint.downsidePrice.toFixed(2)}</strong>
            </span>
            <span className="text-slate-500">
              1σ Interval: ${activeForecastPoint.lowerBand1Sigma.toFixed(2)} – ${activeForecastPoint.upperBand1Sigma.toFixed(2)}
            </span>
          </div>
        ) : activeCandle ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-400 font-semibold">
              {symbol} · {activeCandle.dateLabel}
            </span>
            <span className="text-slate-400">
              O <strong className="text-slate-200">{activeCandle.open.toFixed(2)}</strong>
            </span>
            <span className="text-slate-400">
              H <strong className="text-slate-200">{activeCandle.high.toFixed(2)}</strong>
            </span>
            <span className="text-slate-400">
              L <strong className="text-slate-200">{activeCandle.low.toFixed(2)}</strong>
            </span>
            <span className="text-slate-400">
              C{' '}
              <strong
                className={
                  activeCandle.close >= activeCandle.open ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                }
              >
                {activeCandle.close.toFixed(2)}
              </strong>
            </span>
            <span className="text-slate-400">
              Vol{' '}
              <strong className="text-slate-300">
                {(activeCandle.volume / 1_000_000).toFixed(2)}M
              </strong>
            </span>
            {showEma50 && (
              <span className="text-[#00E5FF]">
                EMA50:{' '}
                {activeTech?.ema50 !== null && activeTech?.ema50 !== undefined
                  ? activeTech.ema50.toFixed(2)
                  : 'N/A (<50 bars)'}
              </span>
            )}
            {showEma200 && (
              <span className="text-amber-400">
                EMA200:{' '}
                {activeTech?.ema200 !== null && activeTech?.ema200 !== undefined
                  ? activeTech.ema200.toFixed(2)
                  : 'N/A (<200 bars)'}
              </span>
            )}
            {showSma20 && (
              <span className="text-purple-300">
                SMA20:{' '}
                {activeTech?.sma20 !== null && activeTech?.sma20 !== undefined
                  ? activeTech.sma20.toFixed(2)
                  : 'N/A'}
              </span>
            )}
            {showBollinger && activeTech?.bbUpper && activeTech?.bbLower && (
              <span className="text-indigo-300">
                BB: {activeTech.bbLower.toFixed(1)}–{activeTech.bbUpper.toFixed(1)}
              </span>
            )}
          </div>
        ) : null}

        <div className="text-[10px] text-slate-500 hidden xl:block">
          {TIMEFRAME_RESOLUTION_NOTE[timeframe]}
        </div>
      </div>

      {/* Main SVG Financial Chart */}
      <div className="relative w-full select-none bg-[#090c11]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[340px] sm:h-[380px] block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="upsideConeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00E676" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#00E676" stopOpacity="0.16" />
            </linearGradient>
            <linearGradient id="innerConeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          {/* Horizontal Price Grid Lines & Right Axis Labels */}
          {priceTicks.map((tick, i) => {
            const y = getYPrice(tick);
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={W - padRight}
                  y2={y}
                  stroke="#161d2a"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
                <text
                  x={W - padRight + 6}
                  y={y + 3.5}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  ${tick.toFixed(tick >= 1000 ? 0 : 2)}
                </text>
              </g>
            );
          })}

          {/* Vertical Time Grid Lines & Bottom Axis Labels */}
          {timeTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={t.x}
                y1={padTop}
                x2={t.x}
                y2={H - padBottom}
                stroke="#141b26"
                strokeWidth="1"
              />
              <text
                x={t.x}
                y={H - 9}
                textAnchor="middle"
                fill={t.isForecast ? '#00E5FF' : '#64748b'}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Divider line between Price zone and Volume zone */}
          {showVolume && (
            <line
              x1={padLeft}
              y1={padTop + pricePlotH + 4}
              x2={W - padRight}
              y2={padTop + pricePlotH + 4}
              stroke="#1c2331"
              strokeWidth="1"
            />
          )}

          {/* Bollinger Bands Shaded Channel */}
          {showBollinger && bollingerAreaPoints && (
            <>
              <polygon points={bollingerAreaPoints} fill="#6366f1" fillOpacity="0.07" />
              <path
                d={buildLinePath(visSeries.map((s) => s.bbUpper))}
                fill="none"
                stroke="#818cf8"
                strokeWidth="1"
                strokeDasharray="2,2"
                opacity="0.65"
              />
              <path
                d={buildLinePath(visSeries.map((s) => s.bbLower))}
                fill="none"
                stroke="#818cf8"
                strokeWidth="1"
                strokeDasharray="2,2"
                opacity="0.65"
              />
            </>
          )}

          {/* Volume Bars at bottom */}
          {showVolume &&
            visCandles.map((c, idx) => {
              const x = getX(idx);
              const yTop = getYVol(c.volume);
              const barH = Math.max(1, padTop + chartH - yTop);
              const isUp = c.close >= c.open;
              return (
                <rect
                  key={`vol-${idx}`}
                  x={x - candleWidth / 2}
                  y={yTop}
                  width={candleWidth}
                  height={barH}
                  fill={isUp ? '#00E676' : '#FF4D4D'}
                  fillOpacity="0.28"
                />
              );
            })}

          {/* Primary Price Series: Candlesticks or Line */}
          {chartType === 'line' ? (
            <>
              {visCandles.length > 1 && (
                <polygon
                  points={`${getX(0).toFixed(1)},${(padTop + pricePlotH).toFixed(1)} ${visCandles
                    .map((c, idx) => `${getX(idx).toFixed(1)},${getYPrice(c.close).toFixed(1)}`)
                    .join(' ')} ${getX(visCandles.length - 1).toFixed(1)},${(
                    padTop + pricePlotH
                  ).toFixed(1)}`}
                  fill="url(#lineAreaGrad)"
                />
              )}
              <path
                d={buildLinePath(visCandles.map((c) => c.close))}
                fill="none"
                stroke="#00E5FF"
                strokeWidth="2"
              />
            </>
          ) : (
            visCandles.map((c, idx) => {
              const x = getX(idx);
              const isUp = c.close >= c.open;
              const color = isUp ? '#00E676' : '#FF4D4D';
              const yHigh = getYPrice(c.high);
              const yLow = getYPrice(c.low);
              const yOpen = getYPrice(c.open);
              const yClose = getYPrice(c.close);
              const bodyTop = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));

              return (
                <g key={`candle-${idx}`}>
                  <line
                    x1={x}
                    y1={yHigh}
                    x2={x}
                    y2={yLow}
                    stroke={color}
                    strokeWidth="1.1"
                  />
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={color}
                  />
                </g>
              );
            })
          )}

          {/* Moving Average Overlays */}
          {showSma20 && (
            <path
              d={buildLinePath(visSeries.map((s) => s.sma20))}
              fill="none"
              stroke="#c084fc"
              strokeWidth="1.4"
            />
          )}
          {showEma50 && (
            <path
              d={buildLinePath(visSeries.map((s) => s.ema50))}
              fill="none"
              stroke="#00E5FF"
              strokeWidth="1.5"
            />
          )}
          {showEma200 && (
            <path
              d={buildLinePath(visSeries.map((s) => s.ema200))}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.5"
            />
          )}

          {/* Forecast & Risk Scenario Cone Overlay */}
          {forecastPaths && (
            <g>
              {/* Outer 1.25σ envelope */}
              <polygon points={forecastPaths.outerPolygon} fill="url(#upsideConeGrad)" />
              {/* Inner 1.0σ uncertainty interval */}
              <polygon points={forecastPaths.innerPolygon} fill="url(#innerConeGrad)" />

              {/* Explicit Boundary Line between Observed & Projected Data */}
              <line
                x1={forecastPaths.boundaryX}
                y1={padTop}
                x2={forecastPaths.boundaryX}
                y2={H - padBottom}
                stroke="#00E5FF"
                strokeWidth="1.2"
                strokeDasharray="4,4"
              />
              <rect
                x={forecastPaths.boundaryX - 58}
                y={padTop + 4}
                width="116"
                height="16"
                rx="2"
                fill="#0b131e"
                stroke="#00E5FF"
                strokeWidth="0.8"
              />
              <text
                x={forecastPaths.boundaryX}
                y={padTop + 15}
                textAnchor="middle"
                fill="#00E5FF"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
              >
                OBSERVED | PROJECTED
              </text>

              {/* Upside Scenario Path (Neon Green) */}
              <path
                d={forecastPaths.upsidePath}
                fill="none"
                stroke="#00E676"
                strokeWidth="1.8"
                strokeDasharray="5,3"
              />
              {/* Central Drift Trajectory (Cyan) */}
              <path
                d={forecastPaths.centralPath}
                fill="none"
                stroke="#00E5FF"
                strokeWidth="1.8"
              />
              {/* Downside Risk Scenario Path (Red/Coral) */}
              <path
                d={forecastPaths.downsidePath}
                fill="none"
                stroke="#FF4D4D"
                strokeWidth="1.8"
                strokeDasharray="5,3"
              />

              {/* End labels on right edge of forecast */}
              <circle
                cx={forecastPaths.endX}
                cy={forecastPaths.endUpsideY}
                r="3"
                fill="#00E676"
              />
              <circle
                cx={forecastPaths.endX}
                cy={forecastPaths.endCentralY}
                r="3"
                fill="#00E5FF"
              />
              <circle
                cx={forecastPaths.endX}
                cy={forecastPaths.endDownsideY}
                r="3"
                fill="#FF4D4D"
              />
            </g>
          )}

          {/* Crosshair Hover Line & Marker */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padTop}
                x2={getX(hoverIndex)}
                y2={H - padBottom}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              {hoverIndex < visCandles.length && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getYPrice(visCandles[hoverIndex].close)}
                  r="3.5"
                  fill="#00E5FF"
                  stroke="#090c11"
                  strokeWidth="1.5"
                />
              )}
            </g>
          )}

          {/* Watermark Symbol Label in Top-Left of Plot */}
          <text
            x={padLeft + 10}
            y={padTop + 22}
            fill="#cbd5e1"
            fillOpacity="0.22"
            fontSize="16"
            fontWeight="700"
            fontFamily="JetBrains Mono, monospace"
          >
            {symbol} · {companyName} ({timeframe})
          </text>
        </svg>
      </div>

      {/* Chart Footer: Legend & Scenario Methodology Disclosure */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#0d1117] border-t border-[#1c2331] text-[11px]">
        <div className="flex items-center gap-4 flex-wrap font-mono">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 inline-block bg-[#00E676] rounded-xs" />
            Bullish / Upside (+1.25σ: ${forecast.projectedUpsideEnd.toFixed(2)})
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 inline-block bg-[#00E5FF] rounded-xs" />
            Central Trajectory (${forecast.projectedCentralEnd.toFixed(2)})
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 inline-block bg-[#FF4D4D] rounded-xs" />
            Bearish / Downside Risk (-1.25σ: ${forecast.projectedDownsideEnd.toFixed(2)})
          </span>
          {showEma50 && (
            <span className="text-[#00E5FF]">— EMA(50)</span>
          )}
          {showEma200 && (
            <span className="text-amber-400">— EMA(200)</span>
          )}
          {showBollinger && (
            <span className="text-indigo-300">--- BB(20, 2σ)</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
          <Info className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
          <span>
            {forecast.methodName} · Horizon: {forecast.horizonDays}D · Input: {forecast.historicalWindowUsed} obs · Scenario paths illustrate statistical variance, not guaranteed future prices.
          </span>
        </div>
      </div>
    </div>
  );
};
