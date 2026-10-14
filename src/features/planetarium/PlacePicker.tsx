import { useEffect, useId, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { type Place, PLACES, deviceTimeZone, formatLatLon, formatUtcOffset, timeZoneOffsetMinutes } from './places';

export interface PlacePickerProps {
  place: Place;
  onChange: (p: Place) => void;
  date: Date;
  label?: string;
}

/** Escolha do lugar: lista de cidades, coordenadas personalizadas ou localização do dispositivo. */
export function PlacePicker({ place, onChange, date, label }: PlacePickerProps) {
  const { t } = useI18n();
  const tp = t.planetarium.place;
  const id = useId();
  const [lat, setLat] = useState(String(place.latDeg));
  const [lon, setLon] = useState(String(place.lonDeg));
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setLat(String(Math.round(place.latDeg * 10000) / 10000));
    setLon(String(Math.round(place.lonDeg * 10000) / 10000));
  }, [place.latDeg, place.lonDeg]);

  const isPreset = PLACES.some((p) => p.id === place.id);

  const applyCustom = (e: FormEvent) => {
    e.preventDefault();
    const la = Number(lat.replace(',', '.'));
    const lo = Number(lon.replace(',', '.'));
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180 || lat.trim() === '' || lon.trim() === '') {
      setError(tp.invalid);
      return;
    }
    setError(null);
    onChange({ id: 'custom', name: tp.customPlace, region: 'world', latDeg: la, lonDeg: lo, heightM: 0, timeZone: deviceTimeZone() });
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setError(tp.geoUnsupported);
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({
          id: 'mine',
          name: tp.myPlace,
          region: 'world',
          latDeg: pos.coords.latitude,
          lonDeg: pos.coords.longitude,
          heightM: pos.coords.altitude ?? 0,
          timeZone: deviceTimeZone(),
        });
      },
      () => {
        setLocating(false);
        setError(tp.geoDenied);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  };

  const offset = formatUtcOffset(timeZoneOffsetMinutes(date, place.timeZone));

  return (
    <div className="place-picker">
      <label className="field">
        <span className="field-label">{label ?? tp.select}</span>
        <select
          value={isPreset ? place.id : ''}
          onChange={(e) => {
            const p = PLACES.find((x) => x.id === e.target.value);
            if (p) onChange(p);
          }}
        >
          {!isPreset ? <option value="">{place.name}</option> : null}
          <optgroup label={tp.portugal}>
            {PLACES.filter((p) => p.region === 'pt').map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={tp.world}>
            {PLACES.filter((p) => p.region === 'world').map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <p className="place-coords">
        {formatLatLon(place.latDeg, place.lonDeg)} · {tp.timeZone(place.timeZone, offset)}
      </p>
      <button type="button" className="btn btn--small" onClick={locate} disabled={locating}>
        <Icon name="pin" size={16} />
        {locating ? tp.locating : tp.myLocation}
      </button>
      <details className="place-custom">
        <summary>{tp.custom}</summary>
        <form onSubmit={applyCustom} className="place-custom-form">
          <label className="field">
            <span className="field-label">{tp.lat}</span>
            <input id={`${id}-lat`} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">{tp.lon}</span>
            <input id={`${id}-lon`} inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} />
          </label>
          <button type="submit" className="btn btn--small">
            {tp.apply}
          </button>
          <p className="section-note">{tp.deviceTz}</p>
        </form>
      </details>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
