// ============================================================
//  AddTransactionScreen.tsx
//  Manually add a transaction (completed from Brooklyn's stub)
// ============================================================

import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Switch,
} from "react-native";
import { pythonApi } from "../api/apiClient";

const USER_ID = 1;

const CATEGORIES = [
  "Salary income", "Freelance income", "Rental income",
  "Medical expenses", "Retirement contribution", "Travel - business",
  "Home office", "Software & subscriptions", "Professional development",
  "Business meals", "Groceries", "Entertainment", "Utilities",
  "Transport", "Bank charges", "Uncategorised",
];

export default function AddTransactionScreen({ navigation }: any) {
  const [description, setDescription] = useState("");
  const [amount, setAmount]           = useState("");
  const [date, setDate]               = useState(new Date().toISOString().split("T")[0]);
  const [merchant, setMerchant]       = useState("");
  const [sourceBank, setSourceBank]   = useState("");
  const [categoryIndex, setCategoryIndex] = useState(15); // Uncategorised default
  const [isIncome, setIsIncome]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const handleSubmit = async () => {
    if (!description || !amount || !date) {
      Alert.alert("Missing fields", "Please fill in description, amount and date.");
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      Alert.alert("Invalid amount", "Please enter a valid number for amount.");
      return;
    }

    setLoading(true);
    try {
      await pythonApi.post(`/transactions/manual?user_id=${USER_ID}`, {
        description,
        amount: isIncome ? Math.abs(parsedAmount) : -Math.abs(parsedAmount),
        date,
        merchant: merchant || null,
        source_bank: sourceBank || null,
        category_name: CATEGORIES[categoryIndex],
      });

      Alert.alert("Success", "Transaction added successfully!", [
        { text: "Add Another", onPress: () => resetForm() },
        { text: "Done", onPress: () => navigation.navigate("Transactions") },
      ]);
    } catch (e) {
      Alert.alert("Error", "Could not save transaction. Make sure the Python API is running.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDescription(""); setAmount(""); setMerchant("");
    setSourceBank(""); setCategoryIndex(15); setIsIncome(false);
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Add Transaction</Text>

      <View style={styles.form}>
        {/* Income / Expense toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {isIncome ? "💚 Income" : "🔴 Expense"}
          </Text>
          <Switch value={isIncome} onValueChange={setIsIncome} trackColor={{ true: "#34C759", false: "#FF3B30" }} />
        </View>

        <InputField label="Description *" value={description} onChangeText={setDescription} placeholder="e.g. Woolworths groceries" keyboardType="default" />
        <InputField label="Amount (R) *" value={amount} onChangeText={setAmount} placeholder="e.g. 450.00" />
        <InputField label="Date *" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="default" />
        <InputField label="Merchant" value={merchant} onChangeText={setMerchant} placeholder="e.g. Woolworths" keyboardType="default" />
        <InputField label="Bank" value={sourceBank} onChangeText={setSourceBank} placeholder="e.g. FNB" keyboardType="default" />

        {/* Category picker */}
        <Text style={styles.inputLabel}>Category</Text>
        <TouchableOpacity style={styles.categoryBtn} onPress={() => setShowCategories(!showCategories)}>
          <Text style={styles.categoryBtnText}>{CATEGORIES[categoryIndex]}</Text>
          <Text style={styles.categoryArrow}>{showCategories ? "▲" : "▼"}</Text>
        </TouchableOpacity>

        {showCategories && (
          <View style={styles.categoryList}>
            {CATEGORIES.map((cat, idx) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryItem, idx === categoryIndex && styles.categoryItemActive]}
                onPress={() => { setCategoryIndex(idx); setShowCategories(false); }}
              >
                <Text style={[styles.categoryItemText, idx === categoryIndex && styles.categoryItemTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Save Transaction</Text>
          }
        </TouchableOpacity>
      </View>

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

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: "#f5f5f5" },
  heading:              { fontSize: 22, fontWeight: "700", color: "#1a1a1a", margin: 16 },
  form:                 { backgroundColor: "#fff", marginHorizontal: 12, borderRadius: 14, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  toggleRow:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  toggleLabel:          { fontSize: 16, fontWeight: "700" },
  inputGroup:           { marginBottom: 14 },
  inputLabel:           { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 5 },
  input:                { borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 8, padding: 11, fontSize: 15, color: "#1a1a1a", backgroundColor: "#fafafa" },
  categoryBtn:          { borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 8, padding: 11, backgroundColor: "#fafafa", flexDirection: "row", justifyContent: "space-between" },
  categoryBtnText:      { fontSize: 15, color: "#1a1a1a" },
  categoryArrow:        { fontSize: 12, color: "#888" },
  categoryList:         { borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 8, marginTop: 4, marginBottom: 14, overflow: "hidden" },
  categoryItem:         { padding: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  categoryItemActive:   { backgroundColor: "#007AFF" },
  categoryItemText:     { fontSize: 14, color: "#333" },
  categoryItemTextActive: { color: "#fff", fontWeight: "600" },
  submitBtn:            { backgroundColor: "#007AFF", borderRadius: 10, padding: 15, alignItems: "center", marginTop: 6 },
  submitBtnDisabled:    { opacity: 0.6 },
  submitBtnText:        { color: "#fff", fontSize: 16, fontWeight: "700" },
});
