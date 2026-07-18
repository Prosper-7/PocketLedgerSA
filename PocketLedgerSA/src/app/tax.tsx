import { useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView,
  StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { calculateTax, TaxResult } from '@/api/client';

const USER_ID = 1;

export default function TaxScreen() {
  const [salary, setSalary]         = useState('');
  const [freelance, setFreelance]   = useState('');
  const [retirement, setRetirement] = useState('');
  const [dependants, setDependants] = useState('0');
  const [age, setAge]               = useState('');
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<TaxResult | null>(null);

  const handleCalc = async () => {
    if (!salary || !age) {
      Alert.alert('Missing fields', 'Please enter at least your gross salary and age.');
      return;
    }
    setLoading(true); setResult(null);
    try {
      const res = await calculateTax({
        userId: USER_ID,
        taxYear: '2026/2027',
        grossSalary: parseFloat(salary) || 0,
        freelanceNetIncome: parseFloat(freelance) || 0,
        totalRetirementContributions: parseFloat(retirement) || 0,
        medicalSchemeDependants: parseInt(dependants) || 0,
        age: parseInt(age) || 0,
      });
      setResult(res.data);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? "Could not reach Brooklyn's Tax Engine. Make sure it's running.");
    } finally { setLoading(false); }
  };

  const fmt = (n: number) =>
    `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <SafeAreaView style={{ paddingBottom: BottomTabInset + Spacing.three }}>
        <ThemedText type="subtitle" style={styles.heading}>Tax Calculator</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sub}>2026/2027 Tax Year</ThemedText>

        <ThemedView type="backgroundElement" style={styles.form}>
          <Field label="Gross Annual Salary (R) *" value={salary}     onChange={setSalary}     placeholder="e.g. 500000" />
          <Field label="Freelance Income (R)"       value={freelance}  onChange={setFreelance}  placeholder="e.g. 0" />
          <Field label="Retirement Contributions (R)" value={retirement} onChange={setRetirement} placeholder="e.g. 50000" />
          <Field label="Medical Aid Dependants"     value={dependants} onChange={setDependants} placeholder="e.g. 1" type="numeric" />
          <Field label="Your Age *"                 value={age}        onChange={setAge}        placeholder="e.g. 30" type="numeric" />

          <TouchableOpacity style={[styles.btn, loading && styles.btnOff]} onPress={handleCalc} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.btnTxt}>Calculate Tax</ThemedText>}
          </TouchableOpacity>
        </ThemedView>

        {result && (
          <ThemedView type="backgroundElement" style={styles.resultCard}>
            <ThemedText type="smallBold" style={{ marginBottom: Spacing.three }}>Tax Breakdown</ThemedText>
            <Row label="Gross Taxable Income"   value={fmt(result.grossTaxableIncome)} />
            <Row label="Total Deductions"       value={`- ${fmt(result.totalDeductionsAllowed)}`} color="#34C759" />
            <View style={styles.divider} />
            <Row label="Net Taxable Income"     value={fmt(result.netTaxableIncome)} bold />
            <Row label="Base Tax"               value={fmt(result.baseTaxBeforeCredits)} />
            <Row label="Rebates Applied"        value={`- ${fmt(result.totalRebatesApplied)}`} color="#34C759" />
            <Row label="Medical Credits"        value={`- ${fmt(result.totalMedicalCredits)}`} color="#34C759" />
            <View style={styles.divider} />
            <View style={styles.finalRow}>
              <ThemedText type="smallBold" style={{ fontSize: 16 }}>Final Tax Owed</ThemedText>
              <ThemedText type="smallBold" style={{ fontSize: 20, color: '#FF3B30' }}>{fmt(result.finalTaxOwed)}</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'right', marginTop: 4 }}>
              Effective rate: {result.grossTaxableIncome > 0
                ? `${((result.finalTaxOwed / result.grossTaxableIncome) * 100).toFixed(1)}%`
                : '0%'}
            </ThemedText>
          </ThemedView>
        )}
      </SafeAreaView>
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, type = 'decimal-pad' }: any) {
  return (
    <View style={{ marginBottom: Spacing.three }}>
      <ThemedText type="small" style={{ marginBottom: 5, fontWeight: '600' }}>{label}</ThemedText>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={type}
        placeholderTextColor="#aaa"
      />
    </View>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <ThemedText type="small" themeColor="textSecondary" style={bold ? { fontWeight: '700' } : {}}>{label}</ThemedText>
      <ThemedText type="small" style={[color ? { color } : {}, bold ? { fontWeight: '700' } : {}]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  heading:    { margin: Spacing.three, marginBottom: Spacing.one },
  sub:        { marginHorizontal: Spacing.three, marginBottom: Spacing.three },
  form:       { marginHorizontal: Spacing.three, borderRadius: 14, padding: Spacing.three },
  input:      { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 11, fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa' },
  btn:        { backgroundColor: '#007AFF', borderRadius: 10, padding: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
  btnOff:     { opacity: 0.6 },
  btnTxt:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultCard: { marginHorizontal: Spacing.three, marginTop: Spacing.three, borderRadius: 14, padding: Spacing.three },
  divider:    { height: 1, backgroundColor: '#e0e0e0', marginVertical: Spacing.two },
  finalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
});
