import { BufferGeometry, Color, Float32BufferAttribute, Group, Line, LineBasicMaterial, Points, PointsMaterial, Vector3 } from 'three';
import { heliocentricAuToScene } from '../../../core/astro/scale';
import { type EpochElements, nearestEpoch, sampleSmallBodyOrbit, smallBodyPositionAu } from '../../../core/astro/smallBody';
import type { SmallBody } from '../../../data/smallBodies';

export interface SmallBodyLayerItem {
  body: SmallBody;
  epochs: EpochElements[];
}

interface Entry extends SmallBodyLayerItem {
  orbit: Line;
  epochJd: number;
  pos: Vector3;
  label: HTMLButtonElement;
  width: number;
}

/**
 * Camada de asteroides e cometas na vista 3D: posição (ponto de tamanho fixo no ecrã), órbita e etiqueta.
 * Usa a mesma escala comprimida das distâncias que os planetas. A órbita é a da época de elementos mais próxima e é
 * redesenhada quando a época muda (ao avançar o tempo).
 */
export class SmallBodyLayer {
  readonly group = new Group();
  private readonly entries: Entry[] = [];
  private readonly points: Points;
  private readonly positions: Float32BufferAttribute;
  private showOrbits = true;

  constructor(
    items: readonly SmallBodyLayerItem[],
    labelLayer: HTMLElement,
    onOpen: (slug: string) => void,
    pixelRatio: number,
  ) {
    this.group.name = 'small-bodies';
    const colors: number[] = [];
    for (const item of items) {
      const color = new Color(item.body.accent);
      colors.push(color.r, color.g, color.b);
      const material = new LineBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false });
      const orbit = new Line(new BufferGeometry(), material);
      orbit.frustumCulled = false;
      this.group.add(orbit);
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'space-label space-label--small is-hidden';
      label.textContent = item.body.name;
      label.style.setProperty('--accent', item.body.accent);
      label.tabIndex = -1;
      label.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onOpen(item.body.slug);
      });
      labelLayer.appendChild(label);
      this.entries.push({ ...item, orbit, epochJd: Number.NaN, pos: new Vector3(), label, width: item.body.name.length * 7 + 20 });
    }
    const geom = new BufferGeometry();
    this.positions = new Float32BufferAttribute(new Float32Array(items.length * 3), 3);
    geom.setAttribute('position', this.positions);
    geom.setAttribute('color', new Float32BufferAttribute(colors, 3));
    this.points = new Points(
      geom,
      new PointsMaterial({ size: 5 * pixelRatio, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  update(jd: number) {
    this.entries.forEach((e, i) => {
      const s = heliocentricAuToScene(smallBodyPositionAu(e.epochs, jd));
      e.pos.set(s.x, s.y, s.z);
      this.positions.setXYZ(i, s.x, s.y, s.z);
      const ep = nearestEpoch(e.epochs, jd)[0];
      if (ep !== e.epochJd) {
        e.epochJd = ep;
        const pts: number[] = [];
        for (const p of sampleSmallBodyOrbit(e.epochs, jd, 220, 120)) {
          const q = heliocentricAuToScene(p);
          pts.push(q.x, q.y, q.z);
        }
        e.orbit.geometry.setAttribute('position', new Float32BufferAttribute(pts, 3));
        e.orbit.geometry.computeBoundingSphere();
      }
    });
    this.positions.needsUpdate = true;
    this.points.geometry.computeBoundingSphere();
  }

  setShowOrbits(show: boolean) {
    this.showOrbits = show;
    for (const e of this.entries) e.orbit.visible = show;
  }

  getShowOrbits() {
    return this.showOrbits;
  }

  /** Etiquetas a colocar depois das dos planetas (prioridade mais baixa). */
  labels(): readonly { el: HTMLButtonElement; pos: Vector3; width: number }[] {
    return this.entries.map((e) => ({ el: e.label, pos: e.pos, width: e.width }));
  }

  dispose() {
    for (const e of this.entries) {
      e.orbit.geometry.dispose();
      (e.orbit.material as LineBasicMaterial).dispose();
      e.label.remove();
    }
    this.points.geometry.dispose();
    (this.points.material as PointsMaterial).dispose();
    this.group.removeFromParent();
  }
}
