# Slack y Microsoft Teams

Ambos canales llaman al mismo agente generalista; no contienen lógica específica de SECOP. Cada instalación conserva hasta 16 mensajes de contexto (máximo 12.000 caracteres por mensaje) en Redis, dentro del hilo original. Las menciones inician una conversación; las respuestas del hilo y los mensajes directos continúan el diagnóstico. No se consulta automáticamente el historial completo del equipo ni se descargan archivos adjuntos.

## Activación en Vercel

Configurar `REDIS_URL` con una conexión Redis/TLS compatible con el cliente Node `redis` (no una URL HTTP REST). Configurar también el proveedor de modelos requerido por el agente. Las credenciales van en variables de entorno de Vercel, nunca en el repositorio. La app se compila sin credenciales; un webhook sin la configuración de su plataforma responde HTTP 503.

### Slack

1. Crear una app de Slack con un bot e instalarla en el workspace de demostración.
2. Configurar `SLACK_BOT_TOKEN` y `SLACK_SIGNING_SECRET` en Vercel.
3. Establecer la Events Request URL en `https://DOMINIO/api/webhooks/slack`.
4. Conceder `app_mentions:read`, `chat:write`, `channels:history`, `im:history`, `users:read`; suscribir `app_mention`, `message.channels` y `message.im`. Para canales privados, añadir `groups:history` y `message.groups` si se van a usar.
5. Reinstalar la app tras cambiar permisos e invitar el bot al canal. Mencionarlo con la descripción del proceso y responder en el mismo hilo.

El adaptador oficial verifica la firma HMAC del webhook. Esta versión configura una instalación por plataforma; no implementa un flujo OAuth de instalación pública para múltiples organizaciones.

### Teams

1. Registrar una app/bot de Microsoft Teams en el tenant de demostración y habilitar su instalación.
2. Configurar `TEAMS_APP_ID`, `TEAMS_APP_PASSWORD`, `TEAMS_APP_TENANT_ID` en Vercel. Se usa `SingleTenant` explícitamente.
3. Configurar el endpoint del bot como `https://DOMINIO/api/webhooks/teams` e instalar su paquete en Teams.
4. Mencionar al bot en el canal, o usar una conversación personal. En canales, mencionar de nuevo al bot en cada respuesta si el tenant no habilita entrega de mensajes sin mención.

Se usa `createTeamsAdapter`, cuyo pipeline autentica Bot Framework; no se utiliza el parser de bajo nivel sin validación JWT. La recepción de todos los mensajes de un canal/grupo requiere permisos RSC (`ChannelMessage.Read.Group` / `ChatMessage.Read.Chat`) y configuración del manifiesto. Esta versión no solicita lectura global de los mensajes del tenant.

## Estado y límites operativos

- Redis conserva suscripciones, bloqueos, deduplicación y estado del hilo; el SDK aplica un TTL de 30 días al estado. `reiniciar` o `borrar contexto` borra la memoria del agente para el hilo, no los mensajes originales de Slack/Teams.
- El namespace de Redis incluye la plataforma y un identificador derivado de la instalación. No se combina información entre organizaciones ni entre Slack y Teams. Rotar el token de Slack cambia el namespace y reinicia su contexto.
- `next/server.after()` registra el trabajo que sigue al acuse de recibo, dentro de la duración de la función (60 segundos). **No es una cola durable**: un cierre de función puede interrumpirlo. Para trabajos prolongados, implementar Workflow/cola durable con reintentos e idempotencia.
- Las respuestas del agente vuelven al hilo que lo invocó. El bot no envía mensajes proactivos a otros usuarios.
- La validación de compilación no demuestra conexión real: el ensayo end-to-end requiere las apps instaladas, credenciales y un evento real de cada plataforma.

## Fuentes de implementación

- [Chat SDK: instancia y webhooks](https://chat-sdk.dev/docs/usage)
- [Chat SDK: estado del hilo](https://chat-sdk.dev/docs/api/thread)
- [Adaptador oficial de Slack](https://chat-sdk.dev/adapters/official/slack)
- [Adaptador oficial de Teams](https://chat-sdk.dev/adapters/official/teams)
- [Adaptador Redis](https://chat-sdk.dev/adapters/official/redis)
