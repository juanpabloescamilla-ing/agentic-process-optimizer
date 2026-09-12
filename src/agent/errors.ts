/** Inspect SDK retry wrappers without exposing upstream bodies, headers or prompts. */
export function agentFailure(error: unknown) {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  const names: string[] = [];
  const statuses: number[] = [];
  while (pending.length && seen.size < 20) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    const item = current as Record<string, unknown>;
    if (typeof item.name === 'string') names.push(item.name);
    if (typeof item.statusCode === 'number') statuses.push(item.statusCode);
    pending.push(item.cause, item.lastError);
    if (Array.isArray(item.errors)) pending.push(...item.errors.slice(-3));
  }
  if (statuses.includes(429)) return { names, statuses, status: 429, message: 'El proveedor del modelo está limitando las solicitudes. Espera un momento y vuelve a enviar; tu mensaje se conserva.' };
  if (statuses.includes(402)) return { names, statuses, status: 503, message: 'El proveedor del modelo requiere saldo disponible. El administrador debe revisar sus créditos o el límite de gasto de la clave.' };
  if (statuses.some(status => status === 401 || status === 403)) return { names, statuses, status: 503, message: 'El servicio del modelo rechazó sus credenciales. El administrador debe revisar la clave del proveedor; tu token de consola no es el problema.' };
  return { names, statuses, status: 502, message: 'El proveedor no pudo completar la respuesta. Vuelve a intentarlo; tu mensaje se conserva y no se modificaron sistemas externos.' };
}
