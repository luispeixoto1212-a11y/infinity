import type { Route } from '../../app/router';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { openTour, useUi } from '../../state/ui';
import { markTourSeen, usePreferences, useTourSeen } from '../../state/userData';

/**
 * Oferta da visita guiada na primeira visita. Na vista 3D, enquanto o cartão "Como explorar" estiver visível,
 * a oferta aparece dentro dele, para não sobrepor dois cartões.
 */
export function TourOffer({ route }: { route: Route }) {
  const { t } = useI18n();
  const seen = useTourSeen();
  const { tourOpen } = useUi();
  const prefs = usePreferences();
  if (seen || tourOpen || (route.name === 'explore' && !prefs.hintDismissed)) return null;
  return (
    <aside className="tour-offer" aria-labelledby="tour-offer-title">
      <Icon name="star" size={20} aria-hidden="true" />
      <div>
        <h2 id="tour-offer-title">{t.tour.offerTitle}</h2>
        <p>{t.tour.offerText}</p>
        <div className="tour-offer-actions">
          <button type="button" className="btn btn--small" onClick={openTour}>
            {t.tour.offerStart}
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={markTourSeen}>
            {t.tour.offerDismiss}
          </button>
        </div>
      </div>
    </aside>
  );
}
