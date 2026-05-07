import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChargers } from '../../services/chargers';
import { reserveCharger } from '../../services/reservations';
import './ReservePage.module.css';

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
      const result = await reserveCharger({
        chargerId,
        userId: user?.id || 'guest',
        minutes,
      });
      setMessage(
        result.status === 'reserved'
          ? `Reserved point ${result.pointId} until ${result.reservationEndTime}`
          : `Could not reserve. Current status: ${result.status}`
      );
      onReserved?.(result);
    } catch (err) {
      setError(err.message || 'Reservation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Reserve Charger</h2>
      <p className="muted">
        SRS UC2 step 2–5: pick a charger and reserve a time window with payment pre-auth logic mocked.
      </p>

      <form onSubmit={handleSubmit} className="stack">
        <div className="form-group">
          <label htmlFor="query">Search by point, address, municipality</label>
          <input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Kλειδί, Ημαθίας or 101"
          />
        </div>

        <div className="form-group">
          <label htmlFor="charger">Charger *</label>
          <select
            id="charger"
            required
            value={chargerId}
            onChange={(e) => setChargerId(e.target.value)}
          >
            <option value="">Select charger</option>
            {groupedChargers.map((group) => (
              <optgroup
                key={group.key}
                label={`${group.town} - ${group.region} (${group.items.length})`}
              >
                {group.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    Point {c.id} — {c.provider} — {c.location || 'No address'}
                    {c.capacityKw ? ` — ${c.capacityKw} kW` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {!filteredChargers.length && (
            <div className="muted" style={{ marginTop: '0.5rem' }}>
              No chargers match your search.
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="minutes">Reservation minutes</label>
          <input
            id="minutes"
            type="number"
            min="10"
            max="60"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !chargerId}
        >
          {loading ? 'Reserving...' : 'Reserve'}
        </button>
      </form>
    </div>
  );
};

export default ReserveFlow;
