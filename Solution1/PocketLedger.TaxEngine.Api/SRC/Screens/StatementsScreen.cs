import React, { useState } from "react";
import { View, Text, Button, StyleSheet, ActivityIndicator, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { uploadStatement } from "../api/taxEngineClient";

export default function StatementsScreen() {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/csv"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setStatus(`Selected: ${file.name}`);
        
        setLoading(true);
        setStatus("Uploading statement to engine...");
        
        const isSuccess = await uploadStatement(file.uri, file.name, file.mimeType || "");
        
        if (isSuccess) {
          setStatus("Statement uploaded successfully!");
          Alert.alert("Success", "Your statement has been parsed and added to your ledger.");
        } else {
          setStatus("Upload failed.");
          Alert.alert("Upload Failed", "Could not process your document.");
        }
      } else {
        setStatus("Selection canceled.");
      }
    } catch (error) {
      console.error(error);
      setStatus("An error occurred.");
      Alert.alert("Error", "Could not process statement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Bank Statement</Text>
      <Text style={styles.subtitle}>Select a PDF or CSV file to auto-populate your ledger</Text>
      
      <Button title="Choose File" onPress={handlePickDocument} disabled={loading} />
      
      {loading && <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 15 }} />}
      {status ? <Text style={styles.statusText}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 24 },
  statusText: { marginTop: 15, fontSize: 14, color: "#333", fontWeight: "500", textAlign: "center" },
});