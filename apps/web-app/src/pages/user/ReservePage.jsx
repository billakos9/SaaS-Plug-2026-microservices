import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChargers } from '../../services/chargers';
import { createReservation } from '../../services/reservations';
import { APP_ROUTES } from '../../config/routes';
import styles from './ReservePage.module.css';

const mergeSelectedCharger = (list, selected) => {
  if (!selected?.id) return list;
  const selectedId = String(selected.id);
  const exists = list.some((charger) => String(charger.id) === selectedId);
  if (exists) return list;
  return [{ ...selected, id: selectedId }, ...list];
};

const stripAccents = (text) =>
  (text || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const getPointTown = (point) => {
  const raw = point?.raw || {};
  const town =
    raw.locality ||
    raw.town ||
    raw.municipality ||
    raw.city ||
    raw.region ||
    '';
  if (town) return String(town);
  if (point?.location) {
    const parts = String(point.location)
      .split(/\u2022/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts[1]) return parts[1];
    if (parts[0]) return parts[0];
  }
  return 'Other';
};

const getPointRegion = (point) => {
  const raw = point?.raw || {};
  const region = raw.name || raw.road || raw.location || '';
  if (region) return String(region);
  if (point?.location) {
    const first = String(point.location).split(/\u2022/)[0]?.trim();
    if (first) return first;
  }
  return 'Other';
};

const normalizeRegionName = (region, town) => {
  const cleaned = String(region || '').trim();
  if (!cleaned) return 'All points';
  if (stripAccents(cleaned) === stripAccents(town)) return 'All points';
  return cleaned;
};

const filterChargers = (items, query) => {
  const trimmed = String(query || '').trim();
  if (!trimmed) return items;
  const q = stripAccents(trimmed);
  return items.filter((p) => {
    const haystack = [
      p.id,
      p.provider,
      p.location,
      p.raw?.name,
      p.raw?.locality,
      p.raw?.road,
      p.raw?.location,
    ]
      .filter(Boolean)
      .map((value) => stripAccents(String(value)));
    return haystack.some((value) => value.includes(q));
  });
};

const groupChargers = (items) => {
  const groups = new Map();
  items.forEach((point) => {
    const town = getPointTown(point);
    const region = normalizeRegionName(getPointRegion(point), town);
    const key = `${town}::${region}`;
    if (!groups.has(key)) {
      groups.set(key, { key, town, region, items: [] });
    }
    groups.get(key).items.push(point);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.slice().sort((a, b) => {
        const aLabel = String(a.location || a.id || '');
        const bLabel = String(b.location || b.id || '');
        return aLabel.localeCompare(bLabel, 'en', { numeric: true });
      }),
    }))
    .sort((a, b) => {
      const townSort = a.town.localeCompare(b.town, 'en');
      if (townSort !== 0) return townSort;
      return a.region.localeCompare(b.region, 'en');
    });
};

const ReserveFlow = ({ selectedCharger, user, onReserved }) => {
  const [minutes, setMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate(APP_ROUTES.login, { replace: true, state: { message: 'Login to reserve chargers.' } });
      return;
    }
    if (!selectedCharger) {
        setError('Please select a charger from the map first.');
        return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const result = await createReservation({
        chargerId: selectedCharger.id,
        minutes,
      });
      
      const isSuccess = ['active', 'reserved'].includes(result.status);

      if (isSuccess) {
        // Instant redirect for better UX
        navigate(APP_ROUTES.charging);
      } else {
        setError(`Could not reserve. Current status: ${result.status}`);
      }
      
      onReserved?.(result);
    } catch (err) {
      setError(err.message || 'Reservation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.reserveContainer}>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>Reservation Hub</span>
        <h1>Secure a Station</h1>
        <p className={styles.muted}>
          Confirm your charging window. Our network will lock the selected station 
          exclusively for your vehicle.
        </p>
      </header>

      <div className={styles.reserveCard}>
        {!selectedCharger ? (
            <div className={styles.noSelection}>
                <div className={styles.emptyIcon}>📍</div>
                <h3>No Station Selected</h3>
                <p>Please return to the map to choose a charging station.</p>
                <button className={styles.submitBtn} onClick={() => navigate(APP_ROUTES.map)}>
                    Open Interactive Map
                </button>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className={styles.reserveForm}>
              <div className={styles.formGroup}>
                <label>Selected Station</label>
                <div className={styles.stationDisplay}>
                    <div className={styles.stationInfo}>
                        <strong className={styles.stationName}>{selectedCharger.locationName}</strong>
                        <span className={styles.stationMeta}>
                            {selectedCharger.providerName} • {selectedCharger.capacityKw}kW
                        </span>
                        <p className={styles.stationAddress}>{selectedCharger.address}</p>
                    </div>
                    <span className={styles.statusBadge}>Ready</span>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="minutes">Session Duration</label>
                <div className={styles.durationControl}>
                   <input
                    id="minutes"
                    className={styles.input}
                    type="number"
                    min="10"
                    max="120"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                  <span className={styles.unit}>min</span>
                </div>
                <p className={styles.formHelp}>Recommended: 30-60 mins for most vehicles.</p>
              </div>

              {message && <div className={styles.successAlert}>{message}</div>}
              {error && <div className={styles.errorAlert}>{error}</div>}

              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Confirm Reservation'}
                </button>
                <button 
                  type="button" 
                  className={styles.cancelLink}
                  onClick={() => navigate(APP_ROUTES.map)}
                >
                  Change Station
                </button>
              </div>
            </form>
        )}
      </div>
    </div>
  );
};

export default ReserveFlow;
