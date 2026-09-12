/** Sector-neutral diagnosis. Unknown facts stay unknown; no savings percentages are invented. */
export type Evidence = { id: string; source: string; excerpt: string; kind: "declared" | "observed" | "measured" };
export type Intervention = "agent" | "rules" | "data-preparation" | "human";
export interface ProcessInput {
  id: string;
  name: string;
  sector?: string;
  description?: string;
  evidence: Evidence[];
  monthlyVolume?: number | null;
  minutesPerCase?: number | null;
  peoplePerCase?: number | null;
  hourlyCost?: number | null;
  dataReady?: boolean | null;
  repeatable?: boolean | null;
  deterministicRules?: boolean | null;
  requiresHumanJudgment?: boolean | null;
  risk?: "low" | "medium" | "high" | null;
}
export interface ImpactAssumptions {
  /** Includes human review and exceptions. Same monthly volume as the baseline. */
  remainingHumanMinutesPerCase?: number | null;
  remainingPeoplePerCase?: number | null;
  monthlyOperatingCost?: number | null;
  implementationCost?: number | null;
  /** Actual avoidable expenditure, not the imputed value of salaried time. */
  monthlyAvoidedCashExpense?: number | null;
  periodMonths?: number | null;
  basis?: "declared" | "estimated" | "measured";
}
export interface ImpactResult {
  basis: "declared" | "estimated" | "measured";
  monthlyBaselineHours: number | null;
  monthlyBaselineLaborValue: number | null;
  monthlyRemainingHumanHours: number | null;
  monthlyHoursFreed: number | null;
  monthlyCapacityValue: number | null;
  monthlyNetCashSavings: number | null;
  periodNetCashSavings: number | null;
  periodMonths: number | null;
  missingFields: string[];
}
const known = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);
function validateNumbers(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    if (value == null || typeof value !== "number") continue;
    if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be a finite nonnegative number`);
  }
}
function validateProcess(p: ProcessInput) {
  if (!p.id?.trim() || !p.name?.trim()) throw new Error("Process id and name are required");
  if (!Array.isArray(p.evidence)) throw new Error("Process evidence must be an array");
  validateNumbers(p as unknown as Record<string, unknown>);
  if (known(p.peoplePerCase) && p.peoplePerCase <= 0) throw new Error("peoplePerCase must be positive");
}
export function calculateImpact(p: ProcessInput, a: ImpactAssumptions = {}): ImpactResult {
  validateProcess(p);
  validateNumbers(a as Record<string, unknown>);
  if (known(a.remainingPeoplePerCase) && a.remainingPeoplePerCase <= 0) throw new Error("remainingPeoplePerCase must be positive");
  if (known(a.periodMonths) && a.periodMonths <= 0) throw new Error("periodMonths must be positive");
  const baseline = known(p.monthlyVolume) && known(p.minutesPerCase) && known(p.peoplePerCase)
    ? p.monthlyVolume * p.minutesPerCase * p.peoplePerCase / 60 : null;
  const remaining = known(p.monthlyVolume) && known(a.remainingHumanMinutesPerCase) && known(a.remainingPeoplePerCase)
    ? p.monthlyVolume * a.remainingHumanMinutesPerCase * a.remainingPeoplePerCase / 60 : null;
  const hours = baseline !== null && remaining !== null ? baseline - remaining : null;
  const netCash = known(a.monthlyAvoidedCashExpense) && known(a.monthlyOperatingCost)
    ? a.monthlyAvoidedCashExpense - a.monthlyOperatingCost : null;
  const fields = { monthlyVolume: p.monthlyVolume, minutesPerCase: p.minutesPerCase, peoplePerCase: p.peoplePerCase,
    hourlyCost: p.hourlyCost, remainingHumanMinutesPerCase: a.remainingHumanMinutesPerCase,
    remainingPeoplePerCase: a.remainingPeoplePerCase, monthlyOperatingCost: a.monthlyOperatingCost,
    monthlyAvoidedCashExpense: a.monthlyAvoidedCashExpense, implementationCost: a.implementationCost, periodMonths: a.periodMonths };
  return {
    basis: a.basis ?? "estimated", monthlyBaselineHours: baseline,
    monthlyBaselineLaborValue: baseline !== null && known(p.hourlyCost) ? baseline * p.hourlyCost : null,
    monthlyRemainingHumanHours: remaining, monthlyHoursFreed: hours,
    monthlyCapacityValue: hours !== null && known(p.hourlyCost) ? hours * p.hourlyCost : null,
    monthlyNetCashSavings: netCash,
    periodNetCashSavings: netCash !== null && known(a.periodMonths) && known(a.implementationCost)
      ? netCash * a.periodMonths - a.implementationCost : null,
    periodMonths: a.periodMonths ?? null,
    missingFields: Object.entries(fields).filter(([, value]) => !known(value)).map(([key]) => key),
  };
}
export interface Diagnosis {
  processId: string;
  name: string;
  intervention: Intervention | null;
  status: "needs-information" | "ready-for-pilot" | "human-controlled";
  reasons: string[];
  questions: { field: string; question: string }[];
  evidenceIds: string[];
  requiresApproval: true;
  impact: ImpactResult;
}
const questions: Record<string, string> = {
  evidence: "¿Qué documento, mensaje o registro respalda este proceso?",
  dataReady: "¿La información necesaria está disponible, accesible y organizada?",
  repeatable: "¿El proceso se repite con entradas y resultados comparables?",
  deterministicRules: "¿Puede resolverse con reglas explícitas sin interpretación?",
  requiresHumanJudgment: "¿Qué decisiones requieren criterio y responsabilidad humana?",
  risk: "¿Qué consecuencias tendría una ejecución incorrecta: bajas, medias o altas?",
  monthlyVolume: "¿Cuántos casos se procesan al mes?",
  minutesPerCase: "¿Cuántos minutos dedica cada persona a un caso actualmente?",
  peoplePerCase: "¿Cuántas personas dedican ese tiempo a cada caso?",
  hourlyCost: "¿Cuál es el costo por hora, en una moneda consistente?",
};
export function diagnoseProcess(p: ProcessInput, a: ImpactAssumptions = {}): Diagnosis {
  validateProcess(p);
  const missing = Object.keys(questions).filter(key => key === "evidence" ? p.evidence.length === 0 : p[key as keyof ProcessInput] == null);
  let intervention: Intervention | null = null;
  const reasons: string[] = [];
  if (p.risk === "high" || p.requiresHumanJudgment === true || p.repeatable === false) {
    intervention = "human";
    reasons.push("Conservar control humano por riesgo, juicio requerido o falta de repetibilidad; puede asistirse con tareas acotadas.");
  } else if (p.dataReady === false) {
    intervention = "data-preparation";
    reasons.push("Preparar y validar los datos antes de automatizar la ejecución.");
  } else if (p.dataReady === true && p.repeatable === true && p.requiresHumanJudgment === false && p.risk != null) {
    if (p.deterministicRules === true) {
      intervention = "rules";
      reasons.push("Las reglas explícitas permiten una automatización determinista.");
    } else if (p.deterministicRules === false) {
      intervention = "agent";
      reasons.push("La tarea repetible requiere interpretación con datos disponibles; evaluar un agente en un piloto supervisado.");
    }
  }
  if (missing.length) reasons.push("Faltan datos: la recomendación es provisional y las cifras desconocidas no se completan automáticamente.");
  return { processId: p.id, name: p.name, intervention,
    status: missing.length ? "needs-information" : intervention === "human" ? "human-controlled" : "ready-for-pilot",
    reasons, questions: missing.map(field => ({ field, question: questions[field] })),
    evidenceIds: p.evidence.map(e => e.id), requiresApproval: true, impact: calculateImpact(p, a) };
}
/** Rank only comparable, quantified opportunities. Unknown impact is listed last. */
export function prioritizeProcesses(processes: { process: ProcessInput; assumptions?: ImpactAssumptions }[]): Diagnosis[] {
  return processes.map(({ process, assumptions }) => diagnoseProcess(process, assumptions))
    .sort((a, b) => (b.impact.monthlyHoursFreed ?? -Infinity) - (a.impact.monthlyHoursFreed ?? -Infinity));
}
