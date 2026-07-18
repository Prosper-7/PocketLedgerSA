// ============================================================
//  src/api/client.ts
//  Connects to both backends:
//    Python Intelligence Service → port 8000 (Prosper's Mac)
//    C# Tax Engine               → port 7056 (Brooklyn's PC)
//
//  Replace the IP addresses below with your actual IPs.
//  Prosper: run `ipconfig getifaddr en0` in Terminal
//  Brooklyn: run `ipconfig` in Command Prompt, look for IPv4
// ============================================================

import axios from 'axios';

const PYTHON_URL     = 'http://10.0.0.32:8000';
const TAX_ENGINE_URL = 'http://41.10.13.19:7056';

export const pythonApi = axios.create({
  baseURL: PYTHON_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export const taxApi = axios.create({
  baseURL: TAX_ENGINE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Types ─────────────────────────────────────────────────────

export interface Transaction {
  transaction_id: string;
  date: string;
  amount: number;
  description: string;
  merchant: string;
  source_bank: string;
  is_duplicate: boolean;
  category_name: string;
  is_deductible: boolean;
}

export interface AuditFlag {
  flag_id: number;
  transaction_id: number | null;
  flag_type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  resolved: boolean;
  created_at: string;
}

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

// ── Python API helpers ────────────────────────────────────────

export const checkHealth = () =>
  pythonApi.get<{ api: string; database: string }>('/health');

export const getTransactions = (userId: number) =>
  pythonApi.get<{ transactions: Transaction[] }>(`/transactions/${userId}`);

export const getAuditFlags = (userId: number, resolved = false) =>
  pythonApi.get<{ flags: AuditFlag[] }>(`/audit-flags/${userId}`, {
    params: { resolved },
  });

export const resolveAuditFlag = (flagId: number) =>
  pythonApi.put(`/audit-flags/${flagId}/resolve`);

export const uploadStatement = async (
  userId: number,
  fileUri: string,
  fileName: string,
  mimeType: string
) => {
  const formData = new FormData();
  // @ts-ignore — React Native FormData shape
  formData.append('file', { uri: fileUri, name: fileName, type: mimeType });
  return pythonApi.post(
    `/statements/upload?user_id=${userId}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
};

// ── C# Tax Engine helpers ─────────────────────────────────────

export const calculateTax = (data: TaxRequest) =>
  taxApi.post<TaxResult>('/api/Tax/calculate', data);
