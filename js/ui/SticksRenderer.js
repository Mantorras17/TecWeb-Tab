/**
 * Handles stick throwing animation, rendering, and timing
 */
export default class SticksRenderer {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.busy = false;
    this.queue = [];
    this.animationId = null;

    this.imgLight = new Image();
    this.imgLight.src = 'img/lightpiece.jpg';
    
    this.imgDark = new Image();
    this.imgDark.src = 'img/darkpiece.jpg';

    this.imagesLoaded = false;
    let loadedCount = 0;
    const checkLoad = () => {
        loadedCount++;
        if (loadedCount >= 2) this.imagesLoaded = true;
    };
    this.imgLight.onload = checkLoad;
    this.imgDark.onload = checkLoad;
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

  getCanvas() {
    const canvas = document.getElementById('sticks-canvas');
    if (!canvas) return null;
    return {
      canvas,
      ctx: canvas.getContext('2d'),
      width: canvas.width,
      height: canvas.height
    };
  }

  drawStick(ctx, x, y, w, h, type, rotationAngle = 0) {

    const scaleX = Math.cos(rotationAngle);
    const isBackside = scaleX < 0;

    let currentImg;

    if (rotationAngle !== 0) currentImg = isBackside ? this.imgDark : this.imgLight;
    else currentImg = (type === 1) ? this.imgLight : this.imgDark;

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(Math.abs(scaleX), 1); 
    
    const drawX = -w / 2;
    const drawY = -h / 2;
    
    ctx.beginPath();
    const radius = 18; 
    if (ctx.roundRect) ctx.roundRect(drawX, drawY, w, h, radius);
    else ctx.rect(drawX, drawY, w, h);

    ctx.closePath();
    ctx.clip();

    if (this.imagesLoaded) ctx.drawImage(currentImg, drawX, drawY, w, h);
    else {
      ctx.fillStyle = (type === 1) ? '#f4e2be' : '#3b2b22';
      ctx.fillRect(drawX, drawY, w, h);
    }

    if (type === -1) {
      ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
      ctx.fillRect(drawX, drawY, w, h);
    }

    ctx.strokeStyle = '#351a1a';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  }

  drawScene(sticks, labelText, rotationAngle = 0) {
    const data = this.getCanvas();
    if (!data) return;
    const { ctx, width, height } = data;

    ctx.clearRect(0, 0, width, height);

    const stickW = 60; 
    const stickH = 390; 
    const gap = 15;
    const totalW = (stickW * 4) + (gap * 3);
    const startX = (width - totalW) / 2;
    const startY = 10; 

    sticks.forEach((val, i) => {
      const x = startX + (i * (stickW + gap));
      const individualAngle = rotationAngle + (i * 0.3); 
      this.drawStick(ctx, x, startY, stickW, stickH, val, rotationAngle === 0 ? 0 : individualAngle);
    });

    if (labelText) {
      ctx.font = 'bold 22px "Segoe UI", sans-serif';
      ctx.fillStyle = '#3b2b22';
      ctx.textAlign = 'center';
      ctx.fillText(labelText, width / 2, startY + stickH + 40);
    }
  }

  /**
   * Render the sticks (neutral or showing a roll) and animate if requested.
   */
  renderSticks(valueOrResult, opts = {}) {
    const data = this.getCanvas();
    if (!data) return;

    if (this.uiManager && this.uiManager.getElements().sticksEl) {
      this.uiManager.show(this.uiManager.getElements().sticksEl);
    }

    const force = opts.force === true;
    const animate = opts.animate !== false;

    if (this.busy && !force) return;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    const hasValue = typeof valueOrResult === 'number' || (valueOrResult && valueOrResult.value != null);
    if (!hasValue) {
      this.drawScene([-1, -1, -1, -1], ""); 
      return;
    }

    const value = typeof valueOrResult === 'number' ? valueOrResult : valueOrResult.value;
    const finalSticks = (typeof valueOrResult === 'object' && (valueOrResult.sticks || valueOrResult.stickValues))
      ? (valueOrResult.sticks || valueOrResult.stickValues).map(v => v ? 1 : 0)
      : (window.game?.lastSticks?.length ? window.game.lastSticks : [0, 0, 0, 0]);

    const labelText = (value === 1) ? `${value} move` : `${value} moves`;

    if (!animate) {
      this.drawScene(finalSticks, labelText, 0);
      return;
    }

    this.busy = true;
    const startTime = performance.now();
    const duration = 2000; 

    const loop = (time) => {
      const elapsed = time - startTime;
      
      if (elapsed < duration) {
        const angle = (elapsed / 400) * Math.PI; 
        
        this.drawScene([0, 0, 0, 0], "Rolling...", angle);
        this.animationId = requestAnimationFrame(loop);
      } else {
        this.drawScene(finalSticks, labelText, 0);
        this.busy = false;
        this.animationId = null;
        
        const tasks = this.queue.splice(0, this.queue.length);
        tasks.forEach(fn => fn());
      }
    };

    this.animationId = requestAnimationFrame(loop);
  }

  /**
   * Check if sticks are currently busy animating
   */
  isBusy() {
    return this.busy;
  }
}