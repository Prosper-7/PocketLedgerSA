// ============================================================
//  AuditFlagsScreen.tsx
//  Shows open audit flags raised by the Python Intelligence
//  Service. User can mark them as resolved.
// ============================================================

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { getAuditFlags, resolveFlag } from "../api/apiClient";

const USER_ID = 1;

interface AuditFlag {
  flag_id: number;
  transaction_id: number | null;
  flag_type: string;
  severity: "low" | "medium" | "high";
  description: string;
  resolved: boolean;
  created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  high:   "#FF3B30",
  medium: "#FF9500",
  low:    "#34C759",
};

const FLAG_ICONS: Record<string, string> = {
  duplicate:       "🔁",
  missing_receipt: "🧾",
  outlier:         "📈",
  other:           "🚩",
};

export default function AuditFlagsScreen() {
  const [flags, setFlags]         = useState<AuditFlag[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [resolving, setResolving] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await getAuditFlags(USER_ID, showResolved);
      setFlags(res.data.flags ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [showResolved]);

  const handleResolve = (flagId: number) => {
    Alert.alert(
      "Resolve Flag",
      "Mark this flag as resolved? This means you have reviewed and addressed the issue.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resolve",
          style: "default",
          onPress: async () => {
            setResolving(flagId);
            try {
              await resolveFlag(flagId);
              setFlags((prev) => prev.filter((f) => f.flag_id !== flagId));
            } catch (e) {
              Alert.alert("Error", "Could not resolve flag. Try again.");
            } finally {
              setResolving(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: AuditFlag }) => (
    <View style={[styles.card, { borderLeftColor: SEVERITY_COLORS[item.severity] }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.flagIcon}>{FLAG_ICONS[item.flag_type] ?? "🚩"}</Text>
        <View style={styles.cardHeaderText}>
          <Text style={styles.flagType}>
            {item.flag_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[item.severity] }]}>
            <Text style={styles.severityText}>{item.severity.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.description}>{item.description}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.date}>{item.created_at?.split("T")[0]}</Text>
        {!item.resolved && (
          <TouchableOpacity
            style={styles.resolveBtn}
            onPress={() => handleResolve(item.flag_id)}
            disabled={resolving === item.flag_id}
          >
            {resolving === item.flag_id
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.resolveBtnText}>Mark Resolved</Text>
            }
          </TouchableOpacity>
        )}
      </View>
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
      {/* Toggle open/resolved */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, !showResolved && styles.toggleActive]}
          onPress={() => setShowResolved(false)}
        >
          <Text style={[styles.toggleText, !showResolved && styles.toggleTextActive]}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, showResolved && styles.toggleActive]}
          onPress={() => setShowResolved(true)}
        >
          <Text style={[styles.toggleText, showResolved && styles.toggleTextActive]}>Resolved</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={flags}
        keyExtractor={(item) => String(item.flag_id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{showResolved ? "✅" : "🎉"}</Text>
            <Text style={styles.emptyText}>
              {showResolved ? "No resolved flags yet." : "No open flags — you're all clear!"}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#f5f5f5" },
  center:          { flex: 1, justifyContent: "center", alignItems: "center" },
  toggleRow:       { flexDirection: "row", margin: 12, backgroundColor: "#e0e0e0", borderRadius: 10, padding: 3 },
  toggleBtn:       { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  toggleActive:    { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  toggleText:      { fontSize: 14, color: "#888", fontWeight: "600" },
  toggleTextActive: { color: "#333" },
  card:            { backgroundColor: "#fff", marginHorizontal: 12, marginBottom: 10, borderRadius: 12, padding: 14, borderLeftWidth: 4, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader:      { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  flagIcon:        { fontSize: 24, marginRight: 10 },
  cardHeaderText:  { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  flagType:        { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  severityBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  severityText:    { color: "#fff", fontSize: 10, fontWeight: "700" },
  description:     { fontSize: 13, color: "#555", lineHeight: 19, marginBottom: 10 },
  cardFooter:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date:            { fontSize: 12, color: "#aaa" },
  resolveBtn:      { backgroundColor: "#007AFF", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  resolveBtnText:  { color: "#fff", fontSize: 13, fontWeight: "600" },
  empty:           { alignItems: "center", marginTop: 80 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyText:       { fontSize: 16, fontWeight: "600", color: "#333" },
});
