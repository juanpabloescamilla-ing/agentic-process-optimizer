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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    const content = text.trim(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: content, history: messages.slice(-20) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud.');
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
        <details><summary>Acceso a la consola</summary><label>Token de acceso<input type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="off" placeholder="Token configurado por el equipo" /></label><small>Se conserva solo en esta pestaña, sin guardarlo en el navegador.</small></details>
      </aside>
      <section className="conversation" aria-label="Conversación de diagnóstico">
        <div className="toolbar"><span>CONSOLA DE PRUEBA</span><button disabled={!messages.length} onClick={download}>Descargar conversación ↓</button></div>
        <div className="messages" aria-live="polite">
          {!messages.length && <div className="empty"><div className="symbol">↗</div><h2>¿Qué trabajo se repite en tu equipo?</h2><p>Comparte un caso, qué lo inicia, quién participa y qué resultado deben entregar.</p><small>El mismo agente está preparado para recibir mensajes desde Slack y Teams cuando se configuren sus conexiones.</small></div>}
          {messages.map((message, i) => <article key={i} className={message.role}><strong>{message.role === 'user' ? 'Tu equipo' : 'Process Optimizer'}</strong><div>{message.content}</div></article>)}
          {busy && <p className="loading">Revisando evidencia y herramientas…</p>}
        </div>
        <form onSubmit={send}><label className="sr-only" htmlFor="message">Describe el proceso</label><textarea id="message" maxLength={12000} value={text} onChange={e => setText(e.target.value)} placeholder="Hoy hacemos esto manualmente…" rows={4}/><div className="compose-footer"><small>No incluyas contraseñas ni claves.</small><button className="primary" disabled={busy || !text.trim()}>{busy ? 'Procesando…' : 'Analizar proceso ↗'}</button></div>{error && <p role="alert" className="error">{error}</p>}</form>
      </section>
    </section>
    <footer>Descubrir → Preguntar → Diagnosticar → Ejecutar → Medir<span>SECOP es un caso de prueba. El proceso lo defines tú.</span></footer>
  </main>;
}
