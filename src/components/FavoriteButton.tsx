import { useI18n } from '../i18n';
import { toggleFavorite, useFavorites } from '../state/userData';
import { Icon } from './Icon';

export function FavoriteButton({ id, withText = false }: { id: string; withText?: boolean }) {
  const { t } = useI18n();
  const favorites = useFavorites();
  const on = favorites.includes(id);
  const label = on ? t.panel.favoriteRemove : t.panel.favoriteAdd;
  return (
    <button
      type="button"
      className={`${withText ? 'btn btn--ghost' : 'icon-btn'} favorite-btn${on ? ' is-on' : ''}`}
      aria-pressed={on}
      aria-label={withText ? undefined : label}
      title={label}
      onClick={() => toggleFavorite(id)}
    >
      <Icon name="star" filled={on} size={withText ? 16 : 20} />
      {withText ? (on ? 'Nos favoritos' : 'Guardar nos favoritos') : null}
    </button>
  );
}
