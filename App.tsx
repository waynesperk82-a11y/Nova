import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
type ApiResponse = { data: Quote[]; status: string; fetched_at: string };

const SYMBOLS: SymbolCode[] = ["EUR/USD", "GBP/USD", "XAU/USD"];
const API_BASE = process.env.EXPO_PUBLIC_NOVA_API_URL?.replace(/\/$/, "");

function formatTime(value: string | null | undefined) {
  if (!value) return "Not supplied by data provider";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function App() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!API_BASE) {
      setError("Market-data server is not connected. Set EXPO_PUBLIC_NOVA_API_URL to your deployed NOVA read-only API.");
      setQuotes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/markets`);
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail || `Market-data server returned HTTP ${response.status}`);
      }
      const result = body as ApiResponse;
      if (!Array.isArray(result.data) || result.data.length === 0) {
        throw new Error("The provider returned no market quotes. NOVA will not fill missing values with estimates.");
      }
      setQuotes(result.data);
      setLastFetched(result.fetched_at || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the market-data server.");
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const quoteFor = (symbol: SymbolCode) => quotes.find((quote) => quote.symbol === symbol);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>N</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>NOVA <Text style={styles.cyan}>MARKET AI</Text></Text>
            <Text style={styles.muted}>Real market data · Research dashboard</Text>
          </View>
          <View style={styles.readOnlyBadge}><Text style={styles.readOnlyText}>READ ONLY</Text></View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusTop}>
            <ActivityIndicator color={loading ? "#54D8E8" : "#91A9C2"} animating={loading} />
            <Text style={styles.statusTitle}>{loading ? "CONNECTING TO MARKET DATA" : quotes.length ? "DATA RECEIVED" : "NOT CONNECTED"}</Text>
          </View>
          <Text style={styles.statusBody}>
            {error || (quotes.length ? "Quotes below were returned by the configured data provider. Check each provider timestamp for freshness." : "No market prices are displayed until a genuine data connection succeeds.")}
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={refresh} disabled={loading}>
            <Text style={styles.refreshText}>{loading ? "FETCHING…" : "REFRESH REAL MARKET DATA"}</Text>
          </TouchableOpacity>
          {lastFetched ? <Text style={styles.fetched}>Received by NOVA: {formatTime(lastFetched)}</Text> : null}
        </View>

        <Text style={styles.sectionTitle}>WATCHLIST</Text>
        {SYMBOLS.map((symbol) => {
          const quote = quoteFor(symbol);
          return (
            <View key={symbol} style={styles.quoteCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.symbol}>{symbol}</Text>
                <Text style={styles.instrumentType}>{symbol === "XAU/USD" ? "GOLD SPOT" : "FOREIGN EXCHANGE"}</Text>
              </View>
              <View style={styles.priceBlock}>
                <Text style={styles.price}>{quote ? quote.price : "—"}</Text>
                <Text style={styles.quoteState}>{quote ? quote.source : "No quote"}</Text>
              </View>
              <Text style={styles.timestamp}>Provider timestamp: {quote ? formatTime(quote.quote_time) : "Unavailable"}</Text>
            </View>
          );
        })}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ABOUT THIS VERSION</Text>
          <Text style={styles.infoText}>
            NOVA displays provider-supplied market information only. It does not create sample prices, estimate missing quotes, simulate accounts, or place orders. A blank quote means no verified data was received.
          </Text>
        </View>
        <Text style={styles.footer}>NOVA · Real-data dashboard · No order execution</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#07111F" },
  container: { padding: 18, paddingBottom: 36 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 20 },
  logo: { width: 43, height: 43, borderRadius: 13, backgroundColor: "#54D8E8", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#07111F", fontSize: 24, fontWeight: "900" },
  brand: { color: "#F0F6FF", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  cyan: { color: "#54D8E8" },
  muted: { color: "#9BB0C8", fontSize: 12, lineHeight: 18 },
  readOnlyBadge: { borderWidth: 1, borderColor: "#3A8C78", backgroundColor: "#12352F", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  readOnlyText: { color: "#8DF0C8", fontSize: 9, fontWeight: "900" },
  statusCard: { borderWidth: 1, borderColor: "#2A4A63", backgroundColor: "#102237", borderRadius: 15, padding: 15, marginBottom: 20 },
  statusTop: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 },
  statusTitle: { color: "#DCEAF8", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  statusBody: { color: "#AFC2D7", fontSize: 12, lineHeight: 19 },
  refreshButton: { marginTop: 13, backgroundColor: "#1B6578", padding: 13, borderRadius: 10, alignItems: "center" },
  refreshText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  fetched: { color: "#849BB4", fontSize: 10, marginTop: 9 },
  sectionTitle: { color: "#9BB0C8", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 },
  quoteCard: { backgroundColor: "#101E30", borderColor: "#233951", borderWidth: 1, borderRadius: 14, padding: 15, marginBottom: 10, flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  symbol: { color: "#F0F6FF", fontSize: 16, fontWeight: "900" },
  instrumentType: { color: "#8299B3", fontSize: 9, marginTop: 4, letterSpacing: 0.7 },
  priceBlock: { alignItems: "flex-end" },
  price: { color: "#54D8E8", fontSize: 21, fontWeight: "900" },
  quoteState: { color: "#91A9C2", fontSize: 9, marginTop: 3 },
  timestamp: { width: "100%", color: "#8299B3", fontSize: 10, marginTop: 11 },
  infoCard: { backgroundColor: "#101E30", borderColor: "#233951", borderWidth: 1, borderRadius: 14, padding: 15, marginTop: 8 },
  infoTitle: { color: "#54D8E8", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  infoText: { color: "#AFC2D7", fontSize: 12, lineHeight: 19, marginTop: 7 },
  footer: { color: "#71869E", fontSize: 10, textAlign: "center", marginTop: 18 },
});
