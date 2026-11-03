import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Asset = "EUR/USD" | "GBP/USD" | "XAU/USD";
type Side = "BUY" | "SELL";
type Position = { id: number; asset: Asset; side: Side; entry: number; units: number };

const STARTING_BALANCE = 10000;
const INITIAL_PRICES: Record<Asset, number> = {
  "EUR/USD": 1.085,
  "GBP/USD": 1.27,
  "XAU/USD": 2350,
};

const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const price = (asset: Asset, value: number) =>
  value.toFixed(asset === "XAU/USD" ? 2 : 5);

export default function App() {
  const [asset, setAsset] = useState<Asset>("EUR/USD");
  const [prices] = useState(INITIAL_PRICES);
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [closedPnl, setClosedPnl] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [notice, setNotice] = useState(
    "NOVA is ready. Market values shown here are placeholders, not live quotes."
  );

  const unrealized = useMemo(
    () =>
      positions.reduce((sum, p) => {
        const move = prices[p.asset] - p.entry;
        return sum + move * p.units * (p.side === "BUY" ? 1 : -1);
      }, 0),
    [positions, prices]
  );

  function openPaperPosition(side: Side) {
    const units = asset === "XAU/USD" ? 1 : 1000;
    const next: Position = {
      id: Date.now(),
      asset,
      side,
      entry: prices[asset],
      units,
    };
    setPositions((current) => [...current, next]);
    setNotice(
      `Paper ${side} opened for ${asset}. This is a hypothetical position only.`
    );
  }

  function closePaperPosition(position: Position) {
    const move = prices[position.asset] - position.entry;
    const pnl = move * position.units * (position.side === "BUY" ? 1 : -1);
    setPositions((current) => current.filter((p) => p.id !== position.id));
    setBalance((current) => current + pnl);
    setClosedPnl((current) => current + pnl);
    setNotice(`Paper position closed. Hypothetical result: ${money(pnl)}.`);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>N</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>NOVA <Text style={styles.cyan}>TRADER AI</Text></Text>
            <Text style={styles.muted}>Forex & gold market research</Text>
          </View>
          <View style={styles.demoBadge}><Text style={styles.demoText}>PAPER</Text></View>
        </View>

        <View style={styles.warning}>
          <Text style={styles.warningTitle}>DEVELOPMENT MODE</Text>
          <Text style={styles.warningText}>
            No broker connection or live orders. Prices are placeholders and all positions are simulated.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>VIRTUAL ACCOUNT BALANCE</Text>
          <Text style={styles.balance}>{money(balance)}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.label}>OPEN POSITIONS</Text>
              <Text style={styles.statValue}>{positions.length}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.label}>CLOSED P/L</Text>
              <Text style={[styles.statValue, closedPnl >= 0 ? styles.green : styles.red]}>
                {money(closedPnl)}
              </Text>
            </View>
          </View>
          <Text style={styles.muted}>Unrealized paper P/L: {money(unrealized)}</Text>
        </View>

        <Text style={styles.sectionTitle}>MARKETS</Text>
        <View style={styles.marketRow}>
          {(["EUR/USD", "GBP/USD", "XAU/USD"] as Asset[]).map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setAsset(item)}
              style={[styles.marketButton, asset === item && styles.marketSelected]}
            >
              <Text style={[styles.marketName, asset === item && styles.cyan]}>{item}</Text>
              <Text style={styles.marketType}>{item === "XAU/USD" ? "GOLD" : "FOREX"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>SELECTED INSTRUMENT · PLACEHOLDER PRICE</Text>
          <Text style={styles.instrument}>{asset}</Text>
          <Text style={styles.quote}>{price(asset, prices[asset])}</Text>
          <Text style={styles.muted}>Waiting for a verified read-only market-data source.</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.buyButton} onPress={() => openPaperPosition("BUY")}>
              <Text style={styles.actionText}>PAPER BUY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sellButton} onPress={() => openPaperPosition("SELL")}>
              <Text style={styles.actionText}>PAPER SELL</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>OPEN PAPER POSITIONS</Text>
        <View style={styles.card}>
          {positions.length === 0 ? (
            <Text style={styles.muted}>No open positions. Choose an instrument and create a paper trade.</Text>
          ) : (
            positions.map((p) => (
              <View key={p.id} style={styles.positionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.positionTitle}>{p.asset} · {p.side}</Text>
                  <Text style={styles.muted}>Entry {price(p.asset, p.entry)} · {p.units} units</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={() => closePaperPosition(p)}>
                  <Text style={styles.closeText}>CLOSE</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>NOVA ACTIVITY</Text>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
        <Text style={styles.footer}>NOVA v0.1 · Research and paper-trading prototype</Text>
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
  demoBadge: { borderWidth: 1, borderColor: "#3A8C78", backgroundColor: "#12352F", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  demoText: { color: "#8DF0C8", fontSize: 10, fontWeight: "800" },
  warning: { borderWidth: 1, borderColor: "#705B31", backgroundColor: "#2A2418", borderRadius: 13, padding: 13, marginBottom: 15 },
  warningTitle: { color: "#F6D58D", fontSize: 11, fontWeight: "900", marginBottom: 4 },
  warningText: { color: "#E8D7B1", fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: "#101E30", borderColor: "#233951", borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  label: { color: "#9BB0C8", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  balance: { color: "#F0F6FF", fontSize: 30, fontWeight: "800", marginTop: 7, marginBottom: 15 },
  statsRow: { flexDirection: "row", gap: 20, borderTopWidth: 1, borderTopColor: "#233951", paddingTop: 13, marginBottom: 9 },
  stat: { flex: 1 },
  statValue: { color: "#F0F6FF", fontSize: 18, fontWeight: "800", marginTop: 5 },
  green: { color: "#51D6A2" },
  red: { color: "#FF7185" },
  sectionTitle: { color: "#9BB0C8", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginTop: 9, marginBottom: 10 },
  marketRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  marketButton: { flex: 1, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: "#233951", backgroundColor: "#101E30" },
  marketSelected: { borderColor: "#54D8E8", backgroundColor: "#112B3A" },
  marketName: { color: "#F0F6FF", fontSize: 12, fontWeight: "800" },
  marketType: { color: "#9BB0C8", fontSize: 9, marginTop: 5 },
  instrument: { color: "#F0F6FF", fontSize: 17, fontWeight: "800", marginTop: 8 },
  quote: { color: "#54D8E8", fontSize: 29, fontWeight: "800", marginVertical: 5 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 15 },
  buyButton: { flex: 1, backgroundColor: "#167A62", padding: 13, borderRadius: 10, alignItems: "center" },
  sellButton: { flex: 1, backgroundColor: "#913B50", padding: 13, borderRadius: 10, alignItems: "center" },
  actionText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },
  positionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#233951" },
  positionTitle: { color: "#F0F6FF", fontSize: 13, fontWeight: "800" },
  closeButton: { borderWidth: 1, borderColor: "#8A4052", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  closeText: { color: "#FF9CAC", fontSize: 10, fontWeight: "800" },
  noticeText: { color: "#D5E2F0", fontSize: 12, lineHeight: 19, marginTop: 7 },
  footer: { color: "#71869E", fontSize: 10, textAlign: "center", marginTop: 7 },
});