import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChargerMap from '../../components/map/ChargerMap';
import { getChargers } from '../../services/chargers';
import styles from './MapPage.module.css';

const DEFAULT_CENTER = [37.9838, 23.7275];
const DEFAULT_ZOOM = 11;
const DEFAULT_RADIUS_KM = 8;
const DEFAULT_LOCATION_QUERY = 'Athens';
const GEOCODER_URL =
  import.meta.env.VITE_GEOCODER_URL || 'https://nominatim.openstreetmap.org/search';

const toRadians = (value) => (value * Math.PI) / 180;

const getDistanceKm = (from, to) => {
  if (!from || !to) return null;

  const lat1 = Number(from.lat);
  const lon1 = Number(from.lon);
  const lat2 = Number(to.lat);
  const lon2 = Number(to.lon);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const earthRadius = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const MapPage = ({ onSelect }) => {
  const [chargers, setChargers] = useState([]);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState(DEFAULT_LOCATION_QUERY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [mapCenter, setMapCenter] = useState({
    lat: DEFAULT_CENTER[0],
    lon: DEFAULT_CENTER[1],
  });
  const [locating, setLocating] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [mapPickMode, setMapPickMode] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const mapRef = useRef(null);
  const navigate = useNavigate();

  const loadChargers = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getChargers({
        status: status || undefined,
      });
      setChargers(data);
    } catch (err) {
      setError(err.message || 'Could not load chargers right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChargers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
          mapRef.current?.flyTo([latitude, longitude], 13);
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

  const applyLocationSearch = async () => {
    const trimmed = query.trim();

    if (!trimmed) {
      setGeoError('Type a location and press Enter to set the center.');
      return;
    }

    setMapPickMode(false);
    setSearchingLocation(true);
    setGeoError(null);

    try {
      const url = `${GEOCODER_URL}?format=json&countrycodes=gr&limit=1&q=${encodeURIComponent(
        trimmed
      )}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) throw new Error('Search service unavailable');

      const data = await response.json();
      const place = Array.isArray(data) ? data[0] : null;

      if (!place) {
        setGeoError('No location found. Try another place and press Enter again.');
        return;
      }

      const lat = Number(place.lat);
      const lon = Number(place.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        setGeoError('Location coordinates are unavailable for this search.');
        return;
      }

      setMapCenter({ lat, lon });
      mapRef.current?.flyTo([lat, lon], 12);
    } catch {
      setGeoError('Could not search this location right now. Please try again.');
    } finally {
      setSearchingLocation(false);
    }
  };

  const handleLocationSearchSubmit = (event) => {
    event.preventDefault();
    void applyLocationSearch();
  };

  const handleCenterPick = ({ lat, lon }) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    setMapCenter({ lat, lon });
    setGeoError(null);
    setMapPickMode(false);
  };

  const radiusValue = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : DEFAULT_RADIUS_KM;

  const visibleChargers = useMemo(() => {
    if (!mapCenter) return chargers;

    return chargers.filter((charger) => {
      const distance = getDistanceKm(
        { lat: mapCenter.lat, lon: mapCenter.lon },
        { lat: charger.latitude, lon: charger.longitude }
      );

      if (distance == null) return false;
      return distance <= radiusValue;
    });
  }, [chargers, mapCenter, radiusValue]);

  const chargersWithCoordinates = useMemo(
    () =>
      visibleChargers.filter(
        (charger) => Number.isFinite(charger.latitude) && Number.isFinite(charger.longitude)
      ),
    [visibleChargers]
  );

  const handleReserve = (charger) => {
    onSelect?.(charger);
    navigate('/reserve');
  };

  const resetView = () => {
    setQuery(DEFAULT_LOCATION_QUERY);
    setStatus('');
    setMapPickMode(false);
    setGeoError(null);
    setMapCenter({
      lat: DEFAULT_CENTER[0],
      lon: DEFAULT_CENTER[1],
    });
    mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    void loadChargers();
  };

  return (
    <section className={styles.card}>
      <h2>Map View - Charger Details</h2>
      <p className={styles.muted}>
        The center changes only when you press Enter on location search, use your location, or
        enable map center pick mode.
      </p>

      <div className={styles.toolbar}>
        <form className={`${styles.formGroup} ${styles.mapSearchGroup}`} onSubmit={handleLocationSearchSubmit}>
          <label htmlFor="query">Search address, region, or municipality</label>
          <input
            id="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={searchingLocation}
            placeholder="e.g., Athens, Thessaloniki, Patra"
          />
          <small className={styles.mapControlHint}>
            {searchingLocation ? 'Searching location...' : 'Press Enter to set the map center.'}
          </small>
        </form>

        <div className={`${styles.formGroup} ${styles.small}`}>
          <label htmlFor="radius">Radius (km)</label>
          <div className={styles.rangeRow}>
            <input
              id="radius"
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
          <label htmlFor="status">Status</label>
          <select id="status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Any</option>
            <option value="available">Available</option>
            <option value="charging">Charging</option>
            <option value="reserved">Reserved</option>
            <option value="malfunction">Out of service</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        <button
          type="button"
          className={`${styles.button} ${mapPickMode ? styles.primaryButton : styles.secondaryButton} ${styles.mapCenterToggle}`}
          onClick={() => {
            setMapPickMode((prev) => !prev);
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
          {loading ? 'Loading...' : 'Refresh points'}
        </button>

        <button
          type="button"
          className={`${styles.button} ${styles.secondaryButton}`}
          onClick={resetView}
        >
          Reset view
        </button>
      </div>

      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}
      {geoError && <div className={`${styles.alert} ${styles.alertError}`}>{geoError}</div>}
      {mapPickMode && (
        <div className={`${styles.alert} ${styles.mapCenterHint}`}>
          Center picker is enabled. Click anywhere on the map to set the center.
        </div>
      )}

      <ChargerMap
        center={mapCenter}
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapRef={mapRef}
        radiusKm={radiusValue}
        chargers={chargersWithCoordinates}
        loading={loading}
        pickMode={mapPickMode}
        onCenterPick={handleCenterPick}
        onSelect={onSelect}
        onReserve={handleReserve}
      />

      {loading && <div className={styles.loading}>Fetching chargers...</div>}
    </section>
  );
};

export default MapPage;
