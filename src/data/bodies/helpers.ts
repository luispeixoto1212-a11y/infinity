import type { Fact, FactKey, LocalizedText, Unit, ValueKind } from '../types';
import type { SourceId } from '../sources';

/** Atalho para texto em português de Portugal. */
export const pt = (text: string): LocalizedText => ({ 'pt-PT': text });

export function fact(
  key: FactKey,
  value: Fact['value'],
  unit: Unit,
  kind: ValueKind,
  sourceId: SourceId,
  extra: Partial<Omit<Fact, 'key' | 'value' | 'unit' | 'kind' | 'sourceId'>> = {},
): Fact {
  return { key, value, unit, kind, sourceId, ...extra };
}

export const GRAVITY_NOTE = pt(
  'Aceleração à superfície no equador, incluindo o efeito da rotação; nos planetas gasosos, ao nível de pressão de 1 bar (tabela-resumo da NASA).',
);

export const DISTANCE_NOTE = pt('Semieixo maior da órbita (distância média ao Sol), segundo a tabela-resumo da NASA.');

export const ROTATION_NOTE = pt(
  'Período de rotação sideral (em relação às estrelas). Valores negativos indicam rotação retrógrada.',
);

export const DAY_NOTE = pt('Dia solar médio: tempo entre dois meios-dias consecutivos.');
