// ============================================================
//  DashboardScreen.tsx
//  Home screen — shows a quick summary of the user's
//  transactions, audit flags, and a tax estimate.
// ============================================================

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { getTransactions, getAuditFlags, checkHealth } from "../api/apiClient";

const USER_ID = 1; // Replace with real auth user ID when login is added

interface SummaryCard {
  label: string;
  value: string;
  color: string;
}

export default function DashboardScreen({ navigation }: any) {
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiStatus, setApiStatus] = useState<"ok" | "offline">("offline");
  const [totalIncome, setTotalIncome]   = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [openFlags, setOpenFlags] = useState(0);
  const [deductibleTotal, setDeductibleTotal] = useState(0);

  const loadData = async () => {
    try {
      const [healthRes, txRes, flagRes] = await Promise.all([
        checkHealth(),
        getTransactions(USER_ID),
        getAuditFlags(USER_ID, false),
      ]);

      setApiStatus(healthRes.data.database === "ok" ? "ok" : "offline");

      const transactions: any[] = txRes.data.transactions ?? [];
      let income = 0, expenses = 0, deductible = 0;

      transactions.forEach((t) => {
        if (t.amount > 0) income += t.amount;
        else expenses += Math.abs(t.amount);
        if (t.is_deductible) deductible += Math.abs(t.amount);
      });

      setTotalIncome(income);
      setTotalExpenses(expenses);
      setDeductibleTotal(deductible);
      setOpenFlags(flagRes.data.flags?.length ?? 0);
    } catch (e) {
      setApiStatus("offline");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const fmt = (n: number) =>
    `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cards: SummaryCard[] = [
    { label: "Total Income",       value: fmt(totalIncome),    color: "#34C759" },
    { label: "Total Expenses",     value: fmt(totalExpenses),  color: "#FF3B30" },
    { label: "Deductible Expenses", value: fmt(deductibleTotal), color: "#007AFF" },
    { label: "Open Audit Flags",   value: String(openFlags),   color: openFlags > 0 ? "#FF9500" : "#34C759" },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your ledger...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>PocketLedger SA</Text>
        <View style={[styles.statusBadge, { backgroundColor: apiStatus === "ok" ? "#34C759" : "#FF3B30" }]}>
          <Text style={styles.statusText}>{apiStatus === "ok" ? "● Connected" : "● Offline"}</Text>
        </View>
      </View>

      {/* Summary cards */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.cardGrid}>
        {cards.map((card) => (
          <View key={card.label} style={[styles.card, { borderLeftColor: card.color }]}>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={[styles.cardValue, { color: card.color }]}>{card.value}</Text>
          </View>
        ))}
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Upload")}>
          <Text style={styles.actionIcon}>📄</Text>
          <Text style={styles.actionLabel}>Upload Statement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Transactions")}>
          <Text style={styles.actionIcon}>💳</Text>
          <Text style={styles.actionLabel}>Transactions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("TaxCalc")}>
          <Text style={styles.actionIcon}>🧮</Text>
          <Text style={styles.actionLabel}>Tax Calculator</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, openFlags > 0 && styles.actionBtnAlert]}
          onPress={() => navigation.navigate("AuditFlags")}
        >
          <Text style={styles.actionIcon}>🚩</Text>
          <Text style={styles.actionLabel}>
            Audit Flags {openFlags > 0 ? `(${openFlags})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Flags warning */}
      {openFlags > 0 && (
        <TouchableOpacity
          style={styles.flagWarning}
          onPress={() => navigation.navigate("AuditFlags")}
        >
          <Text style={styles.flagWarningText}>
            ⚠️  You have {openFlags} open audit flag{openFlags > 1 ? "s" : ""} that need attention
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#f5f5f5" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText:  { marginTop: 12, color: "#666" },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "#fff" },
  greeting:     { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText:   { color: "#fff", fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#333", marginTop: 20, marginBottom: 10, marginHorizontal: 16 },
  cardGrid:     { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12 },
  card:         { width: "47%", backgroundColor: "#fff", borderRadius: 12, padding: 16, margin: "1.5%", borderLeftWidth: 4, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardLabel:    { fontSize: 12, color: "#888", marginBottom: 6 },
  cardValue:    { fontSize: 18, fontWeight: "700" },
  actionGrid:   { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12 },
  actionBtn:    { width: "47%", backgroundColor: "#fff", borderRadius: 12, padding: 20, margin: "1.5%", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  actionBtnAlert: { borderWidth: 1.5, borderColor: "#FF9500" },
  actionIcon:   { fontSize: 28, marginBottom: 8 },
  actionLabel:  { fontSize: 13, fontWeight: "600", color: "#333", textAlign: "center" },
  flagWarning:  { margin: 16, backgroundColor: "#FFF3CD", borderRadius: 10, padding: 14, borderLeftWidth: 4, borderLeftColor: "#FF9500" },
  flagWarningText: { color: "#856404", fontSize: 14, fontWeight: "500" },
});
