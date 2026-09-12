import { randomBytes } from 'node:crypto';
import type { createClient } from 'redis';
import { z } from 'zod';
import { processSchema, assumptionsSchema } from '../agent/schemas';
import { diagnoseProcess } from '../core';
import type { StoredReport } from './types';

export const reportInputSchema = z.object({
  process: processSchema,
  assumptions: assumptionsSchema,
  currency: z.string().regex(/^[A-Z]{3}$/).describe('Moneda indicada por el usuario, por ejemplo COP. Pregunta si no se conoce.'),
  summary: z.string().min(1).max(2000),
  steps: z.array(z.string().min(1).max(500)).min(1).max(8),
});
const TTL = 30 * 24 * 60 * 60;
const validId = /^[a-f0-9]{64}$/;

export function prepareReport(input: z.infer<typeof reportInputSchema>, userEvidence: string[], now = new Date()): StoredReport {
  const data = reportInputSchema.parse(input);
  if (!data.process.evidence.length || data.process.evidence.some(e => !userEvidence.some(t => t.includes(e.excerpt)))) {
    throw new Error('REPORT_EVIDENCE_MISSING');
  }
  // Chat statements are declarations, never independently verified measurements.
  data.process.evidence = data.process.evidence.map(e => ({ ...e, kind: 'declared' }));
  if (data.assumptions.basis === 'measured') data.assumptions.basis = 'declared';
  diagnoseProcess(data.process, data.assumptions);
  return { ...data, id: randomBytes(32).toString('hex'), createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + TTL * 1000).toISOString() };
}
async function withRedis<T>(action: (client: ReturnType<typeof createClient>) => Promise<T>): Promise<T> {
  if (!process.env.REDIS_URL?.trim()) throw new Error('REPORT_STORAGE_NOT_CONFIGURED');
  const { createClient } = await import('redis');
  const client = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 5000, reconnectStrategy: false } });
  client.on('error', () => {});
  try { await client.connect(); return await action(client); }
  finally { if (client.isOpen) client.destroy(); }
}
export async function saveReport(input: z.infer<typeof reportInputSchema>, evidence: string[]) {
  const report = prepareReport(input, evidence);
  await withRedis(client => client.set(`okflow:report:v1:${report.id}`, JSON.stringify(report), { EX: TTL }));
  return report;
}
export async function readReport(id: string): Promise<StoredReport | null> {
  if (!validId.test(id)) return null;
  const raw = await withRedis(client => client.get(`okflow:report:v1:${id}`));
  if (!raw) return null;
  return JSON.parse(raw) as StoredReport;
}
export function reportUrl(id: string) {
  const origin = process.env.REPORT_BASE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');
  return `${origin.replace(/\/$/, '')}/reports/${id}`;
}
