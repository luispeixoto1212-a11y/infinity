import type { CSSProperties } from 'react';
import type { CelestialBody } from '../data/types';

/**
 * Disco do objeto a partir da sua textura equirretangular (sem WebGL).
 * Sem textura fiável, mostra a cor ilustrativa.
 */
export function BodyThumb({ body, size = 40 }: { body: CelestialBody; size?: number }) {
  const style: CSSProperties = {
    width: size,
    height: size,
    '--thumb-color': body.render.color,
    backgroundImage: body.render.texture ? `url(textures/${body.render.texture}-512.jpg)` : undefined,
  } as CSSProperties;
  return (
    <span
      className={`body-thumb${body.type === 'star' ? ' body-thumb--star' : ''}${body.render.texture ? '' : ' body-thumb--flat'}`}
      style={style}
      aria-hidden="true"
    />
  );
}
