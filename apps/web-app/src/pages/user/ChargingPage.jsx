import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChargerById as getPoint } from '../../services/chargers';
import { getSessions } from '../../services/analytics';
import './ChargingPage.module.css';

const formatDateInput = (date) => date.toISOString().slice(0, 10);

const parseTimestamp = (value) => {
  if (!value) return null;
  const [datePart, timePart = '00:00'] = String(value).split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return null;
  const [hours, minutes] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
};

const formatDuration = (start, end) => {
  const startDate = parseTimestamp(start);
  const endDate = parseTimestamp(end);
  if (!startDate || !endDate) return '—';
  const diffMs = Math.max(0, endDate - startDate);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return value ?? '—';
  return `€${num.toFixed(2)}`;
};

const getSessionUserId = (session) => {
  if (!session) return null;
  if (session.user && typeof session.user === 'object') {
    return session.user.id ?? session.user.userId ?? null;
  }
  return session.userid ?? session.userId ?? session.user_id ?? session.user ?? null;
};

const filterSessionsForUser = (data, userId) => {
  if (!userId) return data;
  const hasUserData = data.some((s) => getSessionUserId(s) != null);
  if (!hasUserData) return data;
  return data.filter((s) => String(getSessionUserId(s)) === String(userId));
};

const ChargingPage = ({ reservation, user }) => {
  const navigate = useNavigate();
  const [pointId, setPointId] = useState(reservation?.pointId ? String(reservation.pointId) : '');
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return formatDateInput(date);
  });
  const [to, setTo] = useState(() => formatDateInput(new Date()));
  const [point, setPoint] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);

  const loadData = async (id = pointId) => {
    const targetId = String(id || '').trim();
    if (!targetId) {
      setError('Select a point ID to load charging data.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
      const toDate = to ? new Date(`${to}T23:59:59`) : undefined;
      const [pointData, sessionData] = await Promise.all([
        getPoint(targetId),
        getSessions({ pointId: targetId, from: fromDate, to: toDate }),
      ]);
      setPoint(pointData);
      const normalizedSessions = Array.isArray(sessionData) ? sessionData : [];
      setSessions(filterSessionsForUser(normalizedSessions, user?.id));
    } catch (err) {
      setError(err.message || 'Failed to load charging data');
      setPoint(null);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true, state: { message: 'Login to view charging sessions.' } });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (reservation?.pointId) {
      const nextId = String(reservation.pointId);
      setPointId(nextId);
      loadData(nextId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation?.pointId]);

  const latestSession = useMemo(() => {
    const normalized = sessions
      .map((s) => ({
        ...s,
        _start: parseTimestamp(s.starttime || s.startTime),
      }))
      .filter((s) => s._start);
    normalized.sort((a, b) => b._start - a._start);
    return normalized[0] || null;
  }, [sessions]);

  const sessionList = useMemo(() => {
    const normalized = sessions
      .map((s, index) => ({
        ...s,
        _key: `${s.starttime || s.startTime || 'session'}-${s.endtime || s.endTime || index}`,
        _start: parseTimestamp(s.starttime || s.startTime),
      }))
      .filter((s) => s._start);
    normalized.sort((a, b) => b._start - a._start);
    return normalized;
  }, [sessions]);

  const chargePercent = useMemo(() => {
    const raw = latestSession?.endsoc ?? latestSession?.startsoc ?? null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
  }, [latestSession]);

  const energyUsed = latestSession?.totalkwh != null ? `${latestSession.totalkwh} kWh` : '—';
  const duration = formatDuration(latestSession?.starttime, latestSession?.endtime);
  const cost = latestSession?.amount != null ? formatCurrency(latestSession.amount) : '—';
  const status = point?.status || reservation?.status || '—';
  const reservationEnd = point?.reservationEndTime || reservation?.reservationEndTime || '—';
  const price = point?.price != null ? `${formatCurrency(point.price)}/kWh` : '—';
  const capacity = point?.capacityKw ? `${point.capacityKw} kW` : '—';

  const handleSubmit = (event) => {
    event.preventDefault();
    loadData();
  };

  if (!user) return null;

  return (
    <section className="charging-page">
      <div className="charging-shell">
        <div className="charging-card">
          <header className="charging-header">
            <h1>Charging</h1>
            <p>Live point status and past sessions fetched from the IonOS backend.</p>
          </header>

          <div className="charging-body">
            <form className="toolbar" onSubmit={handleSubmit}>
              <div className="form-group small">
                <label htmlFor="pointId">Point ID</label>
                <input
                  id="pointId"
                  type="text"
                  value={pointId}
                  onChange={(event) => setPointId(event.target.value)}
                  placeholder="e.g., 12"
                  required
                />
              </div>
              <div className="form-group small">
                <label htmlFor="from">From</label>
                <input
                  id="from"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  required
                />
              </div>
              <div className="form-group small">
                <label htmlFor="to">To</label>
                <input
                  id="to"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  required
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Loading...' : 'Refresh data'}
              </button>
            </form>

            {error && <div className="alert alert-error">{error}</div>}

            <div
              className="progress-ring"
              style={{ '--progress': `${chargePercent}%` }}
              role="img"
              aria-label={`Battery at ${chargePercent}%`}
            >
              <div className="progress-value">
                <span className="progress-number">{chargePercent}%</span>
                <span className="progress-label">Charged</span>
              </div>
            </div>

            <div className="charging-stats">
              <div className="stat-box">
                <span className="stat-label">Energy Used</span>
                <span className="stat-value">{energyUsed}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Duration</span>
                <span className="stat-value">{duration}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Cost</span>
                <span className="stat-value">{cost}</span>
              </div>
            </div>

            <div className="charging-stats">
              <div className="stat-box">
                <span className="stat-label">Status</span>
                <span className="stat-value">{status}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Price</span>
                <span className="stat-value">{price}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Power</span>
                <span className="stat-value">{capacity}</span>
              </div>
            </div>

            <section>
              <h2>Past Sessions</h2>
              <div className="session-list">
                {loading && <div className="loading">Loading sessions...</div>}
                {!loading && sessionList.length === 0 && (
                  <div className="muted session-empty">No sessions found for the selected range.</div>
                )}
                {!loading &&
                  sessionList.map((s, index) => {
                    const key = s._key || `${s.starttime}-${s.endtime}-${index}`;
                    const isOpen = expandedKey === key;
                    return (
                      <div key={key} className="session-card">
                        <div className="session-card-header">
                          <div>
                            <p className="eyebrow">Session</p>
                            <h3>{s.starttime || s.startTime || '—'}</h3>
                            <p className="muted">Ends: {s.endtime || s.endTime || '—'}</p>
                          </div>
                          <div className="session-card-actions">
                            <span className="badge">{s.amount != null ? formatCurrency(s.amount) : '—'}</span>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setExpandedKey(isOpen ? null : key)}
                            >
                              {isOpen ? 'Hide details' : 'View details'}
                            </button>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="session-card-details">
                            <div className="session-detail-grid">
                              <div className="session-detail">
                                <span className="detail-label">Start SoC</span>
                                <span className="detail-value">{s.startsoc ?? '—'}</span>
                              </div>
                              <div className="session-detail">
                                <span className="detail-label">End SoC</span>
                                <span className="detail-value">{s.endsoc ?? '—'}</span>
                              </div>
                              <div className="session-detail">
                                <span className="detail-label">Energy (kWh)</span>
                                <span className="detail-value">{s.totalkwh ?? '—'}</span>
                              </div>
                              <div className="session-detail">
                                <span className="detail-label">Price (€ / kWh)</span>
                                <span className="detail-value">{s.kwhprice ?? '—'}</span>
                              </div>
                              <div className="session-detail">
                                <span className="detail-label">Amount (€)</span>
                                <span className="detail-value">{s.amount ?? '—'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          </div>
        </div>

        <div className="charging-status">
          {pointId ? `Point ${pointId} • Reservation ends: ${reservationEnd}` : 'Select a point to view status.'}
        </div>
      </div>
    </section>
  );
};

export default ChargingPage;
