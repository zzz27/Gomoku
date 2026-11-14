const size = 15;
const black = 1;
const white = 2;
const byId = id => document.getElementById(id);
const codeInput = byId('code');
const points = [];
let room;
let moves = [];
let winner = [];
let pending = false;
let focusIndex = 112;
let timer;

function makeCode() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0');
}

function colorName(color) {
  return color === black ? '黑棋' : '白棋';
}

function currentColor() {
  return moves.length % 2 === 0 ? black : white;
}

function winningLine(board, index, color) {
  const x = index % size;
  const y = Math.floor(index / size);
  for (const [dx, dy] of [[1,0], [0,1], [1,1], [1,-1]]) {
    const line = [index];
    for (const sign of [-1, 1]) {
      let col = x + dx * sign;
      let row = y + dy * sign;
      while (col >= 0 && col < size && row >= 0 && row < size && board[row * size + col] === color) {
        line.push(row * size + col);
        col += dx * sign;
        row += dy * sign;
      }
    }
    if (line.length >= 5) return line;
  }
  return [];
}

function readMoves(history) {
  if (!Array.isArray(history) || history.length > size * size) return null;
  const board = Array(size * size).fill(0);
  let line = [];
  for (const [turn, index] of history.entries()) {
    if (!Number.isInteger(index) || index < 0 || index >= board.length || board[index] || line.length) return null;
    const color = turn % 2 === 0 ? black : white;
    board[index] = color;
    line = winningLine(board, index, color);
  }
  return { board, line };
}

function gameOver() {
  return winner.length > 0 || moves.length === size * size;
}

function render(message) {
  const { board, line } = readMoves(moves);
  winner = line;
  const ready = !!room?.ready;
  const turn = currentColor();
  byId('loss-overlay').hidden = !(ready && line.length > 0 && room.color === turn);
  const active = ready && !pending && !gameOver() && room.color === turn;
  byId('board').dataset.active = active;
  byId('room').hidden = !room;
  byId('lobby').hidden = !!room;
  byId('room-code').textContent = room?.code ?? '';
  byId('share').hidden = room?.color !== black || !room.listening;
  byId('again').hidden = !(ready && room.color === black && gameOver());
  byId('side').textContent = ready ? '你执' + colorName(room.color) : '15 × 15';
  byId('count').textContent = moves.length + ' 手';
  byId('turn-stone').className = 'stone ' + ((line.length ? 3 - turn : turn) === black ? 'black' : 'white');
  let status = '创建或加入房间开始对弈';
  if (room && !ready) status = room.listening ? '等待好友加入…' : '正在连接…';
  if (ready) {
    if (line.length) status = colorName(3 - turn) + '获胜';
    else if (gameOver()) status = '棋盘已满，平局';
    else status = pending ? '正在同步落子…' : active ? '轮到你 · ' + colorName(turn) : '等待对方 · ' + colorName(turn);
    if (gameOver() && room.color === white) status += ' · 等待房主开新局';
  }
  byId('status').textContent = message || status;
  points.forEach((point, i) => {
    const name = board[i] ? colorName(board[i]) : '空';
    point.className = 'point';
    if (board[i]) point.classList.add(board[i] === black ? 'black' : 'white');
    if (moves.at(-1) === i) point.classList.add('last');
    if (line.includes(i)) point.classList.add('win');
    point.setAttribute('aria-label', `第 ${Math.floor(i / size) + 1} 行，第 ${i % size + 1} 列，${name}`);
    point.setAttribute('aria-disabled', String(!active || !!board[i]));
  });
}

function reset(message) {
  const previous = room;
  room = null;
  clearTimeout(timer);
  previous?.peer.destroy();
  moves = [];
  pending = false;
  byId('fallback').hidden = true;
  byId('copy-status').hidden = true;
  render(message);
}

function play(index) {
  if (!room?.ready || pending || gameOver() || currentColor() !== room.color || moves.includes(index)) return;
  if (room.color === black) {
    moves.push(index);
    room.link.send({ kind: 'state', moves });
  } else {
    room.link.send({ kind: 'move', index, turn: moves.length });
    pending = true;
  }
  render();
}

