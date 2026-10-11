import React, { useState, useMemo } from 'react';
import {
  AlertConfigItem,
  NewsItem,
  StockData,
  Timeframe,
} from '../types/market';
import {
  Bell,
  Plus,
  Trash2,
  Newspaper,
  Search,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';

interface AlertsAndNewsViewProps {
  allStocks: StockData[];
  alerts: AlertConfigItem[];
  onAddAlert: (alert: Omit<AlertConfigItem, 'id' | 'userId' | 'lastEvaluatedAt' | 'createdAt' | 'updatedAt'>) => void;
  onToggleAlert: (id: string) => void;
  onDeleteAlert: (id: string) => void;
  onSelectSymbol: (symbol: string) => void;
}

const CONDITION_LABELS: Record<AlertConfigItem['conditionType'], string> = {
  PRICE_ABOVE: 'Price Above ($)',
  PRICE_BELOW: 'Price Below ($)',
  DAILY_CHANGE_PCT: 'Abs Daily % Move >=',
  RSI_ABOVE: 'RSI (14) Crosses Above',
  RSI_BELOW: 'RSI (14) Crosses Below',
  MACD_CROSSOVER: 'MACD Bullish/Bearish Crossover',
  MA_CROSSOVER: 'SMA 20/50 Crossover',
  COMPANY_NEWS: 'Breaking Company News Published',
};

export const AlertsAndNewsView: React.FC<AlertsAndNewsViewProps> = ({
  allStocks,
  alerts,
  onAddAlert,
  onToggleAlert,
  onDeleteAlert,
  onSelectSymbol,
}) => {
  // New Alert Form State
  const [symbol, setSymbol] = useState('NVDA');
  const [conditionType, setConditionType] =
    useState<AlertConfigItem['conditionType']>('PRICE_ABOVE');
  const [threshold, setThreshold] = useState<number>(142);
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');

  // News Filter State
  const [newsSearch, setNewsSearch] = useState('');
  const [newsTopic, setNewsTopic] = useState<string>('ALL');
  const [newsCompany, setNewsCompany] = useState<string>('ALL');

  // AI News Grounding Analyzer State
  const [analyzingArticle, setAnalyzingArticle] = useState<NewsItem | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const allNews = useMemo(() => {
    const list: NewsItem[] = [];
    for (const s of allStocks) {
      for (const n of s.news) {
        list.push(n);
      }
    }
    return list.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }, [allStocks]);

  const filteredNews = useMemo(() => {
    const q = newsSearch.toLowerCase().trim();
    return allNews.filter((item) => {
      if (newsTopic !== 'ALL' && item.topic !== newsTopic) return false;
      if (newsCompany !== 'ALL' && !item.relatedSymbols.includes(newsCompany)) return false;
      if (
        q &&
        !item.headline.toLowerCase().includes(q) &&
        !item.summary.toLowerCase().includes(q) &&
        !item.source.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [allNews, newsSearch, newsTopic, newsCompany]);

  const handleAnalyzeNewsArticle = async (article: NewsItem) => {
    setAnalyzingArticle(article);
    setAiLoading(true);
    setAiSummary(null);
    try {
      const res = await fetch('/api/ai/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Analyze this retrieved news headline and abstract. Distinguish clearly between: (1) Reported Facts in the retrieved metadata, (2) Market Interpretations & Potential Second-Order Effects, and (3) Limitations (explicitly note that analysis is based on the retrieved headline/abstract and Google Search grounding rather than behind-paywall full text).\n\nHeadline: "${article.headline}"\nSource: ${article.source} (${article.publishedAt})\nRetrieved Summary: "${article.summary}"\nRelated Tickers: ${article.relatedSymbols.join(', ')}`,
          mode: 'grounded',
          companyContext: {
            relatedTickers: article.relatedSymbols,
            articleMetadata: article,
          },
        }),
      });
      const data = await res.json();
      setAiSummary(data.answer || 'No summary returned.');
    } catch (err: any) {
      setAiSummary(`Error analyzing article: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* SECTION 1: CONFIGURABLE RESEARCH ALERTS */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181f2c] pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#00E5FF]" />
            <div>
              <h2 className="text-sm font-bold text-white">
                Configurable Research Alerts & Local Evaluation Engine
              </h2>
              <p className="text-xs text-slate-400">
                Evaluates automatically on every real-time market refresh while QuantPulse is open. Deduplicates triggered events to prevent repeat notification spam.
              </p>
            </div>
          </div>
        </div>

        {/* Create Alert Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAddAlert({
              symbol,
              conditionType,
              threshold,
              timeframe,
              enabled: true,
              status: 'ARMED',
            });
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#11161f] p-3.5 rounded border border-[#1c2433] items-end"
        >
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Target Company</label>
            <select
              value={symbol}
              onChange={(e) => {
                const sym = e.target.value;
                setSymbol(sym);
                const found = allStocks.find((s) => s.symbol === sym);
                if (found && (conditionType === 'PRICE_ABOVE' || conditionType === 'PRICE_BELOW')) {
                  setThreshold(Number((found.price * 1.02).toFixed(2)));
                }
              }}
              className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs font-mono text-white"
            >
              {allStocks.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.name} (${s.price.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Alert Condition</label>
            <select
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value as any)}
              className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs text-white"
            >
              {Object.entries(CONDITION_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Threshold Value (Price / % / RSI)
            </label>
            <input
              type="number"
              step="0.1"
              value={threshold}
              disabled={
                conditionType === 'MACD_CROSSOVER' ||
                conditionType === 'MA_CROSSOVER' ||
                conditionType === 'COMPANY_NEWS'
              }
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-40"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Evaluation Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              className="w-full bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs font-mono text-white"
            >
              {(['1D', '1W', '1M', '3M', '6M', '1Y'] as Timeframe[]).map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#00E5FF] text-slate-950 font-semibold text-xs rounded hover:bg-[#00E5FF]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Alert</span>
          </button>
        </form>

        {/* Active Alerts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1c2433] bg-[#0b0e14] text-slate-400 font-sans">
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Condition & Threshold</th>
                <th className="py-2.5 px-3">Timeframe</th>
                <th className="py-2.5 px-3">Current Status</th>
                <th className="py-2.5 px-3">Last Evaluated</th>
                <th className="py-2.5 px-3">Trigger Details</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181f2c]">
              {alerts.map((al) => (
                <tr key={al.id} className="hover:bg-[#141a26]">
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => onSelectSymbol(al.symbol)}
                      className="font-bold text-white hover:text-[#00E5FF]"
                    >
                      {al.symbol}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-200">
                    {CONDITION_LABELS[al.conditionType]}{' '}
                    {!['MACD_CROSSOVER', 'MA_CROSSOVER', 'COMPANY_NEWS'].includes(
                      al.conditionType
                    ) && <strong className="font-mono text-[#00E5FF]">{al.threshold}</strong>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{al.timeframe}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        al.status === 'TRIGGERED'
                          ? 'text-amber-400'
                          : al.status === 'ARMED'
                          ? 'text-[#00E676]'
                          : 'text-slate-500'
                      }`}
                    >
                      {al.status === 'TRIGGERED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {al.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {new Date(al.lastEvaluatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-300 max-w-[260px]">
                    {al.triggerMessage || 'Monitoring on active refresh loop'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => onToggleAlert(al.id)}
                        className="text-slate-400 hover:text-white"
                        title={al.enabled ? 'Pause Alert' : 'Resume Alert'}
                      >
                        {al.enabled ? (
                          <PauseCircle className="w-4 h-4 text-amber-400" />
                        ) : (
                          <PlayCircle className="w-4 h-4 text-[#00E676]" />
                        )}
                      </button>
                      <button
                        onClick={() => onDeleteAlert(al.id)}
                        className="text-slate-500 hover:text-[#FF4D4D]"
                        title="Delete Alert"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: FINANCIAL NEWS & AI GROUNDED NEWS ANALYSIS */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181f2c] pb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-[#00E5FF]" />
            <div>
              <h2 className="text-sm font-bold text-white">
                Financial News Terminal & AI Grounded News Synthesis
              </h2>
              <p className="text-xs text-slate-400">
                Filter by company, topic, or keyword. AI news analysis summarizes retrieved headline/abstract metadata + live Google Search grounding without claiming full-text paywall access.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={newsSearch}
                onChange={(e) => setNewsSearch(e.target.value)}
                placeholder="Search headlines..."
                className="bg-[#090c11] border border-[#242f42] rounded pl-8 pr-2.5 py-1.5 text-xs text-white"
              />
            </div>

            <select
              value={newsCompany}
              onChange={(e) => setNewsCompany(e.target.value)}
              className="bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs font-mono text-white"
            >
              <option value="ALL">All Companies</option>
              {allStocks.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.name}
                </option>
              ))}
            </select>

            <select
              value={newsTopic}
              onChange={(e) => setNewsTopic(e.target.value)}
              className="bg-[#090c11] border border-[#242f42] rounded px-2.5 py-1.5 text-xs text-white"
            >
              <option value="ALL">All Topics</option>
              <option value="Earnings">Earnings</option>
              <option value="AI & Semis">AI & Semis</option>
              <option value="Macro">Macro</option>
              <option value="Product & Strategy">Product & Strategy</option>
              <option value="Regulation">Regulation</option>
              <option value="Market Structure">Market Structure</option>
            </select>
          </div>
        </div>

        {/* AI Article Synthesis Drawer when active */}
        {analyzingArticle && (
          <div className="bg-[#121824] border border-[#00E5FF]/40 rounded p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#00E5FF] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                AI Grounded News Breakdown: {analyzingArticle.headline}
              </span>
              <button
                onClick={() => setAnalyzingArticle(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            {aiLoading ? (
              <div className="text-xs text-slate-300 py-3 font-mono">
                Synthesizing retrieved metadata and verifying facts with Google Search Grounding...
              </div>
            ) : (
              <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                {aiSummary}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredNews.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded bg-[#121721] border border-[#1c2433] flex flex-col justify-between gap-2.5"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>
                    <strong className="text-slate-200">{item.source}</strong> · {item.topic} ·{' '}
                    <span
                      className={
                        item.sentimentHints === 'Positive'
                          ? 'text-[#00E676]'
                          : item.sentimentHints === 'Cautious'
                          ? 'text-[#FF4D4D]'
                          : 'text-[#00E5FF]'
                      }
                    >
                      {item.sentimentHints}
                    </span>
                  </span>
                  <span className="font-mono">
                    {new Date(item.publishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white leading-snug">{item.headline}</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.summary}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1c2433]">
                <div className="flex items-center gap-1.5">
                  {item.relatedSymbols.map((sym) => (
                    <button
                      key={sym}
                      onClick={() => onSelectSymbol(sym)}
                      className="px-2 py-0.5 rounded bg-[#090c11] border border-[#242f42] font-mono text-[11px] font-bold text-[#00E5FF] hover:border-[#00E5FF]"
                    >
                      {sym} Workspace →
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <button
                    onClick={() => handleAnalyzeNewsArticle(item)}
                    className="inline-flex items-center gap-1 text-[#00E676] hover:underline font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyze Facts vs. Interpretation</span>
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-white"
                  >
                    <span>Source</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
