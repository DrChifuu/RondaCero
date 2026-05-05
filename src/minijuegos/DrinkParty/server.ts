import express, { Express, Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import path from 'path';
import os from 'os';

// ========== TYPE DEFINITIONS ==========
interface TriviaQuestion {
  question: string;
  options: string[];
  correct: number;
  category: string;
}

interface Challenge {
  text: string;
  type: string;
  drinks: number;
  duration?: number;
  penaltyDrinks?: number;
}

interface TriviaDB {
  es: TriviaQuestion[];
  en: TriviaQuestion[];
}

interface ChallengesDB {
  es: Challenge[];
  en: Challenge[];
}

interface StringsDB {
  es: string[];
  en: string[];
}

interface TruthsDB {
  es: string[];
  en: string[];
}

interface DaresDB {
  es: string[];
  en: string[];
}

interface CustomContent {
  trivia: TriviaQuestion[];
  challenge: Challenge[];
  neverever: string[];
  truthordare: { truths: string[]; dares: string[] };
}

interface GameSettings {
  lang: string;
  timePerQuestion: number;
  barFillPerWrong: number;
  drinksPerWrongAnswer: number;
  maxRounds: number;
  voteTime: number;
  cancelMethod: string;
  autoAdvanceNeverEver: boolean;
  autoAdvanceTime: number;
  gameTypes: string[];
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  totalDrinks: number;
  correctAnswers: number;
  wrongAnswers: number;
  score: number;
  isHost: boolean;
  connected: boolean;
  ready: boolean;
}

interface TimedEffect {
  playerId: string;
  playerName: string;
  text: string;
  expiresAtRound: number;
  penaltyDrinks: number;
}

interface CurrentChallenge {
  type: string;
  text?: string;
  drinks?: number;
  targetPlayer?: string;
  statement?: string;
  content?: string;
  duration?: number;
  penaltyDrinks?: number;
}

interface Room {
  code: string;
  host: string;
  players: { [id: string]: Player };
  gameState: string;
  currentGame: string | null;
  currentQuestion: TriviaQuestion | null;
  currentChallenge: CurrentChallenge | null;
  currentVerification?: TimedEffect;
  collectiveBar: number;
  roundNumber: number;
  usedQ: number[];
  usedC: number[];
  usedNE: number[];
  usedT: number[];
  usedD: number[];
  answers: { [pid: string]: { answer: number; isCorrect: boolean } };
  skipVotes: { [pid: string]: boolean };
  challengeVotes: { [pid: string]: boolean };
  cancelVotes: { [pid: string]: boolean };
  verifyVotes: { [pid: string]: boolean };
  neverEverResponses: { [pid: string]: { name: string; avatar: string; drank: boolean } };
  collectiveAccepts: { [pid: string]: boolean };
  timer: NodeJS.Timeout | null;
  timerInterval: NodeJS.Timeout | null;
  voteTimer: NodeJS.Timeout | null;
  neTimer: NodeJS.Timeout | null;
  verifyTimer: NodeJS.Timeout | null;
  expenses: Expense[];
  customContent: CustomContent;
  timedEffects: TimedEffect[];
  pendingVerifications: TimedEffect[];
  settings: GameSettings;
}

interface SafeRoom {
  code: string;
  gameState: string;
  currentGame: string | null;
  collectiveBar: number;
  roundNumber: number;
  totalRounds: number;
  settings: GameSettings;
  players: Player[];
  readyCount: number;
  connectedCount: number;
  inviteLink: string;
  customContent: CustomContent;
  timedEffects: TimedEffect[];
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  timestamp: number;
}

interface SplitResult {
  total: number;
  perPerson: number;
  balances: { [name: string]: { paid: number; owes: number; balance: number } };
}

interface NetworkInterfaceInfo {
  address: string;
  family: string;
  internal: boolean;
}

// ========== EXPRESS & SOCKET.IO SETUP ==========
const app: Express = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' },
  path: '/drinkparty/socket.io',
});

app.use('/drinkparty', express.static(path.join(__dirname, 'public')));

