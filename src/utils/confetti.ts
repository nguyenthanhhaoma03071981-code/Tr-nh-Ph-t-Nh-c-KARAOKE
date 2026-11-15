/**
 * Zero-dependency, high-performance HTML5 Canvas Confetti & Fireworks engine
 * Perfectly tailored for Karaoke celebrations!
 */

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: 'rect' | 'circle' | 'star';
  rotation: number;
  vRot: number;
  alpha: number;
  life: number;
  maxLife: number;
}

const COLORS = [
  '#f59e0b', // gold/amber
  '#fbbf24', // bright yellow
  '#10b981', // emerald
  '#ec4899', // pink
  '#3b82f6', // sky blue
  '#8b5cf6', // purple
  '#ef4444', // red
  '#ffffff'  // white
];

export function triggerKaraokeConfetti(isGrand: boolean = false) {
  if (typeof window === 'undefined') return;

  let canvas = document.getElementById('karaoke-confetti-canvas') as HTMLCanvasElement;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'karaoke-confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999';
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const particles: ConfettiParticle[] = [];
  const particleCount = isGrand ? 160 : 100;

  // Create bursts from 3 origins: bottom center, bottom left, bottom right
  const origins = [
    { x: width * 0.5, y: height * 0.75, angleSpread: Math.PI * 0.8 },
    { x: width * 0.15, y: height * 0.85, angleSpread: Math.PI * 0.5, baseAngle: -Math.PI * 0.3 },
    { x: width * 0.85, y: height * 0.85, angleSpread: Math.PI * 0.5, baseAngle: -Math.PI * 0.7 }
  ];

  origins.forEach(orig => {
    const countForOrig = Math.round(particleCount / origins.length);
    for (let i = 0; i < countForOrig; i++) {
      const angle = (orig.baseAngle !== undefined)
        ? orig.baseAngle + (Math.random() - 0.5) * orig.angleSpread
        : -Math.PI * 0.5 + (Math.random() - 0.5) * orig.angleSpread;

      const speed = Math.random() * 16 + 10;
      const shapes: ('rect' | 'circle' | 'star')[] = isGrand ? ['rect', 'rect', 'circle', 'star'] : ['rect', 'circle'];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const maxLife = Math.random() * 80 + 100;

      particles.push({
        x: orig.x,
        y: orig.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 8 + 6,
        color,
        shape,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        alpha: 1,
        life: 0,
        maxLife
      });
    }
  });

  let animId: number;

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    let activeParticles = 0;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life++;
      if (p.life > p.maxLife) continue;

      activeParticles++;

      // Physics
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.vx *= 0.985; // drag
      p.rotation += p.vRot;

      if (p.life > p.maxLife * 0.7) {
        p.alpha = Math.max(0, 1 - (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3));
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        // Draw 5-point star
        ctx.beginPath();
        const spikes = 5;
        const outerRadius = p.size;
        const innerRadius = p.size * 0.5;
        let rot = (Math.PI / 2) * 3;
        let x = 0;
        let y = 0;
        const step = Math.PI / spikes;

        ctx.moveTo(0, -outerRadius);
        for (let j = 0; j < spikes; j++) {
          x = Math.cos(rot) * outerRadius;
          y = Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y);
          rot += step;

          x = Math.cos(rot) * innerRadius;
          y = Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y);
          rot += step;
        }
        ctx.lineTo(0, -outerRadius);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    if (activeParticles > 0) {
      animId = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(animId);
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
  }

  animId = requestAnimationFrame(render);
}
