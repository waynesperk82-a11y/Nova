import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";

type Tab = "Home" | "Intelligence" | "Markets" | "Workspace";
type SymbolCode = "EUR/USD" | "GBP/USD" | "XAU/USD";
type Quote = { symbol: SymbolCode; price: string; quote_time: string | null; source: string; currency: string | null };
type MarketResponse = { data: Quote[]; status: string; fetched_at: string; errors?: string[] };
type ChatMessage = { role: "user" | "assistant"; content: string };
type Task = { id: number; title: string; done: boolean };

const API_BASE = process.env.EXPO_PUBLIC_NOVA_API_URL?.replace(/\/$/, "");
const SYMBOLS: SymbolCode[] = ["EUR/USD", "GBP/USD", "XAU/USD"];
const C = { bg: "#080D16", panel: "#111A28", panel2: "#152235", line: "#26364B", text: "#F2F6FC", muted: "#91A2B8", cyan: "#57DCEB", green: "#72D6B0", red: "#F18D91" };

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
      const response = await fetch(`${API_BASE}/api/markets`);
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
    <View style={styles.hero}><View style={styles.brandMark}><Text style={styles.brandMarkText}>N</Text></View><View style={{ flex: 1 }}><Text style={styles.brand}>NOVA <Text style={styles.cyan}>2.0</Text></Text><Text style={styles.muted}>Your personal intelligence workspace</Text></View><View style={styles.livePill}><View style={styles.dot} /><Text style={styles.liveText}>NOVA 2.0</Text></View></View>
    <View style={styles.welcome}><Text style={styles.eyebrow}>THINK CLEARER. BUILD FASTER.</Text><Text style={styles.welcomeTitle}>What are we working on?</Text><Text style={styles.muted}>Research, plan, analyze and organize your next steps from one workspace.</Text><Button label="OPEN INTELLIGENCE  →" onPress={() => setTab("Intelligence")} /></View>
    <View style={styles.metrics}><Panel style={styles.metric}><Text style={styles.metricLabel}>WORKSPACE TASKS</Text><Text style={styles.metricValue}>{completedTasks}/{tasks.length}</Text><Text style={styles.metricFoot}>Completed</Text></Panel><Panel style={styles.metric}><Text style={styles.metricLabel}>MARKET FEED</Text><Text style={[styles.metricValue, { color: quotes.length ? C.green : C.muted }]}>{quotes.length ? "LIVE DATA" : "OFFLINE"}</Text><Text style={styles.metricFoot}>Provider dependent</Text></Panel></View>
    <Text style={styles.sectionTitle}>QUICK ACCESS</Text>
    <View style={styles.quickGrid}>{(["Intelligence", "Markets", "Workspace"] as Tab[]).map((item, i) => <TouchableOpacity key={item} style={styles.quickCard} onPress={() => setTab(item)}><Text style={styles.quickIcon}>{["✳", "⌁", "▤"][i]}</Text><Text style={styles.quickTitle}>{item}</Text><Text style={styles.mutedSmall}>{["Ask and explore", "Read-only quotes", "Projects and tasks"][i]}</Text></TouchableOpacity>)}</View>
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
    <Panel><View style={styles.rowBetween}><Text style={styles.panelTitle}>Market data connection</Text><Text style={[styles.statusTag, { color: quotes.length ? C.green : C.red }]}>{quotes.length ? "● CONNECTED" : "● UNAVAILABLE"}</Text></View><Text style={styles.body}>{marketError || "Values below are returned by Twelve Data. Check provider timestamps for freshness."}</Text><Button label={marketLoading ? "REFRESHING…" : "REFRESH REAL MARKET DATA"} onPress={refreshMarkets} disabled={marketLoading} /><Text style={styles.mutedSmall}>Received by NOVA: {timeLabel(marketFetched)}</Text></Panel>
    <Text style={styles.sectionTitle}>WATCHLIST</Text>
    {SYMBOLS.map(symbol => { const q = quoteFor(symbol); return <Panel key={symbol} style={styles.quoteCard}><View style={styles.rowBetween}><View><Text style={styles.quoteSymbol}>{symbol}</Text><Text style={styles.mutedSmall}>{symbol === "XAU/USD" ? "GOLD SPOT" : "FOREIGN EXCHANGE"}</Text></View><View style={{ alignItems: "flex-end" }}><Text style={styles.quotePrice}>{q?.price ?? "—"}</Text><Text style={styles.mutedSmall}>{q?.source ?? "No verified quote"}</Text></View></View><Text style={styles.mutedSmall}>Provider timestamp: {timeLabel(q?.quote_time)}</Text></Panel>; })}
    <Panel><Text style={styles.panelTitle}>Data integrity</Text><Text style={styles.body}>NOVA never invents missing prices, creates sample profit/loss or connects to a broker to place orders. Market information is not financial advice.</Text></Panel>
  </ScrollView>;

  const renderWorkspace = () => <ScrollView contentContainerStyle={styles.content}>
    <Heading title="Workspace" subtitle="Keep projects and next actions organized" />
    <Panel><Text style={styles.eyebrow}>TASK OVERVIEW</Text><Text style={styles.metricValue}>{completedTasks} of {tasks.length}</Text><Text style={styles.muted}>Tasks completed</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: tasks.length ? `${completedTasks / tasks.length * 100}%` : "0%" }]} /></View></Panel>
    <Text style={styles.sectionTitle}>YOUR TASKS</Text>
    {tasks.map(task => <TouchableOpacity key={task.id} onPress={() => setTasks(current => current.map(t => t.id === task.id ? { ...t, done: !t.done } : t))} style={styles.taskRow}><View style={[styles.checkCircle, task.done && styles.checked]}><Text style={styles.checkText}>{task.done ? "✓" : ""}</Text></View><Text style={[styles.taskText, task.done && styles.taskDone]}>{task.title}</Text></TouchableOpacity>)}
    <View style={styles.addTaskRow}><TextInput value={newTask} onChangeText={setNewTask} placeholder="Add a task…" placeholderTextColor={C.muted} style={styles.taskInput} onSubmitEditing={addTask} returnKeyType="done" /><TouchableOpacity style={styles.addButton} onPress={addTask}><Text style={styles.addText}>+</Text></TouchableOpacity></View>
    <Panel><Text style={styles.panelTitle}>Project space</Text><Text style={styles.body}>This first workspace stores tasks locally in the running app. Cloud sync, accounts and shared projects are not enabled yet.</Text></Panel>
  </ScrollView>;

  const screens: Record<Tab, () => React.ReactNode> = { Home: renderHome, Intelligence: renderIntelligence, Markets: renderMarkets, Workspace: renderWorkspace };
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={C.bg} /><View style={styles.topBar}><Text style={styles.topBrand}>NOVA<Text style={styles.cyan}>.</Text></Text><Text style={styles.topMeta}>PERSONAL INTELLIGENCE</Text></View><View style={{ flex: 1 }}>{screens[tab]()}</View><View style={styles.nav}>{(["Home", "Intelligence", "Markets", "Workspace"] as Tab[]).map((item, i) => <TouchableOpacity key={item} onPress={() => setTab(item)} style={styles.navItem}><Text style={[styles.navIcon, tab === item && { color: C.cyan }]}>{["⌂", "✳", "⌁", "▤"][i]}</Text><Text style={[styles.navLabel, tab === item && styles.navActive]}>{item}</Text></TouchableOpacity>)}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topBar: { height: 54, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#1B293B" },
  topBrand: { color: C.text, fontSize: 19, fontWeight: "900", letterSpacing: 2 }, topMeta: { color: C.muted, fontSize: 9, letterSpacing: 1.2, fontWeight: "700" },
  content: { padding: 18, paddingBottom: 28, gap: 14 },
  hero: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 5 },
  brandMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.cyan, alignItems: "center", justifyContent: "center" }, brandMarkText: { color: C.bg, fontWeight: "900", fontSize: 25 },
  brand: { color: C.text, fontSize: 18, fontWeight: "900", letterSpacing: 1.5 }, cyan: { color: C.cyan },
  livePill: { borderWidth: 1, borderColor: "#285747", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }, liveText: { color: C.green, fontSize: 8, fontWeight: "900" },
  welcome: { backgroundColor: "#10283A", borderColor: "#245067", borderWidth: 1, borderRadius: 20, padding: 19, gap: 11, marginBottom: 3 }, eyebrow: { color: C.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 }, welcomeTitle: { color: C.text, fontSize: 25, fontWeight: "800", lineHeight: 31 },
  muted: { color: C.muted, fontSize: 12, lineHeight: 19 }, mutedSmall: { color: C.muted, fontSize: 10, lineHeight: 16 },
  button: { backgroundColor: "#176579", borderRadius: 11, paddingVertical: 13, paddingHorizontal: 14, alignItems: "center", marginTop: 8 }, buttonSecondary: { backgroundColor: C.panel2 }, buttonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10, letterSpacing: 0.6 },
  metrics: { flexDirection: "row", gap: 10 }, metric: { flex: 1 }, panel: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 15, padding: 15, gap: 8 }, metricLabel: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 }, metricValue: { color: C.text, fontSize: 23, fontWeight: "900" }, metricFoot: { color: C.muted, fontSize: 10 },
  sectionTitle: { color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginTop: 5 }, quickGrid: { flexDirection: "row", gap: 8 }, quickCard: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, gap: 5 }, quickIcon: { color: C.cyan, fontSize: 19 }, quickTitle: { color: C.text, fontSize: 11, fontWeight: "800" },
  panelTitle: { color: C.text, fontSize: 14, fontWeight: "800" }, body: { color: "#B2C0D1", fontSize: 12, lineHeight: 19 }, heading: { gap: 4, marginBottom: 3 }, pageTitle: { color: C.text, fontSize: 26, fontWeight: "900" },
  emptyChat: { alignItems: "center", paddingVertical: 28, marginTop: 12 }, emptyIcon: { color: C.cyan, fontSize: 30, marginBottom: 6 }, message: { padding: 13, borderRadius: 14, borderWidth: 1, gap: 6 }, userMessage: { backgroundColor: "#123449", borderColor: "#28617A", marginLeft: 30 }, aiMessage: { backgroundColor: C.panel, borderColor: C.line, marginRight: 18 }, messageRole: { color: C.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  composer: { flexDirection: "row", gap: 8, alignItems: "flex-end", padding: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg }, composerInput: { flex: 1, maxHeight: 110, minHeight: 45, color: C.text, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13 }, sendButton: { width: 45, height: 45, borderRadius: 13, backgroundColor: "#176579", alignItems: "center", justifyContent: "center" }, sendText: { color: "#FFF", fontSize: 23, fontWeight: "800" }, error: { color: C.red, fontSize: 11, lineHeight: 17 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, statusTag: { fontSize: 9, fontWeight: "900" }, quoteCard: { gap: 10 }, quoteSymbol: { color: C.text, fontSize: 16, fontWeight: "900" }, quotePrice: { color: C.cyan, fontSize: 21, fontWeight: "900" },
  progressTrack: { height: 6, backgroundColor: "#253348", borderRadius: 5, overflow: "hidden", marginTop: 5 }, progressFill: { height: 6, backgroundColor: C.cyan, borderRadius: 5 }, taskRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12 }, checkCircle: { width: 21, height: 21, borderRadius: 7, borderWidth: 1, borderColor: "#58708A", alignItems: "center", justifyContent: "center" }, checked: { backgroundColor: "#176579", borderColor: C.cyan }, checkText: { color: "#FFF", fontWeight: "900" }, taskText: { color: C.text, fontSize: 12, flex: 1 }, taskDone: { color: C.muted, textDecorationLine: "line-through" },
  addTaskRow: { flexDirection: "row", gap: 8 }, taskInput: { flex: 1, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 13, fontSize: 12 }, addButton: { width: 45, borderRadius: 12, backgroundColor: "#176579", alignItems: "center", justifyContent: "center" }, addText: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  nav: { height: 67, backgroundColor: "#0D1521", borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-around" }, navItem: { flex: 1, alignItems: "center", gap: 3 }, navIcon: { color: C.muted, fontSize: 19 }, navLabel: { color: C.muted, fontSize: 9, fontWeight: "700" }, navActive: { color: C.cyan },
});
