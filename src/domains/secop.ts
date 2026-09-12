import { z } from 'zod';

export const secopSearchSchema = z.object({
  query: z.string().trim().min(3).max(100),
  limit: z.number().int().min(1).max(20).default(5),
});

// Optional domain tool. The diagnostic engine never imports this module.
export async function searchSecop(input: z.infer<typeof secopSearchSchema>) {
  const { query, limit } = secopSearchSchema.parse(input);
  const url = new URL('https://www.datos.gov.co/resource/p6dx-8zbt.json');
  url.searchParams.set('$q', query);
  url.searchParams.set('$limit', String(limit));
  url.searchParams.set('$order', 'fecha_de_publicacion_del DESC');
  const started = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!response.ok) throw new Error(`SECOP respondió HTTP ${response.status}`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error('Respuesta SECOP inesperada');
  const retrievedAt = new Date().toISOString();
  return {
    source: url.toString(), retrievedAt,
    elapsedMilliseconds: Math.round(performance.now() - started),
    coverage: `Primeros ${limit} resultados de búsqueda textual; no es una revisión exhaustiva.`,
    warning: 'Metadatos para prefiltrado. Vigencia, cronograma y cumplimiento de pliegos pendientes de verificar. Abierto no prueba que acepte ofertas hoy.',
    opportunities: rows.map(row => ({
      id: row.id_del_proceso ?? null,
      title: row.nombre_del_procedimiento ?? null,
      description: row.descripci_n_del_procedimiento ?? null,
      entity: row.entidad ?? null,
      publishedAt: row.fecha_de_publicacion_del ?? null,
      budget: row.precio_base ?? null,
      currency: 'COP',
      status: row.estado_del_procedimiento ?? null,
      modality: row.modalidad_de_contratacion ?? null,
      source: row.urlproceso?.url ?? null,
      eligibility: 'unverified',
    })),
  };
}