// ========== UTILITIES ==========
function getLocalIP(): string {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    const iface = ifaces[name];
    if (iface) {
      for (const info of iface) {
        if (info.family === 'IPv4' && !info.internal) return info.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP: string = getLocalIP();
const PORT: number = parseInt(process.env.PORT || '3000', 10);
const BASE_URL: string = process.env.BASE_URL || `http://${LOCAL_IP}:${PORT}`;

// ========== GAME DATA ==========

const triviaDB: TriviaDB = {
  es: [
    { question: '¿Cuál es el país más grande del mundo?', options: ['China', 'Rusia', 'Estados Unidos', 'Canadá'], correct: 1, category: 'Geografía' },
    { question: '¿En qué año llegó el hombre a la Luna?', options: ['1965', '1969', '1971', '1973'], correct: 1, category: 'Historia' },
    { question: '¿Cuántos huesos tiene el cuerpo humano adulto?', options: ['196', '206', '216', '186'], correct: 1, category: 'Ciencia' },
    { question: '¿Quién pintó la Mona Lisa?', options: ['Miguel Ángel', 'Rafael', 'Leonardo da Vinci', 'Donatello'], correct: 2, category: 'Arte' },
    { question: '¿Cuál es el océano más grande?', options: ['Atlántico', 'Índico', 'Ártico', 'Pacífico'], correct: 3, category: 'Geografía' },
    { question: '¿Cuántos planetas tiene el sistema solar?', options: ['7', '8', '9', '10'], correct: 1, category: 'Ciencia' },
    { question: '¿En qué país se encuentra la Torre Eiffel?', options: ['Italia', 'España', 'Francia', 'Alemania'], correct: 2, category: 'Geografía' },
    { question: '¿Cuál es el elemento químico más abundante en el universo?', options: ['Oxígeno', 'Carbono', 'Helio', 'Hidrógeno'], correct: 3, category: 'Ciencia' },
    { question: '¿Quién escribió \'Cien años de soledad\'?', options: ['Pablo Neruda', 'García Márquez', 'Borges', 'Cortázar'], correct: 1, category: 'Literatura' },
    { question: '¿Cuál es la capital de Australia?', options: ['Sídney', 'Melbourne', 'Canberra', 'Brisbane'], correct: 2, category: 'Geografía' },
    { question: '¿Cuántos corazones tiene un pulpo?', options: ['1', '2', '3', '4'], correct: 2, category: 'Ciencia' },
    { question: '¿En qué año se fundó Google?', options: ['1996', '1998', '2000', '2002'], correct: 1, category: 'Tecnología' },
    { question: '¿Cuál es el río más largo del mundo?', options: ['Nilo', 'Amazonas', 'Misisipi', 'Yangtsé'], correct: 1, category: 'Geografía' },
    { question: '¿Quién descubrió la penicilina?', options: ['Pasteur', 'Fleming', 'Koch', 'Jenner'], correct: 1, category: 'Ciencia' },
    { question: '¿Cada cuántos años se celebran los Juegos Olímpicos?', options: ['2', '3', '4', '5'], correct: 2, category: 'Deportes' },
    { question: '¿Cuántos jugadores tiene un equipo de fútbol en cancha?', options: ['9', '10', '11', '12'], correct: 2, category: 'Deportes' },
    { question: '¿Cómo se llama el protagonista de Breaking Bad?', options: ['Jesse Pinkman', 'Hank Schrader', 'Walter White', 'Saul Goodman'], correct: 2, category: 'Series' },
    { question: '¿Qué banda cantó \'Bohemian Rhapsody\'?', options: ['The Beatles', 'Led Zeppelin', 'Queen', 'Pink Floyd'], correct: 2, category: 'Música' },
    { question: '¿Cuántos infinity stones hay en Marvel?', options: ['4', '5', '6', '7'], correct: 2, category: 'Cine' },
    { question: '¿De qué país es originario el tequila?', options: ['Colombia', 'Perú', 'México', 'Cuba'], correct: 2, category: 'Bebidas' },
    { question: '¿De qué se hace el sake?', options: ['Trigo', 'Cebada', 'Arroz', 'Maíz'], correct: 2, category: 'Bebidas' },
    { question: '¿Qué bebida tiene el gusano en la botella?', options: ['Tequila', 'Mezcal', 'Ron', 'Whisky'], correct: 1, category: 'Bebidas' },
    { question: '¿Cuántos dientes tiene un adulto normalmente?', options: ['28', '30', '32', '34'], correct: 2, category: 'Ciencia' },
    { question: '¿Cuál es el metal más caro del mundo?', options: ['Oro', 'Platino', 'Rodio', 'Paladio'], correct: 2, category: 'Ciencia' },
    { question: '¿En qué año cayó el Muro de Berlín?', options: ['1987', '1989', '1991', '1993'], correct: 1, category: 'Historia' },
    { question: '¿Cuál es la montaña más alta del mundo?', options: ['K2', 'Kangchenjunga', 'Everest', 'Lhotse'], correct: 2, category: 'Geografía' },
    { question: '¿Cuál es el animal más rápido del mundo?', options: ['Guepardo', 'Halcón peregrino', 'Águila', 'Gacela'], correct: 1, category: 'Ciencia' },
    { question: '¿En qué año se hundió el Titanic?', options: ['1910', '1912', '1914', '1916'], correct: 1, category: 'Historia' },
    { question: '¿Cuál es la cerveza más vendida del mundo?', options: ['Budweiser', 'Heineken', 'Corona', 'Snow'], correct: 3, category: 'Bebidas' },
    { question: '¿Quién fue el primer presidente de EEUU?', options: ['Lincoln', 'Jefferson', 'Washington', 'Adams'], correct: 2, category: 'Historia' },
  ],
  en: [
    { question: 'What is the largest country in the world?', options: ['China', 'Russia', 'United States', 'Canada'], correct: 1, category: 'Geography' },
    { question: 'In what year did man land on the Moon?', options: ['1965', '1969', '1971', '1973'], correct: 1, category: 'History' },
    { question: 'How many bones does the adult human body have?', options: ['196', '206', '216', '186'], correct: 1, category: 'Science' },
    { question: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Donatello'], correct: 2, category: 'Art' },
    { question: 'What is the largest ocean?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correct: 3, category: 'Geography' },
    { question: 'How many planets does the solar system have?', options: ['7', '8', '9', '10'], correct: 1, category: 'Science' },
    { question: 'In which country is the Eiffel Tower?', options: ['Italy', 'Spain', 'France', 'Germany'], correct: 2, category: 'Geography' },
    { question: 'What is the most abundant element in the universe?', options: ['Oxygen', 'Carbon', 'Helium', 'Hydrogen'], correct: 3, category: 'Science' },
    { question: 'Who wrote \'One Hundred Years of Solitude\'?', options: ['Pablo Neruda', 'García Márquez', 'Borges', 'Cortázar'], correct: 1, category: 'Literature' },
    { question: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'], correct: 2, category: 'Geography' },
    { question: 'How many hearts does an octopus have?', options: ['1', '2', '3', '4'], correct: 2, category: 'Science' },
    { question: 'In what year was Google founded?', options: ['1996', '1998', '2000', '2002'], correct: 1, category: 'Technology' },
    { question: 'What is the longest river in the world?', options: ['Nile', 'Amazon', 'Mississippi', 'Yangtze'], correct: 1, category: 'Geography' },
    { question: 'Who discovered penicillin?', options: ['Pasteur', 'Fleming', 'Koch', 'Jenner'], correct: 1, category: 'Science' },
    { question: 'How often are the Olympic Games held?', options: ['2 years', '3 years', '4 years', '5 years'], correct: 2, category: 'Sports' },
    { question: 'How many players on a soccer team on the field?', options: ['9', '10', '11', '12'], correct: 2, category: 'Sports' },
    { question: 'What is the name of Breaking Bad\'s protagonist?', options: ['Jesse Pinkman', 'Hank Schrader', 'Walter White', 'Saul Goodman'], correct: 2, category: 'TV Shows' },
    { question: 'Which band sang \'Bohemian Rhapsody\'?', options: ['The Beatles', 'Led Zeppelin', 'Queen', 'Pink Floyd'], correct: 2, category: 'Music' },
    { question: 'How many infinity stones are in Marvel?', options: ['4', '5', '6', '7'], correct: 2, category: 'Movies' },
    { question: 'From which country does tequila originate?', options: ['Colombia', 'Peru', 'Mexico', 'Cuba'], correct: 2, category: 'Drinks' },
    { question: 'What is sake made from?', options: ['Wheat', 'Barley', 'Rice', 'Corn'], correct: 2, category: 'Drinks' },
    { question: 'Which drink has a worm in the bottle?', options: ['Tequila', 'Mezcal', 'Rum', 'Whisky'], correct: 1, category: 'Drinks' },
    { question: 'How many teeth does an adult normally have?', options: ['28', '30', '32', '34'], correct: 2, category: 'Science' },
    { question: 'What is the most expensive metal?', options: ['Gold', 'Platinum', 'Rhodium', 'Palladium'], correct: 2, category: 'Science' },
    { question: 'In what year did the Berlin Wall fall?', options: ['1987', '1989', '1991', '1993'], correct: 1, category: 'History' },
    { question: 'What is the highest mountain in the world?', options: ['K2', 'Kangchenjunga', 'Everest', 'Lhotse'], correct: 2, category: 'Geography' },
    { question: 'What is the fastest animal in the world?', options: ['Cheetah', 'Peregrine falcon', 'Eagle', 'Gazelle'], correct: 1, category: 'Science' },
    { question: 'In what year did the Titanic sink?', options: ['1910', '1912', '1914', '1916'], correct: 1, category: 'History' },
    { question: 'What is the best-selling beer in the world?', options: ['Budweiser', 'Heineken', 'Corona', 'Snow'], correct: 3, category: 'Drinks' },
    { question: 'Who was the first US president?', options: ['Lincoln', 'Jefferson', 'Washington', 'Adams'], correct: 2, category: 'History' },
  ]
};

const challengesDB: ChallengesDB = {
  es: [
    { text: '🍺 Toma 2 tragos seguidos', type: 'drink', drinks: 2 },
    { text: '📱 Deja tu celular en el centro de la mesa por 3 rondas', type: 'timed_action', drinks: 0, duration: 3, penaltyDrinks: 2 },
    { text: '🎤 Canta el coro de tu canción favorita', type: 'action', drinks: 0 },
    { text: '💃 Baila por 15 segundos sin música', type: 'action', drinks: 0 },
    { text: '🤳 Tómate una selfie haciendo tu peor cara', type: 'action', drinks: 0 },
    { text: '🗣️ Habla con acento extranjero por 2 rondas', type: 'timed_action', drinks: 0, duration: 2, penaltyDrinks: 2 },
    { text: '👅 Di un trabalenguas sin equivocarte o bebe 2 tragos', type: 'action_or_drink', drinks: 2 },
    { text: '🤝 Escoge a alguien para que beba contigo', type: 'drink', drinks: 1 },
    { text: '📞 Llama al último contacto y dile algo bonito', type: 'action', drinks: 0 },
    { text: '🎭 Imita a alguien del grupo y los demás adivinan', type: 'action', drinks: 0 },
    { text: '🤔 Cuenta tu momento más vergonzoso o bebe 3 tragos', type: 'action_or_drink', drinks: 3 },
    { text: '🎵 Silba una canción y los demás adivinan', type: 'action', drinks: 0 },
    { text: '💪 Haz 10 sentadillas', type: 'action', drinks: 0 },
    { text: '🤐 No puedes hablar por 2 rondas, solo señas', type: 'timed_action', drinks: 0, duration: 2, penaltyDrinks: 2 },
    { text: '🍺 Inventa un brindis épico y todos beben', type: 'drink_all', drinks: 1 },
    { text: '🎤 Rapea sobre la persona de tu derecha por 20 segundos', type: 'action', drinks: 0 },
    { text: '🤡 Cuenta un chiste. Si nadie ríe, bebe 2 tragos', type: 'action_or_drink', drinks: 2 },
    { text: '📸 Deja que el grupo elija tu foto de perfil por 24hrs', type: 'action', drinks: 0 },
    { text: '🕺 Haz tu mejor moonwalk', type: 'action', drinks: 0 },
    { text: '💬 Di algo bonito de cada persona en la mesa', type: 'action', drinks: 0 },
  ],
  en: [
    { text: '🍺 Take 2 shots in a row', type: 'drink', drinks: 2 },
    { text: '📱 Put your phone in the center for 3 rounds', type: 'timed_action', drinks: 0, duration: 3, penaltyDrinks: 2 },
    { text: '🎤 Sing the chorus of your favorite song', type: 'action', drinks: 0 },
    { text: '💃 Dance for 15 seconds without music', type: 'action', drinks: 0 },
    { text: '🤳 Take a selfie making your worst face', type: 'action', drinks: 0 },
    { text: '🗣️ Speak with a foreign accent for 2 rounds', type: 'timed_action', drinks: 0, duration: 2, penaltyDrinks: 2 },
    { text: '👅 Say a tongue twister without messing up or drink 2', type: 'action_or_drink', drinks: 2 },
    { text: '🤝 Choose someone to drink with you', type: 'drink', drinks: 1 },
    { text: '📞 Call your last contact and say something nice', type: 'action', drinks: 0 },
    { text: '🎭 Imitate someone from the group, others guess', type: 'action', drinks: 0 },
    { text: '🤔 Tell your most embarrassing moment or drink 3', type: 'action_or_drink', drinks: 3 },
    { text: '🎵 Whistle a song and others guess it', type: 'action', drinks: 0 },
    { text: '💪 Do 10 squats', type: 'action', drinks: 0 },
    { text: '🤐 You can\'t talk for 2 rounds, signs only', type: 'timed_action', drinks: 0, duration: 2, penaltyDrinks: 2 },
    { text: '🍺 Make an epic toast and everyone drinks', type: 'drink_all', drinks: 1 },
    { text: '🎤 Rap about the person to your right for 20 sec', type: 'action', drinks: 0 },
    { text: '🤡 Tell a joke. If nobody laughs, drink 2', type: 'action_or_drink', drinks: 2 },
    { text: '📸 Let the group choose your profile pic for 24hrs', type: 'action', drinks: 0 },
    { text: '🕺 Do your best moonwalk', type: 'action', drinks: 0 },
    { text: '💬 Say something nice about everyone at the table', type: 'action', drinks: 0 },
  ]
};

const neverEverDB: StringsDB = {
  es: [
    'Yo nunca nunca me he quedado dormido en el transporte público',
    'Yo nunca nunca he stalkeado a un ex en redes sociales',
    'Yo nunca nunca he mandado un mensaje al contacto equivocado',
    'Yo nunca nunca me he caído en público',
    'Yo nunca nunca he fingido estar enfermo para no ir a trabajar',
    'Yo nunca nunca he cantado en la ducha',
    'Yo nunca nunca he hecho karaoke',
    'Yo nunca nunca he perdido el celular estando borracho',
    'Yo nunca nunca me he comido algo del piso',
    'Yo nunca nunca he llorado con una película',
    'Yo nunca nunca he mentido sobre mi edad',
    'Yo nunca nunca he robado algo de un hotel',
    'Yo nunca nunca he mandado un mensaje borracho del que me arrepiento',
    'Yo nunca nunca he hecho ghosting',
    'Yo nunca nunca me he quedado sin dinero en una cita',
    'Yo nunca nunca he fingido saber de un tema del que no sé nada',
    'Yo nunca nunca he visto un reality show entero',
    'Yo nunca nunca he hecho ejercicio solo para comer más',
    'Yo nunca nunca he besado a alguien que acabo de conocer',
    'Yo nunca nunca he fingido que me gusta un regalo',
  ],
  en: [
    'Never have I ever fallen asleep on public transport',
    'Never have I ever stalked an ex on social media',
    'Never have I ever sent a message to the wrong person',
    'Never have I ever fallen in public',
    'Never have I ever faked being sick to skip work',
    'Never have I ever sung in the shower',
    'Never have I ever done karaoke',
    'Never have I ever lost my phone while drunk',
    'Never have I ever eaten something off the floor',
    'Never have I ever cried during a movie',
    'Never have I ever lied about my age',
    'Never have I ever stolen something from a hotel',
    'Never have I ever sent a drunk text I regretted',
    'Never have I ever ghosted someone',
    'Never have I ever run out of money on a date',
    'Never have I ever pretended to know about a topic',
    'Never have I ever binge-watched an entire reality show',
    'Never have I ever exercised just to eat more',
    'Never have I ever kissed someone I just met',
    'Never have I ever pretended to like a gift',
  ]
};

const truthsDB: StringsDB = {
  es: [
    '¿Cuál es la mentira más grande que has dicho?',
    '¿Quién es la persona más atractiva de esta mesa?',
    '¿Cuál fue tu peor cita?',
    '¿Cuál es tu guilty pleasure más vergonzoso?',
    '¿Cuál fue la última mentira que dijiste?',
    '¿A quién de aquí le contarías un secreto?',
    '¿Cuál es tu crush de famoso/a?',
    '¿Qué es lo más loco que has hecho borracho/a?',
    '¿Cuál es tu peor hábito?',
    '¿A quién fue la última persona que stalkeaste?',
    'Si pudieras besar a alguien aquí, ¿a quién?',
    '¿Cuál es la cosa más rara que has buscado en Google?',
    '¿Cuánto fue lo máximo que gastaste en algo innecesario?',
    '¿Cuál ha sido tu peor borrachera?',
    '¿Alguna vez has mentido a alguien de esta mesa?',
  ],
  en: [
    'What is the biggest lie you\'ve ever told?',
    'Who is the most attractive person at this table?',
    'What was your worst date?',
    'What is your most embarrassing guilty pleasure?',
    'What was the last lie you told?',
    'Who here would you tell a secret to?',
    'Who is your celebrity crush?',
    'What\'s the craziest thing you\'ve done while drunk?',
    'What is your worst habit?',
    'Who was the last person you stalked online?',
    'If you could kiss someone here, who?',
    'What\'s the weirdest thing you\'ve Googled?',
    'What\'s the most you\'ve spent on something unnecessary?',
    'What was your worst hangover?',
    'Have you ever lied to someone at this table?',
  ]
};

const daresDB: StringsDB = {
  es: [
    'Déjale un audio vergonzoso al último contacto de WhatsApp',
    'Publica algo vergonzoso en tus historias',
    'Haz 20 abdominales ahora mismo',
    'Deja que alguien del grupo publique algo en tus redes',
    'Imita al jugador de tu derecha por 1 minuto',
    'Habla como robot por las próximas 2 rondas',
    'Haz tu mejor imitación de un animal',
    'Dile un piropo a la persona de tu izquierda',
    'Intercambia una prenda con alguien del grupo',
    'Haz tu mejor cara de modelo para una foto',
    'Llama a alguien y cántale \'Las Mañanitas\'',
    'Deja que el grupo elija tu foto de perfil por 24hrs',
    'Haz tu mejor moonwalk',
    'Di algo bonito de cada persona en la mesa',
    'Haz una declaración de amor a la cámara',
  ],
  en: [
    'Send an embarrassing voice note to your last WhatsApp contact',
    'Post something embarrassing on your stories',
    'Do 20 sit-ups right now',
    'Let someone post on your social media',
    'Imitate the player to your right for 1 minute',
    'Talk like a robot for 2 rounds',
    'Do your best animal impression',
    'Give a compliment to the person on your left',
    'Swap clothing with someone',
    'Strike your best model pose for a photo',
    'Call someone and sing them Happy Birthday',
    'Let the group choose your profile pic for 24hrs',
    'Do your best moonwalk',
    'Say something nice about everyone at the table',
    'Make a love declaration to the camera',
  ]
};

// ========== ROOM STORE ==========
const rooms: { [code: string]: Room } = {};

function genCode(): string {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = '';
  for (let i = 0; i < 5; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

function randItem<T>(arr: T[], used: number[] = []): { item: T; i: number } {
  const avail = arr.map((item, i) => ({ item, i })).filter(x => !used.includes(x.i));
  if (!avail.length) {
    const idx = Math.floor(Math.random() * arr.length);
    return { item: arr[idx], i: -1 };
  }
  const pick = avail[Math.floor(Math.random() * avail.length)];
  return pick;
}

function connected(room: Room): Player[] {
  return Object.values(room.players).filter(p => p.connected);
}

function calcBar(room: Room): number {
  const total = Object.values(room.players).reduce((s, p) => s + p.wrongAnswers, 0);
  return Math.min(total * room.settings.barFillPerWrong, 100);
}

function safeRoom(code: string): SafeRoom | null {
  const room = rooms[code];
  if (!room) return null;
  return {
    code: room.code,
    gameState: room.gameState,
    currentGame: room.currentGame,
    collectiveBar: room.collectiveBar,
    roundNumber: room.roundNumber,
    totalRounds: room.settings.maxRounds,
    settings: room.settings,
    players: Object.values(room.players).map(p => ({
      id: p.id, name: p.name, avatar: p.avatar,
      totalDrinks: p.totalDrinks, correctAnswers: p.correctAnswers,
      wrongAnswers: p.wrongAnswers, score: p.score,
      isHost: p.isHost, connected: p.connected, ready: p.ready,
    })),
    readyCount: Object.values(room.players).filter(p => p.connected && p.ready).length,
    connectedCount: connected(room).length,
    inviteLink: `${BASE_URL}?room=${room.code}`,
    customContent: room.customContent,
    timedEffects: room.timedEffects,
  };
}

function calcSplit(room: Room): SplitResult {
  const total = room.expenses.reduce((s, e) => s + e.amount, 0);
  const count = connected(room).length || 1;
  const pp = total / count;
  const payments: { [name: string]: number } = {};
  room.expenses.forEach(e => { payments[e.paidBy] = (payments[e.paidBy] || 0) + e.amount; });
  const balances: { [name: string]: { paid: number; owes: number; balance: number } } = {};
  Object.values(room.players).forEach(p => {
    const paid = payments[p.name] || 0;
    balances[p.name] = { paid, owes: pp, balance: paid - pp };
  });
  return { total, perPerson: Math.round(pp * 100) / 100, balances };
}

// QR endpoint
app.get('/api/qr/:code', async (req: Request, res: Response) => {
  try {
    const url = `${BASE_URL}?room=${req.params.code}`;
    const qr = await QRCode.toDataURL(url, { width: 256, margin: 1, color: { dark: '#ff6b35', light: '#1a1a2e' } });
    res.json({ qr, url });
  } catch (e) { res.status(500).json({ error: 'QR fail' }); }
});

// ========== SOCKET.IO ==========
io.on('connection', (socket: Socket) => {
  console.log(`🔌 ${socket.id}`);

  socket.on('createRoom', ({ playerName, avatar }: { playerName: string; avatar: string }) => {
    const code = genCode();
    rooms[code] = {
      code, host: socket.id, players: {},
      gameState: 'lobby', currentGame: null, currentQuestion: null, currentChallenge: null,
      collectiveBar: 0, roundNumber: 0,
      usedQ: [], usedC: [], usedNE: [], usedT: [], usedD: [],
      answers: {}, skipVotes: {}, challengeVotes: {}, cancelVotes: {}, verifyVotes: {},
      neverEverResponses: {},
      collectiveAccepts: {},
      timer: null, timerInterval: null, voteTimer: null, neTimer: null, verifyTimer: null,
      expenses: [],
      customContent: { trivia: [], challenge: [], neverever: [], truthordare: { truths: [], dares: [] } },
      timedEffects: [],
      pendingVerifications: [],
      settings: {
        lang: 'es', timePerQuestion: 20, barFillPerWrong: 8,
        drinksPerWrongAnswer: 1, maxRounds: 20, voteTime: 15,
        cancelMethod: 'host',
        autoAdvanceNeverEver: true, autoAdvanceTime: 10,
        gameTypes: ['trivia', 'challenge', 'neverever', 'truthordare'],
      },
    };
    rooms[code].players[socket.id] = {
      id: socket.id, name: playerName, avatar: avatar || '😎',
      totalDrinks: 0, correctAnswers: 0, wrongAnswers: 0, score: 0,
      isHost: true, connected: true, ready: true,
    };
    socket.join(code);
    (socket as any).roomCode = code;
    socket.emit('roomCreated', { roomCode: code, player: rooms[code].players[socket.id], room: safeRoom(code) });
  });

  socket.on('joinRoom', ({ roomCode, playerName, avatar }: { roomCode: string; playerName: string; avatar: string }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return socket.emit('error', { message: 'Sala no encontrada' });
    if (Object.keys(room.players).length >= 12) return socket.emit('error', { message: 'Sala llena (max 12)' });

    if (room.gameState !== 'lobby') {
      const ex = Object.values(room.players).find(p => p.name === playerName);
      if (ex) {
        delete room.players[ex.id];
        room.players[socket.id] = { ...ex, id: socket.id, connected: true };
        socket.join(code); (socket as any).roomCode = code;
        socket.emit('roomJoined', { roomCode: code, player: room.players[socket.id], room: safeRoom(code), reconnected: true });
        io.to(code).emit('playerReconnected', { player: room.players[socket.id], room: safeRoom(code) });
        return;
      }
      return socket.emit('error', { message: 'Juego en progreso' });
    }

    room.players[socket.id] = {
      id: socket.id, name: playerName, avatar: avatar || '😎',
      totalDrinks: 0, correctAnswers: 0, wrongAnswers: 0, score: 0,
      isHost: false, connected: true, ready: false,
    };
    socket.join(code); (socket as any).roomCode = code;
    socket.emit('roomJoined', { roomCode: code, player: room.players[socket.id], room: safeRoom(code) });
    io.to(code).emit('playerJoined', { player: room.players[socket.id], room: safeRoom(code) });
  });

  socket.on('toggleReady', () => {
    const room = rooms[(socket as any).roomCode];
    if (!room || room.gameState !== 'lobby') return;
    const p = room.players[socket.id];
    if (!p) return;
    p.ready = !p.ready;
    io.to((socket as any).roomCode).emit('readyUpdate', { room: safeRoom((socket as any).roomCode) });
  });

  socket.on('startGame', ({ settings }: { settings?: Partial<GameSettings> }) => {
    const room = rooms[(socket as any).roomCode];
    if (!room || room.host !== socket.id) return;
    const conn = connected(room);
    if (conn.length < 2) return socket.emit('error', { message: 'Mínimo 2 jugadores' });
    const readyN = conn.filter(p => p.ready).length;
    if (readyN < conn.length - 1) return socket.emit('error', { message: 'Faltan jugadores por estar listos' });

    if (settings) room.settings = { ...room.settings, ...settings };
    room.gameState = 'playing';
    room.roundNumber = 0;
    room.collectiveBar = 0;
    room.timedEffects = [];
    Object.values(room.players).forEach(p => {
      p.totalDrinks = 0; p.correctAnswers = 0; p.wrongAnswers = 0; p.score = 0;
    });
    io.to((socket as any).roomCode).emit('gameStarted', { room: safeRoom((socket as any).roomCode) });
    setTimeout(() => nextRound((socket as any).roomCode), 3000);
  });

  socket.on('answerTrivia', ({ answer }: { answer: number }) => {
    const room = rooms[(socket as any).roomCode];
    if (!room || room.gameState !== 'playing' || !room.currentQuestion) return;
    if (room.answers[socket.id] !== undefined) return;
    const p = room.players[socket.id]; if (!p) return;

    const ok = answer === room.currentQuestion.correct;
    room.answers[socket.id] = { answer, isCorrect: ok };
    if (ok) { p.correctAnswers++; p.score += 100; }
    else { p.wrongAnswers++; p.totalDrinks += room.settings.drinksPerWrongAnswer; room.collectiveBar = calcBar(room); }

    io.to((socket as any).roomCode).emit('playerAnswered', {
      playerId: socket.id, playerName: p.name,
      answeredCount: Object.keys(room.answers).length,
      totalPlayers: connected(room).length,
    });

    if (Object.keys(room.answers).length >= connected(room).length) {
      clearTimeout(room.timer!); clearInterval(room.timerInterval!);
      revealAnswer((socket as any).roomCode);
    }
  });

  socket.on('challengeVote', ({ completed }: { completed: boolean }) => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    room.challengeVotes[socket.id] = completed;
    const conn = connected(room);
    const vc = Object.keys(room.challengeVotes).length;
    io.to((socket as any).roomCode).emit('challengeVoteUpdate', {
      votes: room.challengeVotes, voteCount: vc, totalNeeded: conn.length, room: safeRoom((socket as any).roomCode),
    });
    if (vc >= conn.length) { clearTimeout(room.voteTimer!); resolveChallengeVote((socket as any).roomCode); }
  });

  socket.on('timedActionResponse', ({ accepted }: { accepted: boolean }) => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    const ch = room.currentChallenge; if (!ch || ch.type !== 'timed_action') return;
    const target = room.players[ch.targetPlayer!]; if (!target) return;
    const penalty = ch.penaltyDrinks || 2;

    if (accepted) {
      room.timedEffects.push({
        playerId: target.id, playerName: target.name,
        text: ch.text!, expiresAtRound: room.roundNumber + (ch.duration || 2),
        penaltyDrinks: penalty,
      });
      io.to((socket as any).roomCode).emit('timedEffectAdded', {
        effect: { playerId: target.id, playerName: target.name, text: ch.text!, expiresAtRound: room.roundNumber + (ch.duration || 2) },
        room: safeRoom((socket as any).roomCode),
      });
      io.to((socket as any).roomCode).emit('timedActionAccepted', {
        targetPlayer: { id: target.id, name: target.name, avatar: target.avatar },
        challenge: ch.text, duration: ch.duration || 2,
      });
    } else {
      target.totalDrinks += penalty;
      io.to((socket as any).roomCode).emit('timedActionRejected', {
        targetPlayer: { id: target.id, name: target.name, avatar: target.avatar },
        penalty, room: safeRoom((socket as any).roomCode),
      });
    }
    setTimeout(() => io.to((socket as any).roomCode).emit('showSkipButton'), 3000);
  });

  socket.on('timedEffectVerifyVote', ({ completed }: { completed: boolean }) => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    room.verifyVotes[socket.id] = completed;
    const conn = connected(room);
    const vc = Object.keys(room.verifyVotes).length;
    io.to((socket as any).roomCode).emit('timedEffectVerifyUpdate', {
      voteCount: vc, totalNeeded: conn.length,
    });
    if (vc >= conn.length) { clearTimeout(room.voteTimer!); resolveTimedVerification((socket as any).roomCode); }
  });

  socket.on('neverEverDrink', () => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    const p = room.players[socket.id]; if (!p || room.neverEverResponses[socket.id]) return;
    p.totalDrinks += 1;
    room.neverEverResponses[socket.id] = { name: p.name, avatar: p.avatar, drank: true };
    io.to((socket as any).roomCode).emit('playerDrank', {
      playerId: socket.id, playerName: p.name, playerAvatar: p.avatar,
      responses: room.neverEverResponses, room: safeRoom((socket as any).roomCode),
    });
    checkNEAutoAdvance((socket as any).roomCode);
  });

  socket.on('neverEverPass', () => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    if (room.neverEverResponses[socket.id]) return;
    const p = room.players[socket.id]; if (!p) return;
    room.neverEverResponses[socket.id] = { name: p.name, avatar: p.avatar, drank: false };
    io.to((socket as any).roomCode).emit('playerPassed', {
      playerId: socket.id, responses: room.neverEverResponses,
      totalResponded: Object.keys(room.neverEverResponses).length,
      totalPlayers: connected(room).length, room: safeRoom((socket as any).roomCode),
    });
    checkNEAutoAdvance((socket as any).roomCode);
  });

  socket.on('chooseTruthOrDare', ({ choice }: { choice: string }) => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    const lang = room.settings.lang;
    let content: string;
    if (choice === 'truth') {
      const all = [...truthsDB[lang as keyof typeof truthsDB], ...room.customContent.truthordare.truths];
      const { item, i } = randItem(all, room.usedT);
      content = item; if (i >= 0) room.usedT.push(i);
    } else {
      const all = [...daresDB[lang as keyof typeof daresDB], ...room.customContent.truthordare.dares];
      const { item, i } = randItem(all, room.usedD);
      content = item; if (i >= 0) room.usedD.push(i);
    }
    room.currentChallenge = { type: choice, content };
    io.to((socket as any).roomCode).emit('truthOrDareRevealed', {
      type: choice, content, player: room.players[socket.id],
    });
  });

  socket.on('voteSkip', () => {
    const room = rooms[(socket as any).roomCode];
    if (!room || room.gameState !== 'playing') return;
    room.skipVotes[socket.id] = true;
    const conn = connected(room);
    const sc = Object.keys(room.skipVotes).length;
    io.to((socket as any).roomCode).emit('skipVoteUpdate', { skipCount: sc, totalNeeded: conn.length });
    if (sc >= Math.max(Math.ceil(conn.length / 2), 1)) {
      clearAllTimers(room);
      room.skipVotes = {};
      nextRound((socket as any).roomCode);
    }
  });

  socket.on('nextRound', () => {
    const room = rooms[(socket as any).roomCode];
    if (!room || room.host !== socket.id) return;
    clearAllTimers(room);
    room.skipVotes = {};
    nextRound((socket as any).roomCode);
  });

  socket.on('collectiveAccept', () => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    room.collectiveAccepts[socket.id] = true;
    const conn = connected(room);
    const ac = Object.keys(room.collectiveAccepts).length;
    io.to((socket as any).roomCode).emit('collectiveAcceptUpdate', { count: ac, total: conn.length });
    if (ac >= conn.length) {
      room.collectiveAccepts = {};
      startRound((socket as any).roomCode);
    }
  });

  socket.on('cancelGame', () => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    if (room.settings.cancelMethod === 'host') {
      if (room.host !== socket.id) return;
      endGame((socket as any).roomCode, true);
    } else {
      room.cancelVotes[socket.id] = true;
      const conn = connected(room);
      io.to((socket as any).roomCode).emit('cancelVoteUpdate', {
        cancelCount: Object.keys(room.cancelVotes).length,
        totalNeeded: Math.ceil(conn.length / 2),
      });
      if (Object.keys(room.cancelVotes).length >= Math.ceil(conn.length / 2)) endGame((socket as any).roomCode, true);
    }
  });

  socket.on('kickPlayer', ({ playerId }: { playerId: string }) => {
    const room = rooms[(socket as any).roomCode];
    if (!room || room.host !== socket.id) return;
    const kicked = room.players[playerId]; if (!kicked || kicked.isHost) return;
    io.to(playerId).emit('kicked');
    delete room.players[playerId];
    const ks = io.sockets.sockets.get(playerId);
    if (ks) { ks.leave((socket as any).roomCode); (ks as any).roomCode = null; }
    io.to((socket as any).roomCode).emit('playerKicked', { playerName: kicked.name, room: safeRoom((socket as any).roomCode) });
  });

  socket.on('leaveRoom', () => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    const p = room.players[socket.id]; if (!p) return;
    if (room.gameState === 'playing') {
      p.connected = false;
      io.to((socket as any).roomCode).emit('playerDisconnected', { player: p, room: safeRoom((socket as any).roomCode) });
    } else {
      delete room.players[socket.id];
      io.to((socket as any).roomCode).emit('playerLeft', { playerName: p.name, room: safeRoom((socket as any).roomCode) });
    }
    socket.leave((socket as any).roomCode);
    if (room.host === socket.id) {
      const conn2 = connected(room);
      if (conn2.length > 0) {
        room.host = conn2[0].id;
        conn2[0].isHost = true;
        io.to((socket as any).roomCode).emit('newHost', { player: conn2[0], room: safeRoom((socket as any).roomCode) });
      }
    }
    (socket as any).roomCode = null;
    socket.emit('leftRoom');
  });

  socket.on('addCustomContent', ({ mode, content }: { mode: string; content: any }) => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    switch (mode) {
      case 'trivia': if (content.question && content.options && content.correct !== undefined) room.customContent.trivia.push(content); break;
      case 'challenge': if (content.text) room.customContent.challenge.push({ text: content.text, type: content.type || 'action', drinks: content.drinks || 0 }); break;
      case 'neverever': if (content.text) room.customContent.neverever.push(content.text); break;
      case 'truth': if (content.text) room.customContent.truthordare.truths.push(content.text); break;
      case 'dare': if (content.text) room.customContent.truthordare.dares.push(content.text); break;
    }
    io.to((socket as any).roomCode).emit('customContentAdded', {
      mode, by: room.players[socket.id]?.name, customContent: room.customContent, room: safeRoom((socket as any).roomCode),
    });
  });

  socket.on('removeCustomContent', ({ mode, index }: { mode: string; index: number }) => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    const cc = room.customContent;
    switch (mode) {
      case 'trivia': if (index >= 0 && index < cc.trivia.length) cc.trivia.splice(index, 1); break;
      case 'challenge': if (index >= 0 && index < cc.challenge.length) cc.challenge.splice(index, 1); break;
      case 'neverever': if (index >= 0 && index < cc.neverever.length) cc.neverever.splice(index, 1); break;
      case 'truth': if (index >= 0 && index < cc.truthordare.truths.length) cc.truthordare.truths.splice(index, 1); break;
      case 'dare': if (index >= 0 && index < cc.truthordare.dares.length) cc.truthordare.dares.splice(index, 1); break;
    }
    io.to((socket as any).roomCode).emit('customContentUpdated', { customContent: cc, room: safeRoom((socket as any).roomCode) });
  });

  socket.on('addExpense', ({ description, amount, paidBy }: { description: string; amount: string; paidBy: string }) => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    room.expenses.push({ id: uuidv4(), description, amount: parseFloat(amount), paidBy, timestamp: Date.now() });
    io.to((socket as any).roomCode).emit('expensesUpdated', { expenses: room.expenses, split: calcSplit(room) });
  });

  socket.on('removeExpense', ({ expenseId }: { expenseId: string }) => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    room.expenses = room.expenses.filter(e => e.id !== expenseId);
    io.to((socket as any).roomCode).emit('expensesUpdated', { expenses: room.expenses, split: calcSplit(room) });
  });

  socket.on('getSplit', () => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    socket.emit('expensesUpdated', { expenses: room.expenses, split: calcSplit(room) });
  });

  socket.on('chatMessage', ({ message }: { message: string }) => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    const p = room.players[socket.id]; if (!p) return;
    io.to((socket as any).roomCode).emit('chatMessage', { playerName: p.name, avatar: p.avatar, message, timestamp: Date.now() });
  });

  socket.on('updateSettings', ({ settings }: { settings: Partial<GameSettings> }) => {
    const room = rooms[(socket as any).roomCode];
    if (!room || room.host !== socket.id) return;
    room.settings = { ...room.settings, ...settings };
    io.to((socket as any).roomCode).emit('settingsUpdated', { room: safeRoom((socket as any).roomCode) });
  });

  socket.on('getQR', async () => {
    const room = rooms[(socket as any).roomCode]; if (!room) return;
    try {
      const url = `${BASE_URL}?room=${room.code}`;
      const qr = await QRCode.toDataURL(url, { width: 256, margin: 1, color: { dark: '#ff6b35', light: '#1a1a2e' } });
      socket.emit('qrGenerated', { qr, url, roomCode: room.code });
    } catch (e) { }
  });

  socket.on('disconnect', () => {
    const code = (socket as any).roomCode;
    if (!code || !rooms[code]) return;
    const room = rooms[code];
    const p = room.players[socket.id]; if (!p) return;
    p.connected = false;
    io.to(code).emit('playerDisconnected', { player: p, room: safeRoom(code) });
    const conn2 = connected(room);
    if (room.host === socket.id && conn2.length > 0) {
      room.host = conn2[0].id;
      conn2[0].isHost = true;
      io.to(code).emit('newHost', { player: conn2[0], room: safeRoom(code) });
    }
    if (conn2.length === 0) {
      setTimeout(() => { if (rooms[code] && connected(rooms[code]).length === 0) delete rooms[code]; }, 300000);
    }
  });
});

