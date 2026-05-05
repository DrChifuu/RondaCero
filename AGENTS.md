# Ronda Cero - TypeScript

Plataforma de minijuegos sociales multijugador. Servidor principal Express + EJS que orquesta minijuegos independientes.

## Stack

| Capa | Tecnología |
|------|-----------|
| Lenguaje | TypeScript 5.x (strict) |
| Backend principal | Express 4 + EJS + express-session |
| Tiempo real | Socket.IO 4 (minijuegos) |
| Proxy | http-proxy-middleware |
| Hosting | Vercel (serverless) para static/auth, externo para minijuegos real-time |
| Build | `tsc` → `dist/` |

## Comandos

```bash
npm run build      # tsc + copia assets (public/, views/, DrinkParty/public/) a dist/
npm start          # node dist/server.js (producción / Vercel)
npm run dev        # build + start (desarrollo local)
npx tsc --noEmit   # typecheck sin compilar
```

## Estructura

```
src/
├── server.ts                    # Express principal (auth, rutas, proxy)
└── minijuegos/                  # Cada minijuego es un módulo independiente
    └── DrinkParty/
        ├── server.ts            # Lógica del minijuego (Express + Socket.IO)
        ├── package.json         # Dependencias propias (devDependencies)
        ├── tsconfig.json        # Opcional, el root ya compila todo src/
        └── public/              # Static files del minijuego (app.js, index.html, style.css)
views/                           # EJS templates (index, login, dashboard)
public/                          # Static global (style.css)
dist/                            # Output compilado + assets copiados (no commitear)
```

## Arquitectura

### Servidor principal (`src/server.ts`)

- Autenticación: login con credenciales hardcodeadas, acceso invitado
- Sesiones en memoria con `express-session`
- Sirve vistas EJS desde `views/` y archivos estáticos desde `public/`
- Proxy inverso: redirige `/{minijuego}/*` y `/socket.io/*` al proceso hijo correspondiente
- **Exporta `app` como default** para compatibilidad con `@vercel/node`
- **Solo en local** (`process.env.VERCEL !== '1'`): hace `fork()` del minijuego y `app.listen()`

### Minijuegos (`src/minijuegos/{Nombre}/`)

Cada minijuego es una app Express independiente con su propio Socket.IO server. El servidor principal lo levanta como child process y le pasa el tráfico vía http-proxy-middleware.

**Protocolo de comunicación:**
1. El child process debe enviar `process.send('ready')` cuando esté listo para recibir tráfico
2. El padre espera el mensaje `ready` antes de empezar a escuchar en su puerto
3. El padre proxy el tráfico HTTP normal y el upgrade WebSocket al hijo
4. El minijuego usa un namespace de URL (ej: `/drinkparty/`) y un path de Socket.IO específico (ej: `/drinkparty/socket.io`)

### Cómo agregar un minijuego nuevo

1. Crear `src/minijuegos/NuevoJuego/server.ts` que:
   - Cree una app Express y un servidor http
   - Escuche en un puerto interno (ej: `process.env.PORT || 3001`)
   - Monte su Socket.IO con un path único (ej: `/nuevojuego/socket.io`)
   - Envíe `process.send('ready')` cuando esté listo
2. Agregar el proxy en `src/server.ts`:
   - Crear un `createProxyMiddleware` con `target: 'http://localhost:{puerto}'`
   - Configurar `pathFilter` para `/nuevojuego/` y su socket.io path
   - Agregar el fork del child process en el bloque local-only
3. Agregar botón/enlace en `views/dashboard.ejs`
4. Copiar los static files del minijuego en el build script si es necesario

## Vercel

### Limitaciones de Vercel serverless

- **No soporta WebSockets** en plan Hobby. Los minijuegos que usan Socket.IO **no funcionan en Vercel**.
- **No soporta `child_process.fork()`**. No se pueden levantar procesos hijo.
- **Cold starts**: la primera request es lenta, sesiones en memoria se pierden entre deployments.
- Las sesiones de `express-session` son efímeras (en memoria, no persistentes).

### Qué funciona en Vercel

- Login / invitado
- Vistas EJS (index, login, dashboard)
- Archivos estáticos
- Endpoints HTTP sin estado

### Qué NO funciona en Vercel

- Cualquier minijuego con tiempo real (Socket.IO)
- El proxy a procesos hijo (fork)
- Sesiones persistentes entre deploys

### Estrategia para minijuegos real-time

Para que los minijuegos funcionen en producción se necesita un backend separado con soporte WebSocket. Opciones:

| Opción | Descripción |
|--------|------------|
| **Railway / Fly.io / Render** | Hosting que ejecuta `node dist/minijuegos/DrinkParty/server.js` con WebSocket nativo |
| **VPS propio** | Una VM con Node.js ejecutando los minijuegos |
| **Socket.IO + Vercel Serverless Functions** | No viable sin WebSocket |

El frontend de cada minijuego (`public/app.js`) debe conectarse al backend de tiempo real vía URL configurable por variable de entorno (ej: `VITE_WS_URL`).

## Convenciones de código

- **TypeScript estricto** (`strict: true` en tsconfig)
- **Interfaces sobre types** para definiciones de objetos
- **Nombres en camelCase** para variables y funciones, **PascalCase** para interfaces
- **Export default** la app Express principal para Vercel
- **No usar `any`** sin justificación; preferir `unknown` con type narrowing
- **Imports**: usar `import` de ES modules con `esModuleInterop: true`
- **Paths relativos** en imports, no path aliases
- Mantener `node_modules` solo en raíz; las dependencias de minijuegos van en el `package.json` raíz como `dependencies`
