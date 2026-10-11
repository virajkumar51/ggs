import React, { useState, useMemo } from 'react';
import {
  ScreenerPresetItem,
  StockData,
  TechnicalSummary,
} from '../types/market';
import { Sparkline } from './Sparkline';
import { Filter, RotateCcw, Bookmark, ArrowUpDown, Search, Trash2 } from 'lucide-react';

interface ScreenerRow {
  stock: StockData;
  tech: TechnicalSummary;
}

interface ScreenerViewProps {
  rows: ScreenerRow[];
  presets: ScreenerPresetItem[];
  onSavePreset: (preset: Omit<ScreenerPresetItem, 'id' | 'userId' | 'createdAt'>) => void;
  onDeletePreset: (id: string) => void;
  onSelectSymbol: (symbol: string) => void;
}

export const ScreenerView: React.FC<ScreenerViewProps> = ({
  rows,
  presets,
  onSavePreset,
  onDeletePreset,
  onSelectSymbol,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sector, setSector] = useState('ALL');
  const [minMarketCapB, setMinMarketCapB] = useState<number>(0);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(5000);
  const [minDailyChange, setMinDailyChange] = useState<number>(-20);
  const [minRsi, setMinRsi] = useState<number>(0);
  const [maxRsi, setMaxRsi] = useState<number>(100);
  const [maxPE, setMaxPE] = useState<number>(200);
  const [minRevGrowth, setMinRevGrowth] = useState<number>(-50);
  const [maFilter, setMaFilter] = useState<'ALL' | 'ABOVE_EMA50' | 'BELOW_EMA50' | 'BULL_ALIGNED'>('ALL');
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'BULLISH_SIGNAL' | 'BEARISH_SIGNAL'>('ALL');

  const [sortBy, setSortBy] = useState<'marketCap' | 'price' | 'changePercent' | 'volume' | 'rsi' | 'pe' | 'revGrowth'>('marketCap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [newPresetName, setNewPresetName] = useState('');

  const equityRows = useMemo(() => rows.filter((r) => !r.stock.isIndex), [rows]);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    equityRows.forEach((r) => set.add(r.stock.sector));
    return ['ALL', ...Array.from(set)];
  }, [equityRows]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = equityRows.filter(({ stock, tech }) => {
      if (q && !stock.symbol.toLowerCase().includes(q) && !stock.name.toLowerCase().includes(q)) {
        return false;
      }
      if (sector !== 'ALL' && stock.sector !== sector) return false;
      if ((stock.fundamentals.marketCapB ?? 0) < minMarketCapB) return false;
      if (stock.price < minPrice || stock.price > maxPrice) return false;
      if (stock.changePercent < minDailyChange) return false;

      const rsi = tech.latestRsi14 ?? 50;
      if (rsi < minRsi || rsi > maxRsi) return false;

      if (maxPE < 200) {
        if (stock.fundamentals.peRatio === null || stock.fundamentals.peRatio > maxPE) {
          return false;
        }
      }
      if ((stock.fundamentals.revenueGrowthYoY_Pct ?? 0) < minRevGrowth) return false;

      if (maFilter === 'ABOVE_EMA50') {
        if (tech.movingAverages.ema50 === null || stock.price <= tech.movingAverages.ema50) {
          return false;
        }
      } else if (maFilter === 'BELOW_EMA50') {
        if (tech.movingAverages.ema50 === null || stock.price >= tech.movingAverages.ema50) {
          return false;
        }
      } else if (maFilter === 'BULL_ALIGNED') {
        if (
          tech.movingAverages.ema50 === null ||
          tech.movingAverages.ema200 === null ||
          !(stock.price > tech.movingAverages.ema50 && tech.movingAverages.ema50 > tech.movingAverages.ema200)
        ) {
          return false;
        }
      }

      if (signalFilter === 'BULLISH_SIGNAL') {
        if (!tech.signals.some((s) => s.direction === 'bullish')) return false;
      } else if (signalFilter === 'BEARISH_SIGNAL') {
        if (!tech.signals.some((s) => s.direction === 'bearish')) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      let va = 0;
      let vb = 0;
      switch (sortBy) {
        case 'marketCap':
          va = a.stock.fundamentals.marketCapB ?? -1;
          vb = b.stock.fundamentals.marketCapB ?? -1;
          break;
        case 'price':
          va = a.stock.price;
          vb = b.stock.price;
          break;
        case 'changePercent':
          va = a.stock.changePercent;
          vb = b.stock.changePercent;
          break;
        case 'volume':
          va = a.stock.volume;
          vb = b.stock.volume;
          break;
        case 'rsi':
          va = a.tech.latestRsi14 ?? -1;
          vb = b.tech.latestRsi14 ?? -1;
          break;
        case 'pe':
          va = a.stock.fundamentals.peRatio ?? 9999;
          vb = b.stock.fundamentals.peRatio ?? 9999;
          break;
        case 'revGrowth':
          va = a.stock.fundamentals.revenueGrowthYoY_Pct ?? -999;
          vb = b.stock.fundamentals.revenueGrowthYoY_Pct ?? -999;
          break;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [
    equityRows,
    searchQuery,
    sector,
    minMarketCapB,
    minPrice,
    maxPrice,
    minDailyChange,
    minRsi,
    maxRsi,
    maxPE,
    minRevGrowth,
    maFilter,
    signalFilter,
    sortBy,
    sortDir,
  ]);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSector('ALL');
    setMinMarketCapB(0);
    setMinPrice(0);
    setMaxPrice(5000);
    setMinDailyChange(-20);
    setMinRsi(0);
    setMaxRsi(100);
    setMaxPE(200);
    setMinRevGrowth(-50);
    setMaFilter('ALL');
    setSignalFilter('ALL');
  };

  const applyPreset = (p: ScreenerPresetItem) => {
    setSector(p.sector);
    setMinMarketCapB(p.minMarketCapB);
    setMaxPE(p.maxPE);
    setMinRsi(p.minRsi);
    setMaxRsi(p.maxRsi);
    setSignalFilter((p.signalFilter as any) || 'ALL');
  };

  return (
    <div className="space-y-4">
      {/* Screener Filter Control Panel */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181f2c] pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#00E5FF]" />
            <div>
              <h2 className="text-sm font-bold text-white">
                Multi-Factor Institutional Stock Screener
              </h2>
              <p className="text-xs text-slate-400">
                Combines Fundamental, Technical & Signal filters using strict AND logic across {equityRows.length} tracked equities in the active QuantPulse dataset (subset of exchange universe).
              </p>
            </div>
          </div>

          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#141b26] border border-[#242f42] text-xs text-slate-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear All Filters</span>
          </button>
        </div>

        {/* Saved Presets Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#11161f] p-2.5 rounded border border-[#1c2433]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Bookmark className="w-3.5 h-3.5 text-[#00E5FF]" /> Saved Presets:
            </span>
            {presets.map((p) => (
              <div
                key={p.id}
                className="inline-flex items-center bg-[#090c11] border border-[#242f42] rounded overflow-hidden"
              >
                <button
                  onClick={() => applyPreset(p)}
                  className="px-2.5 py-1 text-xs text-slate-200 hover:text-[#00E5FF] transition-colors"
                >
                  {p.name}
                </button>
                <button
                  onClick={() => onDeletePreset(p.id)}
                  className="px-1.5 py-1 text-slate-500 hover:text-[#FF4D4D] border-l border-[#242f42]"
                  title="Delete Preset"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newPresetName.trim()) return;
              onSavePreset({
                name: newPresetName.trim(),
                sector,
                minMarketCapB,
                maxPE,
                minRsi,
                maxRsi,
                signalFilter,
              });
              setNewPresetName('');
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              maxLength={60}
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Save current filter as..."
              className="bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1 text-xs text-white"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-[#00E5FF] text-xs font-semibold rounded hover:bg-[#00E5FF]/25"
            >
              Save Preset
            </button>
          </form>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Search Within Results</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ticker or Name..."
                className="w-full bg-[#090c11] border border-[#242f42] rounded pl-8 pr-2.5 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Sector</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs text-white"
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s === 'ALL' ? 'All Sectors' : s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Min Market Cap ($B): <span className="font-mono text-white">${minMarketCapB}B</span>
            </label>
            <select
              value={minMarketCapB}
              onChange={(e) => setMinMarketCapB(Number(e.target.value))}
              className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs font-mono text-white"
            >
              <option value={0}>Any ($0B+)</option>
              <option value={100}>Large Cap ($100B+)</option>
              <option value={300}>Mega Cap ($300B+)</option>
              <option value={500}>Titan ($500B+)</option>
              <option value={1000}>Trillion Club ($1,000B+)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Max Trailing P/E:{' '}
              <span className="font-mono text-white">{maxPE >= 200 ? 'Any' : `${maxPE}x`}</span>
            </label>
            <input
              type="range"
              min={10}
              max={200}
              step={5}
              value={maxPE}
              onChange={(e) => setMaxPE(Number(e.target.value))}
              className="w-full accent-[#00E5FF] mt-1.5"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Min YoY Rev Growth: <span className="font-mono text-white">{minRevGrowth}%</span>
            </label>
            <select
              value={minRevGrowth}
              onChange={(e) => setMinRevGrowth(Number(e.target.value))}
              className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs font-mono text-white"
            >
              <option value={-50}>Any</option>
              <option value={0}>Positive (&gt; 0%)</option>
              <option value={5}>&gt; 5% YoY</option>
              <option value={15}>High Growth (&gt; 15%)</option>
              <option value={25}>Hypergrowth (&gt; 25%)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              RSI (14) Range: <span className="font-mono text-white">{minRsi} – {maxRsi}</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                value={minRsi}
                onChange={(e) => setMinRsi(Number(e.target.value))}
                className="w-1/2 bg-[#090c11] border border-[#242f42] rounded px-2 py-1 text-xs font-mono text-white"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={maxRsi}
                onChange={(e) => setMaxRsi(Number(e.target.value))}
                className="w-1/2 bg-[#090c11] border border-[#242f42] rounded px-2 py-1 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Moving Average Filter</label>
            <select
              value={maFilter}
              onChange={(e) => setMaFilter(e.target.value as any)}
              className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs text-white"
            >
              <option value="ALL">All MA Positions</option>
              <option value="ABOVE_EMA50">Price &gt; EMA 50</option>
              <option value="BELOW_EMA50">Price &lt; EMA 50</option>
              <option value="BULL_ALIGNED">Price &gt; EMA50 &gt; EMA200</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Technical Signal</label>
            <select
              value={signalFilter}
              onChange={(e) => setSignalFilter(e.target.value as any)}
              className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs text-white"
            >
              <option value="ALL">All Signals</option>
              <option value="BULLISH_SIGNAL">Has Active Bullish Crossover</option>
              <option value="BEARISH_SIGNAL">Has Active Bearish Crossover</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Price Bounds ($)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(Number(e.target.value))}
                className="w-1/2 bg-[#090c11] border border-[#242f42] rounded px-2 py-1 text-xs font-mono text-white"
              />
              <input
                type="number"
                min={1}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-1/2 bg-[#090c11] border border-[#242f42] rounded px-2 py-1 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Min Daily % Change</label>
            <select
              value={minDailyChange}
              onChange={(e) => setMinDailyChange(Number(e.target.value))}
              className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs font-mono text-white"
            >
              <option value={-20}>Any Daily Move</option>
              <option value={0}>Green Today (&gt; 0%)</option>
              <option value={1}>Strong Gain (&gt; +1.0%)</option>
              <option value={2}>Top Movers (&gt; +2.0%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#11161f] border-b border-[#1c2331] text-xs">
          <span className="text-slate-300 font-semibold">
            Showing <strong className="text-[#00E5FF] font-mono">{filteredAndSorted.length}</strong> of{' '}
            <strong className="font-mono">{equityRows.length}</strong> screened companies
          </span>
          <span className="text-[11px] text-slate-500">
            Click any row to open its full Company Research Workspace
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1c2433] text-slate-400 font-sans bg-[#0b0e14]">
                <th className="py-2.5 px-3">Ticker / Company</th>
                <th className="py-2.5 px-3">Sector</th>
                <th className="py-2.5 px-3">1M Trend</th>
                <th
                  onClick={() => handleSort('price')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                >
                  <span className="inline-flex items-center gap-1">
                    Price <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('changePercent')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                >
                  <span className="inline-flex items-center gap-1">
                    1D Change <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('marketCap')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                >
                  <span className="inline-flex items-center gap-1">
                    Mkt Cap <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('pe')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                >
                  <span className="inline-flex items-center gap-1">
                    P/E <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('revGrowth')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                >
                  <span className="inline-flex items-center gap-1">
                    Rev YoY <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('rsi')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-white"
                >
                  <span className="inline-flex items-center gap-1">
                    RSI(14) <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-2.5 px-3">MA & Signal Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181f2c]">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                    No stocks match all active AND filter criteria. Click "Clear All Filters" to reset.
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map(({ stock, tech }) => {
                  const isUp = stock.changePercent >= 0;
                  const sparkData = (stock.candles['1M'] || []).map((c) => c.close);
                  return (
                    <tr
                      key={stock.symbol}
                      onClick={() => onSelectSymbol(stock.symbol)}
                      className="hover:bg-[#141b27] cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-white">{stock.symbol}</div>
                        <div className="text-[11px] text-slate-400 font-sans truncate max-w-[160px]">
                          {stock.name}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-sans">{stock.sector}</td>
                      <td className="py-2.5 px-3">
                        <Sparkline
                          data={sparkData}
                          width={64}
                          height={22}
                          positive={isUp}
                          showArea={false}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-white">
                        ${stock.price.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-semibold ${
                          isUp ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                        }`}
                      >
                        {isUp ? '+' : ''}
                        {stock.changePercent.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {stock.fundamentals.marketCapB !== null
                          ? `$${stock.fundamentals.marketCapB.toFixed(0)}B`
                          : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {stock.fundamentals.peRatio !== null
                          ? `${stock.fundamentals.peRatio.toFixed(1)}x`
                          : 'N/A'}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right ${
                          (stock.fundamentals.revenueGrowthYoY_Pct ?? 0) >= 0
                            ? 'text-[#00E676]'
                            : 'text-[#FF4D4D]'
                        }`}
                      >
                        {stock.fundamentals.revenueGrowthYoY_Pct !== null
                          ? `${stock.fundamentals.revenueGrowthYoY_Pct.toFixed(1)}%`
                          : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {tech.latestRsi14 !== null ? tech.latestRsi14.toFixed(1) : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-[11px] text-slate-300">
                        {tech.signals[0] ? (
                          <span
                            className={
                              tech.signals[0].direction === 'bullish'
                                ? 'text-[#00E676]'
                                : 'text-[#FF4D4D]'
                            }
                          >
                            {tech.signals[0].label}
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            {tech.movingAverages.relationshipLabel.slice(0, 32)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
