import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type SymbolCode = "EUR/USD" | "GBP/USD" | "XAU/USD";
type Quote = {
  symbol: SymbolCode;
  price: string;
  quote_time: string | null;
  source: string;
  currency: string | null;
};
type ApiResponse = { data: Quote[]; status: string; fetched_at: string; errors?: string[] };
type ChatMessage = { role: "user" | "assistant"; content: string };
type CoreStatus = { status: string; configured: boolean; provider: string; model: string; mode: string };

const SYMBOLS: SymbolCode[] = ["EUR/USD", "GBP/USD", "XAU/USD"];
const API_BASE = process.env.EXPO_PUBLIC_NOVA_API_URL?.replace(/\/$/, "");

function formatTime(value: string | null | undefined) {
  if (!value) return "Not supplied by data provider";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function App() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [coreStatus, setCoreStatus] = useState<CoreStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hello. I am NOVA. I can help you analyze a problem, structure research, compare options and build a plan. I will be clear about what I know and what still needs a connected tool or human approval." },
  ]);
  const [draft, setDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    if (!API_BASE) return;
    fetch(`${API_BASE}/api/core/status`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not read NOVA Core status.")))
      .then((data: CoreStatus) => setCoreStatus(data))
      .catch(() => setCoreStatus(null));
  }, []);

  const refreshMarkets = useCallback(async () => {
    if (!API_BASE) {
      setMarketError("NOVA server is not connected. Configure EXPO_PUBLIC_NOVA_API_URL.");
      setQuotes([]);
      return;
    }
    setMarketLoading(true);
    setMarketError(null);
    try {
      const response = await fetch(`${API_BASE}/api/markets`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || `Market server returned HTTP ${response.status}`);
      const result = body as ApiResponse;
      if (!Array.isArray(result.data) || result.data.length === 0) {
        throw new Error("The provider returned no market quotes. NOVA will not invent missing values.");
      }
      setQuotes(result.data);
      setLastFetched(result.fetched_at || new Date().toISOString());
      if (result.errors?.length) setMarketError(`Some symbols were unavailable: ${result.errors.join("; ")}`);
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Could not reach the market-data server.");
      setQuotes([]);
    } finally {
      setMarketLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const content = draft.trim();
    if (!content || chatLoading) return;
    if (!API_BASE) {
      setChatError("NOVA server is not connected. Configure EXPO_PUBLIC_NOVA_API_URL.");
      return;
    }
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setChatError(null);
    setChatLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/core/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-12) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || `NOVA Core returned HTTP ${response.status}`);
      if (typeof body.reply !== "string" || !body.reply.trim()) throw new Error("NOVA Core returned an empty response.");
      setMessages((current) => [...current, { role: "assistant", content: body.reply }]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "NOVA could not complete that request.");
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading, draft, messages]);

  const quoteFor = useMemo(() => (symbol: SymbolCode) => quotes.find((quote) => quote.symbol === symbol), [quotes]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logo}><Text style={styles.logoText}>N</Text></View>
            <View style={styles.headerCopy}>
              <Text style={styles.brand}>NOVA <Text style={styles.cyan}>INTELLIGENCE</Text></Text>
              <Text style={styles.muted}>Unified AI workspace · Android first</Text>
            </View>
            <View style={styles.coreBadge}><Text style={styles.coreBadgeText}>CORE</Text></View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>ONE INTELLIGENCE. MANY CAPABILITIES.</Text>
            <Text style={styles.heroTitle}>Think clearly.{"\n"}Plan intelligently.</Text>
            <Text style={styles.heroBody}>NOVA brings reasoning, planning and connected capabilities into one workspace. External actions remain permission-based.</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, coreStatus?.configured ? styles.dotReady : styles.dotOff]} />
              <Text style={styles.statusLabel}>{coreStatus?.configured ? `AI CORE CONNECTED · ${coreStatus.model}` : "AI CORE NEEDS CONFIGURATION"}</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>NOVA CORE</Text>
            <Text style={styles.sectionHint}>CENTRAL INTELLIGENCE</Text>
          </View>
          <View style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <View style={styles.coreIcon}><Text style={styles.coreIconText}>✦</Text></View>
              <View style={styles.headerCopy}>
                <Text style={styles.cardTitle}>Ask NOVA</Text>
                <Text style={styles.muted}>Reasoning · Research planning · Strategy</Text>
              </View>
              <View style={styles.onlineBadge}><Text style={styles.onlineText}>{coreStatus?.configured ? "READY" : "SETUP"}</Text></View>
            </View>
            <View style={styles.messages}>
              {messages.slice(-8).map((item, index) => (
                <View key={`${index}-${item.role}`} style={[styles.messageBubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
                  <Text style={styles.messageRole}>{item.role === "user" ? "YOU" : "NOVA"}</Text>
                  <Text style={styles.messageText}>{item.content}</Text>
                </View>
              ))}
              {chatLoading ? <View style={styles.thinking}><ActivityIndicator color="#58DCEB" /><Text style={styles.muted}>NOVA is thinking…</Text></View> : null}
            </View>
            {chatError ? <Text style={styles.errorText}>{chatError}</Text> : null}
            <View style={styles.composer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask NOVA to analyze or plan something…"
                placeholderTextColor="#71869E"
                style={styles.input}
                multiline
                maxLength={4000}
                editable={!chatLoading}
              />
              <TouchableOpacity style={[styles.sendButton, (!draft.trim() || chatLoading) && styles.disabledButton]} onPress={sendMessage} disabled={!draft.trim() || chatLoading}>
                <Text style={styles.sendText}>SEND</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.disclaimer}>NOVA chat requires a configured AI provider. This version does not independently browse the web or execute external actions.</Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CONNECTED CAPABILITY</Text>
            <Text style={styles.sectionHint}>READ-ONLY MARKET DATA</Text>
          </View>
          <View style={styles.marketCard}>
            <View style={styles.marketTop}>
              <View style={styles.headerCopy}>
                <Text style={styles.cardTitle}>Market intelligence</Text>
                <Text style={styles.muted}>EUR/USD · GBP/USD · XAU/USD</Text>
              </View>
              <View style={styles.readOnlyBadge}><Text style={styles.readOnlyText}>READ ONLY</Text></View>
            </View>
            <Text style={styles.marketDescription}>Live values appear only when the configured market-data provider returns verified quotes.</Text>
            {SYMBOLS.map((symbol) => {
              const quote = quoteFor(symbol);
              return (
                <View key={symbol} style={styles.quoteRow}>
                  <View style={styles.headerCopy}>
                    <Text style={styles.symbol}>{symbol}</Text>
                    <Text style={styles.instrumentType}>{symbol === "XAU/USD" ? "GOLD SPOT" : "FOREIGN EXCHANGE"}</Text>
                  </View>
                  <View style={styles.priceBlock}>
                    <Text style={styles.price}>{quote ? quote.price : "—"}</Text>
                    <Text style={styles.quoteState}>{quote ? quote.source : "No verified quote"}</Text>
                  </View>
                </View>
              );
            })}
            {marketError ? <Text style={styles.errorText}>{marketError}</Text> : null}
            <TouchableOpacity style={styles.refreshButton} onPress={refreshMarkets} disabled={marketLoading}>
              {marketLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.refreshText}>REFRESH REAL MARKET DATA</Text>}
            </TouchableOpacity>
            {lastFetched ? <Text style={styles.fetched}>Received by NOVA: {formatTime(lastFetched)}</Text> : null}
            {quotes.map((quote) => <Text key={quote.symbol} style={styles.timestamp}>{quote.symbol} provider time: {formatTime(quote.quote_time)}</Text>)}
          </View>

          <View style={styles.capabilityGrid}>
            {[
              ["REASONING", "Analyze complex questions"],
              ["PLANNING", "Break goals into steps"],
              ["RESEARCH", "Prepare structured research"],
              ["INTEGRATIONS", "Connect approved tools"],
            ].map(([title, detail]) => (
              <View key={title} style={styles.capability}>
                <Text style={styles.capabilityTitle}>{title}</Text>
                <Text style={styles.capabilityText}>{detail}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.footer}>NOVA · Unified intelligence prototype · Actions require explicit authorization</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#07111F" },
  container: { padding: 18, paddingBottom: 42, width: "100%", maxWidth: 920, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 20 },
  headerCopy: { flex: 1 },
  logo: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#58DCEB", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#07111F", fontSize: 25, fontWeight: "900" },
  brand: { color: "#F0F6FF", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  cyan: { color: "#58DCEB" },
  muted: { color: "#91A9C2", fontSize: 11, lineHeight: 17 },
  coreBadge: { borderWidth: 1, borderColor: "#316E91", backgroundColor: "#102D45", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  coreBadgeText: { color: "#82D9F1", fontSize: 9, fontWeight: "900" },
  hero: { padding: 19, borderRadius: 18, borderWidth: 1, borderColor: "#24435F", backgroundColor: "#0D2034", marginBottom: 22 },
  eyebrow: { color: "#58DCEB", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  heroTitle: { color: "#F0F6FF", fontSize: 29, lineHeight: 35, fontWeight: "900", marginTop: 12 },
  heroBody: { color: "#AFC2D7", fontSize: 12, lineHeight: 19, marginTop: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  statusDot: { width: 7, height: 7, borderRadius: 5 },
  dotReady: { backgroundColor: "#64E5B5" },
  dotOff: { backgroundColor: "#E9B65B" },
  statusLabel: { color: "#B5C8DB", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { color: "#DCEAF8", fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  sectionHint: { color: "#71869E", fontSize: 8, fontWeight: "800", letterSpacing: 0.7 },
  chatCard: { backgroundColor: "#0D1C2D", borderWidth: 1, borderColor: "#24405A", borderRadius: 17, padding: 14, marginBottom: 22 },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: "#20364B" },
  coreIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#143D50", alignItems: "center", justifyContent: "center" },
  coreIconText: { color: "#58DCEB", fontSize: 22, fontWeight: "900" },
  cardTitle: { color: "#F0F6FF", fontSize: 14, fontWeight: "900" },
  onlineBadge: { backgroundColor: "#24364A", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  onlineText: { color: "#9AB6CE", fontSize: 8, fontWeight: "900" },
  messages: { gap: 9, paddingVertical: 12 },
  messageBubble: { borderRadius: 12, padding: 11, maxWidth: "94%" },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#16435A", borderWidth: 1, borderColor: "#28617B" },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: "#14263A", borderWidth: 1, borderColor: "#263E55" },
  messageRole: { color: "#58DCEB", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginBottom: 5 },
  messageText: { color: "#D5E2EF", fontSize: 12, lineHeight: 18 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 9, padding: 8 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, borderWidth: 1, borderColor: "#2A465E", borderRadius: 12, backgroundColor: "#081625", padding: 7 },
  input: { flex: 1, color: "#F0F6FF", fontSize: 12, minHeight: 42, maxHeight: 110, paddingHorizontal: 7, paddingVertical: 8 },
  sendButton: { backgroundColor: "#17647A", borderRadius: 9, paddingHorizontal: 14, paddingVertical: 12 },
  disabledButton: { opacity: 0.45 },
  sendText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  disclaimer: { color: "#71869E", fontSize: 9, lineHeight: 14, marginTop: 9 },
  marketCard: { backgroundColor: "#0D1C2D", borderWidth: 1, borderColor: "#24405A", borderRadius: 17, padding: 14, marginBottom: 16 },
  marketTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  readOnlyBadge: { borderWidth: 1, borderColor: "#3A8C78", backgroundColor: "#12352F", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  readOnlyText: { color: "#8DF0C8", fontSize: 8, fontWeight: "900" },
  marketDescription: { color: "#91A9C2", fontSize: 11, lineHeight: 17, marginTop: 10, marginBottom: 8 },
  quoteRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#1D3348" },
  symbol: { color: "#F0F6FF", fontSize: 14, fontWeight: "900" },
  instrumentType: { color: "#8299B3", fontSize: 8, marginTop: 4, letterSpacing: 0.7 },
  priceBlock: { alignItems: "flex-end" },
  price: { color: "#58DCEB", fontSize: 18, fontWeight: "900" },
  quoteState: { color: "#91A9C2", fontSize: 8, marginTop: 3 },
  refreshButton: { marginTop: 12, backgroundColor: "#1B6578", padding: 12, borderRadius: 10, alignItems: "center", minHeight: 40, justifyContent: "center" },
  refreshText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  fetched: { color: "#849BB4", fontSize: 9, marginTop: 9 },
  timestamp: { color: "#71869E", fontSize: 8, marginTop: 5 },
  errorText: { color: "#FFB4A9", fontSize: 10, lineHeight: 15, marginTop: 8 },
  capabilityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 2 },
  capability: { width: "48%", flexGrow: 1, backgroundColor: "#0D1C2D", borderWidth: 1, borderColor: "#203A52", borderRadius: 12, padding: 12 },
  capabilityTitle: { color: "#58DCEB", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  capabilityText: { color: "#91A9C2", fontSize: 10, lineHeight: 15, marginTop: 5 },
  footer: { color: "#71869E", fontSize: 9, textAlign: "center", marginTop: 20, lineHeight: 14 },
});
