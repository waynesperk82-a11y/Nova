import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";

type Tab = "Home" | "Intelligence" | "Markets" | "Connections" | "Practice" | "Workspace" | "More";
type SymbolCode = "EUR/USD" | "GBP/USD" | "XAU/USD";
type Quote = { symbol: SymbolCode; price: string; quote_time: string | null; source: string; currency: string | null };
type MarketResponse = { data: Quote[]; status: string; fetched_at: string; errors?: string[] };
type ChatMessage = { role: "user" | "assistant"; content: string };
type Task = { id: number; title: string; done: boolean };
type PracticeOrder = { id: number; symbol: SymbolCode; side: "BUY" | "SELL"; units: number; price: number; createdAt: string };

const API_BASE = process.env.EXPO_PUBLIC_NOVA_API_URL?.replace(/\/$/, "");
const SYMBOLS: SymbolCode[] = ["EUR/USD", "GBP/USD", "XAU/USD"];
const C = { bg: "#070A14", panel: "#101827", panel2: "#151F33", line: "#26334D", text: "#F4F7FF", muted: "#91A0B9", cyan: "#59E1F2", violet: "#9A7CFF", green: "#72D6B0", red: "#F18D91" };

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

  const refreshMarkets = useCallback(async () => {
    if (!API_BASE) { setMarketError("Backend URL is not configured. Set EXPO_PUBLIC_NOVA_API_URL in the Expo environment."); setQuotes([]); setMarketFeedState("offline"); return; }
    setMarketLoading(true); setMarketError(null); setMarketFeedState("loading");
    try {
      const response = await fetch(`${API_BASE}/api/markets`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || `Market API returned HTTP ${response.status}`);
      const result = body as MarketResponse;
      if (!Array.isArray(result.data) || result.data.length === 0) throw new Error("No verified provider quotes were returned.");
      setQuotes(result.data); setMarketFetched(result.fetched_at || new Date().toISOString());
      setMarketFeedState(result.status === "partial" ? "partial" : "live");
      if (result.status === "partial") setMarketError((result.errors || []).join(" · ") || "Some symbols were unavailable.");
    } catch (e) { setQuotes([]); setMarketFeedState("offline"); setMarketError(e instanceof Error ? e.message : "Could not connect to the market-data service."); }
    finally { setMarketLoading(false); }
  }, []);

  useEffect(() => { refreshMarkets(); }, [refreshMarkets]);

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
    <View style={styles.hero}><Image source={require("./assets/nova-icon.png")} style={styles.logoImage} /><View style={{ flex: 1 }}><Text style={styles.brand}>NOVA <Text style={styles.cyan}>2.0</Text></Text><Text style={styles.muted}>Your personal intelligence workspace</Text></View><View style={styles.livePill}><View style={styles.dot} /><Text style={styles.liveText}>NOVA 2.0</Text></View></View>
    <View style={styles.welcome}><Text style={styles.eyebrow}>THINK CLEARER · BUILD FASTER</Text><Text style={styles.welcomeTitle}>Your next big idea starts here.</Text><Text style={styles.muted}>A smarter space to research, reason, explore markets and turn ambitious ideas into clear next steps.</Text><Button label="OPEN INTELLIGENCE  →" onPress={() => setTab("Intelligence")} /></View>
    <View style={styles.metrics}><Panel style={styles.metric}><Text style={styles.metricLabel}>WORKSPACE TASKS</Text><Text style={styles.metricValue}>{completedTasks}/{tasks.length}</Text><Text style={styles.metricFoot}>Completed</Text></Panel><Panel style={styles.metric}><Text style={styles.metricLabel}>MARKET FEED</Text><Text style={[styles.metricValue, { color: quotes.length ? C.green : C.muted }]}>{marketFeedState === "live" ? "LIVE DATA" : marketFeedState === "partial" ? "PARTIAL" : marketFeedState === "loading" ? "CHECKING" : "OFFLINE"}</Text><Text style={styles.metricFoot}>Provider dependent</Text></Panel></View>
    <Text style={styles.sectionTitle}>QUICK ACCESS</Text>
    <View style={styles.quickGrid}>{(["Intelligence", "Markets", "Workspace", "Connections"] as Tab[]).map((item, i) => <TouchableOpacity key={item} style={styles.quickCard} onPress={() => setTab(item)}><Text style={styles.quickIcon}>{["✳", "⌁", "▤", "⌘"][i]}</Text><Text style={styles.quickTitle}>{item}</Text><Text style={styles.mutedSmall}>{["Ask and explore", "Read-only quotes", "Projects and tasks", "Link services"][i]}</Text></TouchableOpacity>)}</View>
    <Text style={styles.sectionTitle}>SYSTEM OVERVIEW</Text>
    <Panel style={styles.systemPanel}>
      <View style={styles.rowBetween}><Text style={styles.panelTitle}>Backend connection</Text><Text style={[styles.statusTag, { color: backendState === "ready" ? C.green : backendState === "checking" ? C.cyan : C.red }]}>{backendState === "ready" ? "● OPERATIONAL" : backendState === "checking" ? "● CHECKING" : backendState === "unknown" ? "● NOT CONFIGURED" : "● NEEDS ATTENTION"}</Text></View>
      <Text style={styles.body}>NOVA API · Read-only health verification</Text>
      <Text style={styles.mutedSmall}>Last checked: {timeLabel(backendCheckedAt)}</Text>
      <Button label={backendState === "checking" ? "CHECKING…" : "RUN HEALTH CHECK"} onPress={refreshBackend} disabled={backendState === "checking"} secondary />
    </Panel>
    <View style={styles.dashboardGrid}>
      <Panel style={styles.dashboardTile}><Text style={styles.metricLabel}>AI WORKSPACE</Text><Text style={styles.tileValue}>READY TO THINK</Text><Text style={styles.mutedSmall}>Research · reasoning · planning</Text></Panel>
      <Panel style={styles.dashboardTile}><Text style={styles.metricLabel}>PRACTICE MODE</Text><Text style={styles.tileValue}>SIMULATION</Text><Text style={styles.mutedSmall}>No broker execution</Text></Panel>
    </View>
    <Panel><Text style={styles.panelTitle}>NOVA operating principles</Text><Text style={styles.body}>Clear answers · Transparent data · Human approval for important actions. NOVA does not execute trades or control physical equipment.</Text></Panel>
  </ScrollView>;

  const renderIntelligence = () => <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Heading title="Intelligence" subtitle="Research, reasoning and practical planning" />
      <Panel><Text style={styles.eyebrow}>NOVA AI ASSISTANT</Text><Text style={styles.panelTitle}>A focused thinking partner</Text><Text style={styles.body}>Ask questions, break down a project, compare options or turn an idea into an action plan. Verify important information before acting.</Text></Panel>
      {messages.length === 0 ? <Panel style={styles.emptyChat}><Text style={styles.emptyIcon}>✳</Text><Text style={styles.panelTitle}>Start a conversation</Text><Text style={styles.muted}>Try: “Help me plan the next milestone for NOVA.”</Text></Panel> : messages.map((m, i) => <View key={i} style={[styles.message, m.role === "user" ? styles.userMessage : styles.aiMessage]}><Text style={styles.messageRole}>{m.role === "user" ? "YOU" : "NOVA"}</Text><Text style={styles.body}>{m.content}</Text></View>)}
      {chatLoading ? <Panel><ActivityIndicator color={C.cyan} /><Text style={[styles.muted, { textAlign: "center", marginTop: 8 }]}>NOVA is thinking…</Text></Panel> : null}
      {chatError ? <Text style={styles.error}>{chatError}</Text> : null}
    </ScrollView>
    <View style={styles.composer}><TextInput value={prompt} onChangeText={setPrompt} placeholder="Ask NOVA anything…" placeholderTextColor={C.muted} multiline style={styles.composerInput} /><TouchableOpacity onPress={sendMessage} disabled={!prompt.trim() || chatLoading} style={[styles.sendButton, (!prompt.trim() || chatLoading) && { opacity: 0.45 }]}><Text style={styles.sendText}>↑</Text></TouchableOpacity></View>
  </KeyboardAvoidingView>;

  const renderMarkets = () => <ScrollView contentContainerStyle={styles.content}>
    <Heading title="Markets" subtitle="Provider-supplied information · Read only" />
    <Panel><View style={styles.rowBetween}><Text style={styles.panelTitle}>Market data connection</Text><Text style={[styles.statusTag, { color: marketFeedState === "live" ? C.green : marketFeedState === "partial" ? "#E8BD70" : C.red }]}>{marketFeedState === "live" ? "● LIVE" : marketFeedState === "partial" ? "● PARTIAL" : marketFeedState === "loading" ? "● CHECKING" : "● OFFLINE"}</Text></View><Text style={styles.body}>{marketError || "Values below are returned by Twelve Data. Check provider timestamps for freshness."}</Text><Button label={marketLoading ? "REFRESHING…" : "REFRESH REAL MARKET DATA"} onPress={refreshMarkets} disabled={marketLoading} /><Text style={styles.mutedSmall}>Received by NOVA: {timeLabel(marketFetched)}</Text></Panel>
    <Text style={styles.sectionTitle}>WATCHLIST</Text>
    {SYMBOLS.map(symbol => { const q = quoteFor(symbol); return <Panel key={symbol} style={styles.quoteCard}><View style={styles.rowBetween}><View><Text style={styles.quoteSymbol}>{symbol}</Text><Text style={styles.mutedSmall}>{symbol === "XAU/USD" ? "GOLD SPOT" : "FOREIGN EXCHANGE"}</Text></View><View style={{ alignItems: "flex-end" }}><Text style={styles.quotePrice}>{q?.price ?? "—"}</Text><Text style={styles.mutedSmall}>{q?.source ?? "No verified quote"}</Text></View></View><Text style={styles.mutedSmall}>Provider timestamp: {timeLabel(q?.quote_time)}</Text></Panel>; })}
    <Panel><Text style={styles.panelTitle}>Data integrity</Text><Text style={styles.body}>NOVA never invents missing prices, creates sample profit/loss or connects to a broker to place orders. Market information is not financial advice.</Text></Panel>
  </ScrollView>;

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

  const renderMore = () => <ScrollView contentContainerStyle={styles.content}>
    <Heading title="More tools" subtitle="Additional NOVA modules and service controls" />
    <TouchableOpacity style={styles.moduleCard} onPress={() => setTab("Connections")}><View style={styles.moduleIcon}><Text style={styles.quickIcon}>⌘</Text></View><View style={{ flex: 1 }}><Text style={styles.panelTitle}>Connections center</Text><Text style={styles.mutedSmall}>Backend, market data and integration status</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>
    <TouchableOpacity style={styles.moduleCard} onPress={() => setTab("Practice")}><View style={styles.moduleIcon}><Text style={styles.quickIcon}>◈</Text></View><View style={{ flex: 1 }}><Text style={styles.panelTitle}>Practice simulator</Text><Text style={styles.mutedSmall}>Learn with local simulated orders only</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>
    <Panel><Text style={styles.panelTitle}>Workspace preferences</Text><Text style={styles.body}>More personalization and project controls can be added here without changing NOVA's protected backend services.</Text></Panel>
  </ScrollView>;

  const renderWorkspace = () => <ScrollView contentContainerStyle={styles.content}>
    <Heading title="Workspace" subtitle="Keep projects and next actions organized" />
    <Panel><Text style={styles.eyebrow}>TASK OVERVIEW</Text><Text style={styles.metricValue}>{completedTasks} of {tasks.length}</Text><Text style={styles.muted}>Tasks completed</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: tasks.length ? `${completedTasks / tasks.length * 100}%` : "0%" }]} /></View></Panel>
    <Text style={styles.sectionTitle}>YOUR TASKS</Text>
    {tasks.map(task => <TouchableOpacity key={task.id} onPress={() => setTasks(current => current.map(t => t.id === task.id ? { ...t, done: !t.done } : t))} style={styles.taskRow}><View style={[styles.checkCircle, task.done && styles.checked]}><Text style={styles.checkText}>{task.done ? "✓" : ""}</Text></View><Text style={[styles.taskText, task.done && styles.taskDone]}>{task.title}</Text></TouchableOpacity>)}
    <View style={styles.addTaskRow}><TextInput value={newTask} onChangeText={setNewTask} placeholder="Add a task…" placeholderTextColor={C.muted} style={styles.taskInput} onSubmitEditing={addTask} returnKeyType="done" /><TouchableOpacity style={styles.addButton} onPress={addTask}><Text style={styles.addText}>+</Text></TouchableOpacity></View>
    <Panel><Text style={styles.panelTitle}>Project space</Text><Text style={styles.body}>This first workspace stores tasks locally in the running app. Cloud sync, accounts and shared projects are not enabled yet.</Text></Panel>
  </ScrollView>;

  const screens: Record<Tab, () => React.ReactNode> = { Home: renderHome, Intelligence: renderIntelligence, Markets: renderMarkets, Connections: renderConnections, Practice: renderPractice, Workspace: renderWorkspace, More: renderMore };
  return <SafeAreaView style={styles.safe}>{Platform.OS === "web" ? <Analytics /> : null}<StatusBar barStyle="light-content" backgroundColor={C.bg} /><View style={styles.topBar}><View style={styles.topBrandRow}><Image source={require("./assets/nova-icon.png")} style={styles.topLogo} /><Text style={styles.topBrand}>NOVA<Text style={styles.cyan}>.</Text></Text></View><Text style={styles.topMeta}>PERSONAL INTELLIGENCE</Text></View><View style={{ flex: 1 }}>{screens[tab]()}</View><View style={styles.nav}>{(["Home", "Intelligence", "Markets", "Workspace", "More"] as Tab[]).map((item, i) => <TouchableOpacity key={item} onPress={() => setTab(item)} style={styles.navItem}><Text style={[styles.navIcon, tab === item && { color: C.cyan }]}>{["⌂", "✳", "⌁", "▤", "⋯"][i]}</Text><Text style={[styles.navLabel, tab === item && styles.navActive]}>{item === "Home" ? "Dashboard" : item}</Text></TouchableOpacity>)}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topBar: { height: 58, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#1B293B", backgroundColor: "#090F1B" }, topBrandRow: { flexDirection: "row", alignItems: "center", gap: 8 }, topLogo: { width: 27, height: 27, borderRadius: 8 }, logoImage: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, borderColor: "#31517A" },
  topBrand: { color: C.text, fontSize: 19, fontWeight: "900", letterSpacing: 2 }, topMeta: { color: C.muted, fontSize: 9, letterSpacing: 1.2, fontWeight: "700" },
  content: { padding: 18, paddingBottom: 28, gap: 14 },
  hero: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 7, paddingVertical: 5 },
  brandMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.cyan, alignItems: "center", justifyContent: "center" }, brandMarkText: { color: C.bg, fontWeight: "900", fontSize: 25 },
  brand: { color: C.text, fontSize: 19, fontWeight: "900", letterSpacing: 1.7 }, cyan: { color: C.cyan },
  livePill: { borderWidth: 1, borderColor: "#285747", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }, liveText: { color: C.green, fontSize: 8, fontWeight: "900" },
  welcome: { backgroundColor: "#102238", borderColor: "#31517A", borderWidth: 1, borderRadius: 22, padding: 21, gap: 12, marginBottom: 4, shadowColor: "#4A76FF", shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 }, eyebrow: { color: C.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 }, welcomeTitle: { color: C.text, fontSize: 25, fontWeight: "800", lineHeight: 31 },
  muted: { color: C.muted, fontSize: 12, lineHeight: 19 }, mutedSmall: { color: C.muted, fontSize: 10, lineHeight: 16 },
  button: { backgroundColor: "#176579", borderRadius: 11, paddingVertical: 13, paddingHorizontal: 14, alignItems: "center", marginTop: 8 }, buttonSecondary: { backgroundColor: C.panel2 }, buttonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10, letterSpacing: 0.6 },
  metrics: { flexDirection: "row", gap: 10 }, metric: { flex: 1 }, panel: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 17, padding: 16, gap: 9 }, metricLabel: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 }, metricValue: { color: C.text, fontSize: 23, fontWeight: "900" }, metricFoot: { color: C.muted, fontSize: 10 },
  sectionTitle: { color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginTop: 5 }, quickGrid: { flexDirection: "row", gap: 8 }, quickCard: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, gap: 5 }, quickIcon: { color: C.cyan, fontSize: 19 }, quickTitle: { color: C.text, fontSize: 11, fontWeight: "800" },
  panelTitle: { color: C.text, fontSize: 14, fontWeight: "800" }, body: { color: "#B2C0D1", fontSize: 12, lineHeight: 19 }, heading: { gap: 4, marginBottom: 3 }, pageTitle: { color: C.text, fontSize: 26, fontWeight: "900" },
  emptyChat: { alignItems: "center", paddingVertical: 28, marginTop: 12 }, emptyIcon: { color: C.cyan, fontSize: 30, marginBottom: 6 }, message: { padding: 13, borderRadius: 14, borderWidth: 1, gap: 6 }, userMessage: { backgroundColor: "#123449", borderColor: "#28617A", marginLeft: 30 }, aiMessage: { backgroundColor: C.panel, borderColor: C.line, marginRight: 18 }, messageRole: { color: C.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  composer: { flexDirection: "row", gap: 8, alignItems: "flex-end", padding: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg }, composerInput: { flex: 1, maxHeight: 110, minHeight: 45, color: C.text, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13 }, sendButton: { width: 45, height: 45, borderRadius: 13, backgroundColor: "#176579", alignItems: "center", justifyContent: "center" }, sendText: { color: "#FFF", fontSize: 23, fontWeight: "800" }, error: { color: C.red, fontSize: 11, lineHeight: 17 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, statusTag: { fontSize: 9, fontWeight: "900" }, quoteCard: { gap: 10 }, quoteSymbol: { color: C.text, fontSize: 16, fontWeight: "900" }, quotePrice: { color: C.cyan, fontSize: 21, fontWeight: "900" },
  progressTrack: { height: 6, backgroundColor: "#253348", borderRadius: 5, overflow: "hidden", marginTop: 5 }, progressFill: { height: 6, backgroundColor: C.cyan, borderRadius: 5 }, taskRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12 }, checkCircle: { width: 21, height: 21, borderRadius: 7, borderWidth: 1, borderColor: "#58708A", alignItems: "center", justifyContent: "center" }, checked: { backgroundColor: "#176579", borderColor: C.cyan }, checkText: { color: "#FFF", fontWeight: "900" }, taskText: { color: C.text, fontSize: 12, flex: 1 }, taskDone: { color: C.muted, textDecorationLine: "line-through" },
  addTaskRow: { flexDirection: "row", gap: 8 }, taskInput: { flex: 1, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 13, fontSize: 12 }, addButton: { width: 45, borderRadius: 12, backgroundColor: "#176579", alignItems: "center", justifyContent: "center" }, addText: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  practiceBanner: { backgroundColor: "#10283A", borderColor: "#245067" }, practiceLock: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#8A6C38", backgroundColor: "#302719", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }, practiceLockText: { color: "#F0C77A", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, practiceChoices: { flexDirection: "row", gap: 7, marginVertical: 5 }, practiceChoice: { flex: 1, padding: 10, borderWidth: 1, borderColor: C.line, borderRadius: 10, alignItems: "center", backgroundColor: C.panel2 }, practiceChoiceActive: { borderColor: C.cyan, backgroundColor: "#123449" }, practiceBuy: { borderColor: C.green, backgroundColor: "#14372F" }, practiceSell: { borderColor: C.red, backgroundColor: "#3A242B" }, practiceChoiceText: { color: C.muted, fontSize: 10, fontWeight: "900" }, practiceChoiceTextActive: { color: C.cyan }, practiceEstimate: { backgroundColor: "#0B1420", borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, gap: 4, marginTop: 5 }, practicePrice: { color: C.cyan, fontSize: 22, fontWeight: "900" }, practiceOrderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, marginTop: 4 }, practiceSideTag: { fontSize: 9, fontWeight: "900" },
  systemPanel: { backgroundColor: "#101F2D", borderColor: "#28506A" }, dashboardGrid: { flexDirection: "row", gap: 10 }, dashboardTile: { flex: 1, minHeight: 105, justifyContent: "space-between" }, tileValue: { color: C.cyan, fontSize: 13, fontWeight: "900", letterSpacing: 0.4 }, moduleCard: { flexDirection: "row", alignItems: "center", gap: 13, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, moduleIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#142A3B", alignItems: "center", justifyContent: "center" }, chevron: { color: C.cyan, fontSize: 25 },
  nav: { height: 67, backgroundColor: "#0D1521", borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-around" }, navItem: { flex: 1, alignItems: "center", gap: 3 }, navIcon: { color: C.muted, fontSize: 19 }, navLabel: { color: C.muted, fontSize: 9, fontWeight: "700" }, navActive: { color: C.cyan },
});
