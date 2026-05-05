// ===== TYPE DECLARATIONS =====

interface State {
  id: string | null;
  name: string;
  avatar: string;
  roomCode: string | null;
  isHost: boolean;
  hasAnswered: boolean;
  selectedAnswer: number | null;
  hasVotedSkip: boolean;
  hasVotedChallenge: boolean;
  hasDrunkNE: boolean;
  hasRespondedTimed: boolean;
  hasVotedVerify: boolean;
  chatUnread: number;
  activeTab: string;
}

interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  totalDrinks: number;
  correctAnswers: number;
  wrongAnswers: number;
  score: number;
}

interface SafeRoom {
  code: string;
  gameState: string;
  currentGame: string | null;
  collectiveBar: number;
  roundNumber: number;
  totalRounds: number;
  settings: GameSettings;
  players: RoomPlayer[];
  readyCount: number;
  connectedCount: number;
  inviteLink: string;
  customContent: CustomContent;
  timedEffects: TimedEffectData[];
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

interface CustomContent {
  trivia: CustomTrivia[];
  challenge: CustomChallenge[];
  neverever: string[];
  truthordare: { truths: string[]; dares: string[] };
}

interface CustomTrivia {
  question: string;
  options: string[];
  correct: number;
  category: string;
}

interface CustomChallenge {
  text: string;
  type: string;
  drinks: number;
}

interface TimedEffectData {
  playerId: string;
  playerName: string;
  text: string;
  expiresAtRound: number;
  penaltyDrinks?: number;
}

interface TriviaQuestionData {
  question: string;
  options: string[];
  category: string;
}

interface TriviaResultData {
  correctAnswer: number;
  correctText: string;
  results: Record<string, { playerName: string; avatar: string; answer: number; isCorrect: boolean }>;
  room: SafeRoom;
  collectiveBar: number;
}

interface ChallengeData {
  challenge: string;
  challengeType: string;
  drinks: number;
  isDrinkChallenge: boolean;
  isTimedAction: boolean;
  duration: number;
  targetPlayer: { id: string; name: string; avatar: string };
  roundNumber: number;
  totalRounds: number;
  voteTime: number;
  room: SafeRoom;
}

interface ChallengeVoteData {
  challenge: string;
  challengeType: string;
  drinks: number;
  targetPlayer: { id: string; name: string; avatar: string };
  voteTime: number;
}

interface NeverEverData {
  statement: string;
  roundNumber: number;
  totalRounds: number;
  autoAdvance: boolean;
  autoAdvanceTime: number;
  room: SafeRoom;
}

interface TruthOrDareData {
  targetPlayer: { id: string; name: string; avatar: string };
  roundNumber: number;
  totalRounds: number;
  room: SafeRoom;
}

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  timestamp: number;
}

interface SplitData {
  total: number;
  perPerson: number;
  balances: Record<string, { paid: number; owes: number; balance: number }>;
}

interface ExpensesData {
  expenses: ExpenseItem[];
  split: SplitData;
}

interface RankingPlayer {
  rank: number;
  name: string;
  avatar: string;
  totalDrinks: number;
  correctAnswers: number;
  score: number;
}

interface GameOverData {
  ranking: RankingPlayer[];
  cancelled: boolean;
  room: SafeRoom;
}

// Sockets are fully dynamic in this app
declare function io(opts?: Record<string, unknown>): Record<string, unknown>;

interface Window {
  kickPlayer: (id: string) => void;
  removeExpense: (id: string) => void;
  voteChallenge: (completed: boolean) => void;
  neverEverDrink: () => void;
  neverEverPass: () => void;
  chooseTruthOrDare: (choice: string) => void;
  nextRound: () => void;
  removeCustomItem: (mode: string, index: number) => void;
  respondTimedAction: (accepted: boolean) => void;
  voteVerify: (completed: boolean) => void;
}

// ===== SOCKET & STATE =====

const socket = io({ path: '/drinkparty/socket.io' }) as unknown as SocketIOWrapper;

interface SocketIOWrapper {
  id: string;
  on: (event: string, cb: (...args: any[]) => void) => void;
  emit: (event: string, data?: any) => void;
}

const S: State = {
  id: null, name: '', avatar: '😎', roomCode: null, isHost: false,
  hasAnswered: false, selectedAnswer: null, hasVotedSkip: false,
  hasVotedChallenge: false, hasDrunkNE: false, hasRespondedTimed: false,
  hasVotedVerify: false, chatUnread: 0, activeTab: 'game'
};

// ===== DOM HELPERS =====

function $(s: string): HTMLElement {
  return document.querySelector(s) as HTMLElement;
}

function $$(s: string): NodeListOf<HTMLElement> {
  return document.querySelectorAll(s);
}

// ===== SCREENS =====

type ScreenName = 'home' | 'lobby' | 'game' | 'gameover';

const screens: Record<ScreenName, HTMLElement> = {
  home: $('#screen-home'),
  lobby: $('#screen-lobby'),
  game: $('#screen-game'),
  gameover: $('#screen-gameover')
};

function showScreen(n: ScreenName): void {
  (Object.values(screens) as HTMLElement[]).forEach(s => s.classList.remove('active'));
  screens[n].classList.add('active');
}

function toast(m: string, t: string = 'info', d: number = 3000): void {
  const e = document.createElement('div');
  e.className = `toast ${t}`;
  e.textContent = m;
  $('#toastContainer').appendChild(e);
  setTimeout(() => {
    e.style.opacity = '0';
    e.style.transform = 'translateX(100px)';
    setTimeout(() => e.remove(), 300);
  }, d);
}

function esc(t: string): string {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function updateBar(v: number): void {
  const fill = $('#collectiveBarFill');
  const text = $('#collectiveBarText');
  fill.style.width = v + '%';
  text.textContent = Math.round(v) + '%';
  fill.style.background = v >= 75
    ? 'linear-gradient(90deg,#ef476f,#ff006e)'
    : v >= 50
      ? 'linear-gradient(90deg,#ffd166,#ef476f)'
      : 'linear-gradient(90deg,#06d6a0,#ffd166,#ef476f)';
}

function updateRanking(pl: RoomPlayer[]): void {
  const s = [...pl].sort((a, b) => b.totalDrinks - a.totalDrinks);
  $('#rankingList').innerHTML = s.map((p, i) =>
    `<div class="ranking-item"><div class="ranking-rank">${
      i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1
    }</div><div class="ranking-avatar">${p.avatar}</div><div class="ranking-info"><div class="ranking-name">${
      esc(p.name)}${p.id === S.id ? ' (Tú)' : ''
    }</div><div class="ranking-stats">✅ ${p.correctAnswers} · ⭐ ${p.score}</div></div><div class="ranking-drinks"><div class="ranking-drinks-count">${
      p.totalDrinks}</div><div class="ranking-drinks-label">tragos</div></div></div>`
  ).join('');
}

function updatePaidBy(pl: RoomPlayer[]): void {
  ($('#expensePaidBy') as HTMLSelectElement).innerHTML = pl
    .filter(p => p.connected)
    .map(p => `<option value="${esc(p.name)}">${p.avatar} ${esc(p.name)}</option>`).join('');
}

function switchTab(t: string): void {
  S.activeTab = t;
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  $$('.game-tab').forEach(x => x.classList.remove('active'));
  ($(`.tab-btn[data-tab="${t}"]`)).classList.add('active');
  $(`#tab-${t}`).classList.add('active');
  if (t === 'chat') {
    S.chatUnread = 0;
    $('#chatBadge').style.display = 'none';
  }
}

function addChat(d: { avatar: string; playerName: string; message: string }): void {
  const e = document.createElement('div');
  e.className = 'chat-message';
  e.innerHTML = `<span class="cm-avatar">${d.avatar}</span><div class="cm-content"><div class="cm-name">${
    esc(d.playerName)}</div><div class="cm-text">${esc(d.message)}</div></div>`;
  $('#chatMessages').appendChild(e);
  $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
  if (S.activeTab !== 'chat') {
    S.chatUnread++;
    $('#chatBadge').style.display = 'block';
  }
}

function sysMsg(m: string): void {
  const e = document.createElement('div');
  e.className = 'chat-message system';
  e.innerHTML = `<div class="cm-content">${m}</div>`;
  $('#chatMessages').appendChild(e);
  $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
}

function fallbackCopy(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); toast('¡Copiado!', 'success'); }
  catch (_e) { toast('No se pudo copiar', 'error'); }
  document.body.removeChild(ta);
}

