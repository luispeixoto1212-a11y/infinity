import { useEffect, useRef } from 'react';
import { useElementSize } from '../../components/useElementSize';
import { useI18n } from '../../i18n';
import { colorFromBv, SUN_ABS_MAG_V } from './starData';

const X0 = -0.5;
const X1 = 2.2;
const Y0 = -8; // mais luminosa (em cima)
const Y1 = 17;
const M = { top: 12, right: 14, bottom: 44, left: 48 };
/** B−V do Sol (valor convencional usado no catálogo HYG). */
const SUN_BV = 0.656;

export interface HrHighlight {
  label: string;
  bv: number;
  absMag: number;
}

export function HrDiagram({ points, highlight, height: fixedHeight }: { points: Float32Array; highlight?: HrHighlight; height?: number }) {
  const { t } = useI18n();
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = fixedHeight ?? (width < 560 ? 380 : 480);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const iw = width - M.left - M.right;
    const ih = height - M.top - M.bottom;
    const sx = (bv: number) => M.left + ((bv - X0) / (X1 - X0)) * iw;
    const sy = (mag: number) => M.top + ((mag - Y0) / (Y1 - Y0)) * ih;

    // Grelha e eixos
    ctx.strokeStyle = 'rgba(150, 175, 230, 0.12)';
    ctx.fillStyle = '#6f7a9a';
    ctx.font = '11px "IBM Plex Sans", system-ui, sans-serif';
    ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let bv = -0.5; bv <= 2.0001; bv += 0.5) {
      const x = Math.round(sx(bv)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, M.top);
      ctx.lineTo(x, M.top + ih);
      ctx.stroke();
      ctx.fillText(new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1 }).format(bv), x, M.top + ih + 6);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let mag = -5; mag <= 15; mag += 5) {
      const y = Math.round(sy(mag)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(M.left, y);
      ctx.lineTo(M.left + iw, y);
      ctx.stroke();
      ctx.fillText(String(mag).replace('-', '−'), M.left - 8, y);
    }
    ctx.fillStyle = '#9aa5c4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(t.space.hrX, M.left + iw / 2, height - 2);
    ctx.save();
    ctx.translate(12, M.top + ih / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText(t.space.hrY, 0, 0);
    ctx.restore();

    // Estrelas (cor aproximada da própria estrela)
    ctx.save();
    ctx.beginPath();
    ctx.rect(M.left, M.top, iw, ih);
    ctx.clip();
    ctx.globalAlpha = highlight ? 0.35 : 0.55;
    const size = width < 560 ? 1.1 : 1.4;
    let lastColorBin = -1;
    // Ordenar por cor seria caro; agrupa por faixas de cor para trocar o fillStyle poucas vezes
    const bins: number[][] = Array.from({ length: 28 }, () => []);
    for (let i = 0; i < points.length; i += 2) {
      const bv = points[i]!;
      const bin = Math.max(0, Math.min(27, Math.floor(((bv - X0) / (X1 - X0)) * 28)));
      bins[bin]!.push(i);
    }
    bins.forEach((idx, b) => {
      if (b !== lastColorBin) ctx.fillStyle = colorFromBv(X0 + ((b + 0.5) / 28) * (X1 - X0));
      lastColorBin = b;
      for (const i of idx) ctx.fillRect(sx(points[i]!) - size / 2, sy(points[i + 1]!) - size / 2, size, size);
    });
    ctx.globalAlpha = 1;

    // Regiões
    ctx.fillStyle = 'rgba(233, 237, 248, 0.82)';
    ctx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.save();
    ctx.translate(sx(0.62), sy(7.6));
    ctx.rotate(Math.atan2(sy(13) - sy(4), sx(1.5) - sx(0.4)));
    ctx.fillText(t.space.hrRegions.main, 0, 0);
    ctx.restore();
    ctx.fillText(t.space.hrRegions.giants, sx(1.25), sy(-1.6));
    ctx.fillText(t.space.hrRegions.dwarfs, sx(-0.35), sy(14.6));

    // O Sol como referência
    const drawMark = (x: number, y: number, label: string, color: string, big: boolean) => {
      ctx.beginPath();
      ctx.arc(x, y, big ? 6 : 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0c1328';
      ctx.stroke();
      ctx.fillStyle = '#e9edf8';
      ctx.font = `${big ? 600 : 500} 12px "IBM Plex Sans", system-ui, sans-serif`;
      const w = ctx.measureText(label).width;
      const lx = x + 10 + w > M.left + iw ? x - 10 - w : x + 10;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx, y);
    };
    drawMark(sx(SUN_BV), sy(SUN_ABS_MAG_V), 'Sol', '#ffc874', false);
    if (highlight) {
      const x = Math.max(M.left, Math.min(M.left + iw, sx(highlight.bv)));
      const y = Math.max(M.top, Math.min(M.top + ih, sy(highlight.absMag)));
      drawMark(x, y, highlight.label, '#ffffff', true);
    }
    ctx.restore();
  }, [points, width, height, highlight, t]);

  return (
    <div className="chart">
      <div ref={wrapRef} className="chart-plot" style={{ height }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${t.space.hrTitle}: ${points.length / 2} estrelas${highlight ? `, com ${highlight.label} assinalada` : ''}.`}
        />
      </div>
    </div>
  );
}
