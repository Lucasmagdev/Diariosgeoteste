import React, { useEffect, useRef, useState } from 'react';
import './IntroScreen.css';

type IntroScreenProps = {
  onDone: () => void;
};

type Phase = 'canvas' | 'logo' | 'underline' | 'tagline' | 'fadeout';

const TAGLINE = 'PAINEL ADMIN';
const LOGO_SRC = '/logogeoteste.png';

// Timeline (ms)
const T_LOGO = 3100;
const T_UNDERLINE = 4600;
const T_TAGLINE = 4900;
const T_FADE = 6500;
const T_DONE = 7200;
const T_FAILSAFE = 7800;

// Palette
const GREEN = '#10b981';
const GREEN_DARK = '#047857';
const WHITE = '#ffffff';
const BG = '#050a08';

export const IntroScreen: React.FC<IntroScreenProps> = ({ onDone }) => {
  const [phase, setPhase] = useState<Phase>('canvas');
  const [logoClip, setLogoClip] = useState(100); // inset right %
  const [typed, setTyped] = useState('');
  const [logoFailed, setLogoFailed] = useState(false);

  const phaseRef = useRef<Phase>('canvas');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const doneRef = useRef(false);

  phaseRef.current = phase;

  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  // ---- Phase timeline ----
  useEffect(() => {
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase('logo'), T_LOGO));
    timers.push(window.setTimeout(() => setPhase('underline'), T_UNDERLINE));
    timers.push(window.setTimeout(() => setPhase('tagline'), T_TAGLINE));
    timers.push(window.setTimeout(() => setPhase('fadeout'), T_FADE));
    timers.push(window.setTimeout(finish, T_DONE));
    // Failsafe: never block the app permanently
    timers.push(window.setTimeout(finish, T_FAILSAFE));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [finish]);

  // ---- Logo scan reveal (clip-path inset) ----
  useEffect(() => {
    if (phase !== 'logo' && phase !== 'underline' && phase !== 'tagline') return;
    if (logoClip <= 0) return;
    const id = window.setInterval(() => {
      setLogoClip((prev) => {
        const next = prev - 9; // ~130ms/step, full reveal ~1.5s
        if (next <= 0) {
          window.clearInterval(id);
          return 0;
        }
        return next;
      });
    }, 130);
    return () => window.clearInterval(id);
  }, [phase, logoClip]);

  // ---- Tagline typing ----
  useEffect(() => {
    if (phase !== 'tagline') return; // não reinicia durante o fade
    if (typed.length >= TAGLINE.length) return;
    const id = window.setTimeout(() => {
      setTyped(TAGLINE.slice(0, typed.length + 1));
    }, 95);
    return () => window.clearTimeout(id);
  }, [phase, typed]);

  // ---- Canvas background (granito / veios premium) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    type P = {
      x: number;
      y: number;
      ox: number;
      oy: number;
      vx: number;
      vy: number;
      r: number;
      c: string;
      a: number;
    };
    let particles: P[] = [];
    let veins: { x: number; y: number; len: number; ang: number; a: number }[] = [];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const build = () => {
      const count = Math.round(Math.min(160, (w * h) / 11000));
      particles = Array.from({ length: count }, () => {
        const x = rand(0, w);
        const y = rand(0, h);
        const isGreen = Math.random() < 0.55;
        return {
          x,
          y,
          ox: x,
          oy: y,
          vx: rand(-0.18, 0.18),
          vy: rand(-0.18, 0.18),
          r: rand(0.6, 2.1),
          c: isGreen ? (Math.random() < 0.5 ? GREEN : GREEN_DARK) : WHITE,
          a: rand(0.15, 0.7),
        };
      });
      const vcount = Math.round(Math.min(14, w / 130));
      veins = Array.from({ length: vcount }, () => ({
        x: rand(0, w),
        y: rand(0, h),
        len: rand(80, 260),
        ang: rand(-0.6, 0.6),
        a: rand(0.03, 0.1),
      }));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();

    const frame = (now: number) => {
      const t = now - start;
      // converge a partir de ~2.5s, intensifica até o reveal da logo
      const pull = t < 2500 ? 0 : Math.min(1, (t - 2500) / 1600);
      const cx = w / 2;
      const cy = h / 2;

      // fundo escuro com leve vinheta
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      grad.addColorStop(0, 'rgba(16,185,129,0.06)');
      grad.addColorStop(1, 'rgba(5,10,8,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // veios de pedra
      ctx.lineWidth = 1;
      for (const v of veins) {
        ctx.strokeStyle = `rgba(180,200,190,${v.a})`;
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(v.x + Math.cos(v.ang) * v.len, v.y + Math.sin(v.ang) * v.len);
        ctx.stroke();
      }

      // partículas convergindo para o centro
      for (const p of particles) {
        p.ox += p.vx;
        p.oy += p.vy;
        if (p.ox < 0) p.ox = w;
        if (p.ox > w) p.ox = 0;
        if (p.oy < 0) p.oy = h;
        if (p.oy > h) p.oy = 0;

        p.x = p.ox + (cx - p.ox) * pull * 0.9;
        p.y = p.oy + (cy - p.oy) * pull * 0.9;

        const fade = 1 - pull * 0.85;
        ctx.globalAlpha = p.a * fade;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const logoIn = phase !== 'canvas';
  const underlineIn = phase === 'underline' || phase === 'tagline' || phase === 'fadeout';
  const showCursor = phase === 'tagline' && typed.length < TAGLINE.length;

  return (
    <div className={`sjg-intro${phase === 'fadeout' ? ' sjg-intro--fade' : ''}`}>
      <canvas ref={canvasRef} className="sjg-intro__canvas" aria-hidden />
      <div className="sjg-intro__stage">
        <div className={`sjg-intro__logo-wrap${logoIn ? ' sjg-intro__logo-wrap--in' : ''}`}>
          {logoFailed ? (
            <div className="sjg-intro__logo-fallback">GEOTESTE</div>
          ) : (
            <img
              src={LOGO_SRC}
              alt="Geoteste"
              className="sjg-intro__logo"
              style={{ clipPath: `inset(0 ${logoClip}% 0 0)` }}
              onError={() => setLogoFailed(true)}
              draggable={false}
            />
          )}
        </div>

        <div className={`sjg-intro__underline${underlineIn ? ' sjg-intro__underline--in' : ''}`} />

        <div className="sjg-intro__tagline">
          {typed}
          {showCursor && <span className="sjg-intro__cursor">_</span>}
        </div>
      </div>
    </div>
  );
};
