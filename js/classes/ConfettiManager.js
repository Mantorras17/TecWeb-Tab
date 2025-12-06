export default class ConfettiManager {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.particles = [];
      this.animationId = null;
      this.isActive = false;
    }
  
    start() {
      if (this.isActive) return;
      this.isActive = true;
  
      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'fixed';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '9999';
      document.body.appendChild(this.canvas);
  
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', this.resize.bind(this));
  
      this.particles = [];
      const colors = ['#FFC700', '#FF0000', '#2E3192', '#41BBC7', '#73CD4B', '#FFFFFF'];
      
      for (let i = 0; i < 200; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height - this.canvas.height,
          w: Math.random() * 10 + 5,
          h: Math.random() * 5 + 5,
          // --- SPEED ADJUSTMENTS HERE ---
          dx: Math.random() * 4 - 2,        // Faster horizontal drift (was * 2 - 1)
          dy: Math.random() * 10 + 5,       // MUCH Faster fall speed (was * 3 + 2)
          // -----------------------------
          color: colors[Math.floor(Math.random() * colors.length)],
          tilt: Math.random() * 10,
          tiltAngle: Math.random(),
          tiltAngleInc: Math.random() * 0.2 + 0.1 // Faster wiggle/flutter (was * 0.1 + 0.05)
        });
      }
  
      this.animate();
    }
  
    stop() {
      this.isActive = false;
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.canvas) {
        this.canvas.remove();
        this.canvas = null;
      }
      window.removeEventListener('resize', this.resize.bind(this));
    }
  
    resize() {
      if (this.canvas) {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
      }
    }
  
    animate() {
      if (!this.isActive || !this.ctx) return;
  
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
      this.particles.forEach((p, i) => {
        p.tiltAngle += p.tiltAngleInc;
        
        p.y += p.dy;
        p.x += Math.sin(p.tiltAngle) * 2; 
        p.tilt = Math.sin(p.tiltAngle) * 15;
  
        this.ctx.beginPath();
        this.ctx.lineWidth = p.w;
        this.ctx.strokeStyle = p.color;
        this.ctx.moveTo(p.x + p.tilt + p.w / 2, p.y);
        this.ctx.lineTo(p.x + p.tilt, p.y + p.h + p.tilt);
        this.ctx.stroke();
  
        if (p.y > this.canvas.height) {
          // Respawn at top with slightly randomized speed again
          this.particles[i] = { 
              ...p, 
              x: Math.random() * this.canvas.width, 
              y: -20,
              dy: Math.random() * 10 + 5 // Keep respawns fast
          };
        }
      });
  
      this.animationId = requestAnimationFrame(this.animate.bind(this));
    }
  }