import { useState } from 'react';
import { formatNumber } from '../../../core/format';
import { useI18n } from '../../../i18n';
import { useCanvasAnimation } from './useAnimation';
import { VizFrame } from './VizFrame';

/** Disco de acreção visto de lado (ilustração): o lado que se aproxima parece mais brilhante. */
export function DiskViz() {
  const { t } = useI18n();
  const tx = t.extreme.disk;
  const { canvasRef, playing, setPlaying } = useCanvasAnimation((ctx, w, h, time) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#03050c';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.13;
    const tilt = 0.28;
    // Parte de trás do disco, desviada por cima da sombra pela curvatura da luz
    const drawRing = (front: boolean) => {
      for (let i = 0; i < 260; i++) {
        const r = R * (1.6 + (i % 13) * 0.17);
        const omega = 1.8 / Math.pow(r / R, 1.5);
        const a = (i * 2.399 + time * omega) % (Math.PI * 2);
        const s = Math.sin(a);
        if (front !== s > 0) continue;
        const x = cx + Math.cos(a) * r;
        const y = cy + s * r * tilt;
        // Lado esquerdo aproxima-se (rotação no sentido contrário ao dos ponteiros do relógio)
        const beaming = 0.55 + 0.45 * -Math.cos(a);
        const heat = 1 - (r / R - 1.6) / 2.4;
        ctx.fillStyle = `rgba(255, ${Math.round(150 + 90 * heat)}, ${Math.round(70 + 120 * heat)}, ${0.25 + 0.6 * beaming * Math.max(0.2, heat)})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.6 + 1.4 * heat, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawRing(false);
    // Arco superior: imagem da parte de trás do disco desviada pela gravidade
    const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.9);
    glow.addColorStop(0, 'rgba(255, 190, 110, 0.55)');
    glow.addColorStop(1, 'rgba(255, 150, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    drawRing(true);
    ctx.fillStyle = 'rgba(220, 230, 255, 0.75)';
    ctx.font = '12px "IBM Plex Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(tx.approaching, 12, h - 14);
    ctx.textAlign = 'right';
    ctx.fillText(tx.receding, w - 12, h - 14);
  }, [tx]);
  return (
    <VizFrame title={tx.title} kind="illustrative" note={tx.note} playing={playing} onToggle={() => setPlaying(!playing)}>
      <canvas ref={canvasRef} className="viz-canvas" role="img" aria-label={tx.aria} />
    </VizFrame>
  );
}

/** Dois buracos negros em espiral e o sinal "chirp" que produzem (ilustração, sem escala). */
export function WavesViz() {
  const { t } = useI18n();
  const tx = t.extreme.waves;
  const { canvasRef, playing, setPlaying } = useCanvasAnimation((ctx, w, h, time) => {
    const cycle = 9;
    const tau = time % cycle;
    const T = 7.5; // instante da fusão no ciclo
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#03050c';
    ctx.fillRect(0, 0, w, h);
    const top = h * 0.58;
    const cx = w / 2;
    const cy = top / 2;
    // Separação e fase de um binário a espiralar: a ∝ (T − t)^(1/4), fase ∝ (T − t)^(5/8)
    const left = Math.max(0, T - tau);
    const sep = left > 0 ? Math.min(top * 0.42, 22 * Math.pow(left, 0.25) * (top / 140)) : 0;
    const phase = left > 0 ? -18 * Math.pow(left, 0.625) : 0;
    // Ondulações (anéis que se afastam)
    for (let k = 0; k < 7; k++) {
      const rr = Math.max(0, ((tau * 60 + k * 40) % 280) * (w / 600));
      ctx.strokeStyle = `rgba(122, 162, 255, ${0.25 * (1 - rr / (280 * (w / 600)))})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (left > 0) {
      for (const [sgn, m] of [
        [1, 1],
        [-1, 0.85],
      ] as const) {
        const x = cx + sgn * Math.cos(phase) * sep * (sgn > 0 ? 0.46 : 0.54);
        const y = cy + sgn * Math.sin(phase) * sep * 0.5 * (sgn > 0 ? 0.46 : 0.54);
        ctx.fillStyle = '#000';
        ctx.strokeStyle = 'rgba(255, 200, 120, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 9 * m, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      const ring = Math.max(0, 1 - (tau - T) * 1.5);
      ctx.fillStyle = '#000';
      ctx.strokeStyle = `rgba(255, 220, 160, ${0.5 + 0.5 * ring})`;
      ctx.lineWidth = 1.5 + 3 * ring;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Sinal: h(t) ∝ f^(2/3) cos(φ), f ∝ (T − t)^(−3/8)
    const y0 = top + (h - top) / 2;
    const amp = (h - top) * 0.4;
    ctx.strokeStyle = 'rgba(150, 175, 230, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, y0);
    ctx.lineTo(w - 10, y0);
    ctx.stroke();
    ctx.strokeStyle = '#ffc874';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const n = 500;
    for (let i = 0; i <= n; i++) {
      const tt = (i / n) * cycle;
      if (tt > tau) break;
      const l = T - tt;
      let v: number;
      if (l > 0.02) v = Math.min(1, 0.18 * Math.pow(l, -0.25)) * Math.cos(-30 * Math.pow(l, 0.625));
      else v = Math.exp(-(tt - T) * 6) * Math.cos((tt - T) * 60) * (tt >= T ? 1 : 0.9);
      const x = 10 + (i / n) * (w - 20);
      const y = y0 - v * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(220, 230, 255, 0.7)';
    ctx.font = '12px "IBM Plex Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(tx.signal, 12, top + 16);
  }, [tx]);
  return (
    <VizFrame title={tx.title} kind="illustrative" note={tx.note} playing={playing} onToggle={() => setPlaying(!playing)}>
      <canvas ref={canvasRef} className="viz-canvas viz-canvas--tall" role="img" aria-label={tx.aria} />
    </VizFrame>
  );
}

const PULSARS: Array<[string, number]> = [
  ['PSR J1748−2446ad', 0.001396],
  ['Caranguejo', 0.0337],
  ['Vela', 0.0893],
];

/** Pulsar como um farol (ilustração), com o período verdadeiro e a animação abrandada. */
export function PulsarViz() {
  const { t } = useI18n();
  const tx = t.extreme.pulsar;
  const [period, setPeriod] = useState(PULSARS[1]![1]);
  const shown = 2.4; // segundos por rotação na animação
  const slow = shown / period;
  const { canvasRef, playing, setPlaying } = useCanvasAnimation(
    (ctx, w, h, time) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#03050c';
      ctx.fillRect(0, 0, w, h);
      const cx = w * 0.42;
      const cy = h / 2;
      const ang = (time / shown) * Math.PI * 2;
      const tilt = 0.5;
      // Feixes nos polos magnéticos, inclinados em relação ao eixo de rotação
      const bx = Math.sin(ang) * Math.sin(tilt);
      const bz = Math.cos(tilt);
      const beamAng = Math.atan2(-bz, bx * 1.6);
      const toward = Math.cos(ang) > 0.93;
      for (const s of [1, -1]) {
        const a = beamAng + (s < 0 ? Math.PI : 0);
        const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * h, cy + Math.sin(a) * h);
        g.addColorStop(0, 'rgba(160, 200, 255, 0.6)');
        g.addColorStop(1, 'rgba(160, 200, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a - 0.13) * h, cy + Math.sin(a - 0.13) * h);
        ctx.lineTo(cx + Math.cos(a + 0.13) * h, cy + Math.sin(a + 0.13) * h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(150, 175, 230, 0.35)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy - h * 0.4);
      ctx.lineTo(cx, cy + h * 0.4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      // Observador e impulso recebido
      ctx.fillStyle = toward ? '#ffc874' : 'rgba(255, 200, 116, 0.25)';
      ctx.beginPath();
      ctx.arc(w - 40, cy, toward ? 10 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 230, 255, 0.75)';
      ctx.font = '12px "IBM Plex Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tx.earth, w - 40, cy + 28);
    },
    [period, tx],
  );
  return (
    <VizFrame title={tx.title} kind="illustrative" note={tx.note(formatNumber(slow, 0))} playing={playing} onToggle={() => setPlaying(!playing)}>
      <canvas ref={canvasRef} className="viz-canvas" role="img" aria-label={tx.aria} />
      <div className="chips viz-chips">
        {PULSARS.map(([name, p]) => (
          <button key={name} type="button" className={`chip${p === period ? ' is-active' : ''}`} onClick={() => setPeriod(p)}>
            {name}: {p < 0.01 ? `${formatNumber(p * 1000, 2)} ms` : `${formatNumber(p * 1000, 1)} ms`}
          </button>
        ))}
      </div>
    </VizFrame>
  );
}
