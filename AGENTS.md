# Ronda Cero - Desarrollo

Plataforma de minijuegos sociales multijugador. Servidor principal Express + EJS que orquesta minijuegos independientes.

## Hosting recomendado: Render

Render soporta WebSocket y `child_process.fork()` de forma nativa, lo que permite ejecutar todos los minijuegos sin restricciones. **Vercel no es recomendado** para este proyecto porque:

- No soporta WebSocket (Socket.IO) en plan Hobby
- No soporta `child_process.fork()` para levantar minijuegos como subprocesos
- Las sesiones en memoria se pierden entre deploys

### Render: lo que funciona

- Login / invitado con sesiones
- Vistas EJS (index, login, dashboard)
- Archivos estáticos
- Minijuegos con tiempo real (Socket.IO) — **completo**
- Proxy a procesos hijo (fork)

## Stack

| Capa | Tecnología |
|------|-----------|
| Lenguaje | JavaScript (Node.js) |
| Backend principal | Express 4 + EJS + express-session |
| Tiempo real | Socket.IO 4 (minijuegos) |
| Proxy | http-proxy-middleware |
| Hosting | Render (Web Service) |

## Comandos

```bash
npm install      # Instalar dependencias raíz + minijuegos (postinstall)
npm start        # node server.js
```

## Estructura

```
server.js                    # Express principal (auth, rutas, proxy)
package.json                 # Dependencias raíz
views/                       # EJS templates (index, login, dashboard)
public/                      # Static global (style.css)
minijuegos/                  # Cada minijuego es un módulo independiente
  DrinkParty/
    server.js                # Lógica del minijuego (Express + Socket.IO)
    package.json             # Dependencias propias
    public/                  # Static files del minijuego (app.js, index.html, style.css)
```

## Arquitectura

### Servidor principal (`server.js`)

- Autenticación: login con credenciales hardcodeadas, acceso invitado
- Sesiones en memoria con `express-session`
- Sirve vistas EJS desde `views/` y archivos estáticos desde `public/`
- Proxy inverso: redirige `/{minijuego}/*` y `/socket.io/*` al proceso hijo correspondiente
- Hace `fork()` del minijuego y espera mensaje `ready` antes de `app.listen()`

### Minijuegos (`minijuegos/{Nombre}/`)

Cada minijuego es una app Express independiente con su propio Socket.IO server. El servidor principal lo levanta como child process y le pasa el tráfico vía http-proxy-middleware.

**Protocolo de comunicación:**
1. El child process debe enviar `process.send('ready')` cuando esté listo para recibir tráfico
2. El padre espera el mensaje `ready` antes de empezar a escuchar en su puerto
3. El padre proxy el tráfico HTTP normal y el upgrade WebSocket al hijo
4. El minijuego usa un namespace de URL (ej: `/drinkparty/`) y un path de Socket.IO específico

### Cómo agregar un minijuego nuevo

1. Crear `minijuegos/NuevoJuego/server.js` que:
   - Cree una app Express y un servidor http
   - Escuche en un puerto interno (ej: `process.env.PORT || 3001`)
   - Monte su Socket.IO con un path único (ej: `/nuevojuego/socket.io`)
   - Envíe `process.send('ready')` cuando esté listo
2. Agregar el proxy en `server.js`:
   - Crear un `createProxyMiddleware` con `target: 'http://localhost:{puerto}'`
   - Configurar `pathFilter` para `/nuevojuego/` y su socket.io path
   - Agregar el fork del child process
3. Agregar botón/enlace en `views/dashboard.ejs`

### Despliegue en Render

1. Crear **Web Service** en Render, conectar repo de GitHub
2. **Build Command**: `npm install && cd minijuegos/DrinkParty && npm install`
3. **Start Command**: `node server.js`
4. **Plan**: Starter o superior (necesario para WebSocket)
5. El servidor usa `process.env.PORT` que Render asigna automáticamente

## Convenciones de código

- **JavaScript plano** (sin TypeScript — se priorizó simplicidad y compatibilidad con Render)
- **Nombres en camelCase** para variables y funciones
- **No usar `var`** — preferir `const` y `let`
- **Mantener `node_modules` solo en raíz**; `postinstall` instala dependencias de minijuegos automáticamente
