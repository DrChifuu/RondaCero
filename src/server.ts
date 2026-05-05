import express, { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fork, ChildProcess } from 'child_process';
import path from 'path';

interface User {
  username: string;
  password: string;
  name: string;
}

interface SessionUser {
  username: string;
  name: string;
  guest?: boolean;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || '4000', 10);

app.use(session({
  secret: 'clave-secreta-temporal',
  resave: false,
  saveUninitialized: false,
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const users: User[] = [
  { username: 'admin', password: 'admin', name: 'Admin' }
];

app.use((req: Request, res: Response, next: NextFunction) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.get('/', (req: Request, res: Response) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('index', { error: null });
});

app.get('/login', (req: Request, res: Response) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

app.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    req.session.user = { username: user.username, name: user.name };
    return res.redirect('/dashboard');
  }
  res.render('index', { error: 'Credenciales inválidas' });
});

app.post('/guest', (req: Request, res: Response) => {
  const randName = 'Invitado_' + Math.floor(Math.random() * 9000 + 1000);
  req.session.user = { username: randName, name: randName, guest: true };
  res.redirect('/dashboard');
});

app.get('/dashboard', (req: Request, res: Response) => {
  if (!req.session.user) return res.redirect('/');
  res.render('dashboard');
});

app.get('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

const drinkPartyPath = path.join(__dirname, 'minijuegos', 'DrinkParty', 'server.js');

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.url === '/drinkparty') return _res.redirect('/drinkparty/');
  next();
});

const drinkPartyProxy = createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
  pathFilter: (pathname: string) =>
    pathname.startsWith('/drinkparty/') ||
    pathname.startsWith('/socket.io/'),
  logger: console,
});

app.use(drinkPartyProxy);

const drinkPartyChild: ChildProcess = fork(drinkPartyPath, [], {
  env: { ...process.env, PORT: '3000' },
});

drinkPartyChild.on('message', (msg: unknown) => {
  if (msg === 'ready') {
    const server = app.listen(PORT, () => {
      console.log(`🎲 Ronda Cero → http://localhost:${PORT}`);
    });

    server.on('upgrade', (req: any, socket: any, head: any) => {
      if (
        req.url.startsWith('/drinkparty/') ||
        req.url.startsWith('/socket.io/')
      ) {
        if (drinkPartyProxy.upgrade) {
          drinkPartyProxy.upgrade(req, socket, head);
        } else {
          socket.destroy();
        }
      }
    });
  }
});

process.on('exit', () => drinkPartyChild.kill());
