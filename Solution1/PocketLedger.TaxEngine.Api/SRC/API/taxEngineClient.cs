import axios from "axios";
import Constants from "expo-constants";

// Resolves to your local backend API url
const baseURL = Constants.expoConfig?.extra?.taxEngineApiUrl ?? "http://localhost:5001/api";

export const taxEngineClient = axios.create({ baseURL });

export interface TaxCalculationResult {
  taxableIncome: number;
  grossTaxBeforeRebates: number;
  rebatesApplied: number;
}

// API helper to upload statements
export const uploadStatement = async (fileUri: string, fileName: string, mimeType: string): Promise<boolean> => {
  try {
    const formData = new FormData();
    // @ts-ignore
    formData.append("statement", {
      uri: fileUri,
      name: fileName,
      type: mimeType || "application/pdf",
    });

    const response = await taxEngineClient.post("/statements/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.status === 200 || response.status === 201;
  } catch (error) {
    console.error("Statement Upload Error:", error);
    return false;
  }
};