function copyToClipboard(text: string): void {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('¡Copiado!', 'success')).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

// ===== URL CHECK =====

(function checkURL(): void {
  const p = new URLSearchParams(window.location.search);
  const r = p.get('room');
  if (r) {
    ($('#roomCodeInput') as HTMLInputElement).value = r.toUpperCase();
    $('#btnJoinRoom').classList.add('glow-pulse');
  }
})();

// ===== AVATAR PICKER =====

$('#avatarPicker').addEventListener('click', (e: Event) => {
  const target = e.target as HTMLElement;
  const o = target.closest('.avatar-option');
  if (!o) return;
  $$('.avatar-option').forEach(x => x.classList.remove('selected'));
  o.classList.add('selected');
  S.avatar = (o as HTMLElement).dataset.avatar || '😎';
});

// ===== HOME =====

$('#btnCreateRoom').addEventListener('click', () => {
  const n = ($('#playerName') as HTMLInputElement).value.trim();
  if (!n) return toast('Escribe tu nombre', 'error');
  S.name = n;
  socket.emit('createRoom', { playerName: n, avatar: S.avatar });
});

$('#btnJoinRoom').addEventListener('click', () => {
  const n = ($('#playerName') as HTMLInputElement).value.trim();
  const c = ($('#roomCodeInput') as HTMLInputElement).value.trim().toUpperCase();
  if (!n) return toast('Escribe tu nombre', 'error');
  if (!c || c.length < 4) return toast('Código inválido', 'error');
  S.name = n;
  socket.emit('joinRoom', { roomCode: c, playerName: n, avatar: S.avatar });
});

($('#roomCodeInput') as HTMLInputElement).addEventListener('keypress', (e: KeyboardEvent) => {
  if (e.key === 'Enter') ($('#btnJoinRoom') as HTMLButtonElement).click();
});

($('#playerName') as HTMLInputElement).addEventListener('keypress', (e: KeyboardEvent) => {
  if (e.key === 'Enter') ($('#btnCreateRoom') as HTMLButtonElement).click();
});

($('#roomCodeInput') as HTMLInputElement).addEventListener('input', () => {
  const v = ($('#roomCodeInput') as HTMLInputElement).value.trim();
  if (v.length >= 4) $('#btnJoinRoom').classList.add('glow-pulse');
  else $('#btnJoinRoom').classList.remove('glow-pulse');
});

// ===== LOBBY =====

$('#btnCopyCode').addEventListener('click', () => copyToClipboard(S.roomCode || ''));
$('#btnCopyLink').addEventListener('click', () => copyToClipboard(($('#inviteLinkInput') as HTMLInputElement).value));
$('#btnLeaveLobby').addEventListener('click', () => socket.emit('leaveRoom'));
$('#btnReady').addEventListener('click', () => socket.emit('toggleReady'));

// ===== QUICK PICK BUTTONS =====

function broadcastSettings(): void {
  const gameTypes = Array.from(
    ($$('.gameTypeCheck:checked') as NodeListOf<HTMLInputElement>)
  ).map(c => c.value);

  socket.emit('updateSettings', {
    settings: {
      lang: ($('#settingLang') as HTMLSelectElement).value,
      timePerQuestion: parseInt(($('#settingTime') as HTMLInputElement).value) || 20,
      maxRounds: parseInt(($('#settingRounds') as HTMLInputElement).value) || 20,
      barFillPerWrong: parseInt(($('#settingBarFill') as HTMLInputElement).value) || 8,
      voteTime: parseInt(($('#settingVoteTime') as HTMLInputElement).value) || 15,
      cancelMethod: ($('#settingCancelMethod') as HTMLSelectElement).value,
      autoAdvanceNeverEver: ($('#settingAutoAdvance') as HTMLInputElement).checked,
      autoAdvanceTime: parseInt(($('#settingAutoTime') as HTMLInputElement).value) || 10,
      gameTypes,
    }
  });
}

document.addEventListener('click', (e: Event) => {
  const target = e.target as HTMLElement;
  const qpBtn = target.closest('.qp-btn') as HTMLElement | null;
  if (!qpBtn) return;
  const container = qpBtn.closest('.quick-pick') as HTMLElement | null;
  if (!container) return;
  const targetId = container.dataset.target;
  if (!targetId) return;
  const input = $(`#${targetId}`) as HTMLInputElement;

  if (qpBtn.dataset.val === 'custom') {
    input.classList.toggle('visible');
    input.classList.toggle('hidden-input');
    if (input.classList.contains('visible')) input.focus();
    return;
  }

  container.querySelectorAll('.qp-btn').forEach(b => b.classList.remove('active'));
  qpBtn.classList.add('active');
  input.value = qpBtn.dataset.val || '';
  input.classList.remove('visible');
  input.classList.add('hidden-input');

  const customBtn = container.querySelector('.qp-custom');
  if (customBtn) customBtn.innerHTML = '✏️';

  if (S.isHost) broadcastSettings();
});

['settingTime', 'settingRounds', 'settingBarFill', 'settingVoteTime', 'settingAutoTime'].forEach(id => {
  ($(`#${id}`) as HTMLInputElement).addEventListener('change', () => {
    const input = $(`#${id}`) as HTMLInputElement;
    const container = input.previousElementSibling as HTMLElement | null;
    if (container && container.classList.contains('quick-pick')) {
      const val = input.value;
      let found = false;
      container.querySelectorAll<HTMLElement>('.qp-btn:not(.qp-custom)').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.val === val) { b.classList.add('active'); found = true; }
      });
      const customBtn = container.querySelector('.qp-custom') as HTMLElement | null;
      if (!found && val) {
        container.querySelectorAll('.qp-btn').forEach(b => b.classList.remove('active'));
        if (customBtn) {
          customBtn.classList.add('active');
          customBtn.innerHTML = `✏️ ${val}`;
        }
      } else if (customBtn) {
        customBtn.classList.remove('active');
        customBtn.innerHTML = '✏️';
      }
    }
    if (S.isHost) broadcastSettings();
  });
});