// ========== GAME LOGIC ==========
function clearAllTimers(room: Room): void {
  if (room.timer) clearTimeout(room.timer);
  if (room.timerInterval) clearInterval(room.timerInterval);
  if (room.voteTimer) clearTimeout(room.voteTimer);
  if (room.neTimer) clearTimeout(room.neTimer);
  if (room.verifyTimer) clearTimeout(room.verifyTimer);
}

function checkNEAutoAdvance(roomCode: string): void {
  const room = rooms[roomCode]; if (!room) return;
  const conn = connected(room);
  const responded = Object.keys(room.neverEverResponses).length;
  if (responded >= conn.length && room.settings.autoAdvanceNeverEver) {
    if (room.neTimer) clearTimeout(room.neTimer);
    room.neTimer = setTimeout(() => nextRound(roomCode), 6000);
    io.to(roomCode).emit('neAutoAdvanceStarted', { seconds: 6 });
  }
}

function nextRound(roomCode: string): void {
  const room = rooms[roomCode];
  if (!room || room.gameState !== 'playing') return;
  room.roundNumber++;
  room.answers = {}; room.skipVotes = {}; room.challengeVotes = {};
  room.neverEverResponses = {}; room.collectiveAccepts = {}; room.verifyVotes = {};

  const expiring = room.timedEffects.filter(e => e.expiresAtRound <= room.roundNumber);
  room.timedEffects = room.timedEffects.filter(e => e.expiresAtRound > room.roundNumber);
  if (expiring.length > 0) {
    room.pendingVerifications = [...(room.pendingVerifications || []), ...expiring];
  }

  if (room.pendingVerifications && room.pendingVerifications.length > 0) {
    processNextVerification(roomCode);
    return;
  }

  if (room.roundNumber > room.settings.maxRounds) {
    endGame(roomCode);
    return;
  }

  if (room.collectiveBar >= 100) {
    Object.values(room.players).forEach(p => { if (p.connected) p.totalDrinks += 2; });
    room.collectiveBar = 0;
    Object.values(room.players).forEach(p => p.wrongAnswers = 0);
    io.to(roomCode).emit('collectiveBarFull', { room: safeRoom(roomCode) });
    return;
  }

  startRound(roomCode);
}

