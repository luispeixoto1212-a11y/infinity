import { beforeEach, describe, expect, it } from 'vitest';
import { filterRelevant, parseNasaItem, parseNasaResponse, searchNasaImages } from './nasaImages';
import { readJson, setStorageBackend, writeJson, isStringArray, type KeyValueStore } from '../core/storage';

function item(id: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    data: [{ nasa_id: id, title, media_type: 'image', center: 'JPL', date_created: '2004-07-01T00:00:00Z', ...extra }],
    links: [{ href: `https://images-assets.nasa.gov/image/${id}/${id}~thumb.jpg`, rel: 'preview', render: 'image' }],
  };
}

describe('NASA Image and Video Library', () => {
  it('extrai título, crédito e ligações da resposta', () => {
    const img = parseNasaItem(item('PIA00001', 'Saturn from Cassini', { photographer: 'NASA/JPL/Space Science Institute' }));
    expect(img).toMatchObject({
      nasaId: 'PIA00001',
      title: 'Saturn from Cassini',
      credit: 'NASA/JPL/Space Science Institute',
      detailsUrl: 'https://images.nasa.gov/details/PIA00001',
    });
  });

  it('sem fotógrafo, usa o centro da NASA como crédito', () => {
    expect(parseNasaItem(item('X', 'Mars'))?.credit).toBe('NASA/JPL');
  });

  it('ignora itens incompletos, vídeos e ligações inseguras', () => {
    expect(parseNasaItem({})).toBeNull();
    expect(parseNasaItem(item('V', 'Mars video', { media_type: 'video' }))).toBeNull();
    const insecure = item('I', 'Mars');
    insecure.links[0]!.href = 'http://example.com/x.jpg';
    expect(parseNasaItem(insecure)).toBeNull();
  });

  it('rejeita respostas sem a estrutura esperada', () => {
    expect(() => parseNasaResponse({ foo: 1 })).toThrow();
    expect(() => parseNasaResponse(null)).toThrow();
  });

  it('filtra por relevância e remove duplicados', () => {
    const imgs = parseNasaResponse({
      collection: {
        items: [item('1', 'Saturn rings'), item('2', 'A random nebula'), item('3', 'Saturn rings'), item('4', 'Saturn and Titan')],
      },
    });
    expect(filterRelevant(imgs, ['saturn'], 5).map((i) => i.nasaId)).toEqual(['1', '4']);
  });

  it('a relevância usa palavras inteiras (Io não corresponde a "Galileo")', () => {
    const imgs = parseNasaResponse({
      collection: { items: [item('g', 'Galileo spacecraft assembly'), item('i', 'Io volcano Pele'), item('b', 'Jupiter and Io')] },
    });
    expect(filterRelevant(imgs, ['io'], 5).map((i) => i.nasaId)).toEqual(['i', 'b']);
  });

  it('propaga erros HTTP para a interface mostrar a mensagem certa', async () => {
    const fakeFetch = (async () => new Response('erro', { status: 503 })) as typeof fetch;
    await expect(searchNasaImages('Mars teste 503', ['mars'], { fetchImpl: fakeFetch })).rejects.toThrow('503');
  });

  it('devolve resultados válidos com um fetch simulado', async () => {
    const body = JSON.stringify({ collection: { items: [item('A', 'Jupiter Great Red Spot')] } });
    const fakeFetch = (async () => new Response(body, { status: 200 })) as typeof fetch;
    const res = await searchNasaImages('Jupiter teste ok', ['jupiter'], { fetchImpl: fakeFetch });
    expect(res).toHaveLength(1);
    expect(res[0]!.title).toBe('Jupiter Great Red Spot');
  });
});

describe('armazenamento local seguro', () => {
  let data: Record<string, string>;
  const backend: KeyValueStore = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };

  beforeEach(() => {
    data = {};
    setStorageBackend(backend);
  });

  it('grava e lê valores', () => {
    expect(writeJson('favorites', ['mars'])).toBe(true);
    expect(readJson('favorites', [], isStringArray)).toEqual(['mars']);
  });

  it('usa o valor por omissão se os dados estiverem corrompidos ou com o tipo errado', () => {
    data['universe-infinity:favorites'] = '{não é json';
    expect(readJson('favorites', ['x'], isStringArray)).toEqual(['x']);
    data['universe-infinity:favorites'] = JSON.stringify({ a: 1 });
    expect(readJson('favorites', [], isStringArray)).toEqual([]);
  });

  it('continua a funcionar sem armazenamento disponível', () => {
    setStorageBackend(null);
    expect(writeJson('favorites', ['mars'])).toBe(false);
    expect(readJson('favorites', ['fallback'], isStringArray)).toEqual(['fallback']);
  });

  it('tolera um armazenamento que lança exceções', () => {
    setStorageBackend({
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    });
    expect(writeJson('k', 1)).toBe(false);
    expect(readJson('k', 5, (v): v is number => typeof v === 'number')).toBe(5);
  });
});
