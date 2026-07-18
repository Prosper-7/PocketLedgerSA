import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { AuditFlag, getAuditFlags, resolveAuditFlag } from '@/api/client';

const USER_ID = 1;

const SEV_COLOR: Record<string, string> = { high: '#FF3B30', medium: '#FF9500', low: '#34C759' };
const FLAG_ICON: Record<string, string> = { duplicate: '🔁', missing_receipt: '🧾', outlier: '📈', other: '🚩' };

export default function FlagsScreen() {
  const [flags, setFlags]           = useState<AuditFlag[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [resolving, setResolving]   = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await getAuditFlags(USER_ID, showResolved);
      setFlags(res.data.flags ?? []);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [showResolved]);

  const handleResolve = (id: number) => {
    Alert.alert('Resolve Flag', 'Mark this flag as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve', onPress: async () => {
          setResolving(id);
          try {
            await resolveAuditFlag(id);
            setFlags(f => f.filter(x => x.flag_id !== id));
          } catch { Alert.alert('Error', 'Could not resolve. Try again.'); }
          finally { setResolving(null); }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: AuditFlag }) => (
    <ThemedView type="backgroundElement" style={[styles.card, { borderLeftColor: SEV_COLOR[item.severity] }]}>
      <View style={styles.cardTop}>
        <ThemedText style={styles.icon}>{FLAG_ICON[item.flag_type] ?? '🚩'}</ThemedText>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">
            {item.flag_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </ThemedText>
          <View style={[styles.sevBadge, { backgroundColor: SEV_COLOR[item.severity] }]}>
            <ThemedText style={styles.sevText}>{item.severity.toUpperCase()}</ThemedText>
          </View>
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
        {item.description}
      </ThemedText>
      <View style={styles.cardBottom}>
        <ThemedText type="small" themeColor="textSecondary">{item.created_at?.split('T')[0]}</ThemedText>
        {!item.resolved && (
          <TouchableOpacity style={styles.resolveBtn} onPress={() => handleResolve(item.flag_id)} disabled={resolving === item.flag_id}>
            {resolving === item.flag_id
              ? <ActivityIndicator size="small" color="#fff" />
              : <ThemedText style={styles.resolveTxt}>Resolve</ThemedText>
            }
          </TouchableOpacity>
        )}
      </View>
    </ThemedView>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.toggle}>
        {(['Open', 'Resolved'] as const).map(label => {
          const active = (label === 'Resolved') === showResolved;
          return (
            <TouchableOpacity key={label} style={[styles.toggleBtn, active && styles.toggleActive]}
              onPress={() => setShowResolved(label === 'Resolved')}>
              <ThemedText type="small" style={active ? { fontWeight: '700' } : {}}>{label}</ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
      <FlatList
        data={flags}
        keyExtractor={i => String(i.flag_id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three }}
        ListEmptyComponent={
          <View style={styles.center}>
            <ThemedText style={{ fontSize: 48 }}>{showResolved ? '✅' : '🎉'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
              {showResolved ? 'No resolved flags yet.' : "No open flags — you're all clear!"}
            </ThemedText>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  toggle:      { flexDirection: 'row', margin: Spacing.three, backgroundColor: '#e0e0e0', borderRadius: 10, padding: 3 },
  toggleBtn:   { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  toggleActive: { backgroundColor: '#fff' },
  card:        { marginHorizontal: Spacing.three, marginBottom: Spacing.two, borderRadius: 12, padding: Spacing.three, borderLeftWidth: 4 },
  cardTop:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.two, gap: Spacing.two },
  icon:        { fontSize: 24 },
  sevBadge:    { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  sevText:     { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resolveBtn:  { backgroundColor: '#007AFF', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  resolveTxt:  { color: '#fff', fontSize: 13, fontWeight: '600' },
});