function startRound(roomCode: string): void {
  const room = rooms[roomCode]; if (!room) return;
  const types = room.settings.gameTypes;
  const type = types[Math.floor(Math.random() * types.length)];
  room.currentGame = type;

  switch (type) {
    case 'trivia': startTrivia(roomCode); break;
    case 'challenge': startChallenge(roomCode); break;
    case 'neverever': startNeverEver(roomCode); break;
    case 'truthordare': startTruthOrDare(roomCode); break;
  }
}

function startTrivia(roomCode: string): void {
  const room = rooms[roomCode];
  const lang = room.settings.lang as keyof typeof triviaDB;
  const all = [...triviaDB[lang], ...room.customContent.trivia];
  const { item: q, i: idx } = randItem(all, room.usedQ);
  if (idx >= 0) room.usedQ.push(idx);
  room.currentQuestion = q; room.answers = {};

  io.to(roomCode).emit('triviaQuestion', {
    question: { question: q.question, options: q.options, category: q.category },
    roundNumber: room.roundNumber, totalRounds: room.settings.maxRounds,
    timeLimit: room.settings.timePerQuestion, room: safeRoom(roomCode),
  });

  let tl = room.settings.timePerQuestion;
  room.timerInterval = setInterval(() => {
    tl--;
    io.to(roomCode).emit('timerTick', { time: tl });
    if (tl <= 0 && room.timerInterval) clearInterval(room.timerInterval);
  }, 1000);

  room.timer = setTimeout(() => {
    if (room.timerInterval) clearInterval(room.timerInterval);
    Object.values(room.players).forEach(p => {
      if (p.connected && room.answers[p.id] === undefined) {
        room.answers[p.id] = { answer: -1, isCorrect: false };
        p.wrongAnswers++;
        p.totalDrinks += room.settings.drinksPerWrongAnswer;
      }
    });
    room.collectiveBar = calcBar(room);
    revealAnswer(roomCode);
  }, room.settings.timePerQuestion * 1000);
}

