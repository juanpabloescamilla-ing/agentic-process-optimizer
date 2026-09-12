import { z } from 'zod';

export const classifyRecordsSchema = z.object({
  records: z.array(z.object({ id: z.string().min(1), text: z.string().max(6000) })).min(1).max(100),
  rules: z.array(z.object({
    label: z.string().min(1).max(100),
    contains: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
  })).min(1).max(20),
});

export function classifyRecords(input: z.infer<typeof classifyRecordsSchema>) {
  const { records, rules } = classifyRecordsSchema.parse(input);
  const ids = new Set(records.map(r => r.id));
  if (ids.size !== records.length) throw new Error('Cada registro necesita un identificador único');
  const started = performance.now();
  return {
    kind: 'executed-rule-classification',
    scope: 'Clasificación de registros aportados; sin modificar sistemas externos.',
    results: records.map(record => {
      const matches = rules.flatMap(rule => {
        const terms = rule.contains.filter(term => record.text.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
        return terms.length ? [{ label: rule.label, matchedTerms: terms }] : [];
      });
      return { id: record.id, matches, status: matches.length === 1 ? 'classified' : matches.length > 1 ? 'ambiguous' : 'needs-review' };
    }),
    elapsedMilliseconds: Math.round(performance.now() - started),
    savings: null,
    measurementNote: 'La duración del sistema no mide el ahorro humano. Falta comparar contra una línea base y registrar revisión.',
  };
}
