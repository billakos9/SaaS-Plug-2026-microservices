import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChargers } from '../../services/chargers';
import { createReservation } from '../../services/reservations';
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
  const [chargers, setChargers] = useState([]);
  const [chargerId, setChargerId] = useState(selectedCharger?.id ? String(selectedCharger.id) : '');
  const [query, setQuery] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadChargers();
  }, []);

  useEffect(() => {
    if (selectedCharger?.id) {
      setChargerId(String(selectedCharger.id));
      setChargers((prev) => mergeSelectedCharger(prev, selectedCharger));
    }
  }, [selectedCharger]);

  const loadChargers = async () => {
    try {
      const data = await getChargers({ status: 'available' });
      setChargers(mergeSelectedCharger(data, selectedCharger));
    } catch (err) {
      setError(err.message || 'Failed to load chargers');
    }
  };

  const filteredChargers = useMemo(() => {
    const filtered = filterChargers(chargers, query);
    if (!chargerId) return filtered;
    const selected = chargers.find((c) => String(c.id) === String(chargerId));
    if (!selected) return filtered;
    const hasSelected = filtered.some((c) => String(c.id) === String(chargerId));
    return hasSelected ? filtered : [selected, ...filtered];
  }, [chargers, query, chargerId]);

  const groupedChargers = useMemo(
    () => groupChargers(filteredChargers),
    [filteredChargers]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { replace: true, state: { message: 'Login to reserve chargers.' } });
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const result = await createReservation({
        chargerId,
        userId: user?.id || 'guest',
        minutes,
      });
      
      const isSuccess = ['active', 'reserved'].includes(result.status);

      if (isSuccess) {
        // Instant redirect for better UX
        navigate('/charging');
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
        <form onSubmit={handleSubmit} className={styles.reserveForm}>
          <div className={styles.formGroup}>
            <label htmlFor="query">Quick Search</label>
            <input
              id="query"
              className={styles.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Alimos, Marousi or Station ID"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="charger">Select Charger *</label>
            <select
              id="charger"
              className={styles.select}
              required
              value={chargerId}
              onChange={(e) => setChargerId(e.target.value)}
            >
              <option value="">Choose a point...</option>
              {groupedChargers.map((group) => (
                <optgroup
                  key={group.key}
                  label={`${group.town} - ${group.region}`}
                >
                  {group.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.locationName} — {c.capacityKw}kW ({c.providerName})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {!filteredChargers.length && query && (
              <div className={styles.formHelp}>No chargers match your search.</div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="minutes">Session Duration (Minutes)</label>
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
              disabled={loading || !chargerId}
            >
              {loading ? 'Processing...' : 'Confirm Reservation'}
            </button>
            <button 
              type="button" 
              className={styles.cancelLink}
              onClick={() => navigate('/map')}
            >
              Back to Map
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReserveFlow;
