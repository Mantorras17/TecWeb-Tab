/**
 * Sticks module: handles stick rendering and animations
 */

import { show } from './ui.js';

export const sticksUI = { busy: false, queue: [] };

export const ROLL_NAME = { 
  1: 'Tâb',
  2: 'Itneyn', 
  3: 'Teláteh', 
  4: "Arba'ah", 
  6: 'Sitteh' 
};

export function renderSticks(sticksEl, valueOrResult, opts = {}, flipAnimMs = 1100) {
  if (!sticksEl) {
    console.warn('Cannot render sticks - element not found');
    return;
  }
  
  show(sticksEl);
  
  const force = opts.force === true;
  const animate = opts.animate !== false;

  if (sticksUI.busy && !force) return;

  sticksEl.innerHTML = '';

  const hasValue =
    typeof valueOrResult === 'number' ||
    (valueOrResult && valueOrResult.value != null);

  if (!hasValue) {
    const strip = document.createElement('div');
    strip.className = 'stick-strip';
    for (let i = 0; i < 4; i++) {
      const img = document.createElement('img');
      img.className = 'stick-img inactive';
      img.src = 'img/darkpiece.jpg';
      strip.appendChild(img);
    }
    const label = document.createElement('div');
    label.className = 'sticks-label';
    sticksEl.appendChild(strip);
    sticksEl.appendChild(label);
    return;
  }

  sticksUI.busy = animate;

  const value = typeof valueOrResult === 'number'
    ? valueOrResult
    : valueOrResult.value;

  const faces =
    typeof valueOrResult === 'object' && valueOrResult.sticks
      ? valueOrResult.sticks
      : window.game && window.game.lastSticks && window.game.lastSticks.length
      ? window.game.lastSticks
      : [0, 0, 0, 0];

  const strip = document.createElement('div');
  strip.className = 'stick-strip';

  faces.forEach(() => {
    const img = document.createElement('img');
    img.className = 'stick-img inactive';
    img.src = 'img/darkpiece.jpg';
    if (animate) {
      img.classList.add('animating');
    }
    strip.appendChild(img);
  });

  const label = document.createElement('div');
  label.className = 'sticks-label';
  label.innerHTML = animate ? '<i>Rolling...</i>' : `&rarr; <b>${value}</b>`;

  sticksEl.appendChild(strip);
  sticksEl.appendChild(label);

  const reveal = () => {
    strip.innerHTML = '';
    faces.forEach((v) => {
      const img = document.createElement('img');
      img.className = 'stick-img ' + (v === 1 ? 'light' : 'dark') + ' active';
      img.alt = v === 1 ? 'Flat side (light)' : 'Round side (dark)';
      img.src = v === 1 ? 'img/lightpiece.jpg' : 'img/darkpiece.jpg';
      strip.appendChild(img);
    });
    if (value === 1) {
      label.innerHTML = `<b>${value} move</b>`;
    } else {
      label.innerHTML = `<b>${value} moves</b>`;
    }
    sticksUI.busy = false;
    const tasks = sticksUI.queue.splice(0, sticksUI.queue.length);
    tasks.forEach(fn => fn());
  };

  if (animate) setTimeout(reveal, flipAnimMs);
  else reveal();
}

export function sticksToGrey(sticksEl, delayMs = 0) {
  setTimeout(() => renderSticks(sticksEl, null, { force: true, animate: false }), delayMs);
}

export function queueAfterFlip(cb, delay = 0) {
  if (!sticksUI.busy) {
    setTimeout(cb, delay);
    return;
  }
  sticksUI.queue.push(() => setTimeout(cb, delay));
}

export function msgAfterFlip(setMessageFn, text, delay = 0) {
  queueAfterFlip(() => setMessageFn(text), delay);
}

export function announceRoll(setMessageFn, playerName, value) {
  const name = ROLL_NAME[value] ?? String(value);
  const who =
    playerName === 'player1' ? 'Player 1' :
    playerName === 'player2' ? 'Player 2' :
    playerName === 'cpu' ? 'Player 2' : 'Player';
  setMessageFn(`${who} rolled a ${name} (${value})!`);
}