['settingLang', 'settingCancelMethod'].forEach(id => {
  ($(`#${id}`) as HTMLSelectElement).addEventListener('change', () => {
    if (S.isHost) broadcastSettings();
  });
});

($('#settingAutoAdvance') as HTMLInputElement).addEventListener('change', () => {
  if (S.isHost) broadcastSettings();
});

$('#btnStartGame').addEventListener('click', () => {
  const gt = Array.from(
    ($$('.gameTypeCheck:checked') as NodeListOf<HTMLInputElement>)
  ).map(c => c.value);
  if (!gt.length) return toast('Selecciona al menos un tipo', 'error');
  socket.emit('startGame', {
    settings: {
      lang: ($('#settingLang') as HTMLSelectElement).value,
      timePerQuestion: parseInt(($('#settingTime') as HTMLInputElement).value) || 20,
      maxRounds: parseInt(($('#settingRounds') as HTMLInputElement).value) || 20,
      barFillPerWrong: parseInt(($('#settingBarFill') as HTMLInputElement).value) || 8,
      voteTime: parseInt(($('#settingVoteTime') as HTMLInputElement).value) || 15,
      cancelMethod: ($('#settingCancelMethod') as HTMLSelectElement).value,
      autoAdvanceNeverEver: ($('#settingAutoAdvance') as HTMLInputElement).checked,
      autoAdvanceTime: parseInt(($('#settingAutoTime') as HTMLInputElement).value) || 10,
      gameTypes: gt,
    }
  });
});

// ===== CUSTOM CONTENT =====

($('#customMode') as HTMLSelectElement).addEventListener('change', () => {
  const m = ($('#customMode') as HTMLSelectElement).value;
  $('#customTriviaFields').style.display = m === 'trivia' ? 'block' : 'none';
  $('#customTextFields').style.display = m !== 'trivia' ? 'block' : 'none';
});

$('#btnAddCustom').addEventListener('click', () => {
  const m = ($('#customMode') as HTMLSelectElement).value;
  if (m === 'trivia') {
    const q = ($('#customTriviaQ') as HTMLInputElement).value.trim();
    const a = ($('#customTriviaA') as HTMLInputElement).value.trim();
    const b = ($('#customTriviaB') as HTMLInputElement).value.trim();
    const c = ($('#customTriviaC') as HTMLInputElement).value.trim();
    const d = ($('#customTriviaD') as HTMLInputElement).value.trim();
    const cor = parseInt(($('#customTriviaCorrect') as HTMLSelectElement).value);
    if (!q || !a || !b || !c || !d) return toast('Completa todos los campos', 'error');
    socket.emit('addCustomContent', {
      mode: 'trivia',
      content: { question: q, options: [a, b, c, d], correct: cor, category: 'Custom' }
    });
    ($('#customTriviaQ') as HTMLInputElement).value = '';
    ($('#customTriviaA') as HTMLInputElement).value = '';
    ($('#customTriviaB') as HTMLInputElement).value = '';
    ($('#customTriviaC') as HTMLInputElement).value = '';
    ($('#customTriviaD') as HTMLInputElement).value = '';
  } else {
    const t = ($('#customText') as HTMLInputElement).value.trim();
    if (!t) return toast('Escribe algo', 'error');
    socket.emit('addCustomContent', { mode: m, content: { text: t } });
    ($('#customText') as HTMLInputElement).value = '';
  }
});

// ===== LOBBY RENDER =====

function updateLobby(room: SafeRoom): void {
  const pl = room.players;
  const am = pl.find(p => p.id === S.id)?.isHost;
  S.isHost = !!am;
  $('#lobbyPlayers').innerHTML = pl.map(p => `
    <div class="player-card ${p.isHost ? 'host' : ''} ${p.ready ? 'ready' : ''} ${!p.connected ? 'disconnected' : ''}">
      ${am && !p.isHost && p.connected ? `<button class="kick-btn visible" onclick="kickPlayer('${p.id}')">✕</button>` : ''}
      <div class="avatar">${p.avatar}</div>
      <div class="name">${esc(p.name)}${p.id === S.id ? ' (Tú)' : ''}</div>
      ${p.isHost ? '<div class="host-badge">👑 Host</div>' : ''}
      ${p.ready && !p.isHost ? '<div class="ready-badge">✅ Listo</div>' : ''}
      ${!p.connected ? '<div style="font-size:.6rem;color:rgba(255,255,255,.3)">Desconectado</div>' : ''}
    </div>`).join('');
  const rc = room.readyCount;
  const cc = room.connectedCount;
  $('#readyStatus').textContent = `${rc}/${cc} listos`;
  if (am) {
    $('#btnStartGame').style.display = 'block';
    $('#settingsSection').style.display = 'block';
    const can = rc >= cc - 1 && cc >= 2;
    ($('#btnStartGame') as HTMLButtonElement).disabled = !can;
    $('#btnStartGame').style.opacity = can ? '1' : '.5';
  } else {
    $('#btnStartGame').style.display = 'none';
    $('#settingsSection').style.display = 'none';
  }
  const me = pl.find(p => p.id === S.id);
  if (me && !me.isHost) {
    $('#btnReady').style.display = 'block';
    $('#btnReady').textContent = me.ready ? '✅ ¡Estoy Listo!' : '✋ Estoy Listo';
    $('#btnReady').className = me.ready ? 'btn btn-secondary btn-large' : 'btn btn-success btn-large';
  } else {
    $('#btnReady').style.display = 'none';
  }
}

function renderCustomList(cc: CustomContent): void {
  const l: { m: string; t: string; mode: string; idx: number }[] = [];
  cc.trivia.forEach((t, i) => l.push({ m: '🧠', t: t.question, mode: 'trivia', idx: i }));
  cc.challenge.forEach((c, i) => l.push({ m: '🎯', t: c.text, mode: 'challenge', idx: i }));
  cc.neverever.forEach((n, i) => l.push({ m: '🙅', t: n, mode: 'neverever', idx: i }));
  cc.truthordare.truths.forEach((t, i) => l.push({ m: '🔮', t: t, mode: 'truth', idx: i }));
  cc.truthordare.dares.forEach((d, i) => l.push({ m: '⚡', t: d, mode: 'dare', idx: i }));
  $('#customAddedList').innerHTML = l.map(i =>
    `<div class="custom-item"><span class="custom-mode-tag">${i.m}</span><span style="flex:1;margin-left:6px">${esc(i.t)}</span><button class="btn-custom-delete" onclick="removeCustomItem('${i.mode}',${i.idx})" title="Eliminar">🗑️</button></div>`
  ).join('');
}

