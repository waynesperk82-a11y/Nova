import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";

type Tab = "Dashboard" | "Intelligence" | "Markets" | "Workspace";
type AIMode = "think" | "research" | "create" | "plan";
type SymbolCode = string;
type Quote = { symbol: SymbolCode; price: string; quote_time: string | null; source: string; currency: string | null; open?: string | null; high?: string | null; low?: string | null; previous_close?: string | null; change?: string | null; percent_change?: string | null; volume?: string | null };
type Candle = { datetime: string; open: number | null; high: number | null; low: number | null; close: number; volume: number | null };
type HistoryResponse = { symbol?: string; interval?: string; data: Candle[]; source?: string; fetched_at?: string };
type MarketResponse = { data: Quote[]; status: string; fetched_at: string; errors?: string[] };
type ChatMessage = { role: "user" | "assistant"; content: string };
type Task = { id: number; title: string; done: boolean };
const AI_MODES: { id: AIMode; label: string; detail: string; icon: string }[] = [
  { id: "think", label: "Think", detail: "Analyze and compare", icon: "◈" },
  { id: "research", label: "Research", detail: "Evidence and uncertainty", icon: "⌕" },
  { id: "create", label: "Create", detail: "Original ideas", icon: "✧" },
  { id: "plan", label: "Plan", detail: "Steps and milestones", icon: "▤" },
];

const API_BASE = process.env.EXPO_PUBLIC_NOVA_API_URL?.replace(/\/$/, "");
const DEFAULT_SYMBOLS: SymbolCode[] = ["EUR/USD", "GBP/USD", "XAU/USD", "BTC/USD", "ETH/USD"];
const MARKET_INTERVALS = ["1day", "4h", "1h", "15min"] as const;
type MarketInterval = typeof MARKET_INTERVALS[number];
const C = { bg: "#080B14", panel: "#111827", panel2: "#19243A", line: "#293650", text: "#F4F6FF", muted: "#9AA8C2", cyan: "#72A7FF", purple: "#A78BFA", green: "#72D6B0", red: "#F18D91" };

function timeLabel(value?: string | null) {
  if (!value) return "Provider timestamp unavailable";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}
function Button({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && { opacity: 0.5 }]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}
function Panel({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}
function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={styles.heading}><Text style={styles.pageTitle}>{title}</Text>{subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}</View>;
}


