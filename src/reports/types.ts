import type { ProcessInput, ImpactAssumptions } from '../core';
export interface StoredReport {
  id: string; createdAt: string; expiresAt: string;
  process: ProcessInput; assumptions: ImpactAssumptions;
  currency: string; summary: string; steps: string[];
}
