import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";

type Tab = "Dashboard" | "Intelligence" | "Markets" | "Workspace";
type AIMode = "think" | "research" | "create" | "plan";
type SymbolCode = string;
type Quote = { symbol: SymbolCode; price: string; quote_time: string | null; source: string; currency: string | null; open?: string | null; high?: string | null; low?: string | null; previous_close?: string | null; change?: string | null; percent_change?: string | null; volume?: string | null };\ntype Candle = { datetime: string; close: number };\ntype HistoryResponse = { data: Candle[] };
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
const DEFAULT_SYMBOLS: SymbolCode[] = ["EUR/USD", "GBP/USD", "XAU/USD", "BTC/USD", "ETH/USD"];\nconst MARKET_INTERVALS = ["1day", "4h", "1h", "15min"] as const;\ntype MarketInterval = typeof MARKET_INTERVALS[number];
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

export default function App() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [quotes, setQuotes] = useState<Quote[]>([]);\n  const [watchlist, setWatchlist] = useState<SymbolCode[]>(DEFAULT_SYMBOLS);\n  const [newSymbol, setNewSymbol] = useState("");\n  const [selectedSymbol, setSelectedSymbol] = useState<SymbolCode>("BTC/USD");\n  const [marketInterval, setMarketInterval] = useState<MarketInterval>("1day");\n  const [history, setHistory] = useState<Candle[]>([]);\n  const [historyLoading, setHistoryLoading] = useState(false);\n  const [historyError, setHistoryError] = useState<string | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketFetched, setMarketFetched] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiMode, setAiMode] = useState<AIMode>("think");
  const [prompt, setPrompt] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
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
  }, []);

  useEffect(() => { refreshMarkets(); }, [refreshMarkets]);

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
    <View style={styles.hero}><View style={styles.brandMark}><Text style={styles.brandMarkText}>N</Text></View><View style={{ flex: 1 }}><Text style={styles.brand}>NOVA <Text style={styles.cyan}>2.0</Text></Text><Text style={styles.muted}>Your personal intelligence workspace</Text></View><View style={styles.livePill}><View style={styles.dot} /><Text style={styles.liveText}>NOVA 2.0</Text></View></View>
    <View style={styles.welcome}><Text style={styles.eyebrow}>YOUR INTELLIGENCE, IN ONE PLACE</Text><Text style={styles.welcomeTitle}>Good to see you.</Text><Text style={styles.muted}>Think deeply, explore ideas and move your projects forward with NOVA.</Text><Button label="START THINKING  →" onPress={() => setTab("Intelligence")} /></View>
    <View style={styles.metrics}><Panel style={styles.metric}><Text style={styles.metricLabel}>WORKSPACE TASKS</Text><Text style={styles.metricValue}>{completedTasks}/{tasks.length}</Text><Text style={styles.metricFoot}>Completed</Text></Panel><Panel style={styles.metric}><Text style={styles.metricLabel}>MARKET FEED</Text><Text style={[styles.metricValue, { color: quotes.length ? C.green : C.muted }]}>{quotes.length ? "LIVE DATA" : "OFFLINE"}</Text><Text style={styles.metricFoot}>Provider dependent</Text></Panel></View>
    <Text style={styles.sectionTitle}>YOUR AI WORKSPACE</Text>
    <View style={styles.quickGrid}>{(["Intelligence", "Markets", "Workspace"] as Tab[]).map((item, i) => <TouchableOpacity key={item} style={styles.quickCard} onPress={() => setTab(item)}><Text style={styles.quickIcon}>{["✳", "⌁", "▤"][i]}</Text><Text style={styles.quickTitle}>{item}</Text><Text style={styles.mutedSmall}>{["Ask and explore", "Read-only quotes", "Projects and tasks"][i]}</Text></TouchableOpacity>)}</View>
    <Text style={styles.sectionTitle}>TODAY AT A GLANCE</Text>
    <View style={styles.quickGrid}>
      <TouchableOpacity style={styles.quickCard} onPress={() => setTab("Intelligence")}><Text style={styles.quickIcon}>✧</Text><Text style={styles.quickTitle}>Think</Text><Text style={styles.mutedSmall}>Work through a question</Text></TouchableOpacity>
      <TouchableOpacity style={styles.quickCard} onPress={() => setTab("Intelligence")}><Text style={[styles.quickIcon, { color: C.purple }]}>◎</Text><Text style={styles.quickTitle}>Create</Text><Text style={styles.mutedSmall}>Shape a new idea</Text></TouchableOpacity>
      <TouchableOpacity style={styles.quickCard} onPress={() => setTab("Workspace")}><Text style={styles.quickIcon}>▤</Text><Text style={styles.quickTitle}>Organize</Text><Text style={styles.mutedSmall}>Move tasks forward</Text></TouchableOpacity>
    </View>
    <Panel><View style={styles.rowBetween}><Text style={styles.panelTitle}>Your next step</Text><Text style={styles.statusTag}>WORKSPACE</Text></View><Text style={styles.body}>{tasks.find(t => !t.done)?.title || "All current tasks are complete. Add a new milestone in Workspace."}</Text><Button label="OPEN WORKSPACE  →" onPress={() => setTab("Workspace")} secondary /></Panel>
    <Panel><Text style={styles.panelTitle}>NOVA operating principles</Text><Text style={styles.body}>Clear answers · Transparent data · Human approval for important actions. NOVA does not execute trades or control physical equipment.</Text></Panel>
  </ScrollView>;

  const renderIntelligence = () => <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.chatHeader}><Heading title="Intelligence" subtitle="Choose how NOVA approaches your request" /><TouchableOpacity onPress={() => { setMessages([]); setChatError(null); }} disabled={messages.length === 0 || chatLoading} style={[styles.clearButton, (messages.length === 0 || chatLoading) && { opacity: 0.35 }]}><Text style={styles.clearButtonText}>NEW CHAT</Text></TouchableOpacity></View>
      <View style={styles.modeWrap}>{AI_MODES.map(item => <TouchableOpacity key={item.id} onPress={() => setAiMode(item.id)} style={[styles.modeChip, aiMode === item.id && styles.modeChipActive]}><Text style={[styles.modeIcon, aiMode === item.id && styles.modeTextActive]}>{item.icon}</Text><Text style={[styles.modeLabel, aiMode === item.id && styles.modeTextActive]}>{item.label}</Text><Text style={styles.modeDetail}>{item.detail}</Text></TouchableOpacity>)}</View>
      <Panel><Text style={styles.eyebrow}>{aiMode.toUpperCase()} MODE</Text><Text style={styles.panelTitle}>NOVA AI ASSISTANT</Text><Text style={styles.panelTitle}>A focused thinking partner</Text><Text style={styles.body}>{AI_MODES.find(item => item.id === aiMode)?.detail}. NOVA adapts its response structure to this mode while keeping uncertainty visible.</Text></Panel>
      {messages.length === 0 ? <Panel style={styles.emptyChat}><Text style={styles.emptyIcon}>✳</Text><Text style={styles.panelTitle}>Start a conversation</Text><Text style={styles.muted}>Choose a mode, then try one of these prompts.</Text><View style={styles.suggestionRow}><TouchableOpacity style={styles.suggestionChip} onPress={() => setPrompt("Compare three ways to improve NOVA’s intelligence.")}><Text style={styles.mutedSmall}>Improve NOVA</Text></TouchableOpacity><TouchableOpacity style={styles.suggestionChip} onPress={() => setPrompt("Create an original feature idea for NOVA.")}><Text style={styles.mutedSmall}>Invent a feature</Text></TouchableOpacity></View></Panel> : messages.map((m, i) => <View key={i} style={[styles.message, m.role === "user" ? styles.userMessage : styles.aiMessage]}><Text style={styles.messageRole}>{m.role === "user" ? "YOU" : "NOVA"}</Text><Text style={styles.body}>{m.content}</Text></View>)}
      {chatLoading ? <Panel><ActivityIndicator color={C.cyan} /><Text style={[styles.muted, { textAlign: "center", marginTop: 8 }]}>NOVA is thinking…</Text></Panel> : null}
      {chatError ? <Text style={styles.error}>{chatError}</Text> : null}
    </ScrollView>
    <View style={styles.composer}><TextInput value={prompt} onChangeText={setPrompt} placeholder="Ask NOVA anything…" placeholderTextColor={C.muted} multiline style={styles.composerInput} /><TouchableOpacity onPress={sendMessage} disabled={!prompt.trim() || chatLoading} style={[styles.sendButton, (!prompt.trim() || chatLoading) && { opacity: 0.45 }]}><Text style={styles.sendText}>↑</Text></TouchableOpacity></View>
  </KeyboardAvoidingView>;

  const renderMarkets = () => {
    const selectedQuote = quoteFor(selectedSymbol);
    const values = history.map(point => point.close).filter(value => Number.isFinite(value) && value > 0);
    const minValue = values.length ? Math.min(...values) : 0, maxValue = values.length ? Math.max(...values) : 0;
    const range = maxValue - minValue || 1, first = values[0], last = values[values.length - 1];
    const chartChange = values.length > 1 ? ((last - first) / first) * 100 : 0, chartPositive = chartChange >= 0;
    return <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.marketHero}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>NOVA MARKET INTELLIGENCE</Text><Text style={styles.pageTitle}>Markets</Text><Text style={styles.muted}>Your customizable forex, crypto, stock and commodity watchlist.</Text></View><View style={styles.marketLive}><View style={styles.dot} /><Text style={styles.liveText}>DATA FEED</Text></View></View>
      <Panel><View style={styles.rowBetween}><View><Text style={styles.panelTitle}>Market data connection</Text><Text style={styles.mutedSmall}>Twelve Data · read-only</Text></View><Text style={[styles.statusTag, { color: quotes.length ? C.green : C.red }]}>{quotes.length ? "● CONNECTED" : "● UNAVAILABLE"}</Text></View><Text style={styles.body}>{marketError || "Prices are provider-supplied. Provider timestamps are shown with each quote."}</Text><View style={styles.rowBetween}><Text style={styles.mutedSmall}>Retrieved: {timeLabel(marketFetched)}</Text><Button label={marketLoading ? "UPDATING…" : "↻ REFRESH"} onPress={refreshMarkets} disabled={marketLoading} secondary /></View></Panel>
      <View style={styles.addMarketPanel}><Text style={styles.panelTitle}>Customize watchlist</Text><Text style={styles.mutedSmall}>Add BTC/USD, ETH/USD, SOL/USD, AAPL, USD/JPY or another provider-supported symbol.</Text><View style={styles.addTaskRow}><TextInput value={newSymbol} onChangeText={setNewSymbol} placeholder="Enter symbol…" placeholderTextColor={C.muted} autoCapitalize="characters" style={styles.taskInput} onSubmitEditing={() => addMarketSymbol(newSymbol)} returnKeyType="done" /><TouchableOpacity style={styles.addButton} onPress={() => addMarketSymbol(newSymbol)}><Text style={styles.addText}>+</Text></TouchableOpacity></View><View style={styles.quickAssets}>{["BTC/USD","ETH/USD","SOL/USD","AAPL","USD/JPY"].map(symbol => <TouchableOpacity key={symbol} style={styles.assetChip} onPress={() => addMarketSymbol(symbol)}><Text style={styles.assetChipText}>+ {symbol}</Text></TouchableOpacity>)}</View><Text style={styles.mutedSmall}>Up to 20 symbols. Provider plan determines availability.</Text></View>
      <Text style={styles.sectionTitle}>YOUR WATCHLIST · {watchlist.length} ASSETS</Text>
      {watchlist.map(symbol => { const q = quoteFor(symbol); const positive = Number(q?.percent_change ?? q?.change ?? 0) >= 0; return <TouchableOpacity key={symbol} onPress={() => setSelectedSymbol(symbol)} style={[styles.marketAsset, selectedSymbol === symbol && styles.marketAssetSelected]}><View style={styles.assetIcon}><Text style={styles.assetIconText}>{symbol.startsWith("BTC") ? "₿" : symbol.startsWith("ETH") ? "Ξ" : symbol.startsWith("XAU") ? "Au" : symbol.split("/")[0].slice(0,2)}</Text></View><View style={{ flex: 1, gap: 3 }}><Text style={styles.quoteSymbol}>{symbol}</Text><Text style={styles.mutedSmall}>{["BTC","ETH","SOL"].some(s => symbol.startsWith(s)) ? "CRYPTO" : symbol.startsWith("XAU") ? "COMMODITY" : symbol.includes("/") ? "FOREX" : "EQUITY / INDEX"}</Text></View><View style={{ alignItems: "flex-end", gap: 3 }}><Text style={styles.quotePrice}>{q ? q.price : "—"}</Text><Text style={[styles.changeText, { color: positive ? C.green : C.red }]}>{q?.percent_change ? (positive ? "+" : "") + q.percent_change + "%" : q ? "Change n/a" : "Price unavailable"}</Text></View><TouchableOpacity onPress={() => setWatchlist(current => current.filter(item => item !== symbol))} style={styles.removeAsset}><Text style={styles.removeAssetText}>×</Text></TouchableOpacity></TouchableOpacity>; })}
      <Panel style={styles.chartPanel}><View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>PRICE HISTORY</Text><Text style={styles.panelTitle}>{selectedSymbol}</Text></View><Text style={[styles.chartDelta, { color: chartPositive ? C.green : C.red }]}>{values.length > 1 ? (chartPositive ? "+" : "") + chartChange.toFixed(2) + "%" : "—"}</Text></View><Text style={styles.chartPrice}>{selectedQuote?.price ?? "—"}</Text><Text style={styles.mutedSmall}>{selectedQuote ? "Latest quote · " + timeLabel(selectedQuote.quote_time) : "Waiting for verified quote"}</Text><View style={styles.intervalRow}>{MARKET_INTERVALS.map(interval => <TouchableOpacity key={interval} onPress={() => setMarketInterval(interval)} style={[styles.intervalChip, marketInterval === interval && styles.intervalChipActive]}><Text style={[styles.intervalText, marketInterval === interval && styles.intervalTextActive]}>{interval === "1day" ? "1D" : interval === "4h" ? "4H" : interval === "1h" ? "1H" : "15M"}</Text></TouchableOpacity>)}</View>{historyLoading ? <ActivityIndicator color={C.cyan} style={{ marginVertical: 30 }} /> : history.length ? <View style={styles.chartWrap}><View style={styles.chartLabels}><Text style={styles.mutedSmall}>{maxValue.toLocaleString(undefined,{maximumFractionDigits:4})}</Text><Text style={styles.mutedSmall}>{minValue.toLocaleString(undefined,{maximumFractionDigits:4})}</Text></View><View style={styles.chartBars}>{history.slice(-48).map((point,index) => <View key={point.datetime + index} style={[styles.chartBar, { height: 12 + ((point.close - minValue) / range) * 112, backgroundColor: chartPositive ? C.green : C.red }]} />)}</View></View> : <View style={styles.chartEmpty}><Text style={styles.muted}>{historyError || "No verified chart history is available."}</Text></View>}<View style={styles.rowBetween}><Text style={styles.mutedSmall}>{history.length ? history.length + " provider data points" : "No chart data"}</Text><Text style={styles.mutedSmall}>Source: Twelve Data</Text></View></Panel>
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
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={C.bg} /><View style={styles.topBar}><Text style={styles.topBrand}>NOVA<Text style={styles.cyan}>.</Text></Text><Text style={styles.topMeta}>PERSONAL INTELLIGENCE</Text></View><View style={{ flex: 1 }}>{screens[tab]()}</View><View style={styles.nav}>{(["Dashboard", "Intelligence", "Markets", "Workspace"] as Tab[]).map((item, i) => <TouchableOpacity key={item} onPress={() => setTab(item)} style={styles.navItem}><Text style={[styles.navIcon, tab === item && { color: C.cyan }]}>{["◫", "✳", "⌁", "▤"][i]}</Text><Text style={[styles.navLabel, tab === item && styles.navActive]}>{item}</Text></TouchableOpacity>)}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topBar: { height: 58, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#1B293B" },
  topBrand: { color: C.text, fontSize: 19, fontWeight: "900", letterSpacing: 2 }, topMeta: { color: C.muted, fontSize: 9, letterSpacing: 1.2, fontWeight: "700" },
  content: { padding: 18, paddingBottom: 28, gap: 14 },
  hero: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 5 },
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
  marketHero: { flexDirection: "row", alignItems: "center", gap: 10 }, marketLive: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#285747", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 }, addMarketPanel: { backgroundColor: "#111D30", borderColor: "#344A70", borderWidth: 1, borderRadius: 15, padding: 15, gap: 9 }, quickAssets: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, assetChip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 }, assetChipText: { color: "#BFD2F5", fontSize: 9, fontWeight: "800" }, marketAsset: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 13, padding: 11 }, marketAssetSelected: { borderColor: "#5279C4", backgroundColor: "#14223A" }, assetIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" }, assetIconText: { color: C.cyan, fontWeight: "900", fontSize: 12 }, changeText: { fontSize: 10, fontWeight: "800" }, removeAsset: { width: 25, height: 25, alignItems: "center", justifyContent: "center" }, removeAssetText: { color: C.muted, fontSize: 20 }, chartPanel: { gap: 10 }, chartDelta: { fontSize: 13, fontWeight: "900" }, chartPrice: { color: C.text, fontSize: 28, fontWeight: "900" }, intervalRow: { flexDirection: "row", gap: 7, marginTop: 4 }, intervalChip: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 9, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2 }, intervalChipActive: { borderColor: "#5279C4", backgroundColor: "#20385E" }, intervalText: { color: C.muted, fontSize: 10, fontWeight: "800" }, intervalTextActive: { color: "#D8E5FF" }, chartWrap: { height: 150, flexDirection: "row", gap: 8, paddingTop: 7 }, chartLabels: { justifyContent: "space-between", paddingBottom: 8 }, chartBars: { flex: 1, height: 130, flexDirection: "row", alignItems: "flex-end", gap: 2, borderBottomWidth: 1, borderBottomColor: C.line }, chartBar: { flex: 1, minWidth: 2, borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: 0.82 }, chartEmpty: { minHeight: 100, justifyContent: "center", alignItems: "center", padding: 15, backgroundColor: "#0D1521", borderRadius: 12 }, detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, detailCell: { width: "30%", gap: 3 }, detailValue: { color: C.text, fontSize: 12, fontWeight: "800" },\n  progressTrack: { height: 6, backgroundColor: "#253348", borderRadius: 5, overflow: "hidden", marginTop: 5 }, progressFill: { height: 6, backgroundColor: C.cyan, borderRadius: 5 }, taskRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12 }, checkCircle: { width: 21, height: 21, borderRadius: 7, borderWidth: 1, borderColor: "#58708A", alignItems: "center", justifyContent: "center" }, checked: { backgroundColor: "#426ED0", borderColor: C.cyan }, checkText: { color: "#FFF", fontWeight: "900" }, taskText: { color: C.text, fontSize: 12, flex: 1 }, taskDone: { color: C.muted, textDecorationLine: "line-through" },
  addTaskRow: { flexDirection: "row", gap: 8 }, taskInput: { flex: 1, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 13, fontSize: 12 }, addButton: { width: 45, borderRadius: 12, backgroundColor: "#426ED0", alignItems: "center", justifyContent: "center" }, addText: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  nav: { height: 67, backgroundColor: "#0D1521", borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-around" }, navItem: { flex: 1, alignItems: "center", gap: 3 }, navIcon: { color: C.muted, fontSize: 19 }, navLabel: { color: C.muted, fontSize: 9, fontWeight: "700" }, navActive: { color: C.cyan },
});
