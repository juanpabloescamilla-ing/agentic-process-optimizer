"use client";

import { useMemo, useState } from "react";
import { calculateImpact, diagnoseProcess } from "@/src/core";
import type { StoredReport } from "@/src/reports/types";
import styles from "./report.module.css";

const fields = [
  { key: "monthlyVolume", label: "Casos al mes", group: "process", min: 0 },
  { key: "minutesPerCase", label: "Minutos por persona y caso", group: "process", min: 0 },
  { key: "peoplePerCase", label: "Personas por caso", group: "process", min: 0.01 },
  { key: "hourlyCost", label: "Costo por hora", group: "process", min: 0 },
  { key: "remainingHumanMinutesPerCase", label: "Minutos humanos restantes por caso", group: "assumptions", min: 0 },
  { key: "remainingPeoplePerCase", label: "Personas que revisan cada caso", group: "assumptions", min: 0.01 },
  { key: "monthlyOperatingCost", label: "Costo mensual de operación", group: "assumptions", min: 0 },
  { key: "implementationCost", label: "Costo de implementación", group: "assumptions", min: 0 },
  { key: "monthlyAvoidedCashExpense", label: "Gastos realmente evitados al mes", group: "assumptions", min: 0 },
  { key: "periodMonths", label: "Horizonte en meses", group: "assumptions", min: 0.01 },
] as const;
const interventionLabels = { agent: "Piloto con agente", rules: "Automatización con reglas", "data-preparation": "Preparar los datos", human: "Mantener control humano" };
const basisLabels = { declared: "Declarado", measured: "Medido", estimated: "Estimado" };
function simplifyReason(reason: string) {
  if (reason.startsWith("Conservar control humano")) return "Una persona debe revisar las decisiones porque el trabajo requiere criterio, tiene consecuencias importantes o cambia entre casos.";
  if (reason.startsWith("Preparar y validar")) return "Primero hay que organizar y comprobar la información necesaria.";
  if (reason.startsWith("Las reglas explícitas")) return "El trabajo sigue reglas claras: puede resolverse con una automatización sencilla.";
  if (reason.startsWith("La tarea repetible")) return "El trabajo se repite pero necesita interpretar información. Conviene probar un agente con revisión del equipo.";
  if (reason.startsWith("Faltan datos")) return "Falta información. Esta recomendación debe confirmarse y los valores desconocidos quedan pendientes.";
  return reason;
}
function originalValues(report: StoredReport) {
  return Object.fromEntries(fields.map(f => {
    const value = (report[f.group] as Record<string, unknown>)[f.key];
    return [f.key, typeof value === "number" ? String(value) : ""];
  }));
}

