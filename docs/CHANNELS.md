# Slack y Microsoft Teams

Ambos canales llaman al mismo agente generalista; no contienen lógica específica de SECOP. Cada instalación conserva hasta 16 mensajes de contexto (máximo 12.000 caracteres por mensaje) en Redis, dentro del hilo original. Las menciones inician una conversación; las respuestas del hilo y los mensajes directos continúan el diagnóstico. No se consulta automáticamente el historial completo del equipo ni se descargan archivos adjuntos.

## Activación en Vercel

Configurar `REDIS_URL` con una conexión Redis/TLS compatible con el cliente Node `redis` (no una URL HTTP REST). Configurar también el proveedor de modelos requerido por el agente. Las credenciales van en variables de entorno de Vercel, nunca en el repositorio. La app se compila sin credenciales; un webhook sin la configuración de su plataforma responde HTTP 503.

### Slack

#### Vercel Connect (instalación `slack/okflow`)

Configurar `SLACK_CONNECTOR=slack/okflow` y `REDIS_URL`. No se requieren `SLACK_BOT_TOKEN` ni `SLACK_SIGNING_SECRET` en este modo. El adaptador recibe `connectSlackAdapter()` de `@vercel/connect/chat`: obtiene credenciales temporales para las respuestas y verifica el bearer OIDC que añade Vercel a los webhooks reenviados. No acepta directamente la firma nativa de Slack en este modo.

El conector debe estar vinculado al proyecto y entorno correctos **con triggers habilitados**, apuntando a `/api/webhooks/slack`. Vercel verifica primero la firma de Slack y el helper verifica después el token OIDC del reenvío contra las claves de Vercel, el proyecto y el entorno de despliegue. El helper exige `VERCEL_PROJECT_ID` y `VERCEL_TARGET_ENV` o `VERCEL_ENV`; si faltan, rechaza las solicitudes. No basta con conectar la cuenta para activar la entrega de eventos. El endpoint no incorpora un bypass de autenticación.

El namespace de Redis usa el proyecto y el identificador estable del conector, por lo que la rotación de sus tokens no borra la conversación. Cada conector corresponde a la instalación configurada. Se puede fijar `SLACK_WORKSPACE_ID` para separar explícitamente el estado si se vuelve a vincular el mismo conector a otro workspace; modificarlo inicia un contexto nuevo.

#### Token de bot (alternativa sin Connect)

Dejar `SLACK_CONNECTOR` sin configurar para usar el modo de firma HMAC original:

Se necesita el enlace del workspace de Slack y una cuenta que pueda crear e instalar aplicaciones allí (o la aprobación de su administrador). El acceso a GitHub/Vercel no concede esos permisos en Slack. También hay que elegir un canal público de prueba al que invitar el bot; los DM con la app están habilitados.

1. Abrir [Slack Apps](https://api.slack.com/apps), elegir **Create New App → From a manifest**, seleccionar el workspace e importar [slack-manifest.json](./slack-manifest.json).
2. Si Slack exige verificar el endpoint antes de guardar, importar inicialmente sin `settings.event_subscriptions` y agregar esa sección después del paso 4. El webhook devuelve 503 mientras faltan Redis o las credenciales de Slack.
3. En **OAuth & Permissions**, instalar la app en el workspace. Guardar **Bot User OAuth Token** (`xoxb-…`) como `SLACK_BOT_TOKEN` en las variables de producción de Vercel. En **Basic Information → App Credentials**, guardar **Signing Secret** como `SLACK_SIGNING_SECRET`. No pegar estos valores en el chat ni guardarlos en archivos del repositorio.
4. Comprobar que producción tiene `REDIS_URL` y el proveedor de modelos configurados y hacer un nuevo despliegue para aplicar las variables.
5. En **Event Subscriptions**, habilitar los eventos y verificar `https://agentic-process-optimizer-p4w9.vercel.app/api/webhooks/slack`. Usar los tres eventos del manifiesto: `app_mention`, `message.channels` y `message.im`.
6. Invitar `process-optimizer` al canal de prueba. Mencionarlo con la descripción de un proceso y responder en el mismo hilo sin volver a mencionarlo. Probar además un DM y `borrar contexto`. No dar por conectada la integración hasta observar respuestas reales con el contexto esperado.

El manifiesto concede `app_mentions:read` para menciones, `chat:write` para responder, `channels:history` para recibir continuaciones en canales públicos donde está invitado, `im:history` para mensajes directos y `users:read` para la identificación de autores/bots del adaptador. No solicita lectura de archivos, correo de usuarios, reacciones, comandos ni canales privados. El agente usa su contexto de Redis; no recorre el historial completo del workspace. Para una prueba en canal privado, agregar explícitamente `groups:history` y `message.groups`, reinstalar e invitar el bot. Reinstalar también después de cualquier cambio de permisos.

El adaptador oficial verifica la firma HMAC del webhook en este modo. Esta versión configura una instalación por plataforma; no implementa un flujo OAuth de instalación pública para múltiples organizaciones.

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
- [Vercel Connect con Chat SDK y verificación OIDC](https://vercel.com/docs/connect/frameworks/chat-sdk)
