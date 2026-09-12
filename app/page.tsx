'use client';
import { useState } from 'react';
type Message = { role: 'user' | 'assistant'; content: string };
const examples = [
  { title: 'Operaciones', text: 'Cada mes revisamos 120 solicitudes. Una persona dedica 20 minutos a cada una. Los datos están en un archivo organizado, pero debe interpretar cada solicitud. Quiero diagnosticar este proceso.' },
  { title: 'Finanzas', text: 'Recibimos facturas por correo y copiamos sus datos a otro sistema. A veces faltan soportes. Ayúdame a identificar qué debo medir antes de automatizar.' },
  { title: 'Contratación pública', text: 'El equipo busca oportunidades en SECOP y las revisa manualmente. Diagnostiquemos primero nuestro proceso y después probemos una búsqueda de software.' },
];
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [token, setToken] = useState('');
  const [accessReady, setAccessReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy || !accessReady || !token.trim()) return;
    const content = text.trim(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: content, history: messages.slice(-20) }) });
      const result = await response.json().catch(() => null);
      if (response.status === 401) {
        setAccessReady(false);
        throw new Error('No se pudo validar el acceso. Revisa el token de consola con el administrador y vuelve a intentarlo. Tu mensaje se ha conservado.');
      }
      if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : `El servicio no pudo responder (HTTP ${response.status}). Inténtalo nuevamente; tu mensaje se ha conservado.`);
      if (typeof result?.text !== 'string' || !result.text.trim()) throw new Error('El agente no devolvió una respuesta. Tu mensaje se ha conservado; vuelve a intentarlo.');
      setMessages(previous => [...previous, { role: 'user', content }, { role: 'assistant', content: result.text }]);
      setText('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de conexión'); }
    finally { setBusy(false); }
  }
  function download() {
    const blob = new Blob([messages.map(m => `${m.role === 'user' ? 'EQUIPO' : 'AGENTE'}\n${m.content}`).join('\n\n---\n\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'diagnostico.md'; a.click(); URL.revokeObjectURL(url);
  }
  return <main>
    <header><a className="brand" href="/">↗ PROCESS OPTIMIZER</a><span>Diagnóstico · Intervención · Evidencia</span></header>
    <div className="intro"><p className="eyebrow">DEL TRABAJO COTIDIANO A UNA MEJORA COMPROBABLE</p>
      <h1>Entiende el proceso.<br/><em>Cambia lo que importa.</em></h1>
      <p>Describe cómo trabaja tu equipo. Identifica qué conviene automatizar, qué necesita preparación y cómo comprobar su impacto.</p>
    </div>
    <section className="workspace">
      <aside><p className="eyebrow">UN NÚCLEO, DISTINTOS CONTEXTOS</p>
        <h2>Empieza con un proceso real.</h2><p>Los ejemplos son ficticios. Sustituye sus datos por los de tu equipo.</p>
        {examples.map(example => <button className="example" key={example.title} onClick={() => setText(example.text)}>{example.title}<span>↗</span></button>)}
        <div className="principle"><b>El impacto se demuestra.</b><p>El informe distingue carga actual, capacidad liberada y ahorro monetario. Los datos faltantes quedan visibles.</p></div>
      </aside>
      <section className="conversation" aria-label="Conversación de diagnóstico">
        <div className="toolbar"><span>CONSOLA DE PRUEBA</span><button disabled={!messages.length} onClick={download}>Descargar conversación ↓</button></div>
        {!accessReady ? <form className="access-gate" onSubmit={event => { event.preventDefault(); if (token.trim()) { setToken(token.trim()); setAccessReady(true); setError(''); } }}>
          <p className="eyebrow">PASO 1 · ACCESO DEL EQUIPO</p>
          <h2>Conecta tu acceso para empezar.</h2>
          <p>Introduce el token de consola que te entregó el administrador del proyecto. No es tu contraseña de Vercel ni una clave del modelo.</p>
          <label htmlFor="console-token">Token de consola</label>
          <input id="console-token" type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Introduce el token de acceso" required disabled={busy}/>
          <div className="access-actions"><small>Se verificará al enviar tu mensaje. Solo se mantiene en memoria y se borra al recargar la página.</small><button className="primary" disabled={busy || !token.trim()}>Continuar al diagnóstico →</button></div>
        </form> : <div className="access-status"><span>Token preparado para esta sesión</span><button disabled={busy} onClick={() => setAccessReady(false)}>Cambiar acceso</button></div>}
        {error && <div role="alert" className="error service-error"><strong>No se pudo completar la consulta</strong><p>{error}</p><small>El mensaje sigue en el editor para volver a enviarlo.</small></div>}
        <div className="messages" aria-live="polite">
          {!messages.length && <div className="empty"><div className="symbol">↗</div><h2>¿Qué trabajo se repite en tu equipo?</h2><p>Comparte un caso, qué lo inicia, quién participa y qué resultado deben entregar.</p><small>El mismo agente está preparado para recibir mensajes desde Slack y Teams cuando se configuren sus conexiones.</small></div>}
          {messages.map((message, i) => <article key={i} className={message.role}><strong>{message.role === 'user' ? 'Tu equipo' : 'Process Optimizer'}</strong><div>{message.content}</div></article>)}
          {busy && <p className="loading">Revisando evidencia y herramientas…</p>}
        </div>
        <form onSubmit={send}><label className="sr-only" htmlFor="message">Describe el proceso</label><textarea id="message" maxLength={12000} value={text} disabled={busy} onChange={e => setText(e.target.value)} placeholder="Hoy hacemos esto manualmente…" rows={4}/><div className="compose-footer"><small>{accessReady ? 'No incluyas contraseñas ni claves.' : 'Completa el acceso arriba para enviar. Puedes preparar tu mensaje.'}</small><button className="primary" disabled={busy || !text.trim() || !accessReady || !token.trim()}>{busy ? 'Procesando…' : 'Analizar proceso ↗'}</button></div></form>
      </section>
    </section>
    <footer>Descubrir → Preguntar → Diagnosticar → Ejecutar → Medir<span>SECOP es un caso de prueba. El proceso lo defines tú.</span></footer>
  </main>;
}