export default function ReportClient({ report }: { report: StoredReport }) {
  const [values, setValues] = useState(() => originalValues(report));
  const [edited, setEdited] = useState(false);
  const original = useMemo(() => calculateImpact(report.process, report.assumptions), [report]);
  const scenario = useMemo(() => {
    const process = { ...report.process };
    const assumptions = { ...report.assumptions };
    const errors: string[] = [];
    for (const field of fields) {
      const raw = values[field.key]?.trim() ?? "";
      const number = raw === "" ? null : Number(raw);
      if (number !== null && (!Number.isFinite(number) || number < field.min)) errors.push(field.key);
      const target = (field.group === "process" ? process : assumptions) as Record<string, unknown>;
      target[field.key] = number;
    }
    if (edited) assumptions.basis = "estimated";
    return { process, assumptions, errors, diagnosis: errors.length ? null : diagnoseProcess(process, assumptions) };
  }, [values, edited, report]);
  const impact = scenario.diagnosis?.impact;
  const number = (n: number | null | undefined) => n == null ? "Por determinar" : new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(n);
  const money = (n: number | null | undefined) => n == null ? "Por determinar" : `${number(n)} ${report.currency}`;
  const metrics = [
    { label: impact?.monthlyHoursFreed != null && impact.monthlyHoursFreed < 0 ? "Tiempo adicional / mes" : "Tiempo liberado / mes", value: impact?.monthlyHoursFreed, before: original.monthlyHoursFreed, format: (n: number | null | undefined) => n == null ? "Por determinar" : `${number(n)} h`, note: "Horas de trabajo humano recuperadas." },
    { label: impact?.monthlyCapacityValue != null && impact.monthlyCapacityValue < 0 ? "Valor del tiempo adicional / mes" : "Valor del tiempo disponible / mes", value: impact?.monthlyCapacityValue, before: original.monthlyCapacityValue, format: money, note: "Valor del tiempo disponible; no implica reducir nómina." },
    { label: impact?.monthlyNetCashSavings != null && impact.monthlyNetCashSavings < 0 ? "Gasto adicional / mes" : "Dinero ahorrado / mes", value: impact?.monthlyNetCashSavings, before: original.monthlyNetCashSavings, format: money, note: "Gastos evitados menos operación del nuevo proceso." },
    { label: `${impact?.periodNetCashSavings != null && impact.periodNetCashSavings < 0 ? "Gasto adicional" : "Dinero ahorrado"} en ${number(impact?.periodMonths)} meses`, value: impact?.periodNetCashSavings, before: original.periodNetCashSavings, format: money, note: "Incluye el costo inicial de implementación." },
  ];
  const baseline = impact?.monthlyBaselineHours;
  const remaining = impact?.monthlyRemainingHumanHours;
  const maxHours = Math.max(baseline ?? 0, remaining ?? 0, 1);

  return <main className={styles.page}>
    <header className={styles.hero}><div className={styles.wrap}>
      <div className={styles.brand}><span className={styles.mark}>↗</span> OKFlow <span className={styles.heroTag}>DIAGNÓSTICO DE PROCESOS</span></div>
      <p className={styles.eyebrow}>De los datos a un cambio concreto</p>
      <h1>{report.process.name}</h1>
      <p className={styles.summary}>{report.summary || report.process.description || "Diagnóstico y escenario de impacto del proceso."}</p>
      <div className={styles.meta}><span>{report.process.sector || "Proceso transversal"}</span><span>Creado: {new Date(report.createdAt).toLocaleString("es-CO", { timeZone: "America/Bogota" })} · Bogotá</span><span>{edited ? "Escenario local · estimado" : `${basisLabels[original.basis]} · reporte original`}</span></div>
    </div></header>
    <div className={styles.wrap}>
      <div className={styles.toolbar}><p>Explora los supuestos. Los cambios viven solo en esta página y no modifican el reporte compartido.</p><div><button type="button" disabled={!edited} onClick={() => { setValues(originalValues(report)); setEdited(false); }}>Restablecer original</button><button type="button" className={styles.primary} onClick={() => window.print()}>Imprimir / PDF</button></div></div>

      <section className={styles.section} aria-labelledby="recommendation"><span className={styles.sectionNumber}>01 / RECOMENDACIÓN</span><h2 id="recommendation">Un cambio con fundamento</h2>
        <div className={styles.recommendation}><div><span className={styles.pill}>{scenario.diagnosis?.intervention ? interventionLabels[scenario.diagnosis.intervention] : "Completar información"}</span><h3>{scenario.diagnosis?.status === "ready-for-pilot" ? "Listo para evaluar un piloto supervisado" : scenario.diagnosis?.status === "human-controlled" ? "La decisión permanece en manos del equipo" : "La recomendación necesita validación"}</h3><ul>{scenario.diagnosis?.reasons.map((reason, i) => <li key={i}>{simplifyReason(reason)}</li>)}</ul></div><aside>El diagnóstico propone el siguiente paso. Poner en marcha un cambio requiere aprobación en el canal de trabajo.</aside></div>
      </section>

      <section className={styles.section} aria-labelledby="impact"><span className={styles.sectionNumber}>02 / IMPACTO</span><h2 id="impact">Tiempo y dinero, por separado</h2><p className={styles.muted}>{edited ? "Estimación del escenario local. Cada tarjeta conserva la referencia del reporte original." : "Resultados a partir de los datos disponibles. Un valor pendiente nunca se interpreta como cero."}</p>
        <div className={styles.metrics} aria-live="polite">{metrics.map(metric => <article className={styles.metric} key={metric.label}><p>{metric.label}</p><strong className={metric.value != null && metric.value < 0 ? styles.negative : ""}>{metric.format(metric.value == null ? null : Math.abs(metric.value))}</strong>{edited && <small>Original: {metric.format(metric.before)}</small>}<span>{metric.note}</span></article>)}</div>
        <div className={styles.comparison}><h3>Carga humana mensual</h3><p className={styles.muted}>Compara el proceso actual con la mejora propuesta, incluyendo revisión y excepciones.</p>{[{ label: "Proceso actual", value: baseline }, { label: "Con el cambio", value: remaining }].map((bar, i) => <div className={styles.barRow} key={bar.label}><div><span>{bar.label}</span><strong>{bar.value == null ? "Por determinar" : `${number(bar.value)} h`}</strong></div><div className={styles.barTrack}><div className={i === 0 ? styles.barBaseline : styles.barProposed} style={{ width: bar.value == null ? "0%" : `${bar.value / maxHours * 100}%` }} /></div></div>)}<details className={styles.formula}><summary>Cómo se calculan estos resultados</summary><p>Horas actuales = casos/mes × minutos por persona × personas ÷ 60.<br />Horas liberadas = horas actuales − horas humanas restantes.<br />Caja neta del período = (gastos evitados − operación mensual) × meses − implementación.</p></details></div>
      </section>

      <section className={styles.section} aria-labelledby="scenario"><span className={styles.sectionNumber}>03 / SIMULADOR</span><h2 id="scenario">Ajusta los datos, revisa el resultado</h2><p className={styles.muted}>Deja vacío lo que no conozcas. Todos los importes usan {report.currency}. El tiempo restante debe incluir revisión humana y excepciones.</p><div className={styles.fields}>{fields.map(field => <label className={styles.field} key={field.key} htmlFor={`field-${field.key}`}><span>{field.label}</span><input id={`field-${field.key}`} type="number" min={field.min} step="any" placeholder="Sin dato" value={values[field.key]} aria-invalid={scenario.errors.includes(field.key)} aria-describedby={scenario.errors.includes(field.key) ? `error-${field.key}` : undefined} onChange={event => { setEdited(true); setValues(current => ({ ...current, [field.key]: event.target.value })); }} />{scenario.errors.includes(field.key) && <small id={`error-${field.key}`} className={styles.negative}>Ingresa un número {field.min > 0 ? "mayor que cero" : "igual o mayor que cero"}.</small>}</label>)}</div>{scenario.errors.length > 0 && <p className={styles.warning} role="alert">Corrige los campos marcados para recalcular. No se muestran resultados de entradas inválidas.</p>}</section>

      <div className={styles.twoColumns}><section className={styles.section} aria-labelledby="evidence"><span className={styles.sectionNumber}>04 / DATOS APORTADOS</span><h2 id="evidence">Lo que sustenta el diagnóstico</h2>{report.process.evidence.length ? report.process.evidence.map((item, i) => <figure className={styles.evidence} key={`${item.id}-${i}`}><figcaption><span>{item.kind === "observed" ? "Observado" : basisLabels[item.kind]}</span> · {item.id}</figcaption><blockquote>{item.excerpt}</blockquote><p>Fuente: {item.source}</p></figure>) : <p className={styles.warning}>No hay datos de respaldo adjuntos. La oportunidad necesita respaldo antes de ejecutarse.</p>}</section>
      <section className={styles.section} aria-labelledby="pending"><span className={styles.sectionNumber}>05 / POR VALIDAR</span><h2 id="pending">Las preguntas pendientes</h2>{scenario.diagnosis?.questions.length ? <ul className={styles.questions}>{scenario.diagnosis.questions.map(q => <li key={q.field}>{q.question}</li>)}</ul> : <p className={styles.muted}>{scenario.errors.length ? "Corrige los datos del simulador para revisar lo pendiente." : "Los datos básicos del diagnóstico están completos."}</p>}{impact && impact.missingFields.length > 0 && <div className={styles.warning}><strong>Faltan supuestos para calcular todo el impacto</strong><ul>{impact.missingFields.map(key => <li key={key}>{fields.find(f => f.key === key)?.label ?? key}</li>)}</ul></div>}</section></div>

      <section className={styles.section} aria-labelledby="steps"><span className={styles.sectionNumber}>06 / SIGUIENTE PASO</span><h2 id="steps">Del diagnóstico a la implementación</h2>{report.steps.length ? <ol className={styles.steps}>{report.steps.map((step, i) => <li key={i}><span>{String(i + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol> : <p className={styles.muted}>El plan de implementación está pendiente de definición con el equipo.</p>}</section>
      <footer className={styles.footer}><span>OKFlow</span><span>Quien tenga este enlace puede consultar el reporte. Disponible hasta {new Date(report.expiresAt).toLocaleString("es-CO", { timeZone: "America/Bogota" })} (Bogotá).</span></footer>
    </div>
  </main>;
}
