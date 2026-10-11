import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StockData } from '../types/market';
import { buildDynamicCompanyData } from '../data/stockUniverse';
import { Sparkline } from './Sparkline';
import { Search, Clock, ArrowUpRight, ArrowDownRight, AlertCircle, X } from 'lucide-react';

interface GlobalSearchBarProps {
  allStocks: StockData[];
  onSelectStock: (symbol: string, dynamicStock?: StockData) => void;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  allStocks,
  onSelectStock,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [recentSymbols, setRecentSymbols] = useState<string[]>(['AAPL', 'NVDA', 'MSFT', 'TSLA']);
  const [remoteMatches, setRemoteMatches] = useState<any[]>([]);
  const [searchingRemote, setSearchingRemote] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  // Debounced remote symbol discovery for tickers outside local universe
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setRemoteMatches([]);
      setSearchingRemote(false);
      return;
    }

    setSearchingRemote(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/discover?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setRemoteMatches(data.matches || []);
        }
      } catch {
        setRemoteMatches([]);
      } finally {
        setSearchingRemote(false);
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [query]);

  const combinedResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return recentSymbols
        .map((sym) => allStocks.find((s) => s.symbol === sym))
        .filter((s): s is StockData => Boolean(s))
        .map((s) => ({ type: 'local' as const, stock: s }));
    }

    const localFiltered = allStocks
      .filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q)
      )
      .slice(0, 7)
      .map((s) => ({ type: 'local' as const, stock: s }));

    const localSyms = new Set(localFiltered.map((item) => item.stock.symbol));
    const discoveredFiltered = remoteMatches
      .filter((m) => !localSyms.has(m.symbol))
      .slice(0, 5)
      .map((m) => ({
        type: 'discovered' as const,
        stock: buildDynamicCompanyData(m),
      }));

    return [...localFiltered, ...discoveredFiltered];
  }, [query, allStocks, remoteMatches, recentSymbols]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [combinedResults.length, query]);

  const handleChoose = (item: { type: 'local' | 'discovered'; stock: StockData }) => {
    const sym = item.stock.symbol;
    setRecentSymbols((prev) => [sym, ...prev.filter((s) => s !== sym)].slice(0, 6));
    onSelectStock(sym, item.type === 'discovered' ? item.stock : undefined);
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setIsOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(combinedResults.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = combinedResults[highlightIdx];
      if (target) handleChoose(target);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-64 sm:w-80">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search ticker or company (e.g. NVDA, MA, ARM)..."
          className="w-full bg-[#090c11] border border-[#242f42] focus:border-[#00E5FF] rounded pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 text-slate-500 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-[360px] sm:w-[420px] bg-[#0e131b] border border-[#263246] rounded shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-1.5 bg-[#131924] border-b border-[#1c2433] flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              {query.trim() ? (
                <span>SEARCH RESULTS ({combinedResults.length})</span>
              ) : (
                <>
                  <Clock className="w-3 h-3 text-[#00E5FF]" />
                  <span>RECENT & CORE TICKERS</span>
                </>
              )}
            </span>
            <span>↑↓ Navigate · Enter Select</span>
          </div>

          {combinedResults.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <AlertCircle className="w-4 h-4" />
                <span>
                  {searchingRemote
                    ? `Querying exchange feed for "${query.toUpperCase()}"...`
                    : `Symbol "${query.toUpperCase()}" Unsupported or Not Found`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                QuantPulse only displays verified market quotes and never fabricates company data for unrecognized symbols. Try searching AAPL, NVDA, MSFT, TSLA, AMZN, GOOGL, META, BRK.B, JPM, LLY, MA, ARM, or COIN.
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-[#181f2c]">
              {combinedResults.map((item, idx) => {
                const { stock } = item;
                const isUp = stock.changePercent >= 0;
                const spark = (stock.candles['1M'] || []).map((c) => c.close);
                const isSelected = idx === highlightIdx;

                return (
                  <button
                    key={stock.symbol}
                    type="button"
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => handleChoose(item)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                      isSelected ? 'bg-[#172133]' : 'hover:bg-[#131b29]'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-white">
                          {stock.symbol}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {stock.exchange}
                        </span>
                        {item.type === 'discovered' && (
                          <span className="text-[10px] text-[#00E5FF] font-mono">
                            · Extended Discovery
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[165px]">
                        {stock.name}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Sparkline
                        data={spark}
                        width={54}
                        height={20}
                        positive={isUp}
                        showArea={false}
                      />
                      <div className="text-right font-mono min-w-[74px]">
                        <div className="text-xs font-semibold text-white">
                          ${stock.price.toFixed(2)}
                        </div>
                        <div
                          className={`text-[10px] flex items-center justify-end gap-0.5 ${
                            isUp ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                          }`}
                        >
                          {isUp ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {isUp ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
