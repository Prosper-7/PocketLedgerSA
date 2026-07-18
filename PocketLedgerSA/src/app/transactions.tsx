import { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl,
  StyleSheet, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { getTransactions, Transaction } from '@/api/client';

const USER_ID = 1;

export default function TransactionsScreen() {
  const [all, setAll]             = useState<Transaction[]>([]);
  const [filtered, setFiltered]   = useState<Transaction[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');

  const load = async () => {
    try {
      const res = await getTransactions(USER_ID);
      const txns = res.data.transactions ?? [];
      setAll(txns); setFiltered(txns);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(all); return; }
    const q = search.toLowerCase();
    setFiltered(all.filter(t =>
      t.description?.toLowerCase().includes(q) ||
      t.merchant?.toLowerCase().includes(q) ||
      t.category_name?.toLowerCase().includes(q)
    ));
  }, [search, all]);

  const fmt = (n: number) =>
    `${n >= 0 ? '+' : ''}R ${Math.abs(n).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  const renderItem = ({ item }: { item: Transaction }) => (
    <ThemedView type="backgroundElement" style={[styles.card, item.is_duplicate && styles.dup]}>
      <View style={styles.cardLeft}>
        <ThemedText type="smallBold">{item.merchant || item.description}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.category_name}{item.is_deductible ? '  ✅' : ''}{item.is_duplicate ? '  ⚠️ Dup' : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.source_bank} • {item.date?.split('T')[0]}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={{ color: item.amount >= 0 ? '#34C759' : '#FF3B30' }}>
        {fmt(item.amount)}
      </ThemedText>
    </ThemedView>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TextInput
        style={styles.search}
        placeholder="Search transactions..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#aaa"
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
        {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
      </ThemedText>
      <FlatList
        data={filtered}
        keyExtractor={i => i.transaction_id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three }}
        ListEmptyComponent={
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">No transactions yet. Upload a bank statement to get started.</ThemedText>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  search:    { margin: Spacing.three, padding: Spacing.three, borderRadius: 10, backgroundColor: '#f0f0f0', fontSize: 14, color: '#333' },
  count:     { marginHorizontal: Spacing.three, marginBottom: Spacing.two },
  card:      { marginHorizontal: Spacing.three, marginBottom: Spacing.two, borderRadius: 12, padding: Spacing.three, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dup:       { borderLeftWidth: 3, borderLeftColor: '#FF9500', opacity: 0.75 },
  cardLeft:  { flex: 1, marginRight: Spacing.two, gap: 2 },
});
