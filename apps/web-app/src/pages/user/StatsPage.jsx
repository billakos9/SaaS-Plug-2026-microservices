import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats } from '../../services/analytics';
import './StatsPage.module.css';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const VIEW_MODE = {
  SEMESTER: 'semester',
  ALL_TIME: 'all_time',
};

const emptyOverview = () => ({
  userEmail: '',
  username: '',
  totalEnergyKWh: 0,
  avgSessionMinutes: 0,
  totalSessions: 0,
});

const formatDateParam = (date) => {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getSemesterInfo = (sourceDate) => {
  const date = new Date(sourceDate);
  const year = date.getFullYear();
  const month = date.getMonth();
  const isFirstSemester = month <= 5;

  if (isFirstSemester) {
    return {
      label: `Jan - Jun ${year}`,
      key: `S1-${year}`,
      start: new Date(year, 0, 1),
      end: new Date(year, 5, 30),
    };
  }

  return {
    label: `Jul - Dec ${year}`,
    key: `S2-${year}`,
    start: new Date(year, 6, 1),
    end: new Date(year, 11, 31),
  };
};

const getPreviousSemesterInfo = (currentSemester) => {
  const previousDay = new Date(currentSemester.start);
  previousDay.setDate(previousDay.getDate() - 1);
  return getSemesterInfo(previousDay);
};

const toMonthLabel = (value) => {
  const [year, month] = String(value ?? '').split('-');
  const monthIndex = Number(month) - 1;
  if (!year || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return String(value ?? '—');
  }
  return `${MONTH_LABELS[monthIndex]} '${year.slice(2)}`;
};

const formatNumber = (value, suffix = '') => {
  const num = Number(value);
  if (!Number.isFinite(num)) return `0${suffix}`;
  return `${num.toFixed(1)}${suffix}`;
};

const SessionsStatsPage = ({ user }) => {
  const navigate = useNavigate();
  const [pointId, setPointId] = useState('');
  const [viewMode, setViewMode] = useState(VIEW_MODE.ALL_TIME);
  const [dashboard, setDashboard] = useState({
    mode: VIEW_MODE.ALL_TIME,
    allTime: {
      overview: emptyOverview(),
      trends: [],
    },
    currentSemester: null,
    previousSemester: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true, state: { message: 'Login to view your statistics.' } });
    }
  }, [user, navigate]);

  const loadStats = async (mode = viewMode) => {
    setLoading(true);
    setError(null);
    try {
      const normalizedPointId = String(pointId || '').trim() || undefined;

      if (mode === VIEW_MODE.SEMESTER) {
        const currentSemester = getSemesterInfo(new Date());
        const previousSemester = getPreviousSemesterInfo(currentSemester);

        const [currentData, previousData] = await Promise.all([
          getDashboardStats({
            pointId: normalizedPointId,
            from: formatDateParam(currentSemester.start),
            to: formatDateParam(currentSemester.end),
          }),
          getDashboardStats({
            pointId: normalizedPointId,
            from: formatDateParam(previousSemester.start),
            to: formatDateParam(previousSemester.end),
          }),
        ]);

        setDashboard({
          mode: VIEW_MODE.SEMESTER,
          allTime: null,
          currentSemester: {
            ...currentSemester,
            data: currentData,
          },
          previousSemester: {
            ...previousSemester,
            data: previousData,
          },
        });
      } else {
        const allTimeData = await getDashboardStats({
          pointId: normalizedPointId,
        });

        setDashboard({
          mode: VIEW_MODE.ALL_TIME,
          allTime: allTimeData,
          currentSemester: null,
          previousSemester: null,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load statistics');
      setDashboard({
        mode,
        allTime: {
          overview: emptyOverview(),
          trends: [],
        },
        currentSemester: null,
        previousSemester: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadStats(VIEW_MODE.ALL_TIME);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const stats = useMemo(() => {
    if (viewMode === VIEW_MODE.SEMESTER) {
      const currentOverview = dashboard.currentSemester?.data?.overview || emptyOverview();
      const previousOverview = dashboard.previousSemester?.data?.overview || emptyOverview();
      const hasCurrentSessions = Number(currentOverview.totalSessions) > 0;
      const hasPreviousSessions = Number(previousOverview.totalSessions) > 0;

      return [
        {
          label: 'User',
          value:
            currentOverview.username ||
            user?.username ||
            user?.name ||
            currentOverview.userEmail ||
            user?.email ||
            '—',
        },
        {
          label: 'Point Filter',
          value: String(pointId || '').trim() || 'All points',
        },
        {
          label: 'Current Semester',
          value: dashboard.currentSemester?.label || '—',
        },
        {
          label: 'Current Sessions',
          value: String(Number(currentOverview.totalSessions) || 0),
        },
        {
          label: 'Current Energy',
          value: `${formatNumber(currentOverview.totalEnergyKWh)} kWh`,
        },
        {
          label: 'Current Avg Time',
          value: hasCurrentSessions
            ? `${Math.round(Number(currentOverview.avgSessionMinutes) || 0)} min`
            : '—',
        },
        {
          label: 'Previous Semester',
          value: dashboard.previousSemester?.label || '—',
        },
        {
          label: 'Previous Sessions',
          value: String(Number(previousOverview.totalSessions) || 0),
        },
        {
          label: 'Previous Energy',
          value: `${formatNumber(previousOverview.totalEnergyKWh)} kWh`,
        },
        {
          label: 'Previous Avg Time',
          value: hasPreviousSessions
            ? `${Math.round(Number(previousOverview.avgSessionMinutes) || 0)} min`
            : '—',
        },
      ];
    }

    const overview = dashboard?.allTime?.overview || emptyOverview();
    const hasSessions = Number(overview.totalSessions) > 0;
    return [
      {
        label: 'User',
        value:
          overview.username || user?.username || user?.name || overview.userEmail || user?.email || '—',
      },
      {
        label: 'Email',
        value: overview.userEmail || user?.email || '—',
      },
      {
        label: 'Range',
        value: 'From first session until now',
      },
      {
        label: 'Total Sessions',
        value: String(Number(overview.totalSessions) || 0),
      },
      {
        label: 'Energy Delivered',
        value: `${formatNumber(overview.totalEnergyKWh)} kWh`,
      },
      {
        label: 'Avg. Session Time',
        value: hasSessions ? `${Math.round(Number(overview.avgSessionMinutes) || 0)} min` : '—',
      },
      {
        label: 'Point Filter',
        value: String(pointId || '').trim() || 'All points',
      },
    ];
  }, [dashboard, pointId, user, viewMode]);

  const trendData = useMemo(() => {
    if (viewMode === VIEW_MODE.SEMESTER) {
      const previous = dashboard.previousSemester;
      const current = dashboard.currentSemester;
      return [
        {
          month: previous?.label || 'Previous',
          rawMonth: previous?.key || 'previous',
          kwh: Number(previous?.data?.overview?.totalEnergyKWh) || 0,
        },
        {
          month: current?.label || 'Current',
          rawMonth: current?.key || 'current',
          kwh: Number(current?.data?.overview?.totalEnergyKWh) || 0,
        },
      ];
    }

    return (Array.isArray(dashboard?.allTime?.trends) ? dashboard.allTime.trends : []).map((entry) => ({
      month: toMonthLabel(entry.month),
      rawMonth: entry.month,
      kwh: Number(entry.energyKWh) || 0,
    }));
  }, [dashboard, viewMode]);

  const maxTrendValue = Math.max(1, ...trendData.map((m) => m.kwh));

  const handleModeToggle = (mode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    loadStats(mode);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    loadStats(viewMode);
  };

  if (!user) return null;

  return (
    <section className="sessions-stats-page">
      <div className="sessions-background" aria-hidden="true" />
      <div className="sessions-container">
        <header className="sessions-header">
          <h1>Statistics</h1>
          <p>Statistics for your charging sessions. Data is fetched from the IonOS backend.</p>
        </header>

        <section className="sessions-section">
          <h2>Filters</h2>
          <p className="sessions-subtitle">
            Pick the timeframe with toggle. Date selection is automatic and stats stay per logged-in user.
          </p>

          <form className="sessions-form" onSubmit={handleSubmit}>
            <label className="form-field">
              Point ID (optional)
              <input
                type="text"
                value={pointId}
                onChange={(event) => setPointId(event.target.value)}
                placeholder="e.g., 12"
              />
            </label>
            <div className="form-field">
              <span>Timeframe</span>
              <div className="view-toggle" role="group" aria-label="Statistics timeframe">
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === VIEW_MODE.SEMESTER ? 'active' : ''}`}
                  onClick={() => handleModeToggle(VIEW_MODE.SEMESTER)}
                >
                  By Semester
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === VIEW_MODE.ALL_TIME ? 'active' : ''}`}
                  onClick={() => handleModeToggle(VIEW_MODE.ALL_TIME)}
                >
                  From First Session
                </button>
              </div>
            </div>
            <button type="submit" className="apply-btn" disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </form>

          {error && <div className="sessions-results">{error}</div>}
        </section>

        <section className="sessions-section">
          <h2>Statistics Overview</h2>
          <div className="stats-grid">
            {stats.map((stat, index) => (
              <div className="stat-card" key={`${stat.label}-${index}`} style={{ '--delay': `${index * 0.05}s` }}>
                <span className="stat-card-label">{stat.label}</span>
                <span className="stat-card-value">{stat.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="sessions-section">
          <h2>Energy Trends</h2>
          <div className="trend-card">
            <div className="trend-bars">
              {trendData.length === 0 && !loading && (
                <div className="sessions-results">No trend data available for this user.</div>
              )}
              {trendData.map((entry, index) => (
                <div
                  className="trend-bar"
                  key={`${entry.rawMonth}-${index}`}
                  style={{ height: `${(entry.kwh / maxTrendValue) * 100}%` }}
                  title={`${entry.rawMonth}: ${entry.kwh} kWh`}
                />
              ))}
            </div>
            <div className="trend-caption">
              {viewMode === VIEW_MODE.SEMESTER
                ? 'Energy grouped by semester (kWh)'
                : 'Energy delivered per month (kWh)'}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};

export default SessionsStatsPage;

// Optional enhancements
// - Animated number counters: use a hook (e.g., react-countup) to animate stat values after data loads.
// - Mini line chart: replace the trend placeholder with Chart.js and feed it monthly energy data.
// - Hover tooltips: add an info icon per card and show a tooltip component with metric definitions.