// ===== GAME TABS =====

$$('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab((b as HTMLElement).dataset.tab || 'game')));

// ===== GAME FOOTER =====

$('#btnSkipVote').addEventListener('click', () => {
  if (S.hasVotedSkip) return;
  S.hasVotedSkip = true;
  socket.emit('voteSkip');
  $('#btnSkipVote').textContent = '✅ Votaste';
  ($('#btnSkipVote') as HTMLButtonElement).disabled = true;
});

$('#btnCancelGame').addEventListener('click', () => {
  if (confirm('¿Cancelar la partida?')) socket.emit('cancelGame');
});

// ===== COLLECTIVE ACCEPT =====

$('#btnCollectiveAccept').addEventListener('click', () => {
  socket.emit('collectiveAccept');
  ($('#btnCollectiveAccept') as HTMLButtonElement).disabled = true;
  $('#btnCollectiveAccept').textContent = '✅ Listo';
});

// ===== EXPENSES =====

$('#btnAddExpense').addEventListener('click', () => {
  const d = ($('#expenseDesc') as HTMLInputElement).value.trim();
  const a = ($('#expenseAmount') as HTMLInputElement).value;
  const p = ($('#expensePaidBy') as HTMLSelectElement).value;
  if (!d) return toast('Descripción', 'error');
  if (!a || parseFloat(a) <= 0) return toast('Monto válido', 'error');
  socket.emit('addExpense', { description: d, amount: parseFloat(a), paidBy: p });
  ($('#expenseDesc') as HTMLInputElement).value = '';
  ($('#expenseAmount') as HTMLInputElement).value = '';
  toast('Gasto agregado', 'success');
});

function renderExpenses(d: ExpensesData): void {
  $('#expensesList').innerHTML = d.expenses.length === 0
    ? '<p style="text-align:center;color:rgba(255,255,255,.3);padding:12px">Sin gastos</p>'
    : d.expenses.map(e =>
        `<div class="expense-item"><div class="expense-info"><div class="expense-desc">${
          esc(e.description)}</div><div class="expense-payer">Pagó: ${esc(e.paidBy)}</div></div><div class="expense-amount">$${
          e.amount.toFixed(2)}</div><button class="expense-delete" onclick="removeExpense('${e.id}')">🗑️</button></div>`
      ).join('');
  $('#totalExpenses').textContent = '$' + d.split.total.toFixed(2);
  $('#perPersonExpenses').textContent = '$' + d.split.perPerson.toFixed(2);
  const b = d.split.balances;
  $('#balancesList').innerHTML = Object.keys(b).length === 0
    ? ''
    : `<h3>💳 Balances</h3>${Object.entries(b).map(([n, v]) => {
        const cls = v.balance > 0 ? 'positive' : v.balance < 0 ? 'negative' : 'zero';
        const txt = v.balance > 0
          ? `Le deben $${v.balance.toFixed(2)}`
          : v.balance < 0
            ? `Debe $${Math.abs(v.balance).toFixed(2)}`
            : 'Al día';
        return `<div class="balance-item"><span class="balance-name">${esc(n)}</span><span class="balance-paid">Pagó: $${v.paid.toFixed(2)}</span><span class="balance-amount ${cls}">${txt}</span></div>`;
      }).join('')}`;
}

// ===== CHAT =====

function sendChat(): void {
  const m = ($('#chatInput') as HTMLInputElement).value.trim();
  if (!m) return;
  socket.emit('chatMessage', { message: m });
  ($('#chatInput') as HTMLInputElement).value = '';
}

$('#btnSendChat').addEventListener('click', sendChat);
($('#chatInput') as HTMLInputElement).addEventListener('keypress', (e: KeyboardEvent) => {
  if (e.key === 'Enter') sendChat();
});

// ===== GLOBALS =====

window.kickPlayer = (id: string): void => {
  if (confirm('¿Expulsar?')) socket.emit('kickPlayer', { playerId: id });
};
window.removeExpense = (id: string): void => {
  socket.emit('removeExpense', { expenseId: id });
};
window.voteChallenge = (c: boolean): void => {
  if (S.hasVotedChallenge) return;
  S.hasVotedChallenge = true;
  socket.emit('challengeVote', { completed: c });
};
window.neverEverDrink = (): void => {
  if (S.hasDrunkNE) return;
  S.hasDrunkNE = true;
  socket.emit('neverEverDrink');
};
window.neverEverPass = (): void => {
  if (S.hasDrunkNE) return;
  S.hasDrunkNE = true;
  socket.emit('neverEverPass');
};
window.chooseTruthOrDare = (c: string): void => {
  socket.emit('chooseTruthOrDare', { choice: c });
};
window.nextRound = (): void => {
  socket.emit('nextRound');
};
window.removeCustomItem = (mode: string, index: number): void => {
  socket.emit('removeCustomContent', { mode, index });
};
window.respondTimedAction = (acc: boolean): void => {
  if (S.hasRespondedTimed) return;
  S.hasRespondedTimed = true;
  socket.emit('timedActionResponse', { accepted: acc });
};
window.voteVerify = (c: boolean): void => {
  if (S.hasVotedVerify) return;
  S.hasVotedVerify = true;
  socket.emit('timedEffectVerifyVote', { completed: c });
};

// ===== RENDERERS =====

function toGameTab(): void {
  switchTab('game');
  S.hasVotedSkip = false;
  S.hasVotedChallenge = false;
  S.hasDrunkNE = false;
  S.hasRespondedTimed = false;
  S.hasVotedVerify = false;
  $('#btnSkipVote').style.display = 'none';
  ($('#btnSkipVote') as HTMLButtonElement).disabled = false;
  $('#btnSkipVote').textContent = '⏭️ Avanzar';
  $('#skipCount').style.display = 'none';
}

function updateTimedEffects(room: SafeRoom): void {
  const effs = room.timedEffects || [];
  const bar = $('#timedEffectsBar');
  if (effs.length === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'block';
  bar.innerHTML = effs.map(e =>
    `⚠️ <strong>${esc(e.playerName)}</strong>: ${esc(e.text)} (hasta ronda ${e.expiresAtRound})`
  ).join(' · ');
}

function renderTrivia(d: { question: TriviaQuestionData; roundNumber: number; totalRounds: number; timeLimit: number; room: SafeRoom }): void {
  toGameTab();
  S.hasAnswered = false;
  S.selectedAnswer = null;
  $('#roundInfo').textContent = d.roundNumber + '/' + d.totalRounds;
  updateBar(d.room.collectiveBar);
  updateRanking(d.room.players);
  updatePaidBy(d.room.players);
  updateTimedEffects(d.room);
  $('#gameContent').innerHTML = `
    <div class="trivia-container">
      <div class="trivia-header"><div class="trivia-category">${esc(d.question.category)}</div><div class="trivia-timer" id="triviaTimer">${d.timeLimit}</div></div>
      <div class="trivia-question">${esc(d.question.question)}</div>
      <div class="trivia-options" id="triviaOptions">${d.question.options.map((o, i) => `<button class="trivia-option" data-index="${i}"><strong>${['A','B','C','D'][i]}.</strong> ${esc(o)}</button>`).join('')}</div>
      <div class="answers-count" id="answersCount">Esperando...</div>
    </div>`;
  $$('.trivia-option').forEach(b => b.addEventListener('click', () => {
    if (S.hasAnswered) return;
    S.hasAnswered = true;
    S.selectedAnswer = parseInt((b as HTMLElement).dataset.index || '0');
    $$('.trivia-option').forEach(x => x.classList.add('disabled'));
    b.classList.add('selected');
    socket.emit('answerTrivia', { answer: S.selectedAnswer });
  }));
}

function renderTriviaResult(d: TriviaResultData): void {
  const my = d.results[S.id || ''];
  const ok = my ? my.isCorrect : false;
  updateBar(d.collectiveBar);
  updateRanking(d.room.players);
  $('#gameContent').innerHTML = `
    <div class="results-container">
      <div class="result-header ${ok ? 'correct' : 'wrong'}"><h2>${ok ? '✅ ¡Correcto!' : '❌ ¡Incorrecto!'}</h2>${!ok ? '<p style="color:var(--danger)">🍺 ¡A beber!</p>' : ''}</div>
      <div class="result-answer">Respuesta: <strong>${esc(d.correctText)}</strong></div>
      <div class="result-players">${Object.values(d.results).map(r => `<div class="result-player ${r.isCorrect ? 'correct' : 'wrong'}"><span class="rp-avatar">${r.avatar}</span><span class="rp-name">${esc(r.playerName)}</span><span class="rp-result">${r.isCorrect ? '✅' : '❌🍺'}</span></div>`).join('')}</div>
      ${S.isHost ? `<button class="btn btn-primary btn-large" onclick="nextRound()">▶️ Siguiente</button>` : ''}
    </div>`;
}

function renderChallenge(d: ChallengeData): void {
  toGameTab();
  $('#roundInfo').textContent = d.roundNumber + '/' + d.totalRounds;
  updateBar(d.room.collectiveBar);
  updateRanking(d.room.players);
  updatePaidBy(d.room.players);
  updateTimedEffects(d.room);
  const isMe = d.targetPlayer.id === S.id;
  let info: string = '';
  if (d.isDrinkChallenge) {
    info = `<p style="color:var(--danger);font-weight:800;margin-bottom:8px">🍺 ${d.drinks} trago(s)</p>`;
  } else if (d.isTimedAction) {
    info = `<p style="color:var(--secondary);font-size:.85rem;margin-bottom:8px">⏳ Efecto activo por ${d.duration} rondas</p>`;
  } else {
    info = `<p style="color:rgba(255,255,255,.4);font-size:.82rem;margin-bottom:8px">Los demás votarán si lo completaste</p>`;
  }
  $('#gameContent').innerHTML = `
    <div class="challenge-container">
      <div class="challenge-type-badge ${d.isDrinkChallenge ? 'drink' : 'action'}">${d.isDrinkChallenge ? '🍺 BEBIDA' : d.isTimedAction ? '⏳ EFECTO' : '🎯 ACCIÓN'}</div>
      <div class="target-section"><span class="target-avatar">${d.targetPlayer.avatar}</span><span class="target-name">${isMe ? '¡TU TURNO!' : esc(d.targetPlayer.name)}</span></div>
      <div class="challenge-text">${esc(d.challenge)}</div>
      ${info}
      <div id="challengeVoteArea"></div>
    </div>`;
}

function renderChallengeVote(d: ChallengeVoteData): void {
  S.hasVotedChallenge = false;
  const area = $('#challengeVoteArea');
  if (!area) return;
  area.innerHTML = `
    <div class="vote-progress">
      <div style="text-align:center;font-weight:700;font-size:.88rem">🗳️ ¿${esc(d.targetPlayer.name)} completó el reto?</div>
      <div class="vote-bar"><div class="vote-bar-fill" id="voteBarFill" style="width:0%"></div></div>
      <div class="vote-buttons">
        <button class="btn btn-success btn-sm" onclick="voteChallenge(true)">✅ Sí</button>
        <button class="btn btn-danger btn-sm" onclick="voteChallenge(false)">❌ No</button>
      </div>
      <div class="answers-count" id="voteCount">0/? votos</div>
    </div>`;
}

function renderNeverEver(d: NeverEverData): void {
  toGameTab();
  S.hasDrunkNE = false;
  $('#roundInfo').textContent = d.roundNumber + '/' + d.totalRounds;
  updateBar(d.room.collectiveBar);
  updateRanking(d.room.players);
  updatePaidBy(d.room.players);
  updateTimedEffects(d.room);
  $('#gameContent').innerHTML = `
    <div class="neverever-container">
      <div class="neverever-badge">🙅 YO NUNCA NUNCA</div>
      <div class="neverever-statement">${esc(d.statement)}</div>
      <p class="neverever-instruction">Si lo has hecho, bebe 🍺</p>
      <div class="drinkers-grid" id="drinkersGrid"></div>
      <div class="ne-response-count" id="neResponseCount"></div>
      <div class="ne-actions">
        <button class="btn btn-danger" id="btnNEDrink" onclick="neverEverDrink()">🍺 Yo sí lo hice</button>
        <button class="btn btn-secondary" id="btnNEPass" onclick="neverEverPass()">🚫 Yo no</button>
      </div>
      <div class="ne-auto-countdown" id="neAutoCountdown"></div>
      ${S.isHost ? '<div style="margin-top:10px"><button class="btn btn-primary btn-large" onclick="nextRound()">▶️ Siguiente</button></div>' : ''}
    </div>`;
}

function renderTruthOrDare(d: TruthOrDareData): void {
  toGameTab();
  $('#roundInfo').textContent = d.roundNumber + '/' + d.totalRounds;
  updateRanking(d.room.players);
  updatePaidBy(d.room.players);
  updateTimedEffects(d.room);
  const isMe = d.targetPlayer.id === S.id;
  $('#gameContent').innerHTML = `
    <div class="tod-container">
      <div class="target-section"><span class="target-avatar">${d.targetPlayer.avatar}</span><span class="target-name">${isMe ? '¡TU TURNO!' : esc(d.targetPlayer.name)}</span></div>
      <div class="tod-title">🎭 ¿Verdad o Reto?</div>
      ${isMe ? `<div class="tod-choice-buttons" id="todChoiceButtons"><button class="btn tod-btn truth" onclick="chooseTruthOrDare('truth')">🔮 Verdad</button><button class="btn tod-btn dare" onclick="chooseTruthOrDare('dare')">⚡ Reto</button></div>` : `<p style="color:rgba(255,255,255,.35);animation:pulse 2s infinite">${esc(d.targetPlayer.name)} está eligiendo...</p>`}
      <div id="todContent"></div>
      <div id="todVoteArea"></div>
      ${S.isHost ? '<div style="margin-top:10px"><button class="btn btn-primary btn-large" onclick="nextRound()">▶️ Siguiente</button></div>' : ''}
    </div>`;
}

function renderGameOver(d: GameOverData): void {
  const r = d.ranking;
  const cf = $('#confetti');
  cf.innerHTML = '';
  const cols = ['#ff6b35', '#ffd166', '#06d6a0', '#ef476f', '#4361ee', '#fff'];
  for (let i = 0; i < 50; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = cols[Math.floor(Math.random() * cols.length)];
    p.style.animationDelay = Math.random() * 3 + 's';
    p.style.animationDuration = (2 + Math.random() * 3) + 's';
    p.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    cf.appendChild(p);
  }
  const po: (RankingPlayer & { pr: number })[] = [];
  if (r[1]) po.push({ ...r[1], pr: 2 });
  if (r[0]) po.push({ ...r[0], pr: 1 });
  if (r[2]) po.push({ ...r[2], pr: 3 });
  $('#podium').innerHTML = po.map(p => `<div class="podium-place"><div class="pp-avatar">${p.avatar}</div><div class="pp-name">${esc(p.name)}</div><div class="pp-drinks">🍺 ${p.totalDrinks}</div><div class="podium-block">#${p.pr}</div></div>`).join('');
  $('#finalRanking').innerHTML = r.slice(3).map(p => `<div class="ranking-item"><div class="ranking-rank">${p.rank}</div><div class="ranking-avatar">${p.avatar}</div><div class="ranking-info"><div class="ranking-name">${esc(p.name)}</div><div class="ranking-stats">✅ ${p.correctAnswers} · ⭐ ${p.score}</div></div><div class="ranking-drinks"><div class="ranking-drinks-count">${p.totalDrinks}</div><div class="ranking-drinks-label">tragos</div></div></div>`).join('');
}

// ===== GAME OVER BUTTONS =====

$('#btnPlayAgain').addEventListener('click', () => {
  if (S.isHost) {
    const gt = Array.from(
      ($$('.gameTypeCheck:checked') as NodeListOf<HTMLInputElement>)
    ).map(c => c.value);
    socket.emit('startGame', {
      settings: {
        gameTypes: gt,
        maxRounds: parseInt(($('#settingRounds') as HTMLInputElement).value) || 20,
      }
    });
  } else toast('Solo el host', 'warning');
});

$('#btnViewExpenses').addEventListener('click', () => {
  showScreen('game');
  switchTab('expenses');
  socket.emit('getSplit');
});

$('#btnGoHome').addEventListener('click', () => location.reload());

// ===== SOCKET EVENTS =====

socket.on('roomCreated', (d: any) => {
  S.id = socket.id;
  S.roomCode = d.roomCode;
  S.isHost = true;
  $('#lobbyRoomCode').textContent = d.roomCode;
  updateLobby(d.room as SafeRoom);
  if (d.room.inviteLink) ($('#inviteLinkInput') as HTMLInputElement).value = d.room.inviteLink;
  socket.emit('getQR');
  showScreen('lobby');
  toast('¡Sala creada!', 'success');
});

socket.on('roomJoined', (d: any) => {
  S.id = socket.id;
  S.roomCode = d.roomCode;
  S.isHost = d.player.isHost;
  $('#lobbyRoomCode').textContent = d.roomCode;
  updateLobby(d.room as SafeRoom);
  if (d.room.inviteLink) ($('#inviteLinkInput') as HTMLInputElement).value = d.room.inviteLink;
  if (d.room.customContent) renderCustomList(d.room.customContent);
  socket.emit('getQR');
  if (d.room.gameState === 'playing' || d.room.gameState === 'finished') {
    showScreen('game');
    updateBar(d.room.collectiveBar);
    updateRanking(d.room.players);
    updatePaidBy(d.room.players);
    updateTimedEffects(d.room);
    if (d.reconnected) toast('¡Reconectado!', 'success');
  } else {
    showScreen('lobby');
    toast('¡Te uniste!', 'success');
  }
});

socket.on('qrGenerated', (d: any) => {
  ($('#qrImage') as HTMLImageElement).src = d.qr;
  ($('#inviteLinkInput') as HTMLInputElement).value = d.url;
});

socket.on('playerJoined', (d: any) => {
  updateLobby(d.room as SafeRoom);
  updatePaidBy(d.room.players);
  toast(d.player.name + ' se unió 👋', 'info');
  sysMsg(d.player.avatar + ' ' + esc(d.player.name) + ' se unió');
});

socket.on('readyUpdate', (d: any) => updateLobby(d.room as SafeRoom));

socket.on('settingsUpdated', (d: any) => {
  const s = d.room.settings as GameSettings;
  ($('#settingLang') as HTMLSelectElement).value = s.lang;
  ($('#settingTime') as HTMLInputElement).value = String(s.timePerQuestion);
  ($('#settingRounds') as HTMLInputElement).value = String(s.maxRounds);
  ($('#settingBarFill') as HTMLInputElement).value = String(s.barFillPerWrong);
  ($('#settingVoteTime') as HTMLInputElement).value = String(s.voteTime);
  ($('#settingCancelMethod') as HTMLSelectElement).value = s.cancelMethod;
  ($('#settingAutoAdvance') as HTMLInputElement).checked = s.autoAdvanceNeverEver;
  ($('#settingAutoTime') as HTMLInputElement).value = String(s.autoAdvanceTime);
  ($$('.gameTypeCheck') as NodeListOf<HTMLInputElement>).forEach(cb => {
    cb.checked = s.gameTypes.includes(cb.value);
  });
  ['settingTime', 'settingRounds', 'settingBarFill', 'settingVoteTime', 'settingAutoTime'].forEach(id => {
    const input = $(`#${id}`) as HTMLInputElement;
    const cont = input.previousElementSibling as HTMLElement | null;
    if (cont && cont.classList.contains('quick-pick')) {
      let found = false;
      cont.querySelectorAll<HTMLElement>('.qp-btn:not(.qp-custom)').forEach(b => {
        const isActive = b.dataset.val === input.value;
        b.classList.toggle('active', isActive);
        if (isActive) found = true;
      });
      const customBtn = cont.querySelector('.qp-custom') as HTMLElement | null;
      if (customBtn) {
        if (!found && input.value) {
          customBtn.classList.add('active');
          customBtn.innerHTML = `✏️ ${input.value}`;
        } else {
          customBtn.classList.remove('active');
          customBtn.innerHTML = '✏️';
        }
      }
    }
  });
});

socket.on('playerDisconnected', (d: any) => {
  updateLobby(d.room as SafeRoom);
  toast(d.player.name + ' se desconectó', 'warning');
  sysMsg(d.player.avatar + ' ' + esc(d.player.name) + ' se desconectó');
});

socket.on('playerReconnected', (d: any) => {
  updateLobby(d.room as SafeRoom);
  toast(d.player.name + ' volvió', 'success');
  sysMsg(d.player.avatar + ' ' + esc(d.player.name) + ' se reconectó');
});

socket.on('playerLeft', (d: any) => {
  updateLobby(d.room as SafeRoom);
  toast(d.playerName + ' se fue', 'info');
});

socket.on('playerKicked', (d: any) => {
  updateLobby(d.room as SafeRoom);
  toast(d.playerName + ' fue expulsado', 'warning');
});

socket.on('kicked', () => {
  toast('Has sido expulsado', 'error', 5000);
  setTimeout(() => location.reload(), 2000);
});

socket.on('leftRoom', () => {
  showScreen('home');
  toast('Saliste de la sala', 'info');
});

socket.on('newHost', (d: any) => {
  if (d.player.id === S.id) {
    S.isHost = true;
    toast('¡Ahora eres el host!', 'warning');
  }
  updateLobby(d.room as SafeRoom);
});

socket.on('customContentAdded', (d: any) => {
  renderCustomList(d.customContent);
  toast(d.by + ' agregó contenido', 'success');
});

socket.on('customContentUpdated', (d: any) => {
  renderCustomList(d.customContent);
});

socket.on('gameStarted', (d: any) => {
  showScreen('game');
  updateBar(0);
  updateRanking(d.room.players);
  updatePaidBy(d.room.players);
  updateTimedEffects(d.room);
  toast('🎮 ¡Juego iniciado!', 'success');
  sysMsg('🎮 ¡El juego ha comenzado!');
  $('#gameContent').innerHTML = '<div class="game-waiting"><div class="spinner"></div><p>Primera ronda en 3...</p></div>';
});

socket.on('triviaQuestion', renderTrivia);

socket.on('timerTick', (d: any) => {
  const t = document.getElementById('triviaTimer');
  if (t) {
    t.textContent = String(d.time);
    if (d.time <= 5) t.classList.add('warning');
  }
});

socket.on('playerAnswered', (d: any) => {
  const c = document.getElementById('answersCount');
  if (c) c.textContent = d.answeredCount + '/' + d.totalPlayers + ' respondieron';
});

socket.on('triviaResult', (d: any) => {
  $$('.trivia-option').forEach((o, i) => {
    o.classList.add('disabled');
    if (i === d.correctAnswer) o.classList.add('correct');
    else if (i === S.selectedAnswer && i !== d.correctAnswer) o.classList.add('wrong');
  });
  setTimeout(() => renderTriviaResult(d), 1500);
});

socket.on('showSkipButton', () => {
  $('#btnSkipVote').style.display = 'inline-flex';
});

socket.on('skipVoteUpdate', (d: any) => {
  $('#skipCount').style.display = 'inline';
  $('#skipCount').textContent = `(${d.skipCount}/${d.totalNeeded})`;
});

socket.on('challengeRound', renderChallenge);

socket.on('showChallengeVote', (d: any) => renderChallengeVote(d));

socket.on('challengeVoteUpdate', (d: any) => {
  const f = document.getElementById('voteBarFill');
  const c = document.getElementById('voteCount');
  if (f) f.style.width = (d.voteCount / d.totalNeeded) * 100 + '%';
  if (c) c.textContent = d.voteCount + '/' + d.totalNeeded + ' votos';
});

socket.on('challengeVoteResult', (d: any) => {
  const areas = [document.getElementById('challengeVoteArea'), document.getElementById('todVoteArea')];
  areas.forEach(area => {
    if (area) area.innerHTML = `<div class="vote-result ${d.completed ? 'passed' : 'failed'}">${
      d.completed
        ? `✅ ¡${esc(d.targetPlayer?.name || '?')} completó el reto!`
        : `❌ ${esc(d.targetPlayer?.name || '?')} NO completó. 🍺 Bebe ${d.penalty} trago(s)!`
    } (${d.yesVotes}✅ / ${d.noVotes}❌)</div>`;
  });
  updateRanking(d.room.players);
  setTimeout(() => {
    $('#btnSkipVote').style.display = 'inline-flex';
  }, 2000);
});

socket.on('timedEffectAdded', (d: any) => {
  updateTimedEffects(d.room);
  toast(`⏳ Efecto: ${d.effect.playerName} - ${d.effect.text}`, 'warning', 4000);
});

socket.on('timedEffectsExpired', (d: any) => {
  updateTimedEffects(d.room);
  d.expired.forEach((e: any) => {
    sysMsg(`⏳ <strong>${esc(e.playerName)}</strong> terminó su efecto: ${esc(e.text)}`);
  });
});

socket.on('timedActionChoice', (d: any) => {
  S.hasRespondedTimed = false;
  const area = $('#challengeVoteArea');
  if (!area) return;
  const isMe = d.targetPlayer.id === S.id;
  if (isMe) {
    area.innerHTML = `
      <div class="timed-choice-box">
        <p style="font-weight:800;margin-bottom:8px">⏳ ¿Aceptas el reto por ${d.duration} rondas?</p>
        <p style="font-size:.82rem;color:rgba(255,255,255,.5);margin-bottom:12px">Si rechazas, bebes ${d.penaltyDrinks} trago(s)</p>
        <div class="vote-buttons">
          <button class="btn btn-success" onclick="respondTimedAction(true)">✅ Acepto el reto</button>
          <button class="btn btn-danger" onclick="respondTimedAction(false)">🍺 Prefiero tomar (${d.penaltyDrinks})</button>
        </div>
      </div>`;
  } else {
    area.innerHTML = `<p style="text-align:center;color:rgba(255,255,255,.4);animation:pulse 2s infinite">Esperando decisión de ${esc(d.targetPlayer.name)}...</p>`;
  }
});

socket.on('timedActionAccepted', (d: any) => {
  const area = $('#challengeVoteArea');
  if (area) {
    area.innerHTML = `<div class="vote-result passed">✅ ${esc(d.targetPlayer.name)} aceptó el reto por ${d.duration} rondas 💪</div>`;
  }
  toast(`✅ ${d.targetPlayer.name} aceptó el reto`, 'success');
});

socket.on('timedActionRejected', (d: any) => {
  const area = $('#challengeVoteArea');
  if (area) {
    area.innerHTML = `<div class="vote-result failed">🍺 ${esc(d.targetPlayer.name)} rechazó el reto. ¡Bebe ${d.penalty} trago(s)!</div>`;
  }
  updateRanking(d.room.players);
  toast(`🍺 ${d.targetPlayer.name} rechazó y bebe ${d.penalty}`, 'warning');
});

socket.on('timedEffectVerify', (d: any) => {
  S.hasVotedVerify = false;
  toGameTab();
  updateRanking(d.room.players);
  updateTimedEffects(d.room);
  $('#gameContent').innerHTML = `
    <div class="challenge-container">
      <div class="challenge-type-badge action">🔍 VERIFICACIÓN</div>
      <div class="target-section"><span class="target-avatar">${d.targetPlayer.avatar}</span><span class="target-name">${esc(d.targetPlayer.name)}</span></div>
      <div class="challenge-text">${esc(d.effect.text)}</div>
      <p style="color:var(--secondary);font-size:.88rem;font-weight:700;margin-bottom:8px">⏳ El efecto ha expirado</p>
      <div class="vote-progress">
        <div style="text-align:center;font-weight:700;font-size:.88rem;margin-bottom:6px">🗳️ ¿${esc(d.targetPlayer.name)} cumplió con el reto?</div>
        <p style="font-size:.78rem;color:rgba(255,255,255,.4);margin-bottom:8px">Si no cumplió, bebe ${d.penaltyDrinks} trago(s)</p>
        <div class="vote-bar"><div class="vote-bar-fill" id="verifyBarFill" style="width:0%"></div></div>
        <div class="vote-buttons">
          <button class="btn btn-success btn-sm" onclick="voteVerify(true)">✅ Sí cumplió</button>
          <button class="btn btn-danger btn-sm" onclick="voteVerify(false)">❌ No cumplió</button>
        </div>
        <div class="answers-count" id="verifyCount">0/? votos</div>
      </div>
    </div>`;
});

socket.on('timedEffectVerifyUpdate', (d: any) => {
  const f = document.getElementById('verifyBarFill');
  const c = document.getElementById('verifyCount');
  if (f) f.style.width = (d.voteCount / d.totalNeeded) * 100 + '%';
  if (c) c.textContent = d.voteCount + '/' + d.totalNeeded + ' votos';
});

socket.on('timedEffectVerifyResult', (d: any) => {
  $('#gameContent').innerHTML = `
    <div class="challenge-container">
      <div class="challenge-type-badge ${d.completed ? 'action' : 'drink'}">🔍 RESULTADO</div>
      <div class="target-section"><span class="target-avatar">${d.targetPlayer?.avatar || '❓'}</span><span class="target-name">${esc(d.targetPlayer?.name || '?')}</span></div>
      <div class="challenge-text">${esc(d.effect.text)}</div>
      <div class="vote-result ${d.completed ? 'passed' : 'failed'}">
        ${d.completed ? `✅ ¡${esc(d.targetPlayer?.name || '?')} cumplió el reto!` : `❌ ${esc(d.targetPlayer?.name || '?')} NO cumplió. 🍺 Bebe ${d.penalty} trago(s)!`}
        (${d.yesVotes}✅ / ${d.noVotes}❌)
      </div>
    </div>`;
  updateRanking(d.room.players);
});

socket.on('dareVoteStart', (d: any) => {
  S.hasVotedChallenge = false;
  const area = document.getElementById('todVoteArea');
  if (!area) return;
  area.innerHTML = `<div class="vote-progress"><div style="text-align:center;font-weight:700;font-size:.88rem">🗳️ ¿${esc(d.targetPlayer.name)} completó el reto?</div><div class="vote-bar"><div class="vote-bar-fill" id="voteBarFill" style="width:0%"></div></div><div class="vote-buttons"><button class="btn btn-success btn-sm" onclick="voteChallenge(true)">✅ Sí</button><button class="btn btn-danger btn-sm" onclick="voteChallenge(false)">❌ No</button></div><div class="answers-count" id="voteCount">0/? votos</div></div>`;
});

socket.on('neverEverRound', renderNeverEver);

socket.on('playerDrank', (d: any) => {
  const g = document.getElementById('drinkersGrid');
  if (g) {
    const c = document.createElement('div');
    c.className = 'drinker-card';
    c.innerHTML = `<span class="dc-avatar">${d.playerAvatar}</span><span class="dc-name">${esc(d.playerName)} 🍺</span>`;
    g.appendChild(c);
  }
  if (d.playerId === S.id) {
    const db = document.getElementById('btnNEDrink');
    const pb = document.getElementById('btnNEPass');
    if (db) { (db as HTMLButtonElement).disabled = true; db.textContent = '✅ ¡Bebiste!'; db.className = 'btn btn-secondary'; }
    if (pb) (pb as HTMLButtonElement).disabled = true;
  }
  updateRanking(d.room.players);
});

socket.on('playerPassed', (d: any) => {
  const c = document.getElementById('neResponseCount');
  if (c) c.textContent = d.totalResponded + '/' + d.totalPlayers + ' respondieron';
  if (d.playerId === S.id) {
    const db = document.getElementById('btnNEDrink');
    const pb = document.getElementById('btnNEPass');
    if (db) (db as HTMLButtonElement).disabled = true;
    if (pb) { (pb as HTMLButtonElement).disabled = true; pb.textContent = '✅ Pasaste'; pb.className = 'btn btn-secondary'; }
  }
});

socket.on('neAutoAdvanceStarted', (d: any) => {
  const el = document.getElementById('neAutoCountdown');
  if (!el) return;
  let sec: number = d.seconds;
  el.textContent = `Siguiente ronda en ${sec}s...`;
  const iv = setInterval(() => {
    sec--;
    if (sec <= 0) { clearInterval(iv); el.textContent = 'Avanzando...'; }
    else el.textContent = `Siguiente ronda en ${sec}s...`;
  }, 1000);
});

socket.on('truthOrDareRound', renderTruthOrDare);

socket.on('truthOrDareRevealed', (d: any) => {
  const ct = document.getElementById('todContent');
  const btns = document.getElementById('todChoiceButtons');
  if (btns) btns.style.display = 'none';
  if (ct) {
    const lbl = d.type === 'truth' ? '🔮 VERDAD' : '⚡ RETO';
    const cls = d.type === 'truth' ? 'action' : 'drink';
    ct.innerHTML = `<div class="challenge-type-badge ${cls}">${lbl}</div><div class="tod-content">${esc(d.content)}</div>`;
  }
  if (d.type === 'truth') {
    setTimeout(() => { $('#btnSkipVote').style.display = 'inline-flex'; }, 5000);
  }
});

socket.on('collectiveBarFull', (d: any) => {
  const modal = $('#collectiveModal');
  modal.classList.add('active');
  const audio = $('#collectiveAudio') as HTMLAudioElement;
  if (audio && audio.src) try { audio.play(); } catch (_e) { /* ignore */ }
  updateBar(0);
  updateRanking(d.room.players);
  ($('#btnCollectiveAccept') as HTMLButtonElement).disabled = false;
  $('#btnCollectiveAccept').textContent = '🍻 ¡Listo, seguimos!';
  $('#collectiveAcceptStatus').textContent = '0/' + d.room.connectedCount + ' listos';
});

socket.on('collectiveAcceptUpdate', (d: any) => {
  $('#collectiveAcceptStatus').textContent = d.count + '/' + d.total + ' listos';
  if (d.count >= d.total) $('#collectiveModal').classList.remove('active');
});

socket.on('cancelVoteUpdate', (d: any) => {
  toast(`Votación cancelar: ${d.cancelCount}/${d.totalNeeded}`, 'info');
});

socket.on('expensesUpdated', renderExpenses);

socket.on('chatMessage', addChat);

socket.on('gameEnded', (d: any) => {
  renderGameOver(d);
  showScreen('gameover');
  toast(d.cancelled ? '🚫 Cancelada' : '🎉 ¡Fin!', d.cancelled ? 'warning' : 'success', 5000);
});

socket.on('error', (d: any) => toast(d.message, 'error'));

socket.on('connect', () => console.log('✅'));

socket.on('disconnect', () => toast('⚠️ Desconectado...', 'error', 5000));