function revealAnswer(roomCode: string): void {
  const room = rooms[roomCode]; if (!room || !room.currentQuestion) return;
  const results: { [pid: string]: { playerName: string; avatar: string; answer: number; isCorrect: boolean } } = {};
  Object.entries(room.answers).forEach(([pid, ans]) => {
    const p = room.players[pid];
    if (p) results[pid] = { playerName: p.name, avatar: p.avatar, answer: ans.answer, isCorrect: ans.isCorrect };
  });
  io.to(roomCode).emit('triviaResult', {
    correctAnswer: room.currentQuestion.correct,
    correctText: room.currentQuestion.options[room.currentQuestion.correct],
    results, room: safeRoom(roomCode), collectiveBar: room.collectiveBar,
  });
  room.currentQuestion = null;
  setTimeout(() => { io.to(roomCode).emit('showSkipButton'); }, 5000);
}

function startChallenge(roomCode: string): void {
  const room = rooms[roomCode];
  const lang = room.settings.lang as keyof typeof challengesDB;
  const conn = connected(room);
  const target = conn[Math.floor(Math.random() * conn.length)];
  const all = [...challengesDB[lang], ...room.customContent.challenge];
  const { item: ch, i: idx } = randItem(all, room.usedC);
  if (idx >= 0) room.usedC.push(idx);

  room.currentChallenge = { ...ch, targetPlayer: target.id };
  room.challengeVotes = {};

  const isDrink = ch.type === 'drink' || ch.type === 'drink_all';
  const isTimedAction = ch.type === 'timed_action';

  io.to(roomCode).emit('challengeRound', {
    challenge: ch.text, challengeType: ch.type, drinks: ch.drinks,
    isDrinkChallenge: isDrink, isTimedAction,
    duration: ch.duration || 0,
    targetPlayer: { id: target.id, name: target.name, avatar: target.avatar },
    roundNumber: room.roundNumber, totalRounds: room.settings.maxRounds,
    voteTime: room.settings.voteTime, room: safeRoom(roomCode),
  });

  if (isDrink) {
    if (ch.type === 'drink_all') {
      Object.values(room.players).forEach(p => { if (p.connected) p.totalDrinks += ch.drinks; });
    } else {
      target.totalDrinks += ch.drinks;
    }
    setTimeout(() => io.to(roomCode).emit('showSkipButton'), 5000);
  } else if (isTimedAction) {
    io.to(roomCode).emit('timedActionChoice', {
      challenge: ch.text, duration: ch.duration || 2,
      penaltyDrinks: ch.penaltyDrinks || 2,
      targetPlayer: { id: target.id, name: target.name, avatar: target.avatar },
    });
  } else {
    setTimeout(() => {
      io.to(roomCode).emit('showSkipButton');
      io.to(roomCode).emit('showChallengeVote', {
        challenge: ch.text, challengeType: ch.type, drinks: ch.drinks,
        targetPlayer: { id: target.id, name: target.name, avatar: target.avatar },
        voteTime: room.settings.voteTime,
      });
    }, 5000);
  }
}

