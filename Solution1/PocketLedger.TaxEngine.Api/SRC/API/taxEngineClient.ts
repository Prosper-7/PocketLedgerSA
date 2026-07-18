// ============================================================
//  apiClient.ts
//  Connects to BOTH backends:
//    - Prosper's Python Intelligence Service (port 8000)
//    - Brooklyn's C# Tax Engine (port 7056)
//
//  IMPORTANT: Replace YOUR_MAC_IP and BROOKLYN_PC_IP with
//  actual IPs from running `ifconfig` (Mac) or `ipconfig` (Windows)
// ============================================================

import axios from "axios";

// ── Python Intelligence Service (Prosper) ─────────────────────
const PYTHON_API_URL = "http://10.0.0.32:8000";

export const pythonApi = axios.create({
  baseURL: PYTHON_API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── C# Tax Engine (Brooklyn) ──────────────────────────────────
const TAX_ENGINE_URL = "http://41.10.13.19:7056";

export const taxEngineApi = axios.create({
  baseURL: TAX_ENGINE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── Python API helpers ────────────────────────────────────────

export const checkHealth = () =>
  pythonApi.get("/health");

export const getTransactions = (userId: number, categoryId?: number) =>
  pythonApi.get(`/transactions/${userId}`, {
    params: categoryId ? { category_id: categoryId } : {},
  });

export const getAuditFlags = (userId: number, resolved = false) =>
  pythonApi.get(`/audit-flags/${userId}`, { params: { resolved } });

export const resolveFlag = (flagId: number) =>
  pythonApi.put(`/audit-flags/${flagId}/resolve`);

export const uploadBankStatement = async (
  userId: number,
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<{ imported: number; duplicates: number; flags_raised: number }> => {
  const formData = new FormData();
  // @ts-ignore — React Native FormData accepts this shape
  formData.append("file", { uri: fileUri, name: fileName, type: mimeType });

  const response = await pythonApi.post(
    `/statements/upload?user_id=${userId}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return response.data;
};

// ── C# Tax Engine helpers ─────────────────────────────────────

export interface TaxRequest {
  userId: number;
  taxYear: string;
  grossSalary: number;
  freelanceNetIncome: number;
  totalRetirementContributions: number;
  medicalSchemeDependants: number;
  age: number;
}

export interface TaxResult {
  taxYear: string;
  grossTaxableIncome: number;
  totalDeductionsAllowed: number;
  netTaxableIncome: number;
  baseTaxBeforeCredits: number;
  totalRebatesApplied: number;
  totalMedicalCredits: number;
  finalTaxOwed: number;
}

export const calculateTax = (data: TaxRequest): Promise<{ data: TaxResult }> =>
  taxEngineApi.post("/api/Tax/calculate", data);
