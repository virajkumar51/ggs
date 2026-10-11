import React, { useState } from 'react';
import { AlertConfigItem, CrossoverSignalEvent, StockData } from '../types/market';
import { Sparkline } from './Sparkline';
import {
  Plus,
  X,
  ArrowUpRight,
  ArrowDownRight,
  BellRing,
  ExternalLink,
  Bookmark,
} from 'lucide-react';

interface LeftSidebarProps {
  watchlistStocks: StockData[];
  allStocks: StockData[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onOpenCompanyWorkspace: (symbol: string) => void;
  onAddWatchlist: (symbol: string) => void;
  onRemoveWatchlist: (symbol: string) => void;
  triggeredAlerts: AlertConfigItem[];
  recentSignals: CrossoverSignalEvent[];
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  watchlistStocks,
  allStocks,
  selectedSymbol,
  onSelectSymbol,
  onOpenCompanyWorkspace,
  onAddWatchlist,
  onRemoveWatchlist,
  triggeredAlerts,
  recentSignals,
}) => {
  const [addingTicker, setAddingTicker] = useState(false);

  const availableToAdd = allStocks.filter(
    (s) => !watchlistStocks.some((w) => w.symbol === s.symbol)
  );

  return (
    <aside className="w-full lg:w-[265px] xl:w-[280px] shrink-0 bg-[#0d1117] border-b lg:border-b-0 lg:border-r border-[#1c2331] flex flex-col justify-between select-none">
      {/* SECTION 1: WATCHLIST */}
      <div className="p-3 border-b border-[#1c2331]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-[#00E5FF]" />
            <h2 className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              Watchlist ({watchlistStocks.length})
            </h2>
          </div>
          <button
            onClick={() => setAddingTicker(!addingTicker)}
            className="flex items-center gap-0.5 text-[11px] text-[#00E5FF] hover:underline font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {addingTicker && (
          <div className="mb-2.5">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onAddWatchlist(e.target.value);
                  setAddingTicker(false);
                }
              }}
              className="w-full bg-[#090c11] border border-[#242f42] rounded px-2 py-1.5 text-xs text-white"
            >
              <option value="" disabled>
                Select symbol to add...
              </option>
              {availableToAdd.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1 max-h-[360px] overflow-y-auto pr-0.5">
          {watchlistStocks.map((stock) => {
            const isUp = stock.changePercent >= 0;
            const active = stock.symbol === selectedSymbol;
            const sparkCloses = (stock.candles['1M'] || []).map((c) => c.close);

            return (
              <div
                key={stock.symbol}
                onClick={() => onSelectSymbol(stock.symbol)}
                className={`group flex items-center justify-between px-2.5 py-2 rounded border cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#151e2e] border-[#00E5FF]/50'
                    : 'bg-[#11161f] border-[#1a2230] hover:border-slate-600'
                }`}
              >
                <div className="min-w-[68px] pr-1">
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-xs text-white">
                      {stock.symbol}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCompanyWorkspace(stock.symbol);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#00E5FF] transition-opacity"
                      title={`Open ${stock.symbol} Research Workspace`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[76px]">
                    {stock.name}
                  </div>
                </div>

                <Sparkline
                  data={sparkCloses}
                  width={52}
                  height={20}
                  positive={isUp}
                  showArea={true}
                />

                <div className="flex items-center gap-1.5">
                  <div className="text-right font-mono">
                    <div className="text-xs font-semibold text-white">
                      ${stock.price.toFixed(2)}
                    </div>
                    <div
                      className={`text-[10px] flex items-center justify-end gap-0.5 font-medium ${
                        isUp ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                      }`}
                    >
                      {isUp ? (
                        <ArrowUpRight className="w-2.5 h-2.5" />
                      ) : (
                        <ArrowDownRight className="w-2.5 h-2.5" />
                      )}
                      {isUp ? '+' : ''}
                      {stock.changePercent.toFixed(2)}%
                    </div>
                  </div>

                  {watchlistStocks.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveWatchlist(stock.symbol);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-[#FF4D4D] transition-opacity"
                      title="Remove from Watchlist"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: QUICK ALERTS FEED */}
      <div className="p-3 flex-1">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <BellRing className="w-3.5 h-3.5 text-amber-400" />
            <h2 className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              Quick Alerts
            </h2>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Live Evaluation</span>
        </div>

        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-0.5">
          {triggeredAlerts.map((al) => (
            <div
              key={al.id}
              onClick={() => onSelectSymbol(al.symbol)}
              className="p-2 rounded bg-[#141a25] border border-amber-500/30 cursor-pointer hover:border-amber-400/60 transition-colors"
            >
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-amber-400 font-bold">{al.symbol} · THRESHOLD</span>
                <span className="text-slate-500">
                  {new Date(al.lastTriggeredAt || al.updatedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-[11px] text-slate-200 mt-0.5 leading-snug">
                {al.triggerMessage || `${al.conditionType} crossed ${al.threshold}`}
              </p>
            </div>
          ))}

          {recentSignals.slice(0, 5).map((sig) => (
            <div
              key={sig.id}
              onClick={() => onSelectSymbol(sig.symbol)}
              className="p-2 rounded bg-[#11161f] border border-[#1a2230] cursor-pointer hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span
                  className={`font-bold ${
                    sig.direction === 'bullish' ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                  }`}
                >
                  {sig.symbol} · {sig.indicatorValue}
                </span>
                <span className="text-slate-500">{sig.observationDate}</span>
              </div>
              <div className="text-[11px] font-medium text-slate-200 mt-0.5">{sig.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">
                {sig.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