function resolveChallengeVote(roomCode: string): void {
  const room = rooms[roomCode]; if (!room) return;
  if (room.voteTimer) clearTimeout(room.voteTimer);
  const votes = Object.values(room.challengeVotes);
  const yes = votes.filter(v => v === true).length;
  const no = votes.filter(v => v === false).length;
  const completed = yes >= no;
  const targetId = room.currentChallenge?.targetPlayer;
  const target = targetId ? room.players[targetId] : undefined;
  let penalty = 0;

  if (!completed && target) {
    penalty = room.currentChallenge?.drinks || 2;
    target.totalDrinks += penalty;
  }

  io.to(roomCode).emit('challengeVoteResult', {
    completed, yesVotes: yes, noVotes: no,
    targetPlayer: target ? { id: target.id, name: target.name, avatar: target.avatar } : null,
    penalty, room: safeRoom(roomCode),
  });
}

function processNextVerification(roomCode: string): void {
  const room = rooms[roomCode]; if (!room) return;
  if (!room.pendingVerifications || room.pendingVerifications.length === 0) {
    if (room.roundNumber > room.settings.maxRounds) { endGame(roomCode); return; }
    if (room.collectiveBar >= 100) {
      Object.values(room.players).forEach(p => { if (p.connected) p.totalDrinks += 2; });
      room.collectiveBar = 0;
      Object.values(room.players).forEach(p => p.wrongAnswers = 0);
      io.to(roomCode).emit('collectiveBarFull', { room: safeRoom(roomCode) });
      return;
    }
    startRound(roomCode);
    return;
  }

  const effect = room.pendingVerifications.shift()!;
  room.currentVerification = effect;
  room.verifyVotes = {};

  const target = room.players[effect.playerId];
  io.to(roomCode).emit('timedEffectVerify', {
    effect,
    targetPlayer: target ? { id: target.id, name: target.name, avatar: target.avatar } : { id: effect.playerId, name: effect.playerName, avatar: '❓' },
    penaltyDrinks: effect.penaltyDrinks || 2,
    room: safeRoom(roomCode),
  });

  room.verifyTimer = setTimeout(() => resolveTimedVerification(roomCode), 20000);
}

