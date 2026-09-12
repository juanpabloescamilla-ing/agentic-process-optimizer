import test from "node:test";
import assert from "node:assert/strict";
import { calculateImpact, diagnoseProcess, prioritizeProcesses, type ProcessInput } from "../src/core/index";
const process: ProcessInput = {
  id: "invoice-review", name: "Revisar documentos", evidence: [{ id: "e1", source: "slack:thread", excerpt: "100 casos mensuales", kind: "declared" }],
  monthlyVolume: 100, minutesPerCase: 30, peoplePerCase: 2, hourlyCost: 20,
  dataReady: true, repeatable: true, deterministicRules: false, requiresHumanJudgment: false, risk: "low",
};
test("time value is separate from actual cash savings and implementation expense", () => {
  const result = calculateImpact(process, { remainingHumanMinutesPerCase: 6, remainingPeoplePerCase: 1,
    monthlyAvoidedCashExpense: 0, monthlyOperatingCost: 30, implementationCost: 100, periodMonths: 3 });
  assert.equal(result.monthlyBaselineHours, 100);
  assert.equal(result.monthlyHoursFreed, 90);
  assert.equal(result.monthlyCapacityValue, 1800);
  assert.equal(result.monthlyNetCashSavings, -30);
  assert.equal(result.periodNetCashSavings, -190);
});
test("unknown facts never imply zero cost, one person or a savings percentage", () => {
  const result = calculateImpact({ ...process, peoplePerCase: null });
  assert.equal(result.monthlyBaselineHours, null);
  assert.equal(result.monthlyHoursFreed, null);
  assert.equal(result.monthlyNetCashSavings, null);
  assert.ok(result.missingFields.includes("peoplePerCase"));
});
test("classification works independently of sector", () => {
  for (const sector of ["agriculture", "procurement", "health", "manufacturing"]) {
    assert.equal(diagnoseProcess({ ...process, sector }).intervention, "agent");
  }
  assert.equal(diagnoseProcess({ ...process, deterministicRules: true }).intervention, "rules");
  assert.equal(diagnoseProcess({ ...process, dataReady: false }).intervention, "data-preparation");
  assert.equal(diagnoseProcess({ ...process, risk: "high" }).intervention, "human");
});
test("missing readiness blocks confident recommendation and missing evidence blocks pilot", () => {
  const result = diagnoseProcess({ ...process, dataReady: null, evidence: [] });
  assert.equal(result.intervention, null);
  assert.equal(result.status, "needs-information");
  assert.ok(result.questions.some(q => q.field === "evidence"));
  assert.ok(result.questions.some(q => q.field === "dataReady"));
});
test("negative and nonfinite input rejected, negative realized savings preserved", () => {
  assert.throws(() => calculateImpact({ ...process, monthlyVolume: -2 }));
  assert.throws(() => calculateImpact(process, { implementationCost: Infinity }));
  assert.equal(calculateImpact(process, { remainingHumanMinutesPerCase: 90, remainingPeoplePerCase: 2 }).monthlyHoursFreed, -200);
});
test("unknown impact ranks after measured or estimated known impact", () => {
  const ranked = prioritizeProcesses([{ process }, { process: { ...process, id: "known" }, assumptions: { remainingHumanMinutesPerCase: 0, remainingPeoplePerCase: 1 } }]);
  assert.equal(ranked[0].processId, "known");
});
