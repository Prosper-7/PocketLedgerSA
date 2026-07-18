import { useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { checkHealth, getAuditFlags, getTransactions } from '@/api/client';

const USER_ID = 1;

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dbOk, setDbOk]             = useState(false);
  const [income, setIncome]         = useState(0);
  const [expenses, setExpenses]     = useState(0);
  const [deductible, setDeductible] = useState(0);
  const [flagCount, setFlagCount]   = useState(0);

  const load = async () => {
    try {
      const [health, txRes, flagRes] = await Promise.all([
        checkHealth(),
        getTransactions(USER_ID),
        getAuditFlags(USER_ID, false),
      ]);
      setDbOk(health.data.database === 'ok');
      let inc = 0, exp = 0, ded = 0;
      for (const t of txRes.data.transactions ?? []) {
        if (t.amount > 0) inc += t.amount;
        else exp += Math.abs(t.amount);
        if (t.is_deductible) ded += Math.abs(t.amount);
      }
      setIncome(inc); setExpenses(exp); setDeductible(ded);
      setFlagCount(flagRes.data.flags?.length ?? 0);
    } catch { setDbOk(false); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: number) =>
    `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText type="small" style={{ marginTop: 12 }}>Loading your ledger...</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <SafeAreaView style={{ paddingBottom: BottomTabInset + Spacing.three }}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="subtitle">PocketLedger SA</ThemedText>
          <View style={[styles.badge, { backgroundColor: dbOk ? '#34C759' : '#FF3B30' }]}>
            <ThemedText style={styles.badgeText}>{dbOk ? '● Connected' : '● Offline'}</ThemedText>
          </View>
        </View>

        {/* Summary cards */}
        <ThemedText type="smallBold" style={styles.section}>Overview</ThemedText>
        <View style={styles.grid}>
          {[
            { label: 'Total Income',        value: fmt(income),    color: '#34C759' },
            { label: 'Total Expenses',      value: fmt(expenses),  color: '#FF3B30' },
            { label: 'Deductible',          value: fmt(deductible), color: '#007AFF' },
            { label: 'Open Audit Flags',    value: String(flagCount), color: flagCount > 0 ? '#FF9500' : '#34C759' },
          ].map((c) => (
            <ThemedView key={c.label} type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">{c.label}</ThemedText>
              <ThemedText type="smallBold" style={{ color: c.color, marginTop: 4 }}>{c.value}</ThemedText>
            </ThemedView>
          ))}
        </View>

        {/* Quick actions */}
        <ThemedText type="smallBold" style={styles.section}>Quick Actions</ThemedText>
        <View style={styles.grid}>
          {[
            { label: 'Upload Statement', icon: '📄', route: '/upload' },
            { label: 'Transactions',     icon: '💳', route: '/transactions' },
            { label: 'Tax Calculator',   icon: '🧮', route: '/tax' },
            { label: `Flags ${flagCount > 0 ? `(${flagCount})` : ''}`, icon: '🚩', route: '/flags' },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              onPress={() => router.push(a.route as any)}
              style={styles.actionBtn}
            >
              <ThemedView type="backgroundElement" style={styles.actionInner}>
                <ThemedText style={styles.actionIcon}>{a.icon}</ThemedText>
                <ThemedText type="small" style={{ textAlign: 'center', marginTop: 6 }}>{a.label}</ThemedText>
              </ThemedView>
            </TouchableOpacity>
          ))}
        </View>

        {/* Flags warning */}
        {flagCount > 0 && (
          <TouchableOpacity onPress={() => router.push('/flags' as any)} style={styles.warning}>
            <ThemedText type="small" style={{ color: '#856404' }}>
              ⚠️  {flagCount} open audit flag{flagCount > 1 ? 's' : ''} need attention
            </ThemedText>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.three },
  badge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText:  { color: '#fff', fontSize: 12, fontWeight: '600' },
  section:    { marginTop: Spacing.three, marginBottom: Spacing.two, marginHorizontal: Spacing.three },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.two },
  card:       { width: '47%', margin: '1.5%', borderRadius: 12, padding: Spacing.three },
  actionBtn:  { width: '47%', margin: '1.5%' },
  actionInner: { borderRadius: 12, padding: Spacing.three, alignItems: 'center' },
  actionIcon: { fontSize: 28 },
  warning:    { margin: Spacing.three, backgroundColor: '#FFF3CD', borderRadius: 10, padding: Spacing.three, borderLeftWidth: 4, borderLeftColor: '#FF9500' },
});
