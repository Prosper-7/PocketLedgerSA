// ============================================================
//  TransactionsScreen.tsx
//  Shows all transactions for the user, grouped by date.
//  Filterable by category. Colour coded income vs expense.
// ============================================================

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, TextInput,
} from "react-native";
import { getTransactions } from "../api/apiClient";

const USER_ID = 1;

interface Transaction {
  transaction_id: string;
  date: string;
  amount: number;
  description: string;
  merchant: string;
  source_bank: string;
  is_duplicate: boolean;
  category_name: string;
  is_deductible: boolean;
}

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filtered, setFiltered]         = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState("");

  const load = async () => {
    try {
      const res = await getTransactions(USER_ID);
      const txns = res.data.transactions ?? [];
      setTransactions(txns);
      setFiltered(txns);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(transactions);
    } else {
      const q = search.toLowerCase();
      setFiltered(
        transactions.filter(
          (t) =>
            t.description?.toLowerCase().includes(q) ||
            t.merchant?.toLowerCase().includes(q) ||
            t.category_name?.toLowerCase().includes(q)
        )
      );
    }
  }, [search, transactions]);

  const fmt = (n: number) =>
    `${n >= 0 ? "+" : ""}R ${Math.abs(n).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={[styles.txnCard, item.is_duplicate && styles.duplicateCard]}>
      <View style={styles.txnLeft}>
        <Text style={styles.txnMerchant}>{item.merchant || item.description}</Text>
        <Text style={styles.txnMeta}>
          {item.category_name}
          {item.is_deductible ? "  ✅ Deductible" : ""}
          {item.is_duplicate ? "  ⚠️ Duplicate" : ""}
        </Text>
        <Text style={styles.txnBank}>{item.source_bank} • {item.date?.split("T")[0]}</Text>
      </View>
      <Text style={[styles.txnAmount, { color: item.amount >= 0 ? "#34C759" : "#FF3B30" }]}>
        {fmt(item.amount)}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search by merchant, description or category..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#aaa"
      />

      <Text style={styles.count}>{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.transaction_id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions found.</Text>
            <Text style={styles.emptySubText}>Upload a bank statement to get started.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#f5f5f5" },
  center:        { flex: 1, justifyContent: "center", alignItems: "center" },
  search:        { margin: 12, padding: 12, backgroundColor: "#fff", borderRadius: 10, fontSize: 14, color: "#333", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  count:         { marginHorizontal: 16, marginBottom: 6, color: "#888", fontSize: 13 },
  txnCard:       { backgroundColor: "#fff", marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  duplicateCard: { borderLeftWidth: 3, borderLeftColor: "#FF9500", opacity: 0.75 },
  txnLeft:       { flex: 1, marginRight: 12 },
  txnMerchant:   { fontSize: 15, fontWeight: "600", color: "#1a1a1a", marginBottom: 3 },
  txnMeta:       { fontSize: 12, color: "#666", marginBottom: 2 },
  txnBank:       { fontSize: 11, color: "#aaa" },
  txnAmount:     { fontSize: 16, fontWeight: "700" },
  empty:         { alignItems: "center", marginTop: 60 },
  emptyText:     { fontSize: 16, fontWeight: "600", color: "#333" },
  emptySubText:  { fontSize: 13, color: "#888", marginTop: 6 },
});