function resolveTimedVerification(roomCode: string): void {
  const room = rooms[roomCode]; if (!room) return;
  if (room.verifyTimer) clearTimeout(room.verifyTimer);
  const effect = room.currentVerification; if (!effect) return;
  const votes = Object.values(room.verifyVotes);
  const yes = votes.filter(v => v === true).length;
  const no = votes.filter(v => v === false).length;
  const completed = yes >= no;
  const target = room.players[effect.playerId];
  let penalty = 0;

  if (!completed && target) {
    penalty = effect.penaltyDrinks || 2;
    target.totalDrinks += penalty;
  }

  io.to(roomCode).emit('timedEffectVerifyResult', {
    completed, yesVotes: yes, noVotes: no,
    effect,
    targetPlayer: target ? { id: target.id, name: target.name, avatar: target.avatar } : null,
    penalty, room: safeRoom(roomCode),
  });

  room.currentVerification = undefined;
  setTimeout(() => processNextVerification(roomCode), 4000);
}

function startNeverEver(roomCode: string): void {
  const room = rooms[roomCode];
  const lang = room.settings.lang as keyof typeof neverEverDB;
  const all = [...neverEverDB[lang], ...room.customContent.neverever];
  const { item: stmt, i: idx } = randItem(all, room.usedNE);
  if (idx >= 0) room.usedNE.push(idx);

  room.neverEverResponses = {};
  room.currentChallenge = { type: 'neverever', statement: stmt };

  io.to(roomCode).emit('neverEverRound', {
    statement: stmt,
    roundNumber: room.roundNumber, totalRounds: room.settings.maxRounds,
    autoAdvance: room.settings.autoAdvanceNeverEver,
    autoAdvanceTime: room.settings.autoAdvanceTime,
    room: safeRoom(roomCode),
  });

  if (room.settings.autoAdvanceNeverEver) {
    room.neTimer = setTimeout(() => nextRound(roomCode), room.settings.autoAdvanceTime * 1000);
  }
}