function attach(session, link) {
  session.link = link;
  if (session.color === black) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (room === session && session.link === link && !session.ready) {
        session.link = null;
        link.close();
        render('好友连接超时，正在等待重新加入。');
      }
    }, 15000);
  }
  const current = () => room === session && session.link === link;
  link.on('open', () => {
    if (!current()) return;
    if (session.color === black) {
      clearTimeout(timer);
      session.ready = true;
      link.send({ kind: 'state', moves });
      render();
    }
  });
  link.on('data', packet => {
    if (!current() || !packet || typeof packet !== 'object') return;
    if (session.color === white && packet.kind === 'state' && readMoves(packet.moves)) {
      clearTimeout(timer);
      session.ready = true;
      moves = packet.moves;
      pending = false;
      render();
    }
    if (session.color === black && session.ready && packet.kind === 'move') {
      if (!gameOver() && currentColor() === white && packet.turn === moves.length && readMoves([...moves, packet.index])) {
        moves.push(packet.index);
      }
      link.send({ kind: 'state', moves });
      render();
    }
  });
  const disconnected = () => {
    if (!current()) return;
    if (session.color === black && !session.ready) {
      session.link = null;
      clearTimeout(timer);
      link.close();
      render();
      return;
    }
    reset('连接已断开，请重新创建或加入房间。');
  };
  link.on('close', disconnected);
  link.on('error', disconnected);
}

function start(color, code) {
  if (room) return;
  if (typeof Peer !== 'function' || !window.RTCPeerConnection) {
    render('联机服务未加载，请刷新页面或换用系统浏览器。');
    return;
  }
  const id = 'zzz27-gomoku-v1-' + code;
  const peer = color === black ? new Peer(id) : new Peer();
  const session = { peer, color, code, link: null, ready: false, listening: false };
  room = session;
  timer = setTimeout(() => {
    if (room === session && !session.ready) reset('连接超时，请确认房主在线后重试。');
  }, 18000);
  peer.on('open', () => {
    if (room !== session) return;
    if (color === black) {
      clearTimeout(timer);
      session.listening = true;
      render();
    } else {
      attach(session, peer.connect(id, { reliable: true, serialization: 'json' }));
    }
  });
  peer.on('connection', link => {
    if (room !== session || color !== black || session.link) {
      link.on('open', () => link.close());
      return;
    }
    attach(session, link);
  });
  peer.on('error', error => {
    if (room !== session) return;
    if (error.type === 'unavailable-id' && color === black) {
      reset();
      start(black, makeCode());
      return;
    }
    reset(error.type === 'peer-unavailable' ? '找不到该房间，请确认房间码和房主在线状态。' : '联机失败，请检查网络后重试。');
  });
  render();
}

for (let i = 0; i < size * size; i++) {
  const point = document.createElement('button');
  const x = i % size;
  const y = Math.floor(i / size);
  point.type = 'button';
  point.style.left = x / (size - 1) * 100 + '%';
  point.style.top = y / (size - 1) * 100 + '%';
  point.tabIndex = i === focusIndex ? 0 : -1;
  point.addEventListener('click', () => play(i));
  point.addEventListener('focus', () => {
    points[focusIndex].tabIndex = -1;
    point.tabIndex = 0;
    focusIndex = i;
  });
  point.addEventListener('keydown', event => {
    const direction = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const next = direction.map((step, axis) => Math.max(0, Math.min(size - 1, [x,y][axis] + step)));
    points[next[1] * size + next[0]].focus();
  });
  points.push(point);
  byId('points').append(point);
}

const validCode = /^\d{4}$/;
byId('create').onclick = () => start(black, makeCode());
byId('join').onsubmit = event => {
  event.preventDefault();
  const code = codeInput.value.trim().toUpperCase();
  if (validCode.test(code)) start(white, code);
  else render('请输入 4 位数字房间码。');
};
byId('leave').onclick = () => reset();
byId('again').onclick = () => {
  if (room?.ready && room.color === black && gameOver()) {
    moves = [];
    room.link.send({ kind: 'state', moves });
    render();
  }
};
byId('share').onclick = async () => {
  const url = new URL(location.href);
  url.searchParams.set('room', room.code);
  const session = room;
  try {
    await navigator.clipboard.writeText(url.href);
    if (room !== session) return;
    byId('copy-status').hidden = false;
    byId('copy-status').textContent = '已复制，发给好友即可加入。';
  } catch {
    if (room !== session) return;
    byId('fallback').hidden = false;
    byId('invite').value = url.href;
    byId('invite').select();
  }
};

render();
const inviteCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
if (validCode.test(inviteCode)) {
  codeInput.value = inviteCode;
  start(white, inviteCode);
}
