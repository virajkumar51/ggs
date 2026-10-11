import React, { useState, useEffect } from 'react';
import {
  ForecastScenarioResult,
  StockData,
  TechnicalSummary,
  Timeframe,
} from '../types/market';
import { PrimaryFinancialChart } from './PrimaryFinancialChart';
import {
  Building2,
  LineChart,
  Table,
  Newspaper,
  Cpu,
  Sparkles,
  ExternalLink,
  HelpCircle,
  Send,
  Globe,
  Brain,
  Zap,
} from 'lucide-react';

interface CompanyWorkspaceViewProps {
  stock: StockData;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  chartType: 'candlestick' | 'line';
  onChartTypeChange: (t: 'candlestick' | 'line') => void;
  technicals: TechnicalSummary;
  forecast: ForecastScenarioResult;
  showForecastOverlay: boolean;
  onToggleForecastOverlay: () => void;
  forecastHorizon: number;
  onChangeForecastHorizon: (days: number) => void;
  initialSubTab?: 'OVERVIEW' | 'CHARTS' | 'FUNDAMENTALS' | 'NEWS' | 'TECHNICALS' | 'AI_RESEARCH';
  onUpdateFundamentals?: (symbol: string, fundamentals: any, quote?: any) => void;
}

const RATIO_EDUCATION: Record<string, string> = {
  'P/E Ratio': 'Price-to-Earnings measures how much investors pay per $1 of trailing 12-month net earnings. Higher values often reflect higher growth expectations.',
  'Forward P/E': 'Price divided by consensus estimated next-12-month earnings per share.',
  'P/S Ratio': 'Price-to-Sales compares market capitalization to annual revenue; useful when comparing companies with varying margin structures.',
  'EV/EBITDA': 'Enterprise Value (Market Cap + Debt - Cash) divided by operating cash earnings before interest, tax, depreciation, and amortization.',
  'ROE': 'Return on Equity (Net Income / Shareholders Equity) measures how efficiently shareholder capital generates profits.',
  'Debt / Equity': 'Total debt relative to shareholder equity; higher ratios indicate greater financial leverage.',
  'Free Cash Flow': 'Operating cash flow minus capital expenditures — the actual cash available for buybacks, dividends, or debt reduction.',
};

