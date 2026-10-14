import { useMemo } from 'react';
import { radecToUnit } from '../../core/astro/orientation';
import {
  type SkyBodyId,
  enuToHorizontal,
  geocentricBodies,
  horizontalToEnu,
  jdTtFromUt,
  observerOffsetEnuKm,
  skyMatrix,
  topocentricEnuKm,
} from '../../core/astro/sky';
import { julianDayTdbToDate } from '../../core/astro/time';
import { angleBetweenDeg } from '../../core/astro/vector';
import { formatNumber } from '../../core/format';
import { HORIZONS_GEOCENTRIC, HORIZONS_SKY_CONSULTED, HORIZONS_TOPOCENTRIC } from '../../data/skyValidation';

const NAMES: Record<SkyBodyId, string> = {
  sun: 'Sol',
  moon: 'Lua',
  mercury: 'Mercúrio',
  venus: 'Vénus',
  mars: 'Marte',
  jupiter: 'Júpiter',
  saturn: 'Saturno',
  uranus: 'Úrano',
  neptune: 'Neptuno',
};

const dateText = (jdUt: number) =>
  new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(
    julianDayTdbToDate(jdTtFromUt(jdUt)),
  ) + ' UT';

const angle = (arcsec: number) => (arcsec < 120 ? `${formatNumber(arcsec, 1)}″` : `${formatNumber(arcsec / 60, 1)}′`);

/** Validação do planetário contra o JPL Horizons, calculada no navegador com o código da aplicação. */
export function SkyValidationSection() {
  const geo = useMemo(
    () =>
      HORIZONS_GEOCENTRIC.map((ref) => {
        const b = geocentricBodies(jdTtFromUt(ref.jdUt)).find((x) => x.id === ref.id)!;
        return {
          ref,
          errArcsec: angleBetweenDeg(b.geoJ2000Km, radecToUnit(ref.raDeg, ref.decDeg)) * 3600,
          magDiff: ref.mag === null || ref.id === 'moon' ? null : b.magnitude - ref.mag,
          phaseDiff: ref.phaseDeg === null ? null : b.phaseAngleDeg - ref.phaseDeg,
        };
      }),
    [],
  );
  const topo = useMemo(
    () =>
      HORIZONS_TOPOCENTRIC.map((ref) => {
        const obs = { latDeg: ref.latDeg, lonDeg: ref.lonDeg };
        const b = geocentricBodies(jdTtFromUt(ref.jdUt)).find((x) => x.id === ref.id)!;
        const h = enuToHorizontal(topocentricEnuKm(b.geoJ2000Km, skyMatrix(ref.jdUt, obs), observerOffsetEnuKm(obs)));
        return { ref, h, errArcsec: angleBetweenDeg(horizontalToEnu(h), horizontalToEnu(ref)) * 3600 };
      }),
    [],
  );

  return (
    <section id="planetario" className="prose-section">
      <h2>Planetário: o céu de um lugar</h2>
      <p>
        O planetário converte as direções do equador J2000 para o horizonte do observador: precessão até à data (modelo IAU
        1976), tempo sideral médio de Greenwich (Meeus, eq. 12.4, com UT1 ≈ UTC) e latitude geodésica WGS84. As posições do
        Sol e dos planetas são geocêntricas e corrigidas do tempo de viagem da luz, com a Terra separada do baricentro
        Terra–Lua. A Lua inclui a paralaxe (até 1° perto do horizonte), calculada a partir da posição do observador no
        elipsoide. A refração atmosférica (Sæmundsson, para 1010 hPa e 10 °C) eleva os astros perto do horizonte cerca de
        meio grau. Não se aplicam a nutação (até 17″) nem a aberração anual (até 20,5″).
      </p>
      <p>
        As magnitudes dos planetas usam as fórmulas do Astronomical Almanac de 1984 (Meeus, cap. 41), com o ângulo de fase
        e, em Saturno, a inclinação dos anéis calculada a partir do polo da IAU. A constelação de cada direção é determinada
        com os limites oficiais da IAU: como esses limites seguem linhas de ascensão reta e declinação do equinócio de 1875,
        o teste faz-se nesse referencial. Para as 509 estrelas com nome do catálogo AT-HYG, o resultado coincide em todas
        com a constelação indicada no catálogo.
      </p>
      <h3>Posições geocêntricas comparadas com o Horizons</h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Astro</th>
              <th scope="col">Instante</th>
              <th scope="col" className="num">Diferença de posição</th>
              <th scope="col" className="num">Diferença de magnitude</th>
              <th scope="col" className="num">Diferença do ângulo de fase</th>
            </tr>
          </thead>
          <tbody>
            {geo.map((r, i) => (
              <tr key={i}>
                <th scope="row">{NAMES[r.ref.id]}</th>
                <td>{dateText(r.ref.jdUt)}</td>
                <td className="num">{angle(r.errArcsec)}</td>
                <td className="num">{r.magDiff === null ? '—' : `${r.magDiff >= 0 ? '+' : '−'}${formatNumber(Math.abs(r.magDiff), 2)}`}</td>
                <td className="num">{r.phaseDiff === null ? '—' : `${formatNumber(Math.abs(r.phaseDiff), 3)}°`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Azimute e altura vistos de um lugar</h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Astro</th>
              <th scope="col">Lugar</th>
              <th scope="col">Instante</th>
              <th scope="col" className="num">Altura (Horizons)</th>
              <th scope="col" className="num">Altura (aplicação)</th>
              <th scope="col" className="num">Diferença de posição</th>
            </tr>
          </thead>
          <tbody>
            {topo.map((r, i) => (
              <tr key={i}>
                <th scope="row">{NAMES[r.ref.id]}</th>
                <td>{r.ref.place}</td>
                <td>{dateText(r.ref.jdUt)}</td>
                <td className="num">{formatNumber(r.ref.altDeg, 3)}°</td>
                <td className="num">{formatNumber(r.h.altDeg, 3)}°</td>
                <td className="num">{angle(r.errArcsec)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="section-note">
        Referência: JPL Horizons (DE441), consultado em {HORIZONS_SKY_CONSULTED}; posições astrométricas ICRF e, para o
        lugar, azimute e altura aparentes sem atmosfera. Diferenças calculadas agora, no navegador, com o mesmo código do
        planetário. As maiores diferenças (Júpiter e Saturno, 1′ a 5′) vêm da Tabela 1 do JPL, que dá posições aproximadas;
        a magnitude da Lua não se compara porque o Horizons usa outra lei de fase. Nascer e ocaso do Sol e da Lua em Lisboa a
        14 de outubro de 2026: menos de 2 minutos de diferença face ao Horizons (testes automáticos).
      </p>
    </section>
  );
}
