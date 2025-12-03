import { TIMING } from '../constants/Constants.js';

/**
 * Handles stick throwing animation, rendering, and timing
 */
export default class SticksRenderer {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.busy = false;
    this.queue = [];
  }

  /**
   * Queue a callback to run after the sticks animation (or run now if idle).
   */
  queueAfterFlip(cb, delay = 0) {
    if (!this.busy) {
      setTimeout(cb, delay);
      return;
    }
    this.queue.push(() => setTimeout(cb, delay));
  }

  /**
   * Queue a message update to run after the sticks animation.
   */
  msgAfterFlip(text, delay = 0) {
    this.queueAfterFlip(() => this.uiManager.setMessage(text), delay);
  }

  /**
   * Reset the stick display to neutral (grey/inactive) after a delay.
   */
  sticksToGrey(delayMs = 0) {
    setTimeout(() => this.renderSticks(null, { force: true, animate: false }), delayMs);
  }

  /**
   * Render the sticks (neutral or showing a roll) and animate if requested.
   */
  renderSticks(valueOrResult, opts = {}) {
    const sticksEl = this.uiManager.getElements().sticksEl;
    if (!sticksEl) return;
    
    this.uiManager.show(sticksEl);
    const force = opts.force === true;
    const animate = opts.animate !== false;

    if (this.busy && !force) return;

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

    this.busy = animate;

    const value = typeof valueOrResult === 'number'
      ? valueOrResult
      : valueOrResult.value;

    const faces =
      typeof valueOrResult === 'object' && valueOrResult.sticks
        ? valueOrResult.sticks
        : window.game?.lastSticks?.length
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
      
      this.busy = false;
      const tasks = this.queue.splice(0, this.queue.length);
      tasks.forEach(fn => fn());
    };

    if (animate) setTimeout(reveal, TIMING.flipAnimMs);
    else reveal();
  }

  /**
   * Check if sticks are currently busy animating
   */
  isBusy() {
    return this.busy;
  }
}