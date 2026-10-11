import React, { useState, useEffect, useRef } from 'react';
import {
  ForecastScenarioResult,
  StockData,
  TechnicalSummary,
} from '../types/market';
import {
  Send,
  Globe,
  Brain,
  Zap,
  Image as ImageIcon,
  ExternalLink,
  BookOpen,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

interface ResearchAndChatbotViewProps {
  selectedStock: StockData;
  selectedTech: TechnicalSummary;
  selectedForecast: ForecastScenarioResult;
  allStocks: StockData[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  sources?: Array<{ uri: string; title: string }>;
  timestamp: string;
}

export const ResearchAndChatbotView: React.FC<ResearchAndChatbotViewProps> = ({
  selectedStock,
  selectedTech,
  selectedForecast,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'model',
      text: `Welcome to the **QuantPulse AI Research & Financial Education Desk**.\n\nI am currently grounded in **${selectedStock.name} (${selectedStock.symbol})** at **$${selectedStock.price.toFixed(2)}** (${selectedStock.changePercent >= 0 ? '+' : ''}${selectedStock.changePercent.toFixed(2)}%).\n\nYou can switch between three Gemini intelligence modes:\n• **Search Grounded (gemini-3.8-flash + Google Search)**: Retrieves up-to-date web news and verifiable citations.\n• **High Thinking Mode (gemini-3.1-pro-preview · ThinkingLevel.HIGH)**: Deep multi-step quantitative reasoning for complex scenario and valuation questions.\n• **Fast Concept Explainer (gemini-3.1-flash-lite)**: Instant explanations of RSI, MACD, P/E, volatility, and financial concepts.`,
      modelUsed: 'QuantPulse Desk',
      timestamp: new Date().toISOString(),
    },
  ]);

  const [input, setInput] = useState('');
  const [chatMode, setChatMode] = useState<'grounded' | 'deep' | 'fast'>('grounded');
  const [chatLoading, setChatLoading] = useState(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  // Image Generation Studio State (gemini-3-pro-image / gemini-nano-banana-2.1 with 1K, 2K, 4K selector)
  const [imgPrompt, setImgPrompt] = useState(
    `Minimalist dark institutional infographic diagram illustrating ${selectedStock.name} (${selectedStock.symbol}) revenue drivers, semiconductor/cloud ecosystem data flows, obsidian slate background with crisp cyan and emerald telemetry lines`
  );
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '4:3'>('16:9');
  const [imgLoading, setImgLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{
    imageUrl: string;
    captionText?: string;
    modelUsed: string;
    imageSize: string;
    aspectRatio: string;
  } | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);

  // Keep image prompt contextual when selected stock changes
  useEffect(() => {
    setImgPrompt(
      `Minimalist dark institutional infographic diagram illustrating ${selectedStock.name} (${selectedStock.symbol}) business model and market structure, matte obsidian background with crisp cyan and emerald vector lines`
    );
  }, [selectedStock.symbol, selectedStock.name]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (textToSend?: string) => {
    const msgText = (textToSend ?? input).trim();
    if (!msgText || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: msgText,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          mode: chatMode,
          companyContext: {
            symbol: selectedStock.symbol,
            name: selectedStock.name,
            price: selectedStock.price,
            changePercent: selectedStock.changePercent,
            quoteTimestamp: selectedStock.quoteTimestamp,
            fundamentals: selectedStock.fundamentals,
            technicals: {
              timeframe: selectedTech.timeframe,
              rsi14: selectedTech.latestRsi14,
              rsiStatus: selectedTech.rsiStatus,
              macd: selectedTech.latestMacd,
              movingAverages: selectedTech.movingAverages,
              bollinger: selectedTech.bollinger,
              annualizedVolatilityPct: selectedTech.annualizedVolatilityPct,
            },
            scenario30D: {
              centralPrice: selectedForecast.projectedCentralEnd,
              upsidePrice: selectedForecast.projectedUpsideEnd,
              downsidePrice: selectedForecast.projectedDownsideEnd,
              riskClassification: selectedForecast.riskClassification,
            },
            recentNews: selectedStock.news,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat request failed.');

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'model',
        text: data.reply,
        modelUsed: data.modelUsed,
        sources: data.sources || [],
        timestamp: data.timestamp,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: `Error processing request: ${err.message || 'Check your Gemini API configuration.'}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imgPrompt.trim() || imgLoading) return;
    setImgLoading(true);
    setImgError(null);
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imgPrompt,
          imageSize,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate image.');
      setGeneratedImage(data);
    } catch (err: any) {
      setImgError(err.message || 'Image generation failed.');
    } finally {
      setImgLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Main Grid: Multi-Turn Chatbot + Visual Research Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT 7 COLUMNS: MULTI-TURN GEMINI FINANCIAL CHATBOT */}
        <div className="lg:col-span-7 bg-[#0e1218] border border-[#1c2331] rounded flex flex-col h-[600px]">
          {/* Chat Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-[#11161f] border-b border-[#1c2331]">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#00E5FF]" />
                Multi-Turn AI Financial Research Assistant
              </h2>
              <p className="text-[11px] text-slate-400">
                Active Context: <strong className="text-white font-mono">{selectedStock.symbol}</strong> (${selectedStock.price.toFixed(2)}) · Grounded in live quote, indicators & web search
              </p>
            </div>

            <div className="flex items-center gap-1 bg-[#090c10] p-1 rounded border border-[#1e2636]">
              <button
                onClick={() => setChatMode('grounded')}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors whitespace-nowrap shrink-0 ${
                  chatMode === 'grounded'
                    ? 'bg-[#00E5FF]/15 text-[#00E5FF] font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Uses Google Search Grounding for live web news & facts"
              >
                <Globe className="w-3 h-3" />
                Search Grounded
              </button>
              <button
                onClick={() => setChatMode('deep')}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors whitespace-nowrap shrink-0 ${
                  chatMode === 'deep'
                    ? 'bg-purple-500/20 text-purple-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Uses gemini-3.1-pro-preview with ThinkingLevel.HIGH"
              >
                <Brain className="w-3 h-3" />
                High Thinking
              </button>
              <button
                onClick={() => setChatMode('fast')}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors whitespace-nowrap shrink-0 ${
                  chatMode === 'fast'
                    ? 'bg-[#00E676]/15 text-[#00E676] font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Uses gemini-3.1-flash-lite for fast explanations"
              >
                <Zap className="w-3 h-3" />
                Fast Lite
              </button>
              <button
                onClick={() =>
                  setMessages([
                    {
                      id: `reset-${Date.now()}`,
                      role: 'model',
                      text: `Conversation reset. Ready to analyze **${selectedStock.name} (${selectedStock.symbol})** at **$${selectedStock.price.toFixed(2)}**.`,
                      modelUsed: 'QuantPulse Desk',
                      timestamp: new Date().toISOString(),
                    },
                  ])
                }
                className="p-1 text-slate-500 hover:text-white"
                title="Clear Thread"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Conversation Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded p-3 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-white'
                      : 'bg-[#121721] border border-[#1c2433] text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 text-[10px] font-mono text-slate-400 mb-1">
                    <span>{m.role === 'user' ? 'Analyst Query' : m.modelUsed || 'QuantPulse AI'}</span>
                    <span>
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap">{m.text}</div>

                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#1c2433]">
                      <div className="text-[10px] font-semibold text-slate-400 mb-1">
                        Verified Web Grounding Citations:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.sources.map((s, idx) => (
                          <a
                            key={idx}
                            href={s.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#090c11] border border-[#242f42] text-[10px] text-[#00E5FF] hover:underline"
                          >
                            <span className="truncate max-w-[180px]">{s.title}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="text-xs font-mono text-[#00E5FF] bg-[#121721] border border-[#1c2433] rounded p-3">
                {chatMode === 'deep'
                  ? 'Running High-Thinking Deep Analysis (gemini-3.1-pro-preview · ThinkingLevel.HIGH)...'
                  : chatMode === 'grounded'
                  ? 'Querying Google Search Grounding & verifying company metrics...'
                  : 'Generating fast financial explanation...'}
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Prompt Suggestions & Input Bar */}
          <div className="p-3 bg-[#11161f] border-t border-[#1c2331] space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                `What is driving ${selectedStock.symbol}'s recent movement?`,
                `Explain ${selectedStock.symbol}'s RSI (${selectedTech.latestRsi14?.toFixed(1) ?? 'N/A'}) and MACD.`,
                `Explain the risks of a 30D downside scenario on ${selectedStock.symbol}.`,
                `Explain how P/E ratio, EV/EBITDA, and historical volatility work.`,
              ].map((sugg) => (
                <button
                  key={sugg}
                  onClick={() => sendMessage(sugg)}
                  className="px-2.5 py-1 rounded bg-[#090c11] border border-[#242f42] text-[11px] text-slate-300 hover:text-white hover:border-[#00E5FF]/50 whitespace-nowrap shrink-0"
                >
                  {sugg}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${selectedStock.symbol}, compare stocks, or explore financial concepts...`}
                className="flex-1 bg-[#090c11] border border-[#242f42] rounded px-3 py-2 text-xs text-white focus:border-[#00E5FF] outline-none"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#00E5FF] text-slate-950 font-semibold text-xs rounded hover:bg-[#00E5FF]/90 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT 5 COLUMNS: HIGH-RESOLUTION IMAGE GENERATION STUDIO (1K / 2K / 4K) */}
        <div className="lg:col-span-5 bg-[#0e1218] border border-[#1c2331] rounded p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="border-b border-[#181f2c] pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#00E676]" />
                AI Visual Research & Infographic Studio
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate custom visual market concept diagrams and sector infographics at configurable 1K, 2K, or 4K resolution.
              </p>
            </div>

            <form onSubmit={handleGenerateImage} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Visual Research Prompt
                </label>
                <textarea
                  rows={3}
                  value={imgPrompt}
                  onChange={(e) => setImgPrompt(e.target.value)}
                  className="w-full bg-[#090c11] border border-[#242f42] rounded px-3 py-2 text-xs text-white focus:border-[#00E5FF] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Resolution (Image Size)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['1K', '2K', '4K'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setImageSize(sz)}
                        className={`py-1.5 text-xs font-mono rounded border transition-colors ${
                          imageSize === sz
                            ? 'bg-[#00E676]/15 border-[#00E676] text-[#00E676] font-bold'
                            : 'bg-[#090c11] border-[#242f42] text-slate-400 hover:text-white'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['16:9', '1:1', '4:3'] as const).map((ar) => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => setAspectRatio(ar)}
                        className={`py-1.5 text-xs font-mono rounded border transition-colors ${
                          aspectRatio === ar
                            ? 'bg-[#00E5FF]/15 border-[#00E5FF] text-[#00E5FF] font-bold'
                            : 'bg-[#090c11] border-[#242f42] text-slate-400 hover:text-white'
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={imgLoading}
                className="w-full py-2 bg-[#00E676] text-slate-950 font-semibold text-xs rounded hover:bg-[#00E676]/90 transition-colors disabled:opacity-50"
              >
                {imgLoading
                  ? `Generating ${imageSize} Visual Asset...`
                  : `Generate ${imageSize} Research Graphic`}
              </button>
            </form>

            {imgError && (
              <div className="p-2.5 rounded bg-[#FF4D4D]/15 border border-[#FF4D4D]/40 text-xs text-[#FF4D4D]">
                {imgError}
              </div>
            )}

            {/* Image Preview Slot with Resilient Fallback */}
            <div className="bg-[#090c11] border border-[#1c2433] rounded overflow-hidden">
              {generatedImage ? (
                <div>
                  <img
                    src={generatedImage.imageUrl}
                    alt="Generated QuantPulse financial visual"
                    referrerPolicy="no-referrer"
                    className="w-full h-56 object-cover"
                  />
                  <div className="px-3 py-2 text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-[#1c2433]">
                    <span>
                      Size: <strong className="text-white">{generatedImage.imageSize}</strong> · Ratio: {generatedImage.aspectRatio}
                    </span>
                    <span>{generatedImage.modelUsed}</span>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src="/src/assets/images/quantpulse_research_banner_1791728051385.jpg"
                    alt="QuantPulse Quantitative Trajectory Architecture"
                    referrerPolicy="no-referrer"
                    className="w-full h-56 object-cover opacity-90"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="px-3 py-2 text-[11px] text-slate-400 border-t border-[#1c2433] bg-[#0d1118]">
                    Default QuantPulse Quantitative Trajectory Visualization · Select 1K, 2K, or 4K above to generate custom visuals.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1 PRODUCT IDENTITY: ABOUT QUANTPULSE */}
      <div className="bg-[#0e1218] border border-[#1c2331] rounded p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-2 flex justify-center">
            <div className="w-24 h-24 rounded-md overflow-hidden border border-[#242f42] bg-[#11161f] shrink-0">
              <img
                src="/src/assets/images/quantpulse_analyst_avatar_1791728066027.jpg"
                alt="QuantPulse Institutional Emblem"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>

          <div className="md:col-span-10 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#00E5FF]" />
                <h3 className="text-sm font-bold text-white">
                  About QuantPulse — Intelligence for Every Market Move
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Founders: <strong className="text-white">Viraj Kumar</strong> &{' '}
                <strong className="text-white">Varshith Reddy</strong> (Class 9 ICSE)
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              QuantPulse was founded by <strong>Viraj Kumar</strong> and <strong>Varshith Reddy</strong>, classmates in Class 9 ICSE, with a clear mission: <em>to make stock-market information easier to explore and understand through accessible research, data-driven analysis, and AI-assisted explanations.</em>
            </p>

            <p className="text-xs text-slate-400 leading-relaxed">
              <strong>Educational & Analytical Integrity Commitment:</strong> QuantPulse is a financial research and education platform. Every technical indicator (RSI, MACD, Moving Averages, Bollinger Bands), fundamental ratio, and scenario cone is calculated transparently from historical market observations. Financial markets involve inherent uncertainty—QuantPulse explains the evidence and risks behind market signals and never promises profitable predictions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