function MarketPriceChart({ data }: { data: Candle[] }) {
  const [width, setWidth] = useState(340);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, Math.min(47, data.length - 1)));
  const [chartType, setChartType] = useState<"candles" | "line" | "area">("candles");
  const [showMA, setShowMA] = useState(true);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });
  useEffect(() => setSelectedIndex(Math.max(0, Math.min(47, data.length - 1))), [data]);
  const points = data.slice(-80);
  const selected = points[Math.max(0, Math.min(points.length - 1, selectedIndex))];
  const height = 242, left = 64, right = 12, top = 12, priceBottom = 158, volumeTop = 174, volumeBottom = 207;
  const plotWidth = Math.max(100, width - left - right);
  const lows = points.map(p => p.low ?? p.close).filter(Number.isFinite);
  const highs = points.map(p => p.high ?? p.close).filter(Number.isFinite);
  const min = lows.length ? Math.min(...lows) : 0;
  const max = highs.length ? Math.max(...highs) : 1;
  const pad = (max - min || Math.abs(max) * 0.01 || 1) * 0.06;
  const floor = min - pad, ceiling = max + pad, span = ceiling - floor || 1;
  const y = (v: number) => top + ((ceiling - v) / span) * (priceBottom - top);
  const step = plotWidth / Math.max(points.length, 1);
  const candleWidth = Math.max(2, Math.min(9, step * 0.62));
  const volumes = points.map(p => p.volume ?? 0);
  const maxVolume = Math.max(...volumes, 1);
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: v >= 100 ? 2 : 5 });
  const choosePoint = (event: any) => {
    if (!points.length) return;
    const localX = Math.max(0, Math.min(plotWidth - 1, event.nativeEvent.locationX - left));
    setSelectedIndex(Math.min(points.length - 1, Math.floor(localX / step)));
  };
  const dateLabel = (value: string) => {
    const parsed = new Date(value.replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const closes = points.map(p => p.close);
  const sma20 = closes.map((_, i) => i < 19 ? null : closes.slice(i - 19, i + 1).reduce((a,b) => a+b, 0) / 20);
  const linePath = closes.map((v,i) => (i ? "L" : "M") + (left + step * (i + .5)).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const areaPath = linePath + " L " + (left + step * (points.length - .5)).toFixed(1) + " " + priceBottom + " L " + (left + step * .5).toFixed(1) + " " + priceBottom + " Z";
  const maPath = sma20.map((v,i) => v == null ? "" : (i && sma20[i-1] != null ? "L" : "M") + (left + step * (i + .5)).toFixed(1) + " " + y(v).toFixed(1)).filter(Boolean).join(" ");
  const changes = closes.slice(1).map((v,i) => v - closes[i]);
  const rsiValues = changes.map((_,i) => {
    if (i < 13) return null;
    const window = changes.slice(i-13,i+1), gains = window.filter(v=>v>0).reduce((a,b)=>a+b,0)/14, losses = -window.filter(v=>v<0).reduce((a,b)=>a+b,0)/14;
    return losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
  });
  const ema = (values:number[], period:number) => {
    const k=2/(period+1); let current=values[0] ?? 0;
    return values.map((v,i)=>{ current = i===0 ? v : v*k+current*(1-k); return current; });
  };
  const macdFast=ema(closes,12), macdSlow=ema(closes,26), macdValues=macdFast.map((v,i)=>v-macdSlow[i]), macdSignal=ema(macdValues,9);
  if (!points.length) return <View style={styles.chartEmpty}><Text style={styles.muted}>No verified chart history is available.</Text></View>;
  const active = points[Math.max(0, Math.min(points.length - 1, selectedIndex))];
  const toggle = (active:boolean) => active ? styles.chartToolActive : styles.chartTool;
  return <View style={{ gap: 9 }}>
    <View style={styles.chartToolbar}>
      {(["candles","line","area"] as const).map(type=><TouchableOpacity key={type} onPress={()=>setChartType(type)} style={[styles.chartTypeChip,chartType===type&&styles.chartTypeChipActive]}><Text style={[styles.chartTypeText,chartType===type&&styles.chartTypeTextActive]}>{type==="candles"?"CANDLES":type.toUpperCase()}</Text></TouchableOpacity>)}
    </View>
    <View style={styles.chartToolbar}>
      <TouchableOpacity onPress={()=>setShowMA(v=>!v)} style={toggle(showMA)}><Text style={styles.chartToolText}>MA 20 {showMA?"ON":"OFF"}</Text></TouchableOpacity>
      <TouchableOpacity onPress={()=>setShowRSI(v=>!v)} style={toggle(showRSI)}><Text style={styles.chartToolText}>RSI {showRSI?"ON":"OFF"}</Text></TouchableOpacity>
      <TouchableOpacity onPress={()=>setShowMACD(v=>!v)} style={toggle(showMACD)}><Text style={styles.chartToolText}>MACD {showMACD?"ON":"OFF"}</Text></TouchableOpacity>
    </View>
    <View
      onLayout={event => setWidth(Math.max(280, event.nativeEvent.layout.width))}
      onTouchStart={event => { touchStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }; choosePoint(event); }}
      onMoveShouldSetResponder={event => Math.abs(event.nativeEvent.pageX - touchStart.current.x) > Math.abs(event.nativeEvent.pageY - touchStart.current.y) * 1.2}
      onResponderGrant={choosePoint}
      onResponderMove={choosePoint}
      style={{ height, width: "100%" }}
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0,1,2,3].map(i=>{const yy=top+(priceBottom-top)*i/3, value=ceiling-span*i/3;return <React.Fragment key={i}><Line x1={left} y1={yy} x2={width-right} y2={yy} stroke="#293650" strokeWidth={1} strokeDasharray="3 4"/><SvgText x={left-7} y={yy+4} fill="#9AA8C2" fontSize={9} textAnchor="end">{fmt(value)}</SvgText></React.Fragment>;})}
        {chartType==="area"?<Path d={areaPath} fill="#4D9BEA" opacity={0.16}/>:null}
        {chartType==="line"||chartType==="area"?<Path d={linePath} fill="none" stroke="#55D6C2" strokeWidth={2.2}/>:null}
        {chartType==="candles"?points.map((point,i)=>{const x=left+step*(i+.5), open=point.open??point.close, close=point.close, high=point.high??Math.max(open,close), low=point.low??Math.min(open,close), rising=close>=open, color=rising?"#72D6B0":"#F18D91", bodyTop=Math.min(y(open),y(close)), bodyHeight=Math.max(2,Math.abs(y(open)-y(close))), volumeHeight=(point.volume??0)/maxVolume*(volumeBottom-volumeTop);return <React.Fragment key={point.datetime+i}><Line x1={x} y1={y(high)} x2={x} y2={y(low)} stroke={color} strokeWidth={1.2}/><Rect x={x-candleWidth/2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} rx={0.7}/>{volumeHeight>0?<Rect x={x-candleWidth/2} y={volumeBottom-volumeHeight} width={candleWidth} height={volumeHeight} fill={color} opacity={.55}/>:null}</React.Fragment>; }):null}
        {chartType!=="candles"?points.map((point,i)=>{const volumeHeight=(point.volume??0)/maxVolume*(volumeBottom-volumeTop);return volumeHeight>0?<Rect key={point.datetime+i} x={left+step*(i+.5)-candleWidth/2} y={volumeBottom-volumeHeight} width={candleWidth} height={volumeHeight} fill="#557A9D" opacity={.55}/>:null;}):null}
        {showMA&&sma20.length>19?<Path d={maPath} fill="none" stroke="#F2C66D" strokeWidth={1.5}/>:null}
        {selected?<Line x1={left+step*(selectedIndex+.5)} y1={top} x2={left+step*(selectedIndex+.5)} y2={volumeBottom} stroke="#AFCBFF" strokeWidth={1} strokeDasharray="3 3"/>:null}
        <Line x1={left} y1={priceBottom} x2={width-right} y2={priceBottom} stroke="#293650" strokeWidth={1}/>
        <SvgText x={left} y={height-8} fill="#9AA8C2" fontSize={9}>{dateLabel(points[0].datetime)}</SvgText>
        <SvgText x={width-right} y={height-8} fill="#9AA8C2" fontSize={9} textAnchor="end">{dateLabel(points[points.length-1].datetime)}</SvgText>
        <SvgText x={left} y={volumeTop-5} fill="#9AA8C2" fontSize={8}>VOLUME</SvgText>
        {selected?<Circle cx={left+step*(selectedIndex+.5)} cy={y(selected.close)} r={3.5} fill="#AFCBFF" stroke="#080B14" strokeWidth={1.5}/>:null}
      </Svg>
    </View>
    {showRSI?<View style={styles.indicatorPanel}><View style={styles.rowBetween}><Text style={styles.indicatorTitle}>RSI · 14</Text><Text style={styles.mutedSmall}>{rsiValues[selectedIndex-1]==null?"—":rsiValues[selectedIndex-1]!.toFixed(1)}</Text></View><Svg width="100%" height={76} viewBox={`0 0 ${width} 76`}><Line x1={left} y1={15} x2={width-right} y2={15} stroke="#6B7890" strokeDasharray="3 3"/><Line x1={left} y1={61} x2={width-right} y2={61} stroke="#6B7890" strokeDasharray="3 3"/><Path d={rsiValues.map((v,i)=>v==null?"":(i&&rsiValues[i-1]!=null?"L":"M")+(left+step*(i+1.5)).toFixed(1)+" "+(68-(v/100)*58).toFixed(1)).filter(Boolean).join(" ")} fill="none" stroke="#B99BFF" strokeWidth={1.8}/><SvgText x={left-6} y={18} fill="#9AA8C2" fontSize={8} textAnchor="end">70</SvgText><SvgText x={left-6} y={64} fill="#9AA8C2" fontSize={8} textAnchor="end">30</SvgText></Svg></View>:null}
    {showMACD?<View style={styles.indicatorPanel}><View style={styles.rowBetween}><Text style={styles.indicatorTitle}>MACD · 12 / 26 / 9</Text><Text style={styles.mutedSmall}>{(macdValues[selectedIndex]??0).toFixed(4)}</Text></View><Svg width="100%" height={76} viewBox={`0 0 ${width} 76`}><Line x1={left} y1={38} x2={width-right} y2={38} stroke="#6B7890" strokeDasharray="3 3"/><Path d={macdValues.map((v,i)=>(i?"L":"M")+(left+step*(i+.5)).toFixed(1)+" "+(38-v/(Math.max(...macdValues.map(Math.abs),.00001))*28).toFixed(1)).join(" ")} fill="none" stroke="#55D6C2" strokeWidth={1.6}/><Path d={macdSignal.map((v,i)=>(i?"L":"M")+(left+step*(i+.5)).toFixed(1)+" "+(38-v/(Math.max(...macdValues.map(Math.abs),.00001))*28).toFixed(1)).join(" ")} fill="none" stroke="#F2C66D" strokeWidth={1.4}/></Svg></View>:null}
    {active?<View style={styles.candleInfo}><Text style={styles.candleDate}>{active.datetime}</Text><View style={styles.candleValues}><Text style={styles.candleValue}>O {active.open==null?"—":fmt(active.open)}</Text><Text style={styles.candleValue}>H {active.high==null?"—":fmt(active.high)}</Text><Text style={styles.candleValue}>L {active.low==null?"—":fmt(active.low)}</Text><Text style={styles.candleValue}>C {fmt(active.close)}</Text></View></View>:null}
    <View style={styles.chartLegend}><Text style={styles.legendText}>● Price</Text>{showMA?<Text style={styles.legendMA}>━ MA 20</Text>:null}<Text style={styles.legendVolume}>▥ Volume</Text></View>
    <Text style={styles.mutedSmall}>Drag across the chart to inspect data points. Indicators are calculated from the displayed provider history and are educational analysis tools.</Text>
  </View>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [watchlist, setWatchlist] = useState<SymbolCode[]>(DEFAULT_SYMBOLS);
  const [newSymbol, setNewSymbol] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolCode>("BTC/USD");
  const [marketInterval, setMarketInterval] = useState<MarketInterval>("1day");
  const [history, setHistory] = useState<Candle[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyRequestId = useRef(0);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketFetched, setMarketFetched] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiMode, setAiMode] = useState<AIMode>("think");
  const [prompt, setPrompt] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [coreStatus, setCoreStatus] = useState<{status?: string; configured?: boolean; provider?: string; model?: string; chat_modes?: string[] } | null>(null);
  const [coreStatusError, setCoreStatusError] = useState<string | null>(null);
  const [coreStatusLoading, setCoreStatusLoading] = useState(true);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, title: "Connect and verify the NOVA backend", done: false },
    { id: 2, title: "Review the project roadmap", done: false },
  ]);
  const [newTask, setNewTask] = useState("");

  const refreshMarkets = useCallback(async () => {
    if (!API_BASE) { setMarketError("Backend URL is not configured. Set EXPO_PUBLIC_NOVA_API_URL in the Expo environment."); setQuotes([]); return; }
    setMarketLoading(true); setMarketError(null);
    try {
      const response = await fetch(`${API_BASE}/api/markets?symbols=${encodeURIComponent(watchlist.join(","))}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || `Market API returned HTTP ${response.status}`);
      const result = body as MarketResponse;
      if (!Array.isArray(result.data) || result.data.length === 0) throw new Error("No verified provider quotes were returned.");
      setQuotes(result.data); setMarketFetched(result.fetched_at || new Date().toISOString());
      if (result.status === "partial") setMarketError((result.errors || []).join(" · ") || "Some symbols were unavailable.");
    } catch (e) { setQuotes([]); setMarketError(e instanceof Error ? e.message : "Could not connect to the market-data service."); }
    finally { setMarketLoading(false); }
  }, [watchlist]);

  const refreshHistory = useCallback(async (symbol: string, interval: MarketInterval) => {
    const requestId = ++historyRequestId.current;
    if (!API_BASE) { setHistoryError("Backend URL is not configured."); setHistory([]); return; }
    setHistoryLoading(true); setHistoryError(null);
    try {
      const response = await fetch(`${API_BASE}/api/markets/history?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || `Chart API returned HTTP ${response.status}`);
      const result = body as HistoryResponse;
      if (!Array.isArray(result.data) || result.data.length < 2) throw new Error("Not enough verified history is available for this chart.");
      if (requestId === historyRequestId.current) setHistory(result.data);
    } catch (e) {
      if (requestId === historyRequestId.current) { setHistory([]); setHistoryError(e instanceof Error ? e.message : "Could not load price history."); }
    } finally { if (requestId === historyRequestId.current) setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    if (!API_BASE) { setCoreStatusError("Backend URL is not configured."); setCoreStatusLoading(false); return; }
    let active = true;
    fetch(`${API_BASE}/api/core/status`)
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail || "Could not read NOVA core status.");
        if (active) { setCoreStatus(body); setCoreStatusError(null); setCoreStatusLoading(false); }
      })
      .catch(error => { if (active) { setCoreStatusError(error instanceof Error ? error.message : "NOVA core status unavailable."); setCoreStatusLoading(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => { refreshMarkets(); }, [refreshMarkets]);
  useEffect(() => { refreshHistory(selectedSymbol, marketInterval); }, [refreshHistory, selectedSymbol, marketInterval]);

  const quoteFor = (symbol: SymbolCode) => quotes.find(q => q.symbol === symbol);
  const addMarketSymbol = (raw: string) => {
    const symbol = raw.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9]{1,12}(\/[A-Z0-9]{1,12})?$/.test(symbol) || watchlist.includes(symbol) || watchlist.length >= 20) return;
    setWatchlist(current => [...current, symbol]);
    setSelectedSymbol(symbol);
    setNewSymbol("");
  };
  const completedTasks = useMemo(() => tasks.filter(t => t.done).length, [tasks]);

  const sendMessage = async () => {
    const text = prompt.trim();
    if (!text || chatLoading) return;
    if (!API_BASE) { setChatError("NOVA backend is not connected. Configure EXPO_PUBLIC_NOVA_API_URL."); return; }
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next); setPrompt(""); setChatLoading(true); setChatError(null);
    try {
      const response = await fetch(`${API_BASE}/api/core/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: next.slice(-10, -1), mode: aiMode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || `AI service returned HTTP ${response.status}`);
      if (typeof body.reply !== "string" || !body.reply.trim()) throw new Error("The AI service returned an empty response.");
      setMessages(current => [...current, { role: "assistant", content: body.reply }]);
    } catch (e) { setChatError(e instanceof Error ? e.message : "NOVA could not complete the request."); }
    finally { setChatLoading(false); }
  };

  const addTask = () => {
    const title = newTask.trim(); if (!title) return;
    setTasks(current => [...current, { id: Date.now(), title, done: false }]); setNewTask("");
  };

  const renderHome = () => <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>N</Text></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.brand}>NOVA <Text style={styles.cyan}>2.1</Text></Text>
        <Text style={styles.muted}>PERSONAL INTELLIGENCE WORKSPACE</Text>
      </View>
      <View style={[styles.livePill, { borderColor: coreStatus?.configured ? "#285747" : "#73533A" }]}>
        <View style={[styles.dot, { backgroundColor: coreStatus?.configured ? C.green : "#E8B36B" }]} />
        <Text style={[styles.liveText, { color: coreStatus?.configured ? C.green : "#E8B36B" }]}>{coreStatusLoading ? "CHECKING" : coreStatus?.configured ? "CORE READY" : "CORE SETUP"}</Text>
      </View>
    </View>
    <View style={styles.welcome}>
      <Text style={styles.eyebrow}>YOUR PERSONAL INTELLIGENCE HUB</Text>
      <Text style={[styles.welcomeTitle, { fontSize: 29, lineHeight: 35 }]}>Think clearly.{"\n"}Build boldly.</Text>
      <Text style={styles.muted}>Reason through questions, develop ideas, organize projects and explore live market data in one focused workspace.</Text>
      <Button label="OPEN NOVA INTELLIGENCE  ↗" onPress={() => setTab("Intelligence")} />
      <View style={styles.heroFoot}><Text style={styles.mutedSmall}>THINK · RESEARCH · CREATE · PLAN</Text><Text style={styles.mutedSmall}>NOVA 2.1</Text></View>
    </View>
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>LIVE SERVICE OVERVIEW</Text><Text style={styles.mutedSmall}>VERIFIED STATUS</Text></View>
    <View style={styles.metrics}>
      <Panel style={styles.metric}>
        <View style={styles.rowBetween}><Text style={styles.metricLabel}>NOVA CORE</Text><Text style={styles.quickIcon}>✳</Text></View>
        <Text style={[styles.metricValue, { color: coreStatus?.configured ? C.green : "#E8B36B", fontSize: 16 }]}>{coreStatusLoading ? "CHECKING" : coreStatus?.configured ? "CONFIGURED" : "SETUP NEEDED"}</Text>
        <Text style={styles.metricFoot}>{coreStatus?.model ? "Model · " + coreStatus.model : coreStatusError || "AI service status"}</Text>
      </Panel>
      <Panel style={styles.metric}>
        <View style={styles.rowBetween}><Text style={styles.metricLabel}>MARKET DATA</Text><Text style={styles.quickIcon}>⌁</Text></View>
        <Text style={[styles.metricValue, { color: quotes.length ? C.green : C.muted, fontSize: 16 }]}>{quotes.length ? "CONNECTED" : "CHECK FEED"}</Text>
        <Text style={styles.metricFoot}>{quotes.length + " verified quotes loaded"}</Text>
      </Panel>
    </View>
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>YOUR NOVA WORKSPACE</Text><Text style={styles.mutedSmall}>OPEN A MODULE</Text></View>
    <TouchableOpacity style={styles.featureCard} onPress={() => setTab("Intelligence")}>
      <View style={styles.featureIcon}><Text style={styles.quickIcon}>✳</Text></View>
      <View style={{ flex: 1, gap: 4 }}><Text style={styles.quickTitle}>Intelligence</Text><Text style={styles.mutedSmall}>Ask questions, explore ideas and work through complex problems using your connected AI service.</Text></View>
      <Text style={styles.cyan}>↗</Text>
    </TouchableOpacity>
    <View style={styles.quickGrid}>
      <TouchableOpacity style={styles.quickCard} onPress={() => setTab("Markets")}><Text style={styles.quickIcon}>⌁</Text><Text style={styles.quickTitle}>Markets</Text><Text style={styles.mutedSmall}>Quotes and charts</Text></TouchableOpacity>
      <TouchableOpacity style={styles.quickCard} onPress={() => setTab("Workspace")}><Text style={styles.quickIcon}>▤</Text><Text style={styles.quickTitle}>Workspace</Text><Text style={styles.mutedSmall}>Tasks and projects</Text></TouchableOpacity>
      <TouchableOpacity style={styles.quickCard} onPress={() => setTab("Intelligence")}><Text style={styles.quickIcon}>◎</Text><Text style={styles.quickTitle}>Create</Text><Text style={styles.mutedSmall}>Develop new ideas</Text></TouchableOpacity>
    </View>
    <Panel>
      <View style={styles.rowBetween}><Text style={styles.panelTitle}>Your next step</Text><Text style={styles.statusTag}>WORKSPACE</Text></View>
      <Text style={styles.body}>{tasks.find(t => !t.done)?.title || "All current tasks are complete. Add a new milestone in Workspace."}</Text>
      <Button label="CONTINUE IN WORKSPACE  →" onPress={() => setTab("Workspace")} secondary />
    </Panel>
    <Panel><Text style={styles.panelTitle}>Built around clarity and control</Text><Text style={styles.body}>NOVA shows provider-backed market data, keeps AI responses advisory, and leaves important decisions in your hands.</Text></Panel>
  </ScrollView>;

  const renderIntelligence = () => <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.chatHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>NOVA 2.1 · PERSONAL INTELLIGENCE</Text>
          <Text style={styles.pageTitle}>Intelligence</Text>
          <Text style={styles.muted}>A focused space to think, learn, create and plan.</Text>
        </View>
        <TouchableOpacity onPress={() => { setMessages([]); setChatError(null); }} disabled={messages.length === 0 || chatLoading} style={[styles.clearButton, (messages.length === 0 || chatLoading) && { opacity: 0.35 }]}><Text style={styles.clearButtonText}>NEW CHAT</Text></TouchableOpacity>
      </View>
      <View style={styles.aiStatusBar}>
        <View style={[styles.dot, { backgroundColor: coreStatus?.configured ? C.green : "#E8B36B" }]} />
        <Text style={styles.aiStatusText}>{coreStatus?.configured ? "AI CORE CONNECTED" : coreStatusLoading ? "CHECKING AI CORE" : "AI CORE NEEDS SETUP"}</Text>
        <Text style={styles.aiModelText}>{coreStatus?.model || "Model not confirmed"}</Text>
      </View>
      <Text style={styles.sectionTitle}>CHOOSE YOUR APPROACH</Text>
      <View style={styles.modeWrap}>{AI_MODES.map(item => <TouchableOpacity key={item.id} onPress={() => setAiMode(item.id)} style={[styles.modeChip, aiMode === item.id && styles.modeChipActive]}><Text style={[styles.modeIcon, aiMode === item.id && styles.modeTextActive]}>{item.icon}</Text><Text style={[styles.modeLabel, aiMode === item.id && styles.modeTextActive]}>{item.label}</Text><Text style={styles.modeDetail}>{item.detail}</Text></TouchableOpacity>)}</View>
      <Panel style={styles.aiModePanel}>
        <Text style={styles.eyebrow}>{aiMode.toUpperCase()} MODE ACTIVE</Text>
        <Text style={styles.panelTitle}>{aiMode === "think" ? "Reason through the hard parts." : aiMode === "research" ? "Separate facts from uncertainty." : aiMode === "create" ? "Turn ideas into original work." : "Turn goals into clear steps."}</Text>
        <Text style={styles.body}>{aiMode === "think" ? "Compare options, test assumptions and get a clear rationale." : aiMode === "research" ? "Organize what is known, what is uncertain and what needs verification. Live web research is not enabled in this chat." : aiMode === "create" ? "Generate concepts, drafts and alternatives that follow your direction." : "Build ordered steps, milestones and priorities for your project."}</Text>
      </Panel>
      {messages.length === 0 ? <View style={styles.aiWelcome}>
        <View style={styles.aiOrb}><Text style={styles.aiOrbText}>N</Text></View>
        <Text style={styles.panelTitle}>What are we working on?</Text>
        <Text style={[styles.muted, { textAlign: "center" }]}>Start with a question or choose a prompt to give NOVA direction.</Text>
        <View style={styles.promptGrid}>
          <TouchableOpacity style={styles.promptCard} onPress={() => setPrompt("Help me break down a difficult problem and compare possible solutions.")}><Text style={styles.quickIcon}>◈</Text><Text style={styles.quickTitle}>Solve a problem</Text><Text style={styles.mutedSmall}>Analyze options and trade-offs</Text></TouchableOpacity>
          <TouchableOpacity style={styles.promptCard} onPress={() => setPrompt("Help me learn a new topic with a clear explanation and examples.")}><Text style={styles.quickIcon}>⌕</Text><Text style={styles.quickTitle}>Learn something</Text><Text style={styles.mutedSmall}>Build understanding step by step</Text></TouchableOpacity>
          <TouchableOpacity style={styles.promptCard} onPress={() => setPrompt("Help me develop an original idea into a practical project.")}><Text style={styles.quickIcon}>✧</Text><Text style={styles.quickTitle}>Create an idea</Text><Text style={styles.mutedSmall}>Explore original directions</Text></TouchableOpacity>
          <TouchableOpacity style={styles.promptCard} onPress={() => setPrompt("Turn my goal into a realistic plan with milestones and next actions.")}><Text style={styles.quickIcon}>▤</Text><Text style={styles.quickTitle}>Make a plan</Text><Text style={styles.mutedSmall}>Set priorities and milestones</Text></TouchableOpacity>
        </View>
      </View> : <View style={styles.conversation}>
        {messages.map((m, i) => <View key={i} style={[styles.message, m.role === "user" ? styles.userMessage : styles.aiMessage]}>
          <View style={styles.rowBetween}><Text style={styles.messageRole}>{m.role === "user" ? "YOU" : "NOVA"}</Text><Text style={styles.mutedSmall}>{m.role === "assistant" ? aiMode.toUpperCase() : ""}</Text></View>
          <Text style={styles.body}>{m.content}</Text>
        </View>)}
      </View>}
      {chatLoading ? <Panel><ActivityIndicator color={C.cyan} /><Text style={[styles.muted, { textAlign: "center", marginTop: 8 }]}>NOVA is working through your request…</Text></Panel> : null}
      {chatError ? <Text style={styles.error}>{chatError}</Text> : null}
      <Text style={styles.mutedSmall}>NOVA uses the configured AI model and recent conversation turns. Research mode does not browse the live web yet.</Text>
    </ScrollView>
    <View style={styles.composer}>
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="Message NOVA…" placeholderTextColor={C.muted} multiline style={styles.composerInput} />
      <TouchableOpacity onPress={sendMessage} disabled={!prompt.trim() || chatLoading} style={[styles.sendButton, (!prompt.trim() || chatLoading) && { opacity: 0.45 }]}><Text style={styles.sendText}>↑</Text></TouchableOpacity>
    </View>
  </KeyboardAvoidingView>;

  const renderMarkets = () => {
    const selectedQuote = quoteFor(selectedSymbol);
    const values = history.map(point => point.close).filter(value => Number.isFinite(value) && value > 0);
    const first = values[0], last = values[values.length - 1];
    const chartChange = values.length > 1 ? ((last - first) / first) * 100 : 0, chartPositive = chartChange >= 0;
    return <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.marketHero}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>NOVA MARKET INTELLIGENCE</Text><Text style={styles.pageTitle}>Markets</Text><Text style={styles.muted}>Your customizable forex, crypto, stock and commodity watchlist.</Text></View><View style={styles.marketLive}><View style={styles.dot} /><Text style={styles.liveText}>DATA FEED</Text></View></View>
      <Panel><View style={styles.rowBetween}><View><Text style={styles.panelTitle}>Market data connection</Text><Text style={styles.mutedSmall}>Twelve Data · read-only</Text></View><Text style={[styles.statusTag, { color: quotes.length ? C.green : C.red }]}>{quotes.length ? "● CONNECTED" : "● UNAVAILABLE"}</Text></View><Text style={styles.body}>{marketError || "Prices are provider-supplied. Provider timestamps are shown with each quote."}</Text><View style={styles.rowBetween}><Text style={styles.mutedSmall}>Retrieved: {timeLabel(marketFetched)}</Text><Button label={marketLoading ? "UPDATING…" : "↻ REFRESH"} onPress={refreshMarkets} disabled={marketLoading} secondary /></View></Panel>
      <View style={styles.addMarketPanel}><Text style={styles.panelTitle}>Customize watchlist</Text><Text style={styles.mutedSmall}>Add BTC/USD, ETH/USD, SOL/USD, AAPL, USD/JPY or another provider-supported symbol.</Text><View style={styles.addTaskRow}><TextInput value={newSymbol} onChangeText={setNewSymbol} placeholder="Enter symbol…" placeholderTextColor={C.muted} autoCapitalize="characters" style={styles.taskInput} onSubmitEditing={() => addMarketSymbol(newSymbol)} returnKeyType="done" /><TouchableOpacity style={styles.addButton} onPress={() => addMarketSymbol(newSymbol)}><Text style={styles.addText}>+</Text></TouchableOpacity></View><View style={styles.quickAssets}>{["BTC/USD","ETH/USD","SOL/USD","AAPL","USD/JPY"].map(symbol => <TouchableOpacity key={symbol} style={styles.assetChip} onPress={() => addMarketSymbol(symbol)}><Text style={styles.assetChipText}>+ {symbol}</Text></TouchableOpacity>)}</View><Text style={styles.mutedSmall}>Up to 20 symbols. Provider plan determines availability.</Text></View>
      <Text style={styles.sectionTitle}>YOUR WATCHLIST · {watchlist.length} ASSETS</Text>
      {watchlist.map(symbol => { const q = quoteFor(symbol); const positive = Number(q?.percent_change ?? q?.change ?? 0) >= 0; return <View key={symbol} style={[styles.marketAsset, selectedSymbol === symbol && styles.marketAssetSelected]}><TouchableOpacity onPress={() => setSelectedSymbol(symbol)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}><View style={styles.assetIcon}><Text style={styles.assetIconText}>{symbol.startsWith("BTC") ? "₿" : symbol.startsWith("ETH") ? "Ξ" : symbol.startsWith("XAU") ? "Au" : symbol.split("/")[0].slice(0,2)}</Text></View><View style={{ flex: 1, gap: 3 }}><Text style={styles.quoteSymbol}>{symbol}</Text><Text style={styles.mutedSmall}>{["BTC","ETH","SOL"].some(s => symbol.startsWith(s)) ? "CRYPTO" : symbol.startsWith("XAU") ? "COMMODITY" : symbol.includes("/") ? "FOREX" : "EQUITY / INDEX"}</Text></View><View style={{ alignItems: "flex-end", gap: 3 }}><Text style={styles.quotePrice}>{q ? q.price : "—"}</Text><Text style={[styles.changeText, { color: positive ? C.green : C.red }]}>{q?.percent_change ? (positive ? "+" : "") + q.percent_change + "%" : q ? "Change n/a" : "Price unavailable"}</Text></View></TouchableOpacity><TouchableOpacity onPress={() => { setWatchlist(current => current.filter(item => item !== symbol)); if (selectedSymbol === symbol) { const next = watchlist.filter(item => item !== symbol); setSelectedSymbol(next[0] || "BTC/USD"); } }} style={styles.removeAsset} accessibilityLabel={"Remove " + symbol + " from watchlist"}><Text style={styles.removeAssetText}>×</Text></TouchableOpacity></View>; })}
      <Panel style={styles.chartPanel}>
        <View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>PRICE HISTORY · OHLC</Text><Text style={styles.panelTitle}>{selectedSymbol}</Text></View><Text style={[styles.chartDelta, { color: chartPositive ? C.green : C.red }]}>{values.length > 1 ? (chartPositive ? "+" : "") + chartChange.toFixed(2) + "%" : "—"}</Text></View>
        <Text style={styles.chartPrice}>{selectedQuote?.price ?? "—"}</Text>
        <Text style={styles.mutedSmall}>{selectedQuote ? "Latest quote · " + timeLabel(selectedQuote.quote_time) : "Waiting for verified quote"}</Text>
        <View style={styles.intervalRow}>{MARKET_INTERVALS.map(interval => <TouchableOpacity key={interval} onPress={() => setMarketInterval(interval)} style={[styles.intervalChip, marketInterval === interval && styles.intervalChipActive]}><Text style={[styles.intervalText, marketInterval === interval && styles.intervalTextActive]}>{interval === "1day" ? "1D" : interval === "4h" ? "4H" : interval === "1h" ? "1H" : "15M"}</Text></TouchableOpacity>)}</View>
        {historyLoading ? <ActivityIndicator color={C.cyan} style={{ marginVertical: 30 }} /> : history.length ? <MarketPriceChart data={history} /> : <View style={styles.chartEmpty}><Text style={styles.muted}>{historyError || "No verified chart history is available."}</Text></View>}
        <View style={styles.rowBetween}><Text style={styles.mutedSmall}>{history.length ? history.length + " provider data points" : "No chart data"}</Text><Text style={styles.mutedSmall}>Source: Twelve Data</Text></View>
      </Panel>
      {selectedQuote ? <Panel><Text style={styles.panelTitle}>Quote details</Text><View style={styles.detailGrid}>{[["Open",selectedQuote.open],["High",selectedQuote.high],["Low",selectedQuote.low],["Previous close",selectedQuote.previous_close],["Change",selectedQuote.change],["Volume",selectedQuote.volume]].map(([label,value]) => <View key={label} style={styles.detailCell}><Text style={styles.mutedSmall}>{label}</Text><Text style={styles.detailValue}>{value || "—"}</Text></View>)}</View><Text style={styles.mutedSmall}>Provider time: {timeLabel(selectedQuote.quote_time)}</Text></Panel> : null}
      <Panel><Text style={styles.panelTitle}>Data integrity</Text><Text style={styles.body}>Only provider-returned prices and history are shown. Quotes may be delayed or unavailable depending on your provider plan. NOVA does not execute trades or connect to wallets.</Text></Panel>
    </ScrollView>;
  };

  const renderWorkspace = () => <ScrollView contentContainerStyle={styles.content}>
    <Heading title="Workspace" subtitle="Keep projects and next actions organized" />
    <Panel><Text style={styles.eyebrow}>TASK OVERVIEW</Text><Text style={styles.metricValue}>{completedTasks} of {tasks.length}</Text><Text style={styles.muted}>Tasks completed</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: tasks.length ? `${completedTasks / tasks.length * 100}%` : "0%" }]} /></View></Panel>
    <Text style={styles.sectionTitle}>YOUR TASKS</Text>
    {tasks.map(task => <TouchableOpacity key={task.id} onPress={() => setTasks(current => current.map(t => t.id === task.id ? { ...t, done: !t.done } : t))} style={styles.taskRow}><View style={[styles.checkCircle, task.done && styles.checked]}><Text style={styles.checkText}>{task.done ? "✓" : ""}</Text></View><Text style={[styles.taskText, task.done && styles.taskDone]}>{task.title}</Text></TouchableOpacity>)}
    <View style={styles.addTaskRow}><TextInput value={newTask} onChangeText={setNewTask} placeholder="Add a task…" placeholderTextColor={C.muted} style={styles.taskInput} onSubmitEditing={addTask} returnKeyType="done" /><TouchableOpacity style={styles.addButton} onPress={addTask}><Text style={styles.addText}>+</Text></TouchableOpacity></View>
    <Panel><Text style={styles.panelTitle}>Project space</Text><Text style={styles.body}>This first workspace stores tasks locally in the running app. Cloud sync, accounts and shared projects are not enabled yet.</Text></Panel>
  </ScrollView>;

  const screens: Record<Tab, () => React.ReactNode> = { Dashboard: renderHome, Intelligence: renderIntelligence, Markets: renderMarkets, Workspace: renderWorkspace };
  const navigate = (destination: Tab) => { setTab(destination); setNavMenuOpen(false); };
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={C.bg} /><View style={styles.topBar}><TouchableOpacity style={styles.topMenuButton} onPress={() => setNavMenuOpen(open => !open)} accessibilityLabel="Open navigation menu"><Text style={styles.menuGlyph}>{navMenuOpen ? "×" : "☰"}</Text><Text style={styles.topBrand}>NOVA<Text style={styles.cyan}>.</Text></Text></TouchableOpacity><Text style={styles.topMeta}>PERSONAL INTELLIGENCE</Text></View>{navMenuOpen ? <View style={styles.navDrawer}><View style={styles.drawerHeading}><Text style={styles.drawerTitle}>Navigate NOVA</Text><Text style={styles.mutedSmall}>YOUR WORKSPACE</Text></View>{([{name:"Dashboard" as Tab,icon:"◫",desc:"Overview and service status"},{name:"Intelligence" as Tab,icon:"✳",desc:"Think, research, create and plan"},{name:"Markets" as Tab,icon:"⌁",desc:"Quotes, watchlists and charts"},{name:"Workspace" as Tab,icon:"▤",desc:"Projects and tasks"}]).map(item => <TouchableOpacity key={item.name} onPress={() => navigate(item.name)} style={[styles.drawerItem, tab === item.name && styles.drawerItemActive]}><Text style={styles.drawerIcon}>{item.icon}</Text><View style={{flex:1,gap:2}}><Text style={[styles.drawerItemTitle,tab===item.name&&{color:C.cyan}]}>{item.name}</Text><Text style={styles.mutedSmall}>{item.desc}</Text></View><Text style={styles.drawerArrow}>›</Text></TouchableOpacity>)}</View> : null}<View style={{ flex: 1 }}>{screens[tab]()}</View><View style={styles.nav}>{(["Dashboard", "Intelligence", "Markets", "Workspace"] as Tab[]).map((item, i) => <TouchableOpacity key={item} onPress={() => navigate(item)} style={[styles.navItem, tab === item && styles.navItemActive]}><Text style={[styles.navIcon, tab === item && { color: C.cyan }]}>{["◫", "✳", "⌁", "▤"][i]}</Text><Text style={[styles.navLabel, tab === item && styles.navActive]}>{item}</Text></TouchableOpacity>)}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topBar: { height: 58, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#1B293B" },
  topMenuButton: { flexDirection: "row", alignItems: "center", gap: 10 }, menuGlyph: { color: C.cyan, fontSize: 21, fontWeight: "800", width: 25 },
  navDrawer: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, backgroundColor: "#101B2C", borderBottomWidth: 1, borderBottomColor: C.line, gap: 7 }, drawerHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, paddingBottom: 5 }, drawerTitle: { color: C.text, fontSize: 15, fontWeight: "900" }, drawerItem: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, borderColor: "transparent", padding: 10, backgroundColor: "#131F31" }, drawerItemActive: { borderColor: "#466BA8", backgroundColor: "#1A2C49" }, drawerIcon: { color: C.cyan, fontSize: 20, width: 25, textAlign: "center" }, drawerItemTitle: { color: C.text, fontSize: 12, fontWeight: "800" }, drawerArrow: { color: C.muted, fontSize: 22 }, navItemActive: { backgroundColor: "#172742", borderRadius: 12, paddingVertical: 7 },
  topBrand: { color: C.text, fontSize: 19, fontWeight: "900", letterSpacing: 2 }, topMeta: { color: C.muted, fontSize: 9, letterSpacing: 1.2, fontWeight: "700" },
  content: { padding: 18, paddingBottom: 28, gap: 14 },
  hero: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 5 },
  heroFoot: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#2D4563", paddingTop: 10, marginTop: 3 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featureCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: "#344A70", backgroundColor: "#111D30" },
  featureIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#1B2D4C", alignItems: "center", justifyContent: "center" },
  aiStatusBar: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: C.line, borderRadius: 11, backgroundColor: "#0E1928", padding: 11 },
  aiStatusText: { color: C.green, fontSize: 9, fontWeight: "900", letterSpacing: 0.7, flex: 1 },
  aiModelText: { color: C.muted, fontSize: 9 },
  aiModePanel: { backgroundColor: "#12233A", borderColor: "#36527B" },
  aiWelcome: { alignItems: "center", gap: 11, paddingVertical: 14 },
  aiOrb: { width: 58, height: 58, borderRadius: 20, backgroundColor: "#183252", borderWidth: 1, borderColor: "#4D79B6", alignItems: "center", justifyContent: "center" },
  aiOrbText: { color: "#C5DFFF", fontSize: 34, fontWeight: "900" },
  promptGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  promptCard: { width: "48%", flexGrow: 1, minHeight: 104, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, gap: 5 },
  conversation: { gap: 10 },

  brandMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#273D68", borderWidth: 1, borderColor: "#496BAA", alignItems: "center", justifyContent: "center" }, brandMarkText: { color: "#DCE8FF", fontWeight: "900", fontSize: 25 },
  brand: { color: C.text, fontSize: 18, fontWeight: "900", letterSpacing: 1.5 }, cyan: { color: C.cyan },
  livePill: { borderWidth: 1, borderColor: "#285747", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }, liveText: { color: C.green, fontSize: 8, fontWeight: "900" },
  welcome: { backgroundColor: "#151C35", borderColor: "#384A78", borderWidth: 1, borderRadius: 20, padding: 19, gap: 11, marginBottom: 3 }, eyebrow: { color: C.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 }, welcomeTitle: { color: C.text, fontSize: 25, fontWeight: "800", lineHeight: 31 },
  muted: { color: C.muted, fontSize: 12, lineHeight: 19 }, mutedSmall: { color: C.muted, fontSize: 10, lineHeight: 16 },
  button: { backgroundColor: "#426ED0", borderRadius: 11, paddingVertical: 13, paddingHorizontal: 14, alignItems: "center", marginTop: 8 }, buttonSecondary: { backgroundColor: C.panel2 }, buttonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10, letterSpacing: 0.6 },
  metrics: { flexDirection: "row", gap: 10 }, metric: { flex: 1 }, panel: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 15, padding: 15, gap: 8 }, metricLabel: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 }, metricValue: { color: C.text, fontSize: 23, fontWeight: "900" }, metricFoot: { color: C.muted, fontSize: 10 },
  sectionTitle: { color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginTop: 5 }, quickGrid: { flexDirection: "row", gap: 8 }, quickCard: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, gap: 5 }, quickIcon: { color: C.cyan, fontSize: 19 }, quickTitle: { color: C.text, fontSize: 11, fontWeight: "800" },
  panelTitle: { color: C.text, fontSize: 14, fontWeight: "800" }, body: { color: "#B2C0D1", fontSize: 12, lineHeight: 19 }, heading: { gap: 4, marginBottom: 3 }, pageTitle: { color: C.text, fontSize: 26, fontWeight: "900" },
  chatHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, clearButton: { borderWidth: 1, borderColor: C.line, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 }, clearButtonText: { color: C.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  modeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, modeChip: { flexGrow: 1, minWidth: "46%", backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10, gap: 3 }, modeChipActive: { backgroundColor: "#172747", borderColor: "#5279C4" }, modeIcon: { color: C.muted, fontSize: 16 }, modeLabel: { color: C.text, fontSize: 11, fontWeight: "900" }, modeTextActive: { color: "#AFCBFF" }, modeDetail: { color: C.muted, fontSize: 9 }, suggestionRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 7, marginTop: 5 }, suggestionChip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 8 },
  emptyChat: { alignItems: "center", paddingVertical: 28, marginTop: 12 }, emptyIcon: { color: C.cyan, fontSize: 30, marginBottom: 6 }, message: { padding: 13, borderRadius: 14, borderWidth: 1, gap: 6 }, userMessage: { backgroundColor: "#123449", borderColor: "#28617A", marginLeft: 30 }, aiMessage: { backgroundColor: C.panel, borderColor: C.line, marginRight: 18 }, messageRole: { color: C.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  composer: { flexDirection: "row", gap: 8, alignItems: "flex-end", padding: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg }, composerInput: { flex: 1, maxHeight: 110, minHeight: 45, color: C.text, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13 }, sendButton: { width: 45, height: 45, borderRadius: 13, backgroundColor: "#426ED0", alignItems: "center", justifyContent: "center" }, sendText: { color: "#FFF", fontSize: 23, fontWeight: "800" }, error: { color: C.red, fontSize: 11, lineHeight: 17 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, statusTag: { fontSize: 9, fontWeight: "900" }, quoteCard: { gap: 10 }, quoteSymbol: { color: C.text, fontSize: 16, fontWeight: "900" }, quotePrice: { color: C.cyan, fontSize: 21, fontWeight: "900" },
  marketHero: { flexDirection: "row", alignItems: "center", gap: 10 }, marketLive: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#285747", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 }, addMarketPanel: { backgroundColor: "#111D30", borderColor: "#344A70", borderWidth: 1, borderRadius: 15, padding: 15, gap: 9 }, quickAssets: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, assetChip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 }, assetChipText: { color: "#BFD2F5", fontSize: 9, fontWeight: "800" }, marketAsset: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 13, padding: 11 }, marketAssetSelected: { borderColor: "#5279C4", backgroundColor: "#14223A" }, assetIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" }, assetIconText: { color: C.cyan, fontWeight: "900", fontSize: 12 }, changeText: { fontSize: 10, fontWeight: "800" }, removeAsset: { width: 25, height: 25, alignItems: "center", justifyContent: "center" }, removeAssetText: { color: C.muted, fontSize: 20 }, chartPanel: { gap: 10 }, candleInfo: { backgroundColor: "#0D1521", borderRadius: 9, padding: 9, gap: 6 }, candleDate: { color: C.muted, fontSize: 10, fontWeight: "700" }, candleValues: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }, candleValue: { color: C.text, fontSize: 10, fontWeight: "800" }, chartDelta: { fontSize: 13, fontWeight: "900" }, chartPrice: { color: C.text, fontSize: 28, fontWeight: "900" }, intervalRow: { flexDirection: "row", gap: 7, marginTop: 4 }, intervalChip: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 9, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2 }, intervalChipActive: { borderColor: "#5279C4", backgroundColor: "#20385E" }, intervalText: { color: C.muted, fontSize: 10, fontWeight: "800" }, intervalTextActive: { color: "#D8E5FF" }, chartWrap: { height: 150, flexDirection: "row", gap: 8, paddingTop: 7 }, chartLabels: { justifyContent: "space-between", paddingBottom: 8 }, chartBars: { flex: 1, height: 130, flexDirection: "row", alignItems: "flex-end", gap: 2, borderBottomWidth: 1, borderBottomColor: C.line }, chartBar: { flex: 1, minWidth: 2, borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: 0.82 }, chartEmpty: { minHeight: 100, justifyContent: "center", alignItems: "center", padding: 15, backgroundColor: "#0D1521", borderRadius: 12 }, detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, detailCell: { width: "30%", gap: 3 }, detailValue: { color: C.text, fontSize: 12, fontWeight: "800" },
  progressTrack: { height: 6, backgroundColor: "#253348", borderRadius: 5, overflow: "hidden", marginTop: 5 }, progressFill: { height: 6, backgroundColor: C.cyan, borderRadius: 5 }, taskRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12 }, checkCircle: { width: 21, height: 21, borderRadius: 7, borderWidth: 1, borderColor: "#58708A", alignItems: "center", justifyContent: "center" }, checked: { backgroundColor: "#426ED0", borderColor: C.cyan }, checkText: { color: "#FFF", fontWeight: "900" }, taskText: { color: C.text, fontSize: 12, flex: 1 }, taskDone: { color: C.muted, textDecorationLine: "line-through" },
  addTaskRow: { flexDirection: "row", gap: 8 }, taskInput: { flex: 1, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 13, fontSize: 12 }, addButton: { width: 45, borderRadius: 12, backgroundColor: "#426ED0", alignItems: "center", justifyContent: "center" }, addText: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  nav: { height: 67, backgroundColor: "#0D1521", borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-around" }, navItem: { flex: 1, alignItems: "center", gap: 3 }, navIcon: { color: C.muted, fontSize: 19 }, navLabel: { color: C.muted, fontSize: 9, fontWeight: "700" }, navActive: { color: C.cyan },
});
