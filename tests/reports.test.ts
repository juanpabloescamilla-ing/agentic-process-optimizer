import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareReport, readReport, reportInputSchema } from '../src/reports/store';
import { calculateImpact } from '../src/core';
const input = reportInputSchema.parse({
  process: { id: 'procurement', name: 'Revisar oportunidades', evidence: [{ id: 'e1', source: 'Usuario', excerpt: '200 oportunidades al mes', kind: 'measured' }],
    monthlyVolume: 200, minutesPerCase: 15, peoplePerCase: 1, hourlyCost: 30000,
    dataReady: true, repeatable: true, deterministicRules: true, requiresHumanJudgment: true, risk: 'medium' },
  assumptions: { remainingHumanMinutesPerCase: 4, remainingPeoplePerCase: 1, monthlyOperatingCost: 120000,
    implementationCost: 600000, monthlyAvoidedCashExpense: 0, periodMonths: 3, basis: 'estimated' },
  currency: 'COP', summary: 'Prueba ficticia', steps: ['Probar con cinco oportunidades y revisar los errores.'],
});
test('report keeps financial meaning, sources and expiry without inventing measurements', () => {
  const report = prepareReport(input, ['Revisamos 200 oportunidades al mes'], new Date('2026-09-12T12:00:00Z'));
  assert.match(report.id, /^[a-f0-9]{64}$/);
  assert.equal(report.expiresAt, '2026-10-12T12:00:00.000Z');
  assert.equal(report.process.evidence[0].kind, 'declared');
  const impact = calculateImpact(report.process, report.assumptions);
  assert.equal(impact.monthlyBaselineHours, 50);
  assert.ok(Math.abs(impact.monthlyHoursFreed! - 36.6666666667) < 1e-6);
  assert.equal(impact.periodNetCashSavings, -960000);
  assert.notEqual(prepareReport(input, ['200 oportunidades al mes']).id, report.id);
});
test('report rejects unsupported evidence and keeps unknown costs unknown', async () => {
  assert.throws(() => prepareReport(input, ['No hay cifras']), /REPORT_EVIDENCE_MISSING/);
  const report = prepareReport({ ...input, assumptions: { ...input.assumptions, monthlyOperatingCost: null } }, ['200 oportunidades al mes']);
  assert.equal(calculateImpact(report.process, report.assumptions).monthlyNetCashSavings, null);
  assert.equal(await readReport('../other-tenant'), null);
});
