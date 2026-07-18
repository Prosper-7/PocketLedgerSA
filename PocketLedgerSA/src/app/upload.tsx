import { useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { uploadStatement } from '@/api/client';

const USER_ID = 1;

export default function UploadScreen() {
  const [status, setStatus]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ imported: number; duplicates: number; flags_raised: number } | null>(null);

  const handlePick = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/csv',
               'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });

      if (picked.canceled || !picked.assets?.length) {
        setStatus('Selection cancelled.');
        return;
      }

      const file = picked.assets[0];
      setStatus(`Selected: ${file.name}`);
      setLoading(true);
      setResult(null);

      const res = await uploadStatement(USER_ID, file.uri, file.name, file.mimeType ?? 'application/pdf');
      setResult(res.data);
      setStatus('Upload complete!');
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? 'Upload failed. Make sure the Python API is running.';
      setStatus('Upload failed.');
      Alert.alert('Upload Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThemedText type="subtitle" style={styles.heading}>Upload Statement</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sub}>
        Upload a PDF or Excel bank statement to auto-import and categorise your transactions.
      </ThemedText>

      <TouchableOpacity onPress={handlePick} disabled={loading} style={[styles.btn, loading && styles.btnDisabled]}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <ThemedText style={styles.btnText}>📄  Choose File</ThemedText>
        }
      </TouchableOpacity>

      {status ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.status}>{status}</ThemedText>
      ) : null}

      {result && (
        <ThemedView type="backgroundElement" style={styles.resultCard}>
          <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>Import Summary</ThemedText>
          <Row label="Transactions imported" value={String(result.imported)}   color="#34C759" />
          <Row label="Duplicates skipped"    value={String(result.duplicates)} color="#FF9500" />
          <Row label="Audit flags raised"    value={String(result.flags_raised)} color={result.flags_raised > 0 ? '#FF3B30' : '#34C759'} />
        </ThemedView>
      )}

      <ThemedView type="backgroundElement" style={styles.infoCard}>
        <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>Supported banks</ThemedText>
        {['FNB', 'ABSA', 'Nedbank', 'Standard Bank', 'Capitec'].map(b => (
          <ThemedText key={b} type="small" themeColor="textSecondary">• {b}</ThemedText>
        ))}
      </ThemedView>
    </SafeAreaView>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="smallBold" style={{ color }}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three },
  heading:   { marginBottom: Spacing.two },
  sub:       { marginBottom: Spacing.four },
  btn:       { backgroundColor: '#007AFF', borderRadius: 12, padding: Spacing.three, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  status:    { marginTop: Spacing.three, textAlign: 'center' },
  resultCard: { marginTop: Spacing.three, borderRadius: 12, padding: Spacing.three },
  infoCard:  { marginTop: Spacing.three, borderRadius: 12, padding: Spacing.three },
});