function startTruthOrDare(roomCode: string): void {
  const room = rooms[roomCode];
  const conn = connected(room);
  const target = conn[Math.floor(Math.random() * conn.length)];
  room.challengeVotes = {};

  io.to(roomCode).emit('truthOrDareRound', {
    targetPlayer: { id: target.id, name: target.name, avatar: target.avatar },
    roundNumber: room.roundNumber, totalRounds: room.settings.maxRounds,
    room: safeRoom(roomCode),
  });
}

function endGame(roomCode: string, cancelled: boolean = false): void {
  const room = rooms[roomCode]; if (!room) return;
  clearAllTimers(room);
  room.gameState = 'finished';
  const ranking = Object.values(room.players)
    .sort((a, b) => b.totalDrinks - a.totalDrinks)
    .map((p, i) => ({
      rank: i + 1,
      name: p.name,
      avatar: p.avatar,
      totalDrinks: p.totalDrinks,
      correctAnswers: p.correctAnswers,
      score: p.score
    }));
  io.to(roomCode).emit('gameEnded', { ranking, cancelled, room: safeRoom(roomCode) });
}

server.listen(PORT, () => {
  console.log(`\n🍻 DrinkParty v2.1 → ${BASE_URL}\n`);
  if (process.send) process.send('ready');
});