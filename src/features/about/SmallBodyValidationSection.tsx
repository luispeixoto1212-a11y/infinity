import { href } from '../../app/router';
import { LoadState } from '../../components/LoadState';
import { useAsync } from '../../components/useAsync';
import { loadSmallBodyOrbits, validationError } from '../../core/astro/smallBody';
import { formatNumber } from '../../core/format';
import { SMALL_BODIES } from '../../data/smallBodies';

/** Método e validação das posições dos asteroides e cometas, calculada no navegador. */
export function SmallBodyValidationSection() {
  const { state, retry } = useAsync(loadSmallBodyOrbits);
  const data = state.status === 'ready' ? state.value : null;
  return (
    <section id="pequenos-corpos" className="prose-section">
      <h2>Asteroides e cometas</h2>
      <p>
        Para os <a href={href({ name: 'small-bodies' })}>26 pequenos corpos</a> da aplicação guardámos elementos osculadores
        heliocêntricos do JPL Horizons (que integra as órbitas com as efemérides DE441 e as soluções da Small-Body Database)
        de 20 em 20 anos, entre 1806 e 2046. Para os corpos com encontros próximos com planetas ou com forças não
        gravitacionais importantes (Itokawa, Ryugu, Bennu, Apophis, Didymos e os cometas Encke, Tempel 1, 67P e Wild 2)
        acrescentámos épocas de 5 em 5 anos entre 1991 e 2041; para os objetos interestelares, épocas à volta da passagem
        pelo periélio. Antes de serem usados, todos os elementos passam uma verificação de coerência interna (semieixo,
        afélio, período, movimento médio e anomalias), que deteta erros de transcrição.
      </p>
      <p>
        Para uma data, a aplicação usa a época mais próxima e propaga a órbita como problema de dois corpos (elíptico ou
        hiperbólico). A tabela compara, no próprio navegador, essa posição com posições do Horizons em datas a meio caminho
        entre épocas, que é o pior caso.
      </p>
      <LoadState state={state} retry={retry} loading="A calcular…" error="Os dados não carregaram." retryLabel="Tentar de novo" />
      {data ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Objeto</th>
                <th scope="col" className="num">Datas comparadas</th>
                <th scope="col" className="num">Maior diferença vista do Sol</th>
                <th scope="col" className="num">Maior diferença de posição</th>
              </tr>
            </thead>
            <tbody>
              {SMALL_BODIES.map((b) => {
                const err = validationError(data, b.id);
                return (
                  <tr key={b.id}>
                    <th scope="row">
                      <a href={href({ name: 'small-body', slug: b.slug })}>{b.name}</a>
                    </th>
                    <td className="num">{data.validation[b.id]?.length ?? 0}</td>
                    <td className="num">{err.deg < 0.1 ? `${formatNumber(err.deg * 60, 1)}′` : `${formatNumber(err.deg, 2)}°`}</td>
                    <td className="num">{formatNumber(err.au, 4)} UA</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="section-note">
        Os objetos distantes têm um erro quase constante de cerca de 0,03 UA: os elementos heliocêntricos oscilam com o
        movimento do Sol à volta do centro de massa do Sistema Solar (dominado por Júpiter), e a propagação de dois corpos à
        volta do Sol não o reproduz. Os maiores erros angulares aparecem nos cometas da família de Júpiter (Tempel 1 em 2034,
        depois de uma aproximação a Júpiter) e nas datas anteriores a 1991, onde só há épocas de 20 em 20 anos. Os dados
        físicos vêm da SBDB, que indica a referência original de cada valor; quando a SBDB não tem o valor (tamanho dos
        planetas anões transneptunianos e dos objetos interestelares), usámos as páginas da NASA ou os artigos citados na ficha.
      </p>
    </section>
  );
}
