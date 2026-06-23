import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import ChargerMap from '../../components/map/ChargerMap';
import { getChargers } from '../../services/chargers';
import { APP_ROUTES } from '../../config/routes';
import styles from './MapPage.module.css';

const DEFAULT_CENTER = { lat: 37.9838, lon: 23.7275 };
const DEFAULT_RADIUS_KM = 8;
const DEFAULT_LOCATION_QUERY = 'Athens';
const GEOCODER_URL = import.meta.env.VITE_GEOCODER_URL || 'https://nominatim.openstreetmap.org/search';

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'available', label: 'Available' },
  { value: 'charging', label: 'Charging' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'malfunction', label: 'Out of service' },
  { value: 'offline', label: 'Offline' },
];

const toRadians = (value) => (value * Math.PI) / 180;

const hasCoordinates = (charger) => (
  Number.isFinite(Number(charger?.latitude)) &&
  Number.isFinite(Number(charger?.longitude))
);

const getDistanceKm = (from, to) => {
  if (!from || !to) return null;

  const lat1 = Number(from.lat);
  const lon1 = Number(from.lon);
  const lat2 = Number(to.lat);
  const lon2 = Number(to.lon);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const statusMatches = (chargerStatus, selectedStatus) => {
  if (!selectedStatus) return true;

  const normalized = normalizeStatus(chargerStatus);
  const selected = normalizeStatus(selectedStatus);

  if (selected === 'charging') {
    return normalized === 'charging' || normalized === 'occupied';
  }

  if (selected === 'malfunction') {
    return ['malfunction', 'malfunctioning', 'outoforder', 'out_of_order'].includes(normalized);
  }

  return normalized === selected;
};

const MapPage = ({ onSelect }) => {
  const navigate = useNavigate();
  const { user, isAdmin, isProvider } = useAuth();
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState(DEFAULT_LOCATION_QUERY);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapPickMode, setMapPickMode] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locating, setLocating] = useState(false);

  const isReadOnlyMap = isAdmin || isProvider;

  const loadChargers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const raw = await getChargers();
      setChargers(raw);
    } catch (err) {
      console.error('Map initialization failed', err);
      setError(err.message || 'Failed to load chargers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChargers();
  }, [loadChargers]);

  const visibleChargers = useMemo(() => {
    const radiusValue = Number(radiusKm) > 0 ? Number(radiusKm) : DEFAULT_RADIUS_KM;

    return chargers
      .filter((charger) => {
        if (!isProvider || !user?.providerName) return true;
        return String(charger.providerName || '').toLowerCase() === String(user.providerName).toLowerCase();
      })
      .filter((charger) => statusMatches(charger.status, status))
      .filter(hasCoordinates)
      .filter((charger) => {
        const distance = getDistanceKm(mapCenter, {
          lat: charger.latitude,
          lon: charger.longitude,
        });

        return distance != null && distance <= radiusValue;
      });
  }, [chargers, isProvider, mapCenter, radiusKm, status, user?.providerName]);

  const handleReserve = (charger) => {
    if (isReadOnlyMap) return;
    onSelect?.(charger);
    navigate(APP_ROUTES.reserve);
  };

  const handleLocationSearchSubmit = async (event) => {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setGeoError('Type a location and press Enter to set the map center.');
      return;
    }

    setMapPickMode(false);
    setSearchingLocation(true);
    setGeoError(null);

    try {
      const url = `${GEOCODER_URL}?format=json&countrycodes=gr&limit=1&q=${encodeURIComponent(trimmedQuery)}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });

      if (!response.ok) {
        throw new Error('Search service unavailable');
      }

      const results = await response.json();
      const place = Array.isArray(results) ? results[0] : null;
      const lat = Number(place?.lat);
      const lon = Number(place?.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        setGeoError('No location found. Try another place and press Enter again.');
        return;
      }

      setMapCenter({ lat, lon });
    } catch (err) {
      console.error('Location search failed', err);
      setGeoError('Could not search this location right now. Please try again.');
    } finally {
      setSearchingLocation(false);
    }
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.');
      return;
    }

    setMapPickMode(false);
    setLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords || {};

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          setMapCenter({ lat: latitude, lon: longitude });
        } else {
          setGeoError('Location data is unavailable.');
        }

        setLocating(false);
      },
      () => {
        setGeoError('Unable to access your location. Check permissions and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handlePickCenter = ({ lat, lon }) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setMapCenter({ lat, lon });
    setMapPickMode(false);
    setGeoError(null);
  };

  const handleReset = () => {
    setQuery(DEFAULT_LOCATION_QUERY);
    setStatus('');
    setRadiusKm(DEFAULT_RADIUS_KM);
    setMapCenter(DEFAULT_CENTER);
    setMapPickMode(false);
    setGeoError(null);
    setError(null);
    void loadChargers();
  };

  const radiusValue = Number(radiusKm) > 0 ? Number(radiusKm) : DEFAULT_RADIUS_KM;
  const eyebrow = isAdmin ? 'System Monitoring' : isProvider ? 'Fleet Overview' : 'Global Network';
  const title = isAdmin ? 'Infrastructure Oversight' : isProvider ? 'My Network' : 'Infrastructure Hub';
  const description = isAdmin
    ? 'Monitor the next generation of smart energy. View real-time status and telemetry across the saasPlug ecosystem.'
    : isProvider
    ? 'Monitor your charging fleet in real-time. View live status and telemetry across all your registered stations.'
    : 'Navigate the next generation of smart energy. Locate, monitor, and reserve premium charging points across the saasPlug ecosystem in real-time.';

  const emptyMessage = `No chargers found within ${radiusValue} km. Change center, status, or radius.`;

  return (
    <section className={styles.mapPage}>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={styles.header}
      >
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </motion.header>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <form className={`${styles.formGroup} ${styles.mapSearchGroup}`} onSubmit={handleLocationSearchSubmit}>
            <label htmlFor="map-location-query">Location</label>
            <input
              id="map-location-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={searchingLocation}
              placeholder="Athens, Thessaloniki, Patra"
            />
            <small className={styles.mapControlHint}>
              {searchingLocation ? 'Searching location...' : 'Press Enter to set the map center.'}
            </small>
          </form>

          <div className={`${styles.formGroup} ${styles.small}`}>
            <label htmlFor="map-radius">Radius</label>
            <div className={styles.rangeRow}>
              <input
                id="map-radius"
                type="range"
                min="2"
                max="50"
                step="1"
                value={radiusValue}
                onChange={(event) => setRadiusKm(Number(event.target.value))}
              />
              <span className={styles.rangeValue}>{radiusValue} km</span>
            </div>
          </div>

          <div className={`${styles.formGroup} ${styles.small}`}>
            <label htmlFor="map-status">Status</label>
            <select id="map-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={`${styles.button} ${mapPickMode ? styles.primaryButton : styles.secondaryButton} ${styles.mapCenterToggle}`}
            onClick={() => {
              setMapPickMode((current) => !current);
              setGeoError(null);
            }}
          >
            {mapPickMode ? 'Center picker: ON' : 'Pick center on map'}
          </button>

          <button
            type="button"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={handleUseLocation}
            disabled={locating}
          >
            {locating ? 'Locating...' : 'Use my location'}
          </button>

          <button
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={loadChargers}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={handleReset}
          >
            Reset
          </button>
        </div>

        {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}
        {geoError && <div className={`${styles.alert} ${styles.alertError}`}>{geoError}</div>}
        {mapPickMode && (
          <div className={`${styles.alert} ${styles.mapCenterHint}`}>
            Click anywhere on the map to set the filter center.
          </div>
        )}

        <ChargerMap
          chargers={visibleChargers}
          loading={loading}
          onReserve={handleReserve}
          isAdmin={isReadOnlyMap}
          center={mapCenter}
          radiusKm={radiusValue}
          pickMode={mapPickMode}
          onPickCenter={handlePickCenter}
          emptyMessage={emptyMessage}
        />

        {!loading && (
          <div className={styles.loading}>
            Showing {visibleChargers.length} of {chargers.length} synced chargers.
          </div>
        )}
      </div>
    </section>
  );
};

export default MapPage;
