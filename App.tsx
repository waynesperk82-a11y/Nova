import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";

type Tab = "Home" | "Intelligence" | "Markets" | "Connections" | "Practice" | "Workspace" | "More";
type SymbolCode = "EUR/USD" | "GBP/USD" | "USD/JPY" | "USD/CHF" | "XAU/USD" | "XAG/USD" | "AAPL" | "MSFT" | "NVDA" | "GOOGL" | "AMZN" | "TSLA" | "BTC/USD" | "ETH/USD";
type MarketCategory = "Watchlist" | "Forex" | "Stocks" | "Crypto" | "Commodities";
type ChartRange = "1D" | "1W" | "1M" | "3M" | "1Y";
type MarketPoint = { time: string | null; close: number };
type Quote = { symbol: SymbolCode; price: string; quote_time: string | null; source: string; currency: string | null; change?: string | null; percent_change?: string | null };
type MarketResponse = { data: Quote[]; status: string; fetched_at: string; errors?: string[] };
type ChatMessage = { role: "user" | "assistant"; content: string };
type Task = { id: number; title: string; done: boolean };
type PracticeOrder = { id: number; symbol: SymbolCode; side: "BUY" | "SELL"; units: number; price: number; createdAt: string };

const API_BASE = process.env.EXPO_PUBLIC_NOVA_API_URL?.replace(/\/$/, "");
const SYMBOLS: SymbolCode[] = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "XAU/USD", "XAG/USD", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA", "BTC/USD", "ETH/USD"];
const MARKET_GROUPS: Record<MarketCategory, SymbolCode[]> = {
  Watchlist: ["EUR/USD", "GBP/USD", "XAU/USD"],
  Forex: ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF"],
  Stocks: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA"],
  Crypto: ["BTC/USD", "ETH/USD"],
  Commodities: ["XAU/USD", "XAG/USD"],
};
const MARKET_NAMES: Record<SymbolCode, string> = {
  "EUR/USD": "Euro / US Dollar", "GBP/USD": "British Pound / US Dollar",
  "USD/JPY": "US Dollar / Japanese Yen", "USD/CHF": "US Dollar / Swiss Franc",
  "XAU/USD": "Gold / US Dollar", "XAG/USD": "Silver / US Dollar",
  AAPL: "Apple", MSFT: "Microsoft", NVDA: "NVIDIA", GOOGL: "Alphabet",
  AMZN: "Amazon", TSLA: "Tesla", "BTC/USD": "Bitcoin / US Dollar", "ETH/USD": "Ethereum / US Dollar",
};
const C = { bg: "#050A12", panel: "#0C1723", panel2: "#112333", line: "#1C3545", text: "#F2FAFF", muted: "#8198A8", cyan: "#48E5D0", violet: "#A879FF", green: "#65E7B1", red: "#FF7D91", pink: "#F36CB7" };

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

