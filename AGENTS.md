# Ronda Cero - TypeScript

Plataforma de minijuegos sociales multijugador. Servidor principal Express + EJS que orquesta minijuegos independientes.

## Stack

| Capa | Tecnología |
|------|-----------|
| Lenguaje | TypeScript 5.x (strict) |
| Backend principal | Express 4 + EJS + express-session |
| Tiempo real | Socket.IO 4 (minijuegos) |
| Proxy | http-proxy-middleware |
| Build | `tsc` → `dist/` |
| Hosting | [Render](https://render.com) (Web Service) |

## Comandos

```bash
npm install        # Instala deps raíz + postinstall de DrinkParty
npm start          # tsc + copia assets + node dist/server.js
npm run dev        # build + start
npx tsc --noEmit   # typecheck sin compilar
```

## Estructura

```
src/
├── server.ts                    # Express principal (auth, rutas, proxy, fork)
└── minijuegos/
    └── DrinkParty/
        ├── server.ts            # Lógica del minijuego (Express + Socket.IO)
        ├── package.json         # Dependencias propias (devDependencies)
        └── public/              # Static files del minijuego
views/                           # EJS templates (index, login, dashboard)
public/                          # Static global (style.css)
dist/                            # Output compilado + assets copiados (no commitear)
```

## Arquitectura

### Servidor principal (`src/server.ts`)

- Autenticación: login con credenciales hardcodeadas, acceso invitado
- Sesiones en memoria con `express-session`
- Sirve vistas EJS desde `views/` y archivos estáticos desde `public/`
- Proxy inverso: redirige `/drinkparty/*` y `/socket.io/*` al proceso hijo
- Hace `fork()` del minijuego y espera mensaje `ready` antes de `app.listen()`

### Minijuegos (`src/minijuegos/{Nombre}/`)

Cada minijuego es una app Express independiente con su propio Socket.IO server. El servidor principal lo levanta como child process y le pasa el tráfico vía http-proxy-middleware.

**Protocolo de comunicación:**
1. El child process envía `process.send('ready')` cuando esté listo
2. El padre espera `ready` antes de empezar a escuchar en su puerto
3. El padre proxy el tráfico HTTP normal y el upgrade WebSocket al hijo
4. El minijuego usa namespace de URL (ej: `/drinkparty/`) y path de Socket.IO (`/drinkparty/socket.io`)

### Cómo agregar un minijuego

1. Crear `src/minijuegos/NuevoJuego/server.ts`:
   - Express app + http server
   - Escuchar en puerto interno (`process.env.PORT || 3001`)
   - Socket.IO con path único (ej: `/nuevojuego/socket.io`)
   - `process.send('ready')` cuando esté listo
   - `app.use('/nuevojuego', express.static(...))` para servir estáticos
2. En `src/server.ts`, agregar proxy + fork
3. Agregar la copia de assets en el script `build`
4. Agregar botón en `views/dashboard.ejs`

## Despliegue en Render

Render soporta WebSocket y `child_process.fork()` nativamente, sin limitaciones. Vercel **no funciona** para este proyecto (sin WebSocket, sin fork).

### Configuración

1. Crear **Web Service** en Render, conectar repo (rama `typescript`)
2. **Build Command**: `npm install` (ejecuta `postinstall` automáticamente)
3. **Start Command**: `npm start` (compila TypeScript y ejecuta `dist/server.js`)
4. **Plan**: Starter o superior (necesario para WebSocket)

El servidor usa `process.env.PORT` — Render lo asigna automáticamente.

## Convenciones de código

- **TypeScript estricto** (`strict: true`)
- **Interfaces sobre types** para definiciones de objetos
- **camelCase** variables/funciones, **PascalCase** interfaces
- **No `any`** sin justificación; preferir `unknown` con type narrowing
- **ES modules** con `esModuleInterop: true`
- `node_modules` solo en raíz; dependencias de minijuegos via hoisting