export const CompanyWorkspaceView: React.FC<CompanyWorkspaceViewProps> = ({
  stock,
  timeframe,
  onTimeframeChange,
  chartType,
  onChartTypeChange,
  technicals,
  forecast,
  showForecastOverlay,
  onToggleForecastOverlay,
  forecastHorizon,
  onChangeForecastHorizon,
  initialSubTab = 'OVERVIEW',
  onUpdateFundamentals,
}) => {
  const [subTab, setSubTab] = useState<
    'OVERVIEW' | 'CHARTS' | 'FUNDAMENTALS' | 'NEWS' | 'TECHNICALS' | 'AI_RESEARCH'
  >(initialSubTab);
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'Annual' | 'Quarterly'>('ALL');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiMode, setAiMode] = useState<'grounded' | 'deep' | 'fast'>('grounded');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    symbol: string;
    answer: string;
    modelUsed: string;
    sources: Array<{ uri: string; title: string }>;
    timestamp: string;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [verifyingFund, setVerifyingFund] = useState(false);
  const [verifyStatusMsg, setVerifyStatusMsg] = useState<string | null>(null);

  // Prevent data leakage across company workspaces when switching tickers
  useEffect(() => {
    setAiResult(null);
    setAiError(null);
    setAiQuestion('');
    setVerifyStatusMsg(null);
  }, [stock.symbol]);

  const handleVerifyLiveFundamentals = async () => {
    if (verifyingFund) return;
    setVerifyingFund(true);
    setVerifyStatusMsg(null);
    try {
      const res = await fetch(`/api/market/verify-fundamentals/${encodeURIComponent(stock.symbol)}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not verify fundamentals.');
      if (data.fundamentals && onUpdateFundamentals) {
        onUpdateFundamentals(stock.symbol, data.fundamentals, data.quote);
      }
      setVerifyStatusMsg(
        `Verified via ${data.verifiedVia || 'Live Provider'} at ${new Date().toLocaleTimeString()}`
      );
    } catch (err: any) {
      setVerifyStatusMsg(err.message || 'Live verification unavailable; displaying cached filings.');
    } finally {
      setVerifyingFund(false);
    }
  };

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const fmtVal = (val: number | null | undefined, suffix = '', prefix = '') => {
    if (val === null || val === undefined || Number.isNaN(val)) return 'Unavailable';
    return `${prefix}${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
  };

  const handleAskCompanyAi = async (customQuery?: string) => {
    const q = (customQuery ?? aiQuestion).trim();
    if (!q) return;
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `[Target Company: ${stock.name} (${stock.symbol})] ${q}`,
          mode: aiMode,
          companyContext: {
            symbol: stock.symbol,
            name: stock.name,
            exchange: stock.exchange,
            sector: stock.sector,
            industry: stock.industry,
            price: stock.price,
            changePercent: stock.changePercent,
            quoteTimestamp: stock.quoteTimestamp,
            dataSource: stock.dataSource,
            fundamentals: stock.fundamentals,
            technicals: {
              timeframe: technicals.timeframe,
              latestRsi14: technicals.latestRsi14,
              rsiStatus: technicals.rsiStatus,
              latestMacd: technicals.latestMacd,
              movingAverages: technicals.movingAverages,
              bollinger: technicals.bollinger,
              annualizedVolatilityPct: technicals.annualizedVolatilityPct,
              periodReturnPct: technicals.periodReturnPct,
              recentSignals: technicals.signals.slice(0, 5),
            },
            forecastScenario30D: {
              methodName: forecast.methodName,
              projectedCentralEnd: forecast.projectedCentralEnd,
              projectedUpsideEnd: forecast.projectedUpsideEnd,
              projectedDownsideEnd: forecast.projectedDownsideEnd,
              riskClassification: forecast.riskClassification,
            },
            recentNews: stock.news,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run AI research.');
      setAiResult({
        symbol: stock.symbol,
        answer: data.answer,
        modelUsed: data.modelUsed,
        sources: data.sources || [],
        timestamp: data.timestamp,
      });
    } catch (err: any) {
      setAiError(err.message || 'Could not complete AI research query.');
    } finally {
      setAiLoading(false);
    }
  };

  const f = stock.fundamentals;
  const filteredPeriods = f.periods.filter(
    (p) => periodFilter === 'ALL' || p.periodType === periodFilter
  );

  return (
    <div className="space-y-4">
      {/* Sub-navigation Bar for Company Workspace */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0e1218] border border-[#1c2331] rounded p-2">
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { id: 'OVERVIEW', label: 'Overview', icon: Building2 },
            { id: 'CHARTS', label: 'Charts & Overlays', icon: LineChart },
            { id: 'FUNDAMENTALS', label: 'Fundamentals', icon: Table },
            { id: 'TECHNICALS', label: 'Technicals & Signals', icon: Cpu },
            { id: 'NEWS', label: 'Company News', icon: Newspaper },
            { id: 'AI_RESEARCH', label: 'AI Grounded Research', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#151b26]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] font-mono text-slate-400 px-2">
          Workspace: <strong className="text-white">{stock.symbol}</strong> · {stock.exchange} · Currency: {f.currency}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {subTab === 'OVERVIEW' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Company Identity & Summary */}
            <div className="lg:col-span-2 bg-[#0e1218] border border-[#1c2331] rounded p-4 space-y-3">
              <div className="flex items-start justify-between border-b border-[#181f2c] pb-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {stock.name} ({stock.symbol})
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {stock.exchange} · {stock.sector} · {stock.industry}
                  </p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-lg font-bold text-white">${stock.price.toFixed(2)}</div>
                  <div
                    className={`text-xs font-semibold ${
                      stock.changePercent >= 0 ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                    }`}
                  >
                    {stock.change >= 0 ? '+' : ''}
                    {stock.change.toFixed(2)} ({stock.changePercent >= 0 ? '+' : ''}
                    {stock.changePercent.toFixed(2)}%)
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{stock.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 font-mono text-xs">
                <div className="bg-[#121721] p-2.5 rounded border border-[#1c2433]">
                  <div className="text-[10px] text-slate-400 font-sans">Headquarters</div>
                  <div className="text-slate-200 font-semibold mt-0.5 truncate">
                    {stock.headquarters}
                  </div>
                </div>
                <div className="bg-[#121721] p-2.5 rounded border border-[#1c2433]">
                  <div className="text-[10px] text-slate-400 font-sans">Chief Executive</div>
                  <div className="text-slate-200 font-semibold mt-0.5 truncate">{stock.ceo}</div>
                </div>
                <div className="bg-[#121721] p-2.5 rounded border border-[#1c2433]">
                  <div className="text-[10px] text-slate-400 font-sans">Employees</div>
                  <div className="text-slate-200 font-semibold mt-0.5">{stock.employees}</div>
                </div>
                <div className="bg-[#121721] p-2.5 rounded border border-[#1c2433]">
                  <div className="text-[10px] text-slate-400 font-sans">Founded</div>
                  <div className="text-slate-200 font-semibold mt-0.5">{stock.founded}</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 pt-1">
                Data Source: {stock.dataSource} · Last Updated: {f.lastUpdated}
              </div>
            </div>

            {/* Key Valuation & Market Snapshot */}
            <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-200 border-b border-[#181f2c] pb-2 mb-3">
                  Key Financial & Quote Metrics
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Market Cap:</span>
                    <span className="text-white">{fmtVal(f.marketCapB, 'B', '$')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Trailing P/E / Fwd P/E:</span>
                    <span className="text-white">
                      {fmtVal(f.peRatio, 'x')} / {fmtVal(f.forwardPe, 'x')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Revenue (TTM):</span>
                    <span className="text-white">{fmtVal(f.revenueTTM_B, 'B', '$')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Revenue Growth YoY:</span>
                    <span
                      className={
                        (f.revenueGrowthYoY_Pct ?? 0) >= 0 ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                      }
                    >
                      {fmtVal(f.revenueGrowthYoY_Pct, '%')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Net Profit Margin:</span>
                    <span className="text-white">{fmtVal(f.profitMarginPct, '%')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">52-Week Range:</span>
                    <span className="text-slate-200">
                      {fmtVal(f.fiftyTwoWeekLow, '', '$')} – {fmtVal(f.fiftyTwoWeekHigh, '', '$')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Day Range:</span>
                    <span className="text-slate-200">
                      ${stock.dayLow.toFixed(2)} – ${stock.dayHigh.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSubTab('AI_RESEARCH')}
                className="mt-4 w-full py-2 bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-[#00E5FF] rounded text-xs font-semibold hover:bg-[#00E5FF]/25 transition-colors"
              >
                Open Grounded AI Research for {stock.symbol} →
              </button>
            </div>
          </div>

          <PrimaryFinancialChart
            symbol={stock.symbol}
            companyName={stock.name}
            candles={stock.candles[timeframe] || []}
            timeframe={timeframe}
            onTimeframeChange={onTimeframeChange}
            availableTimeframes={['1D', '1W', '1M', '3M', '6M', '1Y']}
            chartType={chartType}
            onChartTypeChange={onChartTypeChange}
            technicals={technicals}
            forecast={forecast}
            showForecastOverlay={showForecastOverlay}
            onToggleForecastOverlay={onToggleForecastOverlay}
            forecastHorizon={forecastHorizon}
            onChangeForecastHorizon={onChangeForecastHorizon}
          />
        </div>
      )}

      {/* TAB 2: CHARTS */}
      {subTab === 'CHARTS' && (
        <PrimaryFinancialChart
          symbol={stock.symbol}
          companyName={stock.name}
          candles={stock.candles[timeframe] || []}
          timeframe={timeframe}
          onTimeframeChange={onTimeframeChange}
          availableTimeframes={['1D', '1W', '1M', '3M', '6M', '1Y']}
          chartType={chartType}
          onChartTypeChange={onChartTypeChange}
          technicals={technicals}
          forecast={forecast}
          showForecastOverlay={showForecastOverlay}
          onToggleForecastOverlay={onToggleForecastOverlay}
          forecastHorizon={forecastHorizon}
          onChangeForecastHorizon={onChangeForecastHorizon}
        />
      )}

      {/* TAB 3: FUNDAMENTALS */}
      {subTab === 'FUNDAMENTALS' && (
        <div className="space-y-4">
          <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181f2c] pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Fundamental Analysis · {stock.name} ({stock.symbol})
                </h3>
                <p className="text-xs text-slate-400">
                  Source: {f.source} · Reporting Currency: {f.currency} · Fiscal Year End: {f.fiscalYearEnd} · Updated: {f.lastUpdated}
                </p>
                {verifyStatusMsg && (
                  <p className="text-[11px] font-mono text-[#00E676] mt-1">{verifyStatusMsg}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  Missing inputs marked Unavailable
                </span>
                <button
                  onClick={handleVerifyLiveFundamentals}
                  disabled={verifyingFund}
                  className="px-3 py-1.5 rounded bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-[#00E5FF] text-xs font-semibold hover:bg-[#00E5FF]/25 transition-colors disabled:opacity-50"
                >
                  {verifyingFund ? 'Verifying Live Feed...' : 'Verify Live Fundamentals'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 font-mono text-xs">
              {[
                { label: 'Market Capitalization', val: fmtVal(f.marketCapB, 'B', '$') },
                { label: 'Revenue (TTM)', val: fmtVal(f.revenueTTM_B, 'B', '$') },
                { label: 'Revenue Growth (YoY)', val: fmtVal(f.revenueGrowthYoY_Pct, '%') },
                { label: 'Net Income (TTM)', val: fmtVal(f.netIncomeTTM_B, 'B', '$') },
                { label: 'Diluted EPS (TTM)', val: fmtVal(f.epsTTM, '', '$') },
                { label: 'Trailing P/E Ratio', val: fmtVal(f.peRatio, 'x'), help: 'P/E Ratio' },
                { label: 'Forward P/E Ratio', val: fmtVal(f.forwardPe, 'x'), help: 'Forward P/E' },
                { label: 'Price-to-Sales (P/S)', val: fmtVal(f.psRatio, 'x'), help: 'P/S Ratio' },
                { label: 'Price-to-Book (P/B)', val: fmtVal(f.pbRatio, 'x') },
                { label: 'EV / EBITDA', val: fmtVal(f.evToEbitda, 'x'), help: 'EV/EBITDA' },
                { label: 'Gross Margin', val: fmtVal(f.grossMarginPct, '%') },
                { label: 'Operating Margin', val: fmtVal(f.operatingMarginPct, '%') },
                { label: 'Net Profit Margin', val: fmtVal(f.profitMarginPct, '%') },
                { label: 'Return on Equity (ROE)', val: fmtVal(f.roePct, '%'), help: 'ROE' },
                { label: 'Debt-to-Equity', val: fmtVal(f.debtToEquity, 'x'), help: 'Debt / Equity' },
                { label: 'Total Cash & Short-Term Inv.', val: fmtVal(f.totalCashB, 'B', '$') },
                { label: 'Total Debt', val: fmtVal(f.totalDebtB, 'B', '$') },
                { label: 'Free Cash Flow (TTM)', val: fmtVal(f.freeCashFlowTTM_B, 'B', '$'), help: 'Free Cash Flow' },
                { label: 'Dividend Yield', val: fmtVal(f.dividendYieldPct, '%') },
                { label: '5-Year Beta', val: fmtVal(f.beta, '') },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-[#121721] p-3 rounded border border-[#1c2433] flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans">
                    <span>{item.label}</span>
                    {item.help && (
                      <span title={RATIO_EDUCATION[item.help]} className="cursor-help text-slate-500 hover:text-[#00E5FF]">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-white mt-1">{item.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Historical Annual & Quarterly Financial Periods Table */}
          <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-xs font-bold text-white">
                  Historical Financial Reporting Periods (Annual vs. Quarterly)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Note: Do not directly compare quarterly flow figures with full-year annual totals without accounting for period length.
                </p>
              </div>
              <div className="flex items-center gap-1 bg-[#090c10] p-0.5 rounded border border-[#1e2636]">
                {(['ALL', 'Annual', 'Quarterly'] as const).map((pf) => (
                  <button
                    key={pf}
                    onClick={() => setPeriodFilter(pf)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      periodFilter === pf
                        ? 'bg-[#00E5FF]/15 text-[#00E5FF] font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {pf}
                  </button>
                ))}
              </div>
            </div>

            {filteredPeriods.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Detailed period-by-period SEC filing tables are unavailable for this dynamically discovered symbol.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1c2433] text-slate-400 font-sans">
                      <th className="py-2 px-3">Period</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Report Date</th>
                      <th className="py-2 px-3 text-right">Revenue ($B)</th>
                      <th className="py-2 px-3 text-right">YoY Growth</th>
                      <th className="py-2 px-3 text-right">Net Income ($B)</th>
                      <th className="py-2 px-3 text-right">Diluted EPS</th>
                      <th className="py-2 px-3 text-right">Op. Margin</th>
                      <th className="py-2 px-3 text-right">Free Cash Flow ($B)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#181f2c]">
                    {filteredPeriods.map((p) => (
                      <tr key={p.period} className="hover:bg-[#141a26]">
                        <td className="py-2.5 px-3 font-bold text-white">{p.period}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-sans">{p.periodType}</td>
                        <td className="py-2.5 px-3 text-slate-400">{p.reportDate}</td>
                        <td className="py-2.5 px-3 text-right text-slate-200">
                          {fmtVal(p.revenueB, 'B', '$')}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right ${
                            (p.revenueGrowthYoY ?? 0) >= 0 ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                          }`}
                        >
                          {fmtVal(p.revenueGrowthYoY, '%')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-200">
                          {fmtVal(p.netIncomeB, 'B', '$')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-200">
                          {fmtVal(p.eps, '', '$')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {fmtVal(p.operatingMarginPct, '%')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {fmtVal(p.freeCashFlowB, 'B', '$')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Educational Ratio Guide */}
            <div className="mt-4 pt-3 border-t border-[#181f2c] grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {Object.entries(RATIO_EDUCATION).slice(0, 6).map(([title, desc]) => (
                <div key={title} className="bg-[#11161f] p-2.5 rounded border border-[#1c2433]">
                  <div className="font-semibold text-[#00E5FF] mb-0.5">{title}</div>
                  <div className="text-slate-400 text-[11px] leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TECHNICALS */}
      {subTab === 'TECHNICALS' && (
        <div className="space-y-4">
          <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181f2c] pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Validated Technical Analysis Engine · {stock.symbol} ({timeframe})
                </h3>
                <p className="text-xs text-slate-400">
                  Calculated from {technicals.observationCount} ordered historical observations. A single technical signal is never sufficient proof of future price direction.
                </p>
              </div>
              <div className="flex items-center gap-1">
                {(['1D', '1W', '1M', '3M', '6M', '1Y'] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => onTimeframeChange(tf)}
                    className={`px-2 py-1 text-xs font-mono rounded ${
                      timeframe === tf
                        ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/40'
                        : 'bg-[#121721] text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#121721] p-3.5 rounded border border-[#1c2433] space-y-1.5">
                <div className="text-slate-400">Relative Strength Index (RSI 14)</div>
                <div className="text-lg font-mono font-bold text-white">
                  {fmtVal(technicals.latestRsi14)}
                </div>
                <div className="text-[#00E5FF] font-medium">{technicals.rsiStatus}</div>
                <p className="text-[11px] text-slate-400 pt-1">
                  RSI measures the speed and magnitude of recent price changes on a 0–100 scale. Readings above 70 indicate stretched buying momentum; below 30 indicate stretched selling pressure.
                </p>
              </div>

              <div className="bg-[#121721] p-3.5 rounded border border-[#1c2433] space-y-1.5">
                <div className="text-slate-400">MACD (12, 26, 9)</div>
                <div className="text-lg font-mono font-bold text-white">
                  MACD: {fmtVal(technicals.latestMacd.macd)} · Sig: {fmtVal(technicals.latestMacd.signal)}
                </div>
                <div className="text-[#00E676] font-medium">{technicals.latestMacd.status}</div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Tracks the spread between the 12-period and 26-period EMAs against a 9-period signal EMA. Histogram: {fmtVal(technicals.latestMacd.histogram)}.
                </p>
              </div>

              <div className="bg-[#121721] p-3.5 rounded border border-[#1c2433] space-y-1.5">
                <div className="text-slate-400">Bollinger Bands (20-Period, 2σ)</div>
                <div className="text-sm font-mono font-bold text-white">
                  Upper: {fmtVal(technicals.bollinger.upper, '', '$')} · Mid: {fmtVal(technicals.bollinger.middle, '', '$')} · Lower: {fmtVal(technicals.bollinger.lower, '', '$')}
                </div>
                <div className="text-indigo-300 font-medium">
                  {technicals.bollinger.positionLabel} (%B: {fmtVal(technicals.bollinger.percentB, '%')})
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Bandwidth: {fmtVal(technicals.bollinger.bandwidthPct, '%')}. Measures price position relative to a 2-standard-deviation volatility envelope around the 20-period SMA.
                </p>
              </div>

              <div className="bg-[#121721] p-3.5 rounded border border-[#1c2433] space-y-1.5">
                <div className="text-slate-400">Moving Averages (SMA & EMA)</div>
                <div className="font-mono text-slate-200 space-y-0.5">
                  <div>SMA(20): {fmtVal(technicals.movingAverages.sma20, '', '$')} · SMA(50): {fmtVal(technicals.movingAverages.sma50, '', '$')}</div>
                  <div>EMA(50): {fmtVal(technicals.movingAverages.ema50, '', '$')} · EMA(200): {fmtVal(technicals.movingAverages.ema200, '', '$')}</div>
                </div>
                <div className="text-[#00E5FF] font-medium">
                  {technicals.movingAverages.relationshipLabel}
                </div>
              </div>

              <div className="bg-[#121721] p-3.5 rounded border border-[#1c2433] space-y-1.5">
                <div className="text-slate-400">Realized Volatility & Period Return</div>
                <div className="text-lg font-mono font-bold text-white">
                  Ann. Vol: {fmtVal(technicals.annualizedVolatilityPct, '%')}
                </div>
                <div
                  className={`font-mono font-semibold ${
                    (technicals.periodReturnPct ?? 0) >= 0 ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                  }`}
                >
                  {timeframe} Return: {fmtVal(technicals.periodReturnPct, '%')}
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Annualized standard deviation of logarithmic returns across the selected {timeframe} observation window.
                </p>
              </div>
            </div>

            {/* Triggered Signal History Log */}
            <div className="mt-5 pt-4 border-t border-[#181f2c]">
              <h4 className="text-xs font-bold text-white mb-2.5">
                Recorded Signal & Crossover Observations ({timeframe})
              </h4>
              {technicals.signals.length === 0 ? (
                <div className="text-xs text-slate-400 p-4 bg-[#121721] rounded border border-[#1c2433]">
                  No threshold crossovers recorded within the recent {timeframe} observation lookback window.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {technicals.signals.map((sig) => (
                    <div
                      key={sig.id}
                      className="p-3 rounded bg-[#121721] border border-[#1c2433] flex items-start justify-between gap-3"
                    >
                      <div>
                        <div
                          className={`text-xs font-semibold ${
                            sig.direction === 'bullish' ? 'text-[#00E676]' : 'text-[#FF4D4D]'
                          }`}
                        >
                          {sig.label}
                        </div>
                        <div className="text-[11px] text-slate-300 mt-0.5">{sig.description}</div>
                      </div>
                      <div className="text-right font-mono text-[11px] shrink-0">
                        <div className="text-white">${sig.triggerPrice.toFixed(2)}</div>
                        <div className="text-slate-400">{sig.observationDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: NEWS */}
      {subTab === 'NEWS' && (
        <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#181f2c] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                Company-Specific News & Filings · {stock.name} ({stock.symbol})
              </h3>
              <p className="text-xs text-slate-400">
                Verified headlines, publisher metadata, and direct source links
              </p>
            </div>
            <button
              onClick={() => {
                setSubTab('AI_RESEARCH');
                handleAskCompanyAi(
                  `Summarize the latest news and catalysts for ${stock.name} (${stock.symbol}), distinguishing reported facts from market interpretations.`
                );
              }}
              className="px-3 py-1.5 rounded bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-[#00E5FF] text-xs font-semibold hover:bg-[#00E5FF]/25 transition-colors"
            >
              AI News Grounding Summary →
            </button>
          </div>

          <div className="space-y-2.5">
            {stock.news.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded bg-[#121721] border border-[#1c2433] hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>
                    <strong className="text-slate-200">{item.source}</strong> · {item.topic} · Tone:{' '}
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
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white">{item.headline}</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.summary}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    Summary derived from retrieved headline & publisher abstract
                  </span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#00E5FF] hover:underline"
                  >
                    <span>Original Article</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: AI RESEARCH */}
      {subTab === 'AI_RESEARCH' && (
        <div className="bg-[#0e1218] border border-[#1c2331] rounded p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181f2c] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00E5FF]" />
                Grounded AI Company Research · {stock.name} ({stock.symbol})
              </h3>
              <p className="text-xs text-slate-400">
                Grounded in {stock.symbol}'s live quote (${stock.price.toFixed(2)}), technicals, fundamentals, and Google Search web sources.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-[#090c10] p-1 rounded border border-[#1e2636]">
              <button
                onClick={() => setAiMode('grounded')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                  aiMode === 'grounded'
                    ? 'bg-[#00E5FF]/15 text-[#00E5FF] font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Search Grounded
              </button>
              <button
                onClick={() => setAiMode('deep')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                  aiMode === 'deep'
                    ? 'bg-purple-500/20 text-purple-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                High Thinking (Pro)
              </button>
              <button
                onClick={() => setAiMode('fast')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                  aiMode === 'fast'
                    ? 'bg-[#00E676]/15 text-[#00E676] font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Fast Lite
              </button>
            </div>
          </div>

          {/* Quick Prompt Starters */}
          <div className="flex flex-wrap gap-2">
            {[
              `What is driving ${stock.symbol}'s recent price movement and momentum?`,
              `Explain ${stock.symbol}'s current RSI, MACD, and Bollinger Band signals.`,
              `Evaluate ${stock.symbol}'s valuation multiples (P/E, P/S) and cash flow health.`,
              `What are the key downside risks and uncertainties for ${stock.symbol}?`,
            ].map((q) => (
              <button
                key={q}
                onClick={() => {
                  setAiQuestion(q);
                  handleAskCompanyAi(q);
                }}
                className="px-3 py-1.5 rounded bg-[#121721] border border-[#1c2433] text-xs text-slate-300 hover:text-white hover:border-[#00E5FF]/50 transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Natural-Language Question Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskCompanyAi();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder={`Ask a research question about ${stock.name} (${stock.symbol})...`}
              className="flex-1 bg-[#090c11] border border-[#242f42] rounded px-3.5 py-2 text-xs text-white focus:border-[#00E5FF] outline-none"
            />
            <button
              type="submit"
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#00E5FF] text-slate-950 font-semibold text-xs rounded hover:bg-[#00E5FF]/90 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{aiLoading ? 'Analyzing...' : 'Run Analysis'}</span>
            </button>
          </form>

          {aiError && (
            <div className="p-3 rounded bg-[#FF4D4D]/15 border border-[#FF4D4D]/40 text-xs text-[#FF4D4D]">
              {aiError}
            </div>
          )}

          {aiResult && aiResult.symbol === stock.symbol && (
            <div className="bg-[#121721] border border-[#1c2433] rounded p-4 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-[#1c2433] pb-2">
                <span>
                  Target: <strong className="text-white">{aiResult.symbol}</strong> · Model: {aiResult.modelUsed}
                </span>
                <span>{new Date(aiResult.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                {aiResult.answer}
              </div>

              {aiResult.sources && aiResult.sources.length > 0 && (
                <div className="pt-3 border-t border-[#1c2433]">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                    Retrieved Google Search Grounding Sources:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiResult.sources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#090c11] border border-[#242f42] text-[11px] text-[#00E5FF] hover:underline"
                      >
                        <span className="truncate max-w-[220px]">{src.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