export default function App() {
  const [tab, setTab] = useState<Tab>("Home");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketFetched, setMarketFetched] = useState<string | null>(null);
  const [marketFeedState, setMarketFeedState] = useState<"loading" | "live" | "partial" | "offline">("loading");
  const [watchlistSymbols, setWatchlistSymbols] = useState<SymbolCode[]>(["EUR/USD", "GBP/USD", "XAU/USD"]);
  const [marketCategory, setMarketCategory] = useState<MarketCategory>("Watchlist");
  const [marketSearch, setMarketSearch] = useState("");
  const [selectedMarketSymbol, setSelectedMarketSymbol] = useState<SymbolCode>("EUR/USD");
  const [chartRange, setChartRange] = useState<ChartRange>("1M");
  const [chartPoints, setChartPoints] = useState<MarketPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [backendState, setBackendState] = useState<"checking" | "ready" | "unhealthy" | "unknown">("checking");
  const [backendCheckedAt, setBackendCheckedAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, title: "Connect and verify the NOVA backend", done: false },
    { id: 2, title: "Review the project roadmap", done: false },
  ]);
  const [newTask, setNewTask] = useState("");
  const [practiceSymbol, setPracticeSymbol] = useState<SymbolCode>("EUR/USD");
  const [practiceSide, setPracticeSide] = useState<"BUY" | "SELL">("BUY");
  const [practiceUnits, setPracticeUnits] = useState("1000");
  const [practiceOrders, setPracticeOrders] = useState<PracticeOrder[]>([]);
  const [practiceNotice, setPracticeNotice] = useState<string | null>(null);

  const refreshMarkets = useCallback(async (requestedSymbols: SymbolCode[] = watchlistSymbols) => {
    if (!API_BASE) { setMarketError("Backend URL is not configured. Set EXPO_PUBLIC_NOVA_API_URL in the Expo environment."); setMarketFeedState("offline"); return; }
    setMarketLoading(true); setMarketError(null); setMarketFeedState("loading");
    try {
      const response = await fetch(`${API_BASE}/api/markets?symbols=${encodeURIComponent(requestedSymbols.join(","))}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || `Market API returned HTTP ${response.status}`);
      const result = body as MarketResponse;
      if (!Array.isArray(result.data) || result.data.length === 0) throw new Error("No verified provider quotes were returned.");
      setQuotes(current => [...current.filter(q => !requestedSymbols.includes(q.symbol)), ...result.data]);
      setMarketFetched(result.fetched_at || new Date().toISOString());
      setMarketFeedState(result.status === "partial" ? "partial" : "live");
      if (result.status === "partial") setMarketError((result.errors || []).join(" · ") || "Some symbols were unavailable.");
    } catch (e) { setMarketFeedState("offline"); setMarketError(e instanceof Error ? e.message : "Could not connect to the market-data service."); }
    finally { setMarketLoading(false); }
  }, [watchlistSymbols]);

  useEffect(() => { refreshMarkets(watchlistSymbols); }, [refreshMarkets, watchlistSymbols]);

  const loadMarketSeries = async (symbol: SymbolCode, range: ChartRange = chartRange) => {
    setSelectedMarketSymbol(symbol);
    setChartRange(range);
    setChartLoading(true);
    setChartError(null);
    if (!API_BASE) { setChartPoints([]); setChartError("Backend URL is not configured."); setChartLoading(false); return; }
    try {
      const response = await fetch(`${API_BASE}/api/markets/series?symbol=${encodeURIComponent(symbol)}&range=${range}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || `Chart service returned HTTP ${response.status}`);
      if (!Array.isArray(body.data) || body.data.length === 0) throw new Error("No historical prices were returned by the provider.");
      setChartPoints(body.data);
    } catch (error) {
      setChartPoints([]);
      setChartError(error instanceof Error ? error.message : "Historical market data is unavailable.");
    } finally { setChartLoading(false); }
  };

  useEffect(() => { loadMarketSeries("EUR/USD", "1M"); }, []);

  const refreshBackend = useCallback(async () => {
    if (!API_BASE) { setBackendState("unknown"); return; }
    setBackendState("checking");
    try {
      const response = await fetch(`${API_BASE}/api/core/status`, { method: "GET" });
      const body = await response.json();
      const healthy = response.ok && body && typeof body === "object" &&
        (body.status === "ready" || body.status === "healthy") && body.configured === true;
      setBackendState(healthy ? "ready" : "unhealthy");
      setBackendCheckedAt(new Date().toISOString());
    } catch {
      setBackendState("unhealthy");
      setBackendCheckedAt(new Date().toISOString());
    }
  }, []);

  useEffect(() => { refreshBackend(); }, [refreshBackend]);

  const quoteFor = (symbol: SymbolCode) => quotes.find(q => q.symbol === symbol);
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
        body: JSON.stringify({ message: text, history: next.slice(-10, -1) }),
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
    <View style={styles.dashTop}>
      <View style={styles.dashIdentity}>
        <View style={styles.dashLogo}><Image source={require("./assets/nova-icon.png")} style={styles.dashLogoImage} /></View>
        <View><Text style={styles.dashBrand}>NOVA <Text style={styles.cyan}>2.1</Text></Text><Text style={styles.dashSub}>PERSONAL INTELLIGENCE</Text></View>
      </View>
      <View style={[styles.dashStatus,{backgroundColor:backendState==="ready"?"#102A25":"#2B2028",borderColor:backendState==="ready"?"#245443":"#65404A"}]}><View style={[styles.dot,{backgroundColor:backendState==="ready"?C.green:backendState==="checking"?C.cyan:C.red}]} /><Text style={[styles.dashStatusText,{color:backendState==="ready"?C.green:backendState==="checking"?C.cyan:C.red}]}>{backendState==="ready"?"CORE ONLINE":backendState==="checking"?"CHECKING":"CORE OFFLINE"}</Text></View>
    </View>
    <View style={styles.dashGreeting}>
      <Text style={styles.dashEyebrow}>YOUR PERSONAL INTELLIGENCE HUB</Text>
      <Text style={styles.dashHeadline}>Think clearly.{ "\n" }Build boldly.</Text>
      <Text style={styles.dashIntro}>Research, ideas, markets and projects in one focused workspace.</Text>
      <TouchableOpacity style={styles.dashPrimary} onPress={() => setTab("Intelligence")}><Text style={styles.dashPrimaryText}>OPEN INTELLIGENCE</Text><Text style={styles.dashArrow}>↗</Text></TouchableOpacity>
      <View pointerEvents="none" style={styles.dashOrb}><View style={styles.dashOrbInner}><Text style={styles.dashOrbGlyph}>N</Text></View></View>
    </View>
    <View style={styles.dashSectionHead}><Text style={styles.dashSectionTitle}>LIVE SERVICE OVERVIEW</Text><Text style={styles.dashSectionMeta}>VERIFIED STATUS</Text></View>
    <View style={styles.dashStats}>
      <TouchableOpacity style={styles.dashStatCard} onPress={() => setTab("Intelligence")}>
        <View style={styles.dashStatTop}><Text style={styles.dashStatLabel}>NOVA CORE</Text><Text style={styles.dashStatIcon}>✳</Text></View>
        <Text style={[styles.dashStatValue,{fontSize:18,color:backendState==="ready"?C.green:backendState==="checking"?C.cyan:C.red}]}>{backendState==="ready"?"ONLINE":backendState==="checking"?"CHECKING":backendState==="unknown"?"NOT SET":"OFFLINE"}</Text>
        <Text style={styles.dashStatFoot}>AI backend health check</Text>
        <Text style={styles.dashStatFoot}>Verified · {timeLabel(backendCheckedAt)}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.dashStatCard} onPress={() => setTab("Markets")}>
        <View style={styles.dashStatTop}><Text style={styles.dashStatLabel}>MARKET DATA</Text><Text style={styles.dashStatIcon}>⌁</Text></View>
        <Text style={[styles.dashStatValue,{fontSize:18,color:marketFeedState==="live"?C.green:marketFeedState==="partial"?"#E8BD70":marketFeedState==="loading"?C.cyan:C.red}]}>{marketFeedState==="live"?"CONNECTED":marketFeedState==="partial"?"PARTIAL":marketFeedState==="loading"?"CHECKING":"OFFLINE"}</Text>
        <Text style={styles.dashStatFoot}>{quotes.length} provider quotes currently loaded</Text>
        <Text style={styles.dashStatFoot}>Source · Twelve Data</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.dashSectionHead}><Text style={styles.dashSectionTitle}>YOUR NOVA WORKSPACE</Text><Text style={styles.dashSectionMeta}>OPEN A MODULE</Text></View>
    <TouchableOpacity style={styles.dashFeature} onPress={() => setTab("Intelligence")}>
      <View style={styles.dashFeatureIcon}><Text style={styles.dashFeatureGlyph}>✳</Text></View>
      <View style={styles.dashFeatureCopy}><Text style={styles.dashFeatureTitle}>Intelligence</Text><Text style={styles.dashFeatureDesc}>Ask questions, develop ideas and work through complex problems using the connected AI service.</Text></View>
      <Text style={styles.dashFeatureArrow}>↗</Text>
    </TouchableOpacity>
    <View style={styles.dashToolGrid}>
      <TouchableOpacity style={styles.dashToolCard} onPress={() => setTab("Markets")}><Text style={styles.dashToolIcon}>⌁</Text><Text style={styles.dashToolTitle}>Markets</Text><Text style={styles.dashToolDesc}>Provider-backed data</Text></TouchableOpacity>
      <TouchableOpacity style={styles.dashToolCard} onPress={() => setTab("Workspace")}><Text style={styles.dashToolIcon}>▤</Text><Text style={styles.dashToolTitle}>Workspace</Text><Text style={styles.dashToolDesc}>Local project tasks</Text></TouchableOpacity>
      <TouchableOpacity style={styles.dashToolCard} onPress={() => setTab("Connections")}><Text style={styles.dashToolIcon}>⌘</Text><Text style={styles.dashToolTitle}>Connections</Text><Text style={styles.dashToolDesc}>Real service setup</Text></TouchableOpacity>
    </View>
    <View style={styles.dashToolGrid}>
      <TouchableOpacity style={styles.dashToolCard} onPress={() => setTab("Practice")}><Text style={styles.dashToolIcon}>◈</Text><Text style={styles.dashToolTitle}>Practice</Text><Text style={styles.dashToolDesc}>Local learning simulator</Text></TouchableOpacity>
      <TouchableOpacity style={styles.dashToolCard} onPress={() => setTab("More")}><Text style={styles.dashToolIcon}>⋯</Text><Text style={styles.dashToolTitle}>More tools</Text><Text style={styles.dashToolDesc}>App controls & modules</Text></TouchableOpacity>
      <TouchableOpacity style={styles.dashToolCard} onPress={refreshBackend}><Text style={styles.dashToolIcon}>↻</Text><Text style={styles.dashToolTitle}>Check core</Text><Text style={styles.dashToolDesc}>Run live health check</Text></TouchableOpacity>
    </View>
    <View style={styles.dashSectionHead}><Text style={styles.dashSectionTitle}>SYSTEM DETAILS</Text><Text style={styles.dashSectionMeta}>NO SIMULATED STATUS</Text></View>
    <View style={styles.dashSystemCard}>
      <View style={styles.dashSystemRow}><View style={styles.dashSystemIcon}><Text style={styles.dashToolIcon}>⌘</Text></View><View style={{flex:1}}><Text style={styles.dashSystemTitle}>NOVA Core API</Text><Text style={styles.dashSystemDesc}>GET /api/core/status · advisory backend</Text></View><View style={[styles.dashSystemBadge,{borderColor:backendState==="ready"?"#28664F":backendState==="checking"?"#276477":"#74404B"}]}><Text style={[styles.dashSystemBadgeText,{color:backendState==="ready"?C.green:backendState==="checking"?C.cyan:C.red}]}>{backendState==="ready"?"READY":backendState==="checking"?"CHECKING":backendState==="unknown"?"NOT SET":"UNAVAILABLE"}</Text></View></View>
      <View style={styles.dashSystemDivider} />
      <View style={styles.dashSystemRow}><View style={styles.dashSystemIcon}><Text style={styles.dashToolIcon}>⌁</Text></View><View style={{flex:1}}><Text style={styles.dashSystemTitle}>Market data · Twelve Data</Text><Text style={styles.dashSystemDesc}>Read-only provider quote service</Text></View><View style={[styles.dashSystemBadge,{borderColor:marketFeedState==="live"?"#28664F":marketFeedState==="loading"?"#276477":"#74404B"}]}><Text style={[styles.dashSystemBadgeText,{color:marketFeedState==="live"?C.green:marketFeedState==="loading"?C.cyan:C.red}]}>{marketFeedState==="live"?"CONNECTED":marketFeedState==="loading"?"CHECKING":marketFeedState.toUpperCase()}</Text></View></View>
      <View style={styles.dashSystemDivider} />
      <Text style={styles.dashSystemFoot}>Core last checked · {timeLabel(backendCheckedAt)}</Text>
      <Text style={styles.dashSystemFoot}>Market last fetched · {timeLabel(marketFetched)}</Text>
    </View>
    <Text style={styles.dashDisclaimer}>Workspace tasks and practice records are stored locally in this prototype. No broker is connected and no live orders can be placed.</Text>
  </ScrollView>;

  const renderIntelligence = () => <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
    <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10 }}>
      <Text style={{ color: C.violet, fontSize: 9, fontWeight: "900", letterSpacing: 2 }}>NOVA / THINKING ENGINE</Text>
      <Text style={{ color: C.text, fontSize: 29, fontWeight: "900", marginTop: 6 }}>Intelligence</Text>
      <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>A workspace for questions, ideas and decisions.</Text>
    </View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 5, gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={{ padding: 18, borderRadius: 22, backgroundColor: "#17172B", borderWidth: 1, borderColor: "#514078", gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#C4A9FF", fontSize: 9, fontWeight: "900", letterSpacing: 1.4 }}>NOVA INTELLIGENCE CORE</Text>
          <Text style={{ color: C.green, fontSize: 9, fontWeight: "900" }}>● READY</Text>
        </View>
        <Text style={{ color: "#F7F3FF", fontSize: 23, lineHeight: 29, fontWeight: "900" }}>What are we{ "\n" }figuring out today?</Text>
        <Text style={{ color: "#B7ABC9", fontSize: 11, lineHeight: 18 }}>Explore a difficult question, develop an idea, or turn a goal into a practical plan.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 2 }}>
          {["RESEARCH", "ANALYSE", "CREATE", "PLAN"].map(label => <View key={label} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: "#28213D", borderWidth: 1, borderColor: "#59477B" }}><Text style={{ color: "#D7C8F5", fontSize: 8, fontWeight: "900" }}>{label}</Text></View>)}
        </View>
      </View>
      {messages.length === 0 ? <View style={{ padding: 16, borderRadius: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, gap: 10 }}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: "900" }}>Start with a direction</Text>
        {["Break a big goal into milestones", "Compare two ideas objectively", "Help me research a new topic"].map((item, i) => <TouchableOpacity key={item} onPress={() => setPrompt(item)} style={{ flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, backgroundColor: "#101F2D", borderWidth: 1, borderColor: "#263D50" }}><Text style={{ color: C.violet, fontSize: 15, marginRight: 10 }}>{["✳", "⌁", "↗"][i]}</Text><Text style={{ color: "#C5D2DE", fontSize: 11, flex: 1 }}>{item}</Text><Text style={{ color: C.violet, fontSize: 17 }}>›</Text></TouchableOpacity>)}
      </View> : messages.map((m, i) => <View key={i} style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: m.role === "user" ? "#3D5479" : "#40365E", backgroundColor: m.role === "user" ? "#14243A" : "#171729", marginLeft: m.role === "user" ? 25 : 0, marginRight: m.role === "assistant" ? 15 : 0, gap: 7 }}><Text style={{ color: m.role === "user" ? C.cyan : "#C4A9FF", fontSize: 9, fontWeight: "900", letterSpacing: 1 }}>{m.role === "user" ? "YOU" : "NOVA · RESPONSE"}</Text><Text style={{ color: "#D6E1EA", fontSize: 12, lineHeight: 20 }}>{m.content}</Text></View>)}
      {chatLoading ? <View style={{ padding: 16, borderRadius: 14, backgroundColor: C.panel, alignItems: "center", gap: 8 }}><ActivityIndicator color={C.violet} /><Text style={{ color: C.muted, fontSize: 11 }}>NOVA is thinking…</Text></View> : null}
      {chatError ? <Text style={styles.error}>{chatError}</Text> : null}
    </ScrollView>
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end", padding: 12, borderTopWidth: 1, borderTopColor: "#302A48", backgroundColor: "#090D18" }}>
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="Message NOVA…" placeholderTextColor={C.muted} multiline style={{ flex: 1, maxHeight: 110, minHeight: 48, color: C.text, backgroundColor: "#111A2A", borderColor: "#393252", borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 }} />
      <TouchableOpacity onPress={sendMessage} disabled={!prompt.trim() || chatLoading} style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: "#7652B9", alignItems: "center", justifyContent: "center", opacity: !prompt.trim() || chatLoading ? 0.45 : 1 }}><Text style={{ color: "#FFF", fontSize: 23, fontWeight: "900" }}>↑</Text></TouchableOpacity>
    </View>
  </KeyboardAvoidingView>;

  const renderMarkets = () => {
    const selectedQuote = quoteFor(selectedMarketSymbol);
    const categorySymbols = marketCategory === "Watchlist" ? watchlistSymbols : MARKET_GROUPS[marketCategory];
    const visibleSymbols = categorySymbols.filter(symbol => `${symbol} ${MARKET_NAMES[symbol]}`.toLowerCase().includes(marketSearch.toLowerCase()));
    const chartValues = chartPoints.map(point => point.close).filter(value => Number.isFinite(value));
    const minValue = chartValues.length ? Math.min(...chartValues) : 0;
    const maxValue = chartValues.length ? Math.max(...chartValues) : 0;
    const chartSegments = chartPoints.slice(-24).map((point, index, points) => {
      if (index === points.length - 1 || maxValue === minValue) return null;
      const next = points[index + 1];
      const x1 = index * (280 / Math.max(points.length - 1, 1));
      const x2 = (index + 1) * (280 / Math.max(points.length - 1, 1));
      const y1 = 126 - ((point.close - minValue) / (maxValue - minValue)) * 108;
      const y2 = 126 - ((next.close - minValue) / (maxValue - minValue)) * 108;
      const dx = x2 - x1;
      const dy = y2 - y1;
      return { key: `${point.time}-${index}`, left: x1, top: (y1 + y2) / 2, width: Math.sqrt(dx * dx + dy * dy), rotate: `${Math.atan2(dy, dx) * 180 / Math.PI}deg` };
    }).filter(Boolean) as {key:string;left:number;top:number;width:number;rotate:string}[];
    const toggleWatchlist = (symbol: SymbolCode) => setWatchlistSymbols(current => current.includes(symbol) ? current.filter(item => item !== symbol) : [...current, symbol]);
    return <ScrollView contentContainerStyle={{ padding: 17, paddingBottom: 32, gap: 13 }}>
      <View style={{ marginBottom: 3 }}>
        <Text style={{ color: C.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 2 }}>NOVA / MARKET INTELLIGENCE</Text>
        <Text style={{ color: C.text, fontSize: 30, fontWeight: "900", marginTop: 5 }}>Markets</Text>
        <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Explore provider-backed instruments and historical price data.</Text>
      </View>
      <View style={{ padding: 16, borderRadius: 20, backgroundColor: "#10283A", borderWidth: 1, borderColor: "#28546C", gap: 9 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#A9D8E9", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 }}>MARKET DATA CONNECTION</Text>
          <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: "#17364A" }}><Text style={{ color: marketFeedState === "live" ? C.green : marketFeedState === "partial" ? "#E8BD70" : marketFeedState === "loading" ? C.cyan : C.red, fontSize: 9, fontWeight: "900" }}>{marketFeedState.toUpperCase()}</Text></View>
        </View>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>{quotes.length} <Text style={{ color: "#9AB9C9", fontSize: 13 }}>verified quotes loaded</Text></Text>
        <Text style={{ color: "#A7C2D2", fontSize: 10, lineHeight: 16 }}>{marketError || "Prices and history are requested from Twelve Data. Missing values are never estimated."}</Text>
        <TouchableOpacity onPress={() => refreshMarkets()} disabled={marketLoading} style={{ backgroundColor: "#176579", borderRadius: 11, padding: 12, alignItems: "center", opacity: marketLoading ? 0.6 : 1 }}><Text style={{ color: "#E7FAFF", fontSize: 9, fontWeight: "900", letterSpacing: 1 }}>{marketLoading ? "UPDATING…" : "↻  REFRESH WATCHLIST"}</Text></TouchableOpacity>
        <Text style={{ color: "#86A9B9", fontSize: 9 }}>Last received · {timeLabel(marketFetched)}</Text>
      </View>
      <View style={{ padding: 16, borderRadius: 20, backgroundColor: "#101B30", borderWidth: 1, borderColor: "#343D67", gap: 11 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View><Text style={{ color: "#B9A6FF", fontSize: 9, fontWeight: "900", letterSpacing: 1.4 }}>PRICE HISTORY</Text><Text style={{ color: C.text, fontSize: 17, fontWeight: "900", marginTop: 5 }}>{selectedMarketSymbol}</Text><Text style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>{MARKET_NAMES[selectedMarketSymbol]}</Text></View><View style={{ alignItems: "flex-end" }}><Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>{selectedQuote?.price ?? "—"}</Text><Text style={{ color: C.muted, fontSize: 9 }}>{selectedQuote?.source ?? "Quote unavailable"}</Text></View></View>
        <View style={{ flexDirection: "row", gap: 6 }}>{(["1D","1W","1M","3M","1Y"] as ChartRange[]).map(range => <TouchableOpacity key={range} onPress={() => loadMarketSeries(selectedMarketSymbol, range)} style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center", backgroundColor: chartRange === range ? "#45366E" : "#1B2942", borderWidth: 1, borderColor: chartRange === range ? "#9D80E8" : "#34435A" }}><Text style={{ color: chartRange === range ? "#E7DCFF" : "#94A6B9", fontSize: 9, fontWeight: "900" }}>{range}</Text></TouchableOpacity>)}</View>
        <View style={{ height: 154, backgroundColor: "#0B1426", borderRadius: 13, borderWidth: 1, borderColor: "#293650", overflow: "hidden", justifyContent: "center" }}>
          {[0,1,2,3].map(row => <View key={row} style={{ position: "absolute", left: 0, right: 0, top: 20 + row * 36, height: 1, backgroundColor: "#202E46" }} />)}
          {chartSegments.map(segment => <View key={segment.key} style={{ position: "absolute", left: segment.left, top: segment.top, width: segment.width, height: 2.5, borderRadius: 2, backgroundColor: C.cyan, transform: [{ rotate: segment.rotate }] }} />)}
          {chartLoading ? <View style={{ alignItems: "center", gap: 8 }}><ActivityIndicator color={C.cyan} /><Text style={{ color: C.muted, fontSize: 10 }}>Loading verified history…</Text></View> : chartError ? <Text style={{ color: C.red, fontSize: 10, textAlign: "center", paddingHorizontal: 18 }}>{chartError}</Text> : chartPoints.length ? <View style={{ position: "absolute", bottom: 9, left: 10, right: 10, flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: "#8193A9", fontSize: 8 }}>{chartPoints[0]?.time ?? ""}</Text><Text style={{ color: "#8193A9", fontSize: 8 }}>{chartPoints[chartPoints.length-1]?.time ?? ""}</Text></View> : <Text style={{ color: C.muted, fontSize: 10, textAlign: "center", paddingHorizontal: 18 }}>Historical data is not available yet. Connect the configured provider to load this chart.</Text>}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: C.muted, fontSize: 9 }}>LOW · {chartValues.length ? minValue.toLocaleString(undefined,{maximumFractionDigits:6}) : "—"}</Text><Text style={{ color: C.muted, fontSize: 9 }}>HIGH · {chartValues.length ? maxValue.toLocaleString(undefined,{maximumFractionDigits:6}) : "—"}</Text></View>
        <Text style={{ color: "#8D9FB3", fontSize: 8 }}>Source · Twelve Data historical close prices · read-only</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: "#C0D0DC", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 }}>MARKET CATEGORIES</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{(["Watchlist","Forex","Stocks","Crypto","Commodities"] as MarketCategory[]).map(category => <TouchableOpacity key={category} onPress={() => setMarketCategory(category)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: marketCategory === category ? "#163A4A" : C.panel, borderWidth: 1, borderColor: marketCategory === category ? C.cyan : C.line }}><Text style={{ color: marketCategory === category ? C.cyan : C.muted, fontSize: 9, fontWeight: "900" }}>{category}</Text></TouchableOpacity>)}</View>
        <TextInput value={marketSearch} onChangeText={setMarketSearch} placeholder="Search instruments…" placeholderTextColor={C.muted} style={{ backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 13, paddingVertical: 12, fontSize: 11 }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: "#C0D0DC", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 }}>{marketCategory.toUpperCase()}</Text><Text style={{ color: C.muted, fontSize: 9 }}>{visibleSymbols.length} INSTRUMENTS</Text></View>
      {visibleSymbols.map((symbol, index) => {
        const quote = quoteFor(symbol);
        const inWatchlist = watchlistSymbols.includes(symbol);
        const accent = index % 3 === 0 ? C.cyan : index % 3 === 1 ? C.violet : "#E8BD70";
        return <TouchableOpacity key={symbol} onPress={() => { setSelectedMarketSymbol(symbol); loadMarketSeries(symbol, chartRange); refreshMarkets([symbol]); }} style={{ padding: 14, borderRadius: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: selectedMarketSymbol === symbol ? "#52618A" : C.line, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#172A40", alignItems: "center", justifyContent: "center" }}><Text style={{ color: accent, fontSize: 12, fontWeight: "900" }}>{symbol.split("/")[0].slice(0,2) || symbol.slice(0,2)}</Text></View><View><Text style={{ color: C.text, fontSize: 14, fontWeight: "900" }}>{symbol}</Text><Text style={{ color: C.muted, fontSize: 9, marginTop: 3 }}>{MARKET_NAMES[symbol]}</Text></View></View>
            <View style={{ alignItems: "flex-end" }}><Text style={{ color: quote ? C.text : C.muted, fontSize: 16, fontWeight: "900" }}>{quote?.price ?? "—"}</Text><Text style={{ color: quote?.percent_change && Number(quote.percent_change) >= 0 ? C.green : quote?.percent_change ? C.red : C.muted, fontSize: 9, marginTop: 3 }}>{quote?.percent_change ? `${Number(quote.percent_change) > 0 ? "+" : ""}${quote.percent_change}%` : quote ? "Change unavailable" : "Quote unavailable"}</Text></View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: "#71899A", fontSize: 8 }}>SOURCE · {quote?.source ?? "NOT RETURNED"}</Text><TouchableOpacity onPress={() => toggleWatchlist(symbol)} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: inWatchlist ? "#352A48" : "#173747" }}><Text style={{ color: inWatchlist ? "#D4BFFF" : C.cyan, fontSize: 8, fontWeight: "900" }}>{inWatchlist ? "− REMOVE" : "+ WATCHLIST"}</Text></TouchableOpacity></View>
          <Text style={{ color: "#8A9EAF", fontSize: 8 }}>Provider time · {timeLabel(quote?.quote_time)}</Text>
        </TouchableOpacity>;
      })}
      {visibleSymbols.length === 0 ? <Text style={{ color: C.muted, fontSize: 11, padding: 16 }}>No supported instruments match this search.</Text> : null}
      <View style={{ padding: 14, borderRadius: 15, backgroundColor: "#171B29", borderWidth: 1, borderColor: "#3A3B54", gap: 6 }}><Text style={{ color: "#C9B8FF", fontSize: 10, fontWeight: "900" }}>DATA INTEGRITY</Text><Text style={{ color: "#AAB6C7", fontSize: 10, lineHeight: 17 }}>Read-only market information. Quotes and chart history are retrieved from Twelve Data when configured. No broker connection, order execution or estimated prices are provided.</Text></View>
    </ScrollView>;
  };

  const renderConnections = () => <ScrollView contentContainerStyle={styles.content}>
    <Heading title="Connections" subtitle="Manage NOVA's service status and safe integrations" />
    <Panel style={styles.practiceBanner}>
      <Text style={styles.eyebrow}>CONNECTION CENTER</Text>
      <Text style={styles.panelTitle}>Your services, clearly separated</Text>
      <Text style={styles.body}>NOVA shows which services are configured, what data they provide and what permissions they have. Never paste API keys or passwords into chat or the app UI.</Text>
    </Panel>
    <Panel>
      <View style={styles.rowBetween}><Text style={styles.panelTitle}>Market data · Twelve Data</Text><Text style={[styles.statusTag,{color:marketFeedState==="live"?C.green:marketFeedState==="partial"?"#E8BD70":C.red}]}>{marketFeedState.toUpperCase()}</Text></View>
      <Text style={styles.body}>Read-only quotes for the NOVA watchlist. Market data access is separate from any broker account.</Text>
      <Text style={styles.mutedSmall}>Last successful fetch: {timeLabel(marketFetched)}</Text>
      <Button label="OPEN MARKETS" onPress={()=>setTab("Markets")} />
    </Panel>
    <Panel>
      <View style={styles.rowBetween}><Text style={styles.panelTitle}>AI provider</Text><Text style={[styles.statusTag,{color:C.cyan}]}>BACKEND CONFIG</Text></View>
      <Text style={styles.body}>NOVA's AI requests are routed through the protected backend. Provider credentials must remain server-side and must never be stored in the mobile app.</Text>
    </Panel>
    <Panel>
      <View style={styles.rowBetween}><Text style={styles.panelTitle}>Broker sandbox adapter</Text><Text style={[styles.statusTag,{color:"#E8BD70"}]}>NOT CONNECTED</Text></View>
      <Text style={styles.body}>Broker integrations are not implemented in this build. A future provider adapter can be developed against a sandbox/demo environment for learning and testing only.</Text>
      <View style={styles.practiceLock}><Text style={styles.practiceLockText}>LIVE ORDER ROUTING DISABLED</Text></View>
      <Text style={styles.mutedSmall}>No broker credentials are collected, no account is linked and no orders or money movements can be sent.</Text>
    </Panel>
    <Panel>
      <Text style={styles.panelTitle}>Connection safety checklist</Text>
      <Text style={styles.body}>• Verify provider identity and API permissions</Text>
      <Text style={styles.body}>• Keep secrets in server-side environment variables</Text>
      <Text style={styles.body}>• Use sandbox credentials and simulated balances</Text>
      <Text style={styles.body}>• Log and review every test request</Text>
      <Text style={styles.body}>• Never label a service connected until a real health check confirms it</Text>
    </Panel>
  </ScrollView>;

  const logPracticeOrder = () => {
    const quote = quoteFor(practiceSymbol);
    const price = quote ? Number.parseFloat(quote.price.replace(/,/g, "")) : NaN;
    const units = Number(practiceUnits);
    if (!quote || !Number.isFinite(price) || price <= 0) { setPracticeNotice("A verified live quote is required before creating a practice order."); return; }
    if (!Number.isFinite(units) || units <= 0 || units > 1000000) { setPracticeNotice("Enter a practice quantity between 1 and 1,000,000 units."); return; }
    setPracticeOrders(current => [{ id: Date.now(), symbol: practiceSymbol, side: practiceSide, units, price, createdAt: new Date().toLocaleString() }, ...current].slice(0, 12));
    setPracticeNotice("Practice order recorded locally. No broker was contacted and no real trade was placed.");
  };

  const renderPractice = () => {
    const selectedQuote = quoteFor(practiceSymbol);
    const selectedPrice = selectedQuote ? Number.parseFloat(selectedQuote.price.replace(/,/g, "")) : NaN;
    const quantity = Number(practiceUnits);
    const notional = Number.isFinite(selectedPrice) && Number.isFinite(quantity) ? selectedPrice * quantity : NaN;
    return <ScrollView contentContainerStyle={styles.content}>
      <Heading title="Trading practice" subtitle="A learning simulator · no real money or broker connection" />
      <Panel style={styles.practiceBanner}><Text style={styles.eyebrow}>SAFE PRACTICE MODE</Text><Text style={styles.panelTitle}>Learn the order workflow</Text><Text style={styles.body}>This screen records simulated orders locally for learning. It cannot send orders, access funds, or connect to a broker.</Text><View style={styles.practiceLock}><Text style={styles.practiceLockText}>BROKER EXECUTION DISABLED</Text></View></Panel>
      <Panel>
        <Text style={styles.panelTitle}>Create a practice order</Text>
        <Text style={styles.mutedSmall}>Instrument</Text>
        <View style={styles.practiceChoices}>{SYMBOLS.map(symbol => <TouchableOpacity key={symbol} onPress={() => setPracticeSymbol(symbol)} style={[styles.practiceChoice, practiceSymbol === symbol && styles.practiceChoiceActive]}><Text style={[styles.practiceChoiceText, practiceSymbol === symbol && styles.practiceChoiceTextActive]}>{symbol}</Text></TouchableOpacity>)}</View>
        <Text style={styles.mutedSmall}>Practice direction</Text>
        <View style={styles.practiceChoices}><TouchableOpacity onPress={() => setPracticeSide("BUY")} style={[styles.practiceChoice, practiceSide === "BUY" && styles.practiceBuy]}><Text style={styles.practiceChoiceText}>BUY</Text></TouchableOpacity><TouchableOpacity onPress={() => setPracticeSide("SELL")} style={[styles.practiceChoice, practiceSide === "SELL" && styles.practiceSell]}><Text style={styles.practiceChoiceText}>SELL</Text></TouchableOpacity></View>
        <Text style={styles.mutedSmall}>Quantity (units)</Text>
        <TextInput value={practiceUnits} onChangeText={setPracticeUnits} keyboardType="numeric" placeholder="1000" placeholderTextColor={C.muted} style={styles.taskInput} />
        <View style={styles.practiceEstimate}><Text style={styles.mutedSmall}>Latest provider quote</Text><Text style={styles.practicePrice}>{selectedQuote?.price ?? "Unavailable"}</Text><Text style={styles.mutedSmall}>Estimated notional: {Number.isFinite(notional) ? notional.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</Text><Text style={styles.mutedSmall}>Source: {selectedQuote?.source ?? "No verified quote"}</Text></View>
        <Button label="RECORD PRACTICE ORDER" onPress={logPracticeOrder} disabled={!selectedQuote || !Number.isFinite(notional) || quantity <= 0} />
        {practiceNotice ? <Text style={styles.muted}>{practiceNotice}</Text> : null}
      </Panel>
      <Panel><Text style={styles.panelTitle}>Practice order history</Text>{practiceOrders.length === 0 ? <Text style={styles.muted}>No practice orders yet. Recorded examples will appear here.</Text> : practiceOrders.map(order => <View key={order.id} style={styles.practiceOrderRow}><View style={{ flex: 1 }}><Text style={styles.quoteSymbol}>{order.side} · {order.symbol}</Text><Text style={styles.mutedSmall}>{order.units.toLocaleString()} units at {order.price}</Text><Text style={styles.mutedSmall}>{order.createdAt}</Text></View><Text style={[styles.practiceSideTag, { color: order.side === "BUY" ? C.green : C.red }]}>SIMULATED</Text></View>)}</Panel>
    </ScrollView>;
  };

  const renderMore = () => <ScrollView contentContainerStyle={{ padding: 17, paddingBottom: 32, gap: 13 }}>
    <View style={{ marginBottom: 4 }}><Text style={{ color: C.violet, fontSize: 9, fontWeight: "900", letterSpacing: 2 }}>NOVA / CONTROL CENTER</Text><Text style={{ color: C.text, fontSize: 29, fontWeight: "900", marginTop: 6 }}>More</Text><Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Your modules, preferences and system controls.</Text></View>
    <View style={{ padding: 17, borderRadius: 21, backgroundColor: "#17172B", borderWidth: 1, borderColor: "#514078", gap: 8 }}><Text style={{ color: "#C5A9FF", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 }}>NOVA MODULES</Text><Text style={{ color: "#F5F0FF", fontSize: 21, fontWeight: "900" }}>Everything in one place.</Text><Text style={{ color: "#B4A9C8", fontSize: 10, lineHeight: 17 }}>Open a module to review its tools, permissions and current capabilities.</Text></View>
    <TouchableOpacity onPress={() => setTab("Connections")} style={{ flexDirection: "row", alignItems: "center", padding: 15, borderRadius: 17, backgroundColor: C.panel, borderWidth: 1, borderColor: "#28566A", gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#123247", alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.cyan, fontSize: 21 }}>⌘</Text></View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: C.text, fontSize: 13, fontWeight: "900" }}>Connections center</Text><Text style={{ color: C.muted, fontSize: 10 }}>Backend, data providers and integration safety</Text></View><Text style={{ color: C.cyan, fontSize: 22 }}>›</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => setTab("Practice")} style={{ flexDirection: "row", alignItems: "center", padding: 15, borderRadius: 17, backgroundColor: C.panel, borderWidth: 1, borderColor: "#4B3B67", gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#29213C", alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.violet, fontSize: 21 }}>◈</Text></View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: C.text, fontSize: 13, fontWeight: "900" }}>Practice simulator</Text><Text style={{ color: C.muted, fontSize: 10 }}>Learning environment with simulated orders only</Text></View><Text style={{ color: C.violet, fontSize: 22 }}>›</Text></TouchableOpacity>
    <View style={{ padding: 15, borderRadius: 17, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, gap: 9 }}><Text style={{ color: C.text, fontSize: 13, fontWeight: "900" }}>Operating principles</Text>{["Human approval for important actions", "Provider-backed data, never invented", "Credentials stay outside the app", "Read-only integrations by default"].map((item, i) => <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Text style={{ color: C.green, fontSize: 12 }}>✓</Text><Text style={{ color: "#AEBECD", fontSize: 10, flex: 1 }}>{item}</Text></View>)}</View>
    <View style={{ padding: 14, borderRadius: 15, backgroundColor: "#101B27", borderWidth: 1, borderColor: "#263A4B", gap: 4 }}><Text style={{ color: C.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1 }}>NOVA 2.1 · PROTOTYPE</Text><Text style={{ color: "#879BAB", fontSize: 10, lineHeight: 16 }}>Additional preferences and account features can be added in later releases. They are not represented as active until implemented.</Text></View>
  </ScrollView>;

  const renderWorkspace = () => <ScrollView contentContainerStyle={{ padding: 17, paddingBottom: 32, gap: 13 }}>
    <View style={{ marginBottom: 4 }}><Text style={{ color: C.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 2 }}>NOVA / PROJECT STUDIO</Text><Text style={{ color: C.text, fontSize: 29, fontWeight: "900", marginTop: 6 }}>Workspace</Text><Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Turn plans into visible progress.</Text></View>
    <View style={{ padding: 17, borderRadius: 20, backgroundColor: "#102A36", borderWidth: 1, borderColor: "#286274", gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: "#9CD8E2", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 }}>PROJECT OVERVIEW</Text><Text style={{ color: C.cyan, fontSize: 9, fontWeight: "900" }}>LOCAL BOARD</Text></View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 7 }}><Text style={{ color: "#F2FCFF", fontSize: 34, fontWeight: "900" }}>{completedTasks}</Text><Text style={{ color: "#A3C4CE", fontSize: 12, marginBottom: 5 }}>of {tasks.length} completed</Text></View>
      <View style={{ height: 7, borderRadius: 5, backgroundColor: "#234554", overflow: "hidden" }}><View style={{ height: 7, borderRadius: 5, backgroundColor: C.cyan, width: tasks.length ? String(completedTasks / tasks.length * 100) + "%" : "0%" }} /></View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: "#A3C4CE", fontSize: 9 }}>Progress</Text><Text style={{ color: C.cyan, fontSize: 9, fontWeight: "900" }}>{tasks.length ? Math.round(completedTasks / tasks.length * 100) : 0}%</Text></View>
    </View>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}><Text style={{ color: "#C0D0DC", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 }}>TASK BOARD</Text><Text style={{ color: C.muted, fontSize: 9 }}>{tasks.length} ITEMS</Text></View>
    {tasks.map((task, i) => <TouchableOpacity key={task.id} onPress={() => setTasks(current => current.map(t => t.id === task.id ? { ...t, done: !t.done } : t))} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 15, backgroundColor: C.panel, borderWidth: 1, borderColor: task.done ? "#285B48" : C.line }}>
      <View style={{ width: 25, height: 25, borderRadius: 9, borderWidth: 1.5, borderColor: task.done ? C.green : "#5B7184", backgroundColor: task.done ? "#153B2D" : "#101E2B", alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.green, fontSize: 14, fontWeight: "900" }}>{task.done ? "✓" : ""}</Text></View>
      <View style={{ flex: 1, gap: 4 }}><Text style={{ color: task.done ? "#82999A" : C.text, fontSize: 11, fontWeight: "800", textDecorationLine: task.done ? "line-through" : "none" }}>{task.title}</Text><Text style={{ color: C.muted, fontSize: 8 }}>{task.done ? "COMPLETED" : "IN PROGRESS"} · TASK {String(i + 1).padStart(2, "0")}</Text></View><Text style={{ color: C.cyan, fontSize: 18 }}>›</Text>
    </TouchableOpacity>)}
    <View style={{ flexDirection: "row", gap: 8 }}><TextInput value={newTask} onChangeText={setNewTask} placeholder="Add a new task to your board…" placeholderTextColor={C.muted} style={{ flex: 1, minHeight: 48, color: C.text, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 13, fontSize: 11 }} onSubmitEditing={addTask} returnKeyType="done" /><TouchableOpacity onPress={addTask} style={{ width: 49, borderRadius: 13, backgroundColor: "#087F83", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FFF", fontSize: 24, fontWeight: "700" }}>+</Text></TouchableOpacity></View>
    <View style={{ padding: 14, borderRadius: 15, backgroundColor: "#171B29", borderWidth: 1, borderColor: "#3A3B54", gap: 5 }}><Text style={{ color: "#C9B8FF", fontSize: 10, fontWeight: "900" }}>WORKSPACE NOTE</Text><Text style={{ color: "#AAB6C7", fontSize: 10, lineHeight: 17 }}>Tasks are stored locally in the running app. Cloud sync, accounts and shared projects are not enabled in this prototype yet.</Text></View>
  </ScrollView>;

  const screens: Record<Tab, () => React.ReactNode> = { Home: renderHome, Intelligence: renderIntelligence, Markets: renderMarkets, Connections: renderConnections, Practice: renderPractice, Workspace: renderWorkspace, More: renderMore };
  return <SafeAreaView style={styles.safe}>{Platform.OS === "web" ? <Analytics /> : null}<StatusBar barStyle="light-content" backgroundColor={C.bg} /><View style={styles.topBar}><View style={styles.topBrandRow}><Image source={require("./assets/nova-icon.png")} style={styles.topLogo} /><Text style={styles.topBrand}>NOVA<Text style={styles.cyan}>.</Text></Text></View><Text style={styles.topMeta}>PERSONAL INTELLIGENCE</Text></View><View style={{ flex: 1 }}>{screens[tab]()}</View><View style={styles.nav}>{(["Home", "Intelligence", "Markets", "Workspace", "More"] as Tab[]).map((item, i) => <TouchableOpacity key={item} onPress={() => setTab(item)} style={styles.navItem}><Text style={[styles.navIcon, tab === item && { color: C.cyan }]}>{["⌂", "✳", "⌁", "▤", "⋯"][i]}</Text><Text style={[styles.navLabel, tab === item && styles.navActive]}>{item === "Home" ? "Dashboard" : item}</Text></TouchableOpacity>)}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topBar: { height: 58, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#183344", backgroundColor: "#07111B" }, topBrandRow: { flexDirection: "row", alignItems: "center", gap: 8 }, topLogo: { width: 27, height: 27, borderRadius: 8 }, logoImage: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, borderColor: "#31517A" },
  topBrand: { color: C.text, fontSize: 19, fontWeight: "900", letterSpacing: 2 }, topMeta: { color: C.muted, fontSize: 9, letterSpacing: 1.2, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 30, gap: 13 },
  hero: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 5, paddingVertical: 5 }, logoFrame: { width: 53, height: 53, borderRadius: 17, padding: 2, backgroundColor: "#123B43", borderWidth: 1, borderColor: "#2C887F" },
  brandMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.cyan, alignItems: "center", justifyContent: "center" }, brandMarkText: { color: C.bg, fontWeight: "900", fontSize: 25 },
  brand: { color: C.text, fontSize: 19, fontWeight: "900", letterSpacing: 1.7 }, cyan: { color: C.cyan },
  livePill: { borderWidth: 1, borderColor: "#285747", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }, liveText: { color: C.green, fontSize: 8, fontWeight: "900" },
  welcome: { backgroundColor: "#0D2634", borderColor: "#226B70", borderWidth: 1, borderRadius: 23, padding: 20, gap: 12, marginBottom: 5, shadowColor: "#24D7C4", shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 7 }, eyebrow: { color: C.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 }, welcomeTitle: { color: C.text, fontSize: 25, fontWeight: "800", lineHeight: 31 },
  muted: { color: C.muted, fontSize: 12, lineHeight: 19 }, mutedSmall: { color: C.muted, fontSize: 10, lineHeight: 16 },
  button: { backgroundColor: "#087F83", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, alignItems: "center", marginTop: 8, shadowColor: C.cyan, shadowOpacity: 0.18, shadowRadius: 10, elevation: 3 }, buttonSecondary: { backgroundColor: C.panel2 }, buttonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10, letterSpacing: 0.6 },
  metrics: { flexDirection: "row", gap: 10 }, metric: { flex: 1, minHeight: 122, justifyContent: "space-between", borderTopWidth: 2, borderTopColor: C.cyan }, panel: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 15, gap: 9, shadowColor: "#000000", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, metricLabel: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 }, metricValue: { color: C.text, fontSize: 23, fontWeight: "900" }, metricFoot: { color: C.muted, fontSize: 10 },
  sectionTitle: { color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginTop: 5 }, quickGrid: { flexDirection: "row", gap: 8 }, quickCard: { flex: 1, minHeight: 102, padding: 11, borderRadius: 15, borderWidth: 1, borderColor: "#234151", backgroundColor: "#0B1925", gap: 6 }, quickIcon: { color: C.cyan, fontSize: 19 }, quickTitle: { color: C.text, fontSize: 11, fontWeight: "800" },
  panelTitle: { color: C.text, fontSize: 14, fontWeight: "800" }, body: { color: "#B2C0D1", fontSize: 12, lineHeight: 19 }, heading: { gap: 4, marginBottom: 3 }, pageTitle: { color: C.text, fontSize: 26, fontWeight: "900" },
  emptyChat: { alignItems: "center", paddingVertical: 28, marginTop: 12 }, emptyIcon: { color: C.cyan, fontSize: 30, marginBottom: 6 }, message: { padding: 13, borderRadius: 14, borderWidth: 1, gap: 6 }, userMessage: { backgroundColor: "#123449", borderColor: "#28617A", marginLeft: 30 }, aiMessage: { backgroundColor: C.panel, borderColor: C.line, marginRight: 18 }, messageRole: { color: C.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  composer: { flexDirection: "row", gap: 8, alignItems: "flex-end", padding: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg }, composerInput: { flex: 1, maxHeight: 110, minHeight: 45, color: C.text, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13 }, sendButton: { width: 45, height: 45, borderRadius: 13, backgroundColor: "#176579", alignItems: "center", justifyContent: "center" }, sendText: { color: "#FFF", fontSize: 23, fontWeight: "800" }, error: { color: C.red, fontSize: 11, lineHeight: 17 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, statusTag: { fontSize: 9, fontWeight: "900" }, quoteCard: { gap: 10 }, quoteSymbol: { color: C.text, fontSize: 16, fontWeight: "900" }, quotePrice: { color: C.cyan, fontSize: 21, fontWeight: "900" },
  progressTrack: { height: 6, backgroundColor: "#253348", borderRadius: 5, overflow: "hidden", marginTop: 5 }, progressFill: { height: 6, backgroundColor: C.cyan, borderRadius: 5 }, taskRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12 }, checkCircle: { width: 21, height: 21, borderRadius: 7, borderWidth: 1, borderColor: "#58708A", alignItems: "center", justifyContent: "center" }, checked: { backgroundColor: "#176579", borderColor: C.cyan }, checkText: { color: "#FFF", fontWeight: "900" }, taskText: { color: C.text, fontSize: 12, flex: 1 }, taskDone: { color: C.muted, textDecorationLine: "line-through" },
  addTaskRow: { flexDirection: "row", gap: 8 }, taskInput: { flex: 1, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 13, fontSize: 12 }, addButton: { width: 45, borderRadius: 12, backgroundColor: "#176579", alignItems: "center", justifyContent: "center" }, addText: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  practiceBanner: { backgroundColor: "#10283A", borderColor: "#245067" }, practiceLock: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#8A6C38", backgroundColor: "#302719", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }, practiceLockText: { color: "#F0C77A", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, practiceChoices: { flexDirection: "row", gap: 7, marginVertical: 5 }, practiceChoice: { flex: 1, padding: 10, borderWidth: 1, borderColor: C.line, borderRadius: 10, alignItems: "center", backgroundColor: C.panel2 }, practiceChoiceActive: { borderColor: C.cyan, backgroundColor: "#123449" }, practiceBuy: { borderColor: C.green, backgroundColor: "#14372F" }, practiceSell: { borderColor: C.red, backgroundColor: "#3A242B" }, practiceChoiceText: { color: C.muted, fontSize: 10, fontWeight: "900" }, practiceChoiceTextActive: { color: C.cyan }, practiceEstimate: { backgroundColor: "#0B1420", borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, gap: 4, marginTop: 5 }, practicePrice: { color: C.cyan, fontSize: 22, fontWeight: "900" }, practiceOrderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, marginTop: 4 }, practiceSideTag: { fontSize: 9, fontWeight: "900" },
  systemPanel: { backgroundColor: "#0C1D29", borderColor: "#1D5A61" }, dashboardGrid: { flexDirection: "row", gap: 10 }, dashboardTile: { flex: 1, minHeight: 122, justifyContent: "space-between", overflow: "hidden", borderTopWidth: 2, borderTopColor: C.cyan }, tileValue: { color: C.cyan, fontSize: 13, fontWeight: "900", letterSpacing: 0.4 }, moduleCard: { flexDirection: "row", alignItems: "center", gap: 13, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, moduleIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#142A3B", alignItems: "center", justifyContent: "center" }, chevron: { color: C.cyan, fontSize: 25 },
  nav: { height: 70, backgroundColor: "#07121C", borderTopWidth: 1, borderTopColor: "#1B3543", flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingTop: 5, paddingBottom: 4 }, navItem: { flex: 1, alignItems: "center", gap: 3 }, navIcon: { color: C.muted, fontSize: 19 }, navLabel: { color: C.muted, fontSize: 9, fontWeight: "700" }, navActive: { color: C.cyan },
  dashTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:7},
  dashIdentity:{flexDirection:"row",alignItems:"center",gap:11},
  dashLogo:{width:45,height:45,borderRadius:15,backgroundColor:"#102B3A",borderWidth:1,borderColor:"#2D7181",alignItems:"center",justifyContent:"center",padding:3},
  dashLogoImage:{width:37,height:37,borderRadius:11},
  dashBrand:{color:C.text,fontSize:19,fontWeight:"900",letterSpacing:1.5},
  dashSub:{color:"#7794A6",fontSize:8,fontWeight:"800",letterSpacing:1.4,marginTop:3},
  dashStatus:{flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:10,paddingVertical:7,borderRadius:20,backgroundColor:"#102A25",borderWidth:1,borderColor:"#245443"},
  dashStatusText:{color:C.green,fontSize:8,fontWeight:"900",letterSpacing:.6},
  dashGreeting:{minHeight:250,backgroundColor:"#0A1D2B",borderWidth:1,borderColor:"#1C5262",borderRadius:25,padding:21,justifyContent:"center",overflow:"hidden",marginTop:7,marginBottom:7},
  dashEyebrow:{color:C.cyan,fontSize:9,fontWeight:"900",letterSpacing:1.8,marginBottom:13},
  dashHeadline:{color:"#F5FAFF",fontSize:35,fontWeight:"900",lineHeight:39,letterSpacing:-1.1,maxWidth:"80%"},
  dashIntro:{color:"#9DB2C1",fontSize:12,lineHeight:19,marginTop:12,maxWidth:"78%"},
  dashPrimary:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"#087F83",borderRadius:12,paddingHorizontal:15,paddingVertical:13,marginTop:19,width:178},
  dashPrimaryText:{color:"#FFFFFF",fontSize:9,fontWeight:"900",letterSpacing:1},
  dashArrow:{color:"#FFFFFF",fontSize:17,fontWeight:"800"},
  dashOrb:{position:"absolute",right:-34,top:43,width:165,height:165,borderRadius:90,borderWidth:1,borderColor:"#277A83",backgroundColor:"rgba(35,172,172,0.08)",alignItems:"center",justifyContent:"center"},
  dashOrbInner:{width:112,height:112,borderRadius:60,borderWidth:1,borderColor:"#3A9C9E",backgroundColor:"rgba(50,199,190,0.11)",alignItems:"center",justifyContent:"center"},
  dashOrbGlyph:{color:"rgba(91,231,216,0.5)",fontSize:68,fontWeight:"200"},
  dashSectionHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:13,marginBottom:9},
  dashSectionTitle:{color:"#B5C7D4",fontSize:9,fontWeight:"900",letterSpacing:1.6},
  dashSectionMeta:{color:"#617C8E",fontSize:8,fontWeight:"800",letterSpacing:1},
  dashSectionAction:{color:C.cyan,fontSize:8,fontWeight:"900",letterSpacing:.8},
  dashStats:{flexDirection:"row",gap:10},
  dashStatCard:{flex:1,minHeight:132,backgroundColor:"#0C1927",borderWidth:1,borderColor:"#203849",borderRadius:17,padding:13,justifyContent:"space-between"},
  dashStatTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  dashStatLabel:{color:"#7892A3",fontSize:8,fontWeight:"900",letterSpacing:1},
  dashStatIcon:{color:C.cyan,fontSize:17},
  dashStatValue:{color:C.text,fontSize:28,fontWeight:"900",marginTop:5},
  dashStatTotal:{color:"#6D8798",fontSize:16,fontWeight:"700"},
  dashStatFoot:{color:"#7892A3",fontSize:9,marginTop:1},
  dashMiniTrack:{height:4,borderRadius:3,backgroundColor:"#243747",overflow:"hidden",marginTop:8},
  dashMiniFill:{height:4,backgroundColor:C.cyan,borderRadius:3},
  dashFeedLine:{flexDirection:"row",alignItems:"center",gap:6,marginTop:8},
  dashFeedDot:{width:6,height:6,borderRadius:3},
  dashFeedText:{color:"#91A6B5",fontSize:8},
  dashFeature:{flexDirection:"row",alignItems:"center",gap:12,padding:15,backgroundColor:"#101E30",borderWidth:1,borderColor:"#35415E",borderRadius:18},
  dashFeatureIcon:{width:42,height:42,borderRadius:14,backgroundColor:"#202744",alignItems:"center",justifyContent:"center"},
  dashFeatureGlyph:{color:"#B59AFF",fontSize:22},
  dashFeatureCopy:{flex:1,gap:4},
  dashFeatureTitle:{color:C.text,fontSize:13,fontWeight:"900"},
  dashFeatureDesc:{color:"#91A4B5",fontSize:9,lineHeight:15},
  dashFeatureArrow:{color:"#B59AFF",fontSize:20,fontWeight:"800"},
  dashToolGrid:{flexDirection:"row",gap:9,marginTop:9},
  dashToolCard:{flex:1,minHeight:106,padding:11,backgroundColor:"#0C1927",borderWidth:1,borderColor:"#203849",borderRadius:15,justifyContent:"space-between"},
  dashToolIcon:{color:C.cyan,fontSize:18},
  dashToolTitle:{color:C.text,fontSize:10,fontWeight:"900",marginTop:6},
  dashToolDesc:{color:"#8198A8",fontSize:8},
  dashSystemCard:{padding:14,backgroundColor:"#0B1925",borderWidth:1,borderColor:"#234251",borderRadius:17,gap:10},
  dashSystemRow:{flexDirection:"row",alignItems:"center",gap:10},
  dashSystemIcon:{width:36,height:36,borderRadius:12,backgroundColor:"#142C3A",alignItems:"center",justifyContent:"center"},
  dashSystemTitle:{color:C.text,fontSize:11,fontWeight:"900"},
  dashSystemDesc:{color:"#8198A8",fontSize:8,marginTop:3},
  dashSystemBadge:{paddingHorizontal:8,paddingVertical:5,borderRadius:8,borderWidth:1,backgroundColor:"#101D29"},
  dashSystemBadgeText:{fontSize:8,fontWeight:"900",letterSpacing:.5},
  dashSystemDivider:{height:1,backgroundColor:"#203747"},
  dashSystemFoot:{color:"#7E94A4",fontSize:9},
  dashDisclaimer:{color:"#5F7788",fontSize:8,lineHeight:14,textAlign:"center",marginTop:7,marginBottom:4},
});
