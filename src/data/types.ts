import type { MajorPlanetKey, OsculatingElements } from '../core/astro/elements';
import type { PoleModel } from '../core/astro/orientation';
import type { SourceId } from './sources';
import type { SatelliteKey } from './moonOrbits';

/** Texto preparado para várias línguas; pt-PT é obrigatório e serve de alternativa. */
export interface LocalizedText {
  'pt-PT': string;
  en?: string;
  es?: string;
}

export type BodyId =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'moon'
  | 'mars'
  | 'ceres'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'phobos'
  | 'deimos'
  | 'io'
  | 'europa'
  | 'ganymede'
  | 'callisto'
  | 'mimas'
  | 'enceladus'
  | 'tethys'
  | 'dione'
  | 'rhea'
  | 'titan'
  | 'iapetus'
  | 'miranda'
  | 'ariel'
  | 'umbriel'
  | 'titania'
  | 'oberon'
  | 'triton'
  | 'charon';

export type BodyType = 'star' | 'planet' | 'dwarf-planet' | 'moon';

/**
 * Natureza de um valor:
 * - measured: valor medido/ajustado publicado pela fonte;
 * - derived: calculado por nós a partir de valores da fonte (a fórmula está na nota);
 * - average: média ou valor representativo (temperaturas médias, distâncias médias);
 * - estimate: estimativa de modelo ou valor com grande incerteza.
 */
export type ValueKind = 'measured' | 'derived' | 'average' | 'estimate';

export type Unit =
  | 'km'
  | 'kg'
  | 'kg/m³'
  | 'm/s²'
  | 'km/s'
  | 'h'
  | 'd'
  | 'yr'
  | '°'
  | '°C'
  | 'K'
  | 'bar'
  | 'AU'
  | '1e6 km'
  | 'W'
  | 's'
  | '';

export type FactKey =
  | 'diameter'
  | 'dimensions'
  | 'equatorialRadius'
  | 'polarRadius'
  | 'mass'
  | 'density'
  | 'gravity'
  | 'escapeVelocity'
  | 'meanDistanceSun'
  | 'semiMajorAxisAu'
  | 'perihelion'
  | 'aphelion'
  | 'distanceEarth'
  | 'distancePlanet'
  | 'perigee'
  | 'apogee'
  | 'lightTime'
  | 'siderealRotation'
  | 'dayLength'
  | 'orbitalPeriod'
  | 'synodicPeriod'
  | 'orbitalVelocity'
  | 'inclination'
  | 'inclinationEquator'
  | 'eccentricity'
  | 'obliquity'
  | 'meanTemperature'
  | 'temperatureRange'
  | 'temperature1bar'
  | 'effectiveTemperature'
  | 'surfacePressure'
  | 'luminosity'
  | 'spectralType'
  | 'centralTemperature'
  | 'centralPressure'
  | 'centralDensity'
  | 'discovery';

export interface Fact {
  key: FactKey;
  /** Valor numérico, intervalo [mín, máx] ou texto (tipo espectral, datas). */
  value: number | [number, number] | string;
  unit: Unit;
  kind: ValueKind;
  sourceId: SourceId;
  /** Incerteza (±) na mesma unidade, quando publicada. */
  uncertainty?: number;
  /** Algarismos/decimais a mostrar; por omissão, como publicado. */
  digits?: number;
  /** Mostrar em notação científica. */
  scientific?: boolean;
  /** Prefixo de desigualdade (< ou ~) quando a fonte o indica. */
  qualifier?: '<' | '~' | '≈';
  note?: LocalizedText;
}

export interface AtmosphereComponent {
  formula: string;
  name: LocalizedText;
  /** Fração por volume. */
  value: number;
  unit: '%' | 'ppm';
  uncertainty?: number;
}

export interface Atmosphere {
  summary: LocalizedText;
  components: AtmosphereComponent[];
  sourceId: SourceId;
  note?: LocalizedText;
}

export interface StructureLayer {
  name: LocalizedText;
  description: LocalizedText;
}

export interface NotableMoon {
  name: LocalizedText;
  /** Raio médio (km) e incerteza (±), JPL. */
  radiusKm: number;
  radiusUncertaintyKm: number;
  /** Ligação para a ficha completa, quando existe na aplicação. */
  bodyId?: BodyId;
}

export interface MoonInfo {
  count: number;
  asOf: string;
  sourceId: SourceId;
  note?: LocalizedText;
  notable: NotableMoon[];
}

export interface Mission {
  name: string;
  agency: string;
  /** Ano (ou intervalo) relevante e o que aconteceu nesse ano. */
  when: LocalizedText;
  kind: 'flyby' | 'orbiter' | 'lander' | 'rover' | 'observatory' | 'impactor' | 'crewed' | 'probe';
  summary: LocalizedText;
  /** Estado ou plano que pode mudar; mostra-se a data de consulta. */
  timeSensitive?: boolean;
}

export type OrbitModel =
  | { kind: 'none' }
  | { kind: 'jpl-approx'; key: MajorPlanetKey }
  | { kind: 'osculating'; elements: OsculatingElements }
  | { kind: 'lunar-mean' }
  | { kind: 'satellite'; key: SatelliteKey };

export interface RenderInfo {
  /** Mapa de cor (sem extensão; existem versões -512 e -2k em public/textures). */
  texture?: string;
  normalMap?: string;
  /** Cor de base quando não há textura fiável (representação ilustrativa). */
  color: string;
  /** Nota sobre a representação visual. */
  visualNote?: LocalizedText;
  rings?: {
    innerKm: number;
    outerKm: number;
    style: 'saturn' | 'faint';
    sourceId: SourceId;
    /** Raios individuais (km) para anéis estreitos desenhados como linhas. */
    radiiKm?: number[];
  };
  clouds?: boolean;
  /** Rotação síncrona: a face com longitude 0° está sempre virada para o planeta. */
  synchronous?: boolean;
  atmosphereGlow?: string;
  /** Ícone para listas: cor de destaque. */
  accent: string;
}

export interface CelestialBody {
  id: BodyId;
  slug: string;
  type: BodyType;
  parent?: BodyId;
  name: LocalizedText;
  /** Outros nomes aceites na pesquisa (inglês, espanhol, latim, designações). */
  aliases: string[];
  symbol?: string;
  tagline: LocalizedText;
  description: LocalizedText[];
  meanRadiusKm: number;
  facts: Fact[];
  atmosphere?: Atmosphere;
  structure?: { layers: StructureLayer[]; note?: LocalizedText; sourceNote?: LocalizedText };
  moons?: MoonInfo;
  features: LocalizedText[];
  discoveries: LocalizedText[];
  missions: Mission[];
  sources: SourceId[];
  orbit: OrbitModel;
  pole?: PoleModel;
  render: RenderInfo;
  /** Termos de pesquisa para a galeria de imagens da NASA. */
  imageQuery?: { q: string; mustInclude: string[] };
}
