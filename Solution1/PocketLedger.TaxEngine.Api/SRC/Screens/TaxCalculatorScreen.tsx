// ============================================================
//  TaxCalculatorScreen.tsx
//  Calls Brooklyn's C# Tax Engine to calculate SARS tax.
// ============================================================

import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { calculateTax, TaxResult } from "../api/apiClient";

const USER_ID = 1;

export default function TaxCalculatorScreen() {
  const [grossSalary, setGrossSalary]         = useState("");
  const [freelanceIncome, setFreelanceIncome] = useState("");
  const [retirement, setRetirement]           = useState("");
  const [dependants, setDependants]           = useState("0");
  const [age, setAge]                         = useState("");
  const [taxYear, setTaxYear]                 = useState("2026/2027");
  const [result, setResult]                   = useState<TaxResult | null>(null);
  const [loading, setLoading]                 = useState(false);

  const handleCalculate = async () => {
    if (!grossSalary || !age) {
      Alert.alert("Missing fields", "Please enter at least your gross salary and age.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await calculateTax({
        userId:                        USER_ID,
        taxYear,
        grossSalary:                   parseFloat(grossSalary) || 0,
        freelanceNetIncome:            parseFloat(freelanceIncome) || 0,
        totalRetirementContributions:  parseFloat(retirement) || 0,
        medicalSchemeDependants:       parseInt(dependants) || 0,
        age:                           parseInt(age) || 0,
      });
      setResult(res.data);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Could not reach the Tax Engine. Make sure Brooklyn's API is running.";
      Alert.alert("Calculation Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>SARS Tax Calculator</Text>
      <Text style={styles.subheading}>2026/2027 Tax Year</Text>

      <View style={styles.form}>
        <InputField label="Gross Annual Salary (R)" value={grossSalary} onChangeText={setGrossSalary} placeholder="e.g. 500000" />
        <InputField label="Freelance / Other Income (R)" value={freelanceIncome} onChangeText={setFreelanceIncome} placeholder="e.g. 0" />
        <InputField label="Retirement Contributions (R)" value={retirement} onChangeText={setRetirement} placeholder="e.g. 50000" />
        <InputField label="Medical Aid Dependants" value={dependants} onChangeText={setDependants} placeholder="e.g. 1" keyboardType="numeric" />
        <InputField label="Your Age" value={age} onChangeText={setAge} placeholder="e.g. 30" keyboardType="numeric" />

        <TouchableOpacity
          style={[styles.calcBtn, loading && styles.calcBtnDisabled]}
          onPress={handleCalculate}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.calcBtnText}>Calculate Tax</Text>
          }
        </TouchableOpacity>
      </View>

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Tax Breakdown</Text>

          <ResultRow label="Gross Taxable Income"    value={fmt(result.grossTaxableIncome)} />
          <ResultRow label="Total Deductions Allowed" value={`- ${fmt(result.totalDeductionsAllowed)}`} color="#34C759" />
          <View style={styles.divider} />
          <ResultRow label="Net Taxable Income"      value={fmt(result.netTaxableIncome)} bold />
          <ResultRow label="Base Tax"                value={fmt(result.baseTaxBeforeCredits)} />
          <ResultRow label="Rebates Applied"         value={`- ${fmt(result.totalRebatesApplied)}`} color="#34C759" />
          <ResultRow label="Medical Credits"         value={`- ${fmt(result.totalMedicalCredits)}`} color="#34C759" />
          <View style={styles.divider} />

          <View style={styles.finalRow}>
            <Text style={styles.finalLabel}>Final Tax Owed</Text>
            <Text style={styles.finalValue}>{fmt(result.finalTaxOwed)}</Text>
          </View>

          <View style={styles.effectiveRow}>
            <Text style={styles.effectiveText}>
              Effective rate:{" "}
              {result.grossTaxableIncome > 0
                ? `${((result.finalTaxOwed / result.grossTaxableIncome) * 100).toFixed(1)}%`
                : "0%"}
            </Text>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function InputField({ label, value, onChangeText, placeholder, keyboardType = "decimal-pad" }: any) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        placeholderTextColor="#aaa"
      />
    </View>
  );
}

function ResultRow({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, bold && { fontWeight: "700" }]}>{label}</Text>
      <Text style={[styles.resultValue, color ? { color } : {}, bold && { fontWeight: "700" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#f5f5f5" },
  heading:        { fontSize: 22, fontWeight: "700", color: "#1a1a1a", marginTop: 20, marginHorizontal: 16 },
  subheading:     { fontSize: 14, color: "#888", marginHorizontal: 16, marginBottom: 16 },
  form:           { backgroundColor: "#fff", marginHorizontal: 12, borderRadius: 14, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  inputGroup:     { marginBottom: 14 },
  inputLabel:     { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 5 },
  input:          { borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 8, padding: 11, fontSize: 15, color: "#1a1a1a", backgroundColor: "#fafafa" },
  calcBtn:        { backgroundColor: "#007AFF", borderRadius: 10, padding: 15, alignItems: "center", marginTop: 6 },
  calcBtnDisabled: { opacity: 0.6 },
  calcBtnText:    { color: "#fff", fontSize: 16, fontWeight: "700" },
  resultCard:     { backgroundColor: "#fff", marginHorizontal: 12, marginTop: 16, borderRadius: 14, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  resultTitle:    { fontSize: 17, fontWeight: "700", color: "#1a1a1a", marginBottom: 14 },
  resultRow:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  resultLabel:    { fontSize: 14, color: "#555" },
  resultValue:    { fontSize: 14, color: "#1a1a1a" },
  divider:        { height: 1, backgroundColor: "#f0f0f0", marginVertical: 10 },
  finalRow:       { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  finalLabel:     { fontSize: 17, fontWeight: "700", color: "#1a1a1a" },
  finalValue:     { fontSize: 20, fontWeight: "800", color: "#FF3B30" },
  effectiveRow:   { marginTop: 8, alignItems: "flex-end" },
  effectiveText:  { fontSize: 13, color: "#888" },
});
