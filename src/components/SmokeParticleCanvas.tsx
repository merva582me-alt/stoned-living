import React, { useEffect, useRef } from 'react';

export const SmokeParticleCanvas: React.FC<{ enabled?: boolean }> = ({ enabled = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const resizeCanvas = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Color palettes for green/emerald glowing cannabis smoke motes
    const colors = [
      { color: 'rgba(16, 185, 129, ',  glow: '#10b981' }, // Vibrant Emerald
      { color: 'rgba(52, 211, 153, ',  glow: '#34d399' }, // Bright Mint Emerald
      { color: 'rgba(34, 197, 94, ',   glow: '#22c55e' }, // Pure Neon Green
      { color: 'rgba(110, 231, 183, ', glow: '#6ee7b7' }, // Light Emerald Glow
      { color: 'rgba(167, 243, 208, ', glow: '#a7f3d0' }, // Soft Neon Mote
      { color: 'rgba(74, 222, 128, ',  glow: '#4ade80' }  // Lime Emerald
    ];

    // Dynamic particle count optimized for high performance without GPU lag
    const particleCount = Math.min(30, Math.max(15, Math.floor(width / 45)));
    
    interface Particle {
      x: number;
      y: number;
      radius: number;
      vx: number;
      vy: number;
      maxAlpha: number;
      glowColor: string;
      waveOffset: number;
      waveSpeed: number;
    }

    const particles: Particle[] = [];

    // Initialize particles across the full screen viewport
    for (let i = 0; i < particleCount; i++) {
      const palette = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.5 + 1.2,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.15, // Continuous upward drift
        maxAlpha: Math.random() * 0.4 + 0.2,
        glowColor: palette.glow,
        waveOffset: Math.random() * Math.PI * 2,
        waveSpeed: Math.random() * 0.012 + 0.004
      });
    }

    // Ambient floating smoke wisps (large soft cloud blobs)
    interface Wisp {
      x: number;
      y: number;
      radius: number;
      vx: number;
      vy: number;
      alpha: number;
      pulse: number;
    }

    const wisps: Wisp[] = [
      { x: width * 0.2, y: height * 0.3, radius: 220, vx: 0.08, vy: -0.04, alpha: 0.05, pulse: 0 },
      { x: width * 0.8, y: height * 0.6, radius: 240, vx: -0.06, vy: -0.03, alpha: 0.04, pulse: 1.5 },
      { x: width * 0.5, y: height * 0.2, radius: 180, vx: 0.05, vy: -0.05, alpha: 0.05, pulse: 3.0 }
    ];

    let lastTime = performance.now();

    const render = (time: number) => {
      // Throttle animation to max ~60fps smooth loop
      if (time - lastTime < 16) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // 1. Render ambient background smoke cloud wisps
      wisps.forEach((w) => {
        w.x += w.vx;
        w.y += w.vy;
        w.pulse += 0.005;

        // Wrap around viewport edges seamlessly
        if (w.x < -150) w.x = width + 150;
        if (w.x > width + 150) w.x = -150;
        if (w.y < -150) w.y = height + 150;

        const currentRadius = w.radius + Math.sin(w.pulse) * 20;
        const gradient = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, currentRadius);
        gradient.addColorStop(0, `rgba(16, 185, 129, ${w.alpha})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(w.x, w.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // 2. Render glowing smoke particles using lightweight arcs
      particles.forEach((p) => {
        p.waveOffset += p.waveSpeed;
        p.x += p.vx + Math.sin(p.waveOffset) * 0.2;
        p.y += p.vy;

        // Alpha calculation based on viewport height position
        let currentAlpha = p.maxAlpha;
        if (p.y > height * 0.8) {
          const factor = Math.max(0, (height + 30 - p.y) / (height * 0.2 + 30));
          currentAlpha = p.maxAlpha * factor;
        } else if (p.y < height * 0.2) {
          const factor = Math.max(0, (p.y + 30) / (height * 0.2 + 30));
          currentAlpha = p.maxAlpha * factor;
        }

        // Reset particle position when floating off top
        if (p.y < -30) {
          p.y = height + Math.random() * 30;
          p.x = Math.random() * width;
          p.vx = (Math.random() - 0.5) * 0.3;
          p.vy = -Math.random() * 0.4 - 0.15;
          p.maxAlpha = Math.random() * 0.4 + 0.2;
        }

        if (currentAlpha > 0.01) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.glowColor;
          ctx.globalAlpha = currentAlpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-90 mix-blend-screen"
      style={{ filter: 'blur(0.2px)' }}
    />
  );
};
