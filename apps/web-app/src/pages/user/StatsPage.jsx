import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyReservations } from '../../services/reservations';
import {
  getGlobalReport,
  getAllProvidersReport,
  getProviderReport,
  getGlobalHistory,
  getProviderHistory,
} from '../../services/analytics';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import styles from './StatsPage.module.css';

const StatCard = ({ label, value, unit, color, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    className={styles.statCard}
    style={{ borderBottom: `4px solid ${color || 'var(--primary)'}` }}
  >
    <p className={styles.statLabel}>{label}</p>
    <p className={styles.statValue}>
      {value} <span className={styles.statUnit}>{unit}</span>
    </p>
    <div className={styles.statGlow} style={{ background: color }} />
  </motion.div>
);

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const formatPeriodLabel = (period) => {
  if (!period || period.length < 7) return period;
  const [year, monthStr] = period.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  return `${MONTH_NAMES[monthIdx]} '${year.slice(2)}`;
};

const formatDuration = (seconds) => {
  if (!seconds) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

const StatsPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isProvider } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [providerStats, setProviderStats] = useState([]);
  const [providerReport, setProviderReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentPeriod = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showCount, setShowCount] = useState(8);

  const isAllTime = period === 'all';
  const [curYear, curMon] = useMemo(() => currentPeriod.split('-').map(Number), [currentPeriod]);
  const [selYear, selMon] = useMemo(
    () => isAllTime ? [null, null] : period.split('-').map(Number),
    [period, isAllTime],
  );
  const availableYears = useMemo(
    () => Array.from({ length: curYear - 2024 + 1 }, (_, i) => 2024 + i),
    [curYear],
  );
  const availableMonths = useMemo(() => {
    if (!selYear) return [];
    const minM = selYear === 2024 ? 6 : 1;
    const maxM = selYear === curYear ? curMon : 12;
    return MONTH_NAMES
      .map((name, i) => ({ name, num: i + 1 }))
      .filter(m => m.num >= minM && m.num <= maxM);
  }, [selYear, curYear, curMon]);

  const allTimeStats = useMemo(() => {
    if (!isAllTime || !history.length) return null;
    return history.reduce((acc, h) => ({
      totalReservations: acc.totalReservations + (h.totalReservations || 0),
      totalRevenue:      Math.round((acc.totalRevenue + (h.totalRevenue || 0)) * 100) / 100,
      totalEnergyKwh:   Math.round((acc.totalEnergyKwh + (h.totalEnergyKwh || 0)) * 100) / 100,
    }), { totalReservations: 0, totalRevenue: 0, totalEnergyKwh: 0 });
  }, [isAllTime, history]);

  const handleYearChange = useCallback((y) => {
    if (y === 'all') { setPeriod('all'); return; }
    const ny = Number(y);
    const minM = ny === 2024 ? 6 : 1;
    const maxM = ny === curYear ? curMon : 12;
    const base = selMon ?? minM;
    const nm = Math.max(minM, Math.min(base, maxM));
    setPeriod(`${ny}-${String(nm).padStart(2, '0')}`);
  }, [curYear, curMon, selMon]);

  const handleMonthChange = useCallback((m) => {
    setPeriod(`${selYear}-${String(Number(m)).padStart(2, '0')}`);
  }, [selYear]);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getMyReservations(user.id);
      const finished = data.filter(s => ['completed', 'cancelled'].includes(s.status));
      setSessions(finished);
    } catch {
      // silently fail — UI shows empty state
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchAdminData = useCallback(async (p) => {
    try {
      const [stats, providersResp] = await Promise.all([
        getGlobalReport(p),
        getAllProvidersReport(p),
      ]);
      setGlobalStats(stats);
      setProviderStats(providersResp?.providers || []);
    } catch {
      // silently fail — UI shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProviderData = useCallback(async (p) => {
    if (!user?.providerName) return;
    try {
      const report = await getProviderReport(user.providerName, p);
      setProviderReport(report);
    } catch {
      // silently fail — UI shows empty state
    } finally {
      setLoading(false);
    }
  }, [user?.providerName]);

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return; }
    const fetchPeriod = isAllTime ? currentPeriod : period;
    if (isAdmin) {
      fetchAdminData(fetchPeriod);
    } else if (isProvider) {
      fetchProviderData(fetchPeriod);
    } else {
      fetchUserData();
    }
  }, [user, isAdmin, isProvider, period, isAllTime, currentPeriod, navigate, fetchAdminData, fetchProviderData, fetchUserData]);

  useEffect(() => {
    if (!user) return;
    if (!isAdmin && !isProvider) return;
    setHistoryLoading(true);
    const fetchHistory = isAdmin
      ? getGlobalHistory()
      : getProviderHistory(user.providerName);
    fetchHistory
      .then((data) => {
        const arr = Array.isArray(data) ? data : (data?.history || []);
        setHistory(arr.map(item => ({
          ...item,
          label: formatPeriodLabel(item.period),
        })));
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [user, isAdmin, isProvider]);

  const overview = useMemo(() => {
    if (isAdmin || isProvider) return null;
    const total = sessions.length;
    const totalSeconds = sessions.reduce((acc, s) => acc + ((s.actualDurationSeconds ?? s.durationSeconds) ?? 0), 0);
    const energy = sessions.reduce((acc, s) => {
      const durationHrs = ((s.actualDurationSeconds ?? s.durationSeconds) ?? 0) / 3600;
      const kw = s.capacityKw || 22;
      return acc + (durationHrs * kw);
    }, 0);
    return {
      total,
      totalSeconds,
      avgSeconds: total > 0 ? Math.round(totalSeconds / total) : 0,
      energy: energy.toFixed(2),
      co2: (energy * 0.4).toFixed(2)
    };
  }, [sessions, isAdmin]);

  const dominantProvider = useMemo(() => {
    if (isAdmin || isProvider || !sessions.length) return null;
    const counts = sessions.reduce((acc, s) => {
      const name = s.providerName || 'saasPlug';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    return {
      name: top[0],
      percentage: Math.round((top[1] / sessions.length) * 100)
    };
  }, [sessions, isAdmin]);

  const chartData = useMemo(
    () => isAllTime ? history : history.filter(h => h.period.startsWith(`${selYear}-`)),
    [isAllTime, history, selYear],
  );

  const userChartData = useMemo(() => {
    if (isAdmin || isProvider || !sessions.length) return [];
    const buckets = {};
    sessions.forEach(s => {
      const month = (s.createdAt || '').slice(0, 7);
      if (!month) return;
      buckets[month] = (buckets[month] || 0) + 1;
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ label: formatPeriodLabel(month), count }));
  }, [sessions, isAdmin, isProvider]);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [sessions],
  );

  if (!user) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={styles.container}
    >
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <span className={styles.eyebrow}>
              {isAdmin ? 'Network Ecosystem' : isProvider ? 'Fleet Intelligence' : 'Personal Insights'}
            </span>
            <h1>{isAdmin ? 'Global Analytics' : isProvider ? 'Provider Analytics' : 'Usage Analytics'}</h1>
            <p className={styles.muted}>
              {isAdmin
                ? 'Real-time monitoring of global energy flow and network performance.'
                : isProvider
                ? "Your network's energy delivery and revenue performance."
                : 'Detailed breakdown of your charging behavior and energy footprint.'}
            </p>
          </div>
          {(isAdmin || isProvider) && (
            <div className={styles.periodSelector}>
              <span className={styles.periodLabel}>Reporting Period</span>
              <div className={styles.periodSelects}>
                <select className={styles.periodSelect} value={isAllTime ? 'all' : selYear} onChange={e => handleYearChange(e.target.value)}>
                  <option value="all">All Time</option>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {!isAllTime && (
                  <select className={styles.periodSelect} value={selMon} onChange={e => handleMonthChange(e.target.value)}>
                    {availableMonths.map(m => <option key={m.num} value={m.num}>{m.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {isProvider ? (
          <motion.div
            key="provider-stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className={styles.statsGrid}>
              <StatCard index={0} label="Total Revenue" value={(isAllTime ? allTimeStats?.totalRevenue : providerReport?.totalRevenue)?.toFixed(2) || '0.00'} unit="€" color="#00c853" />
              <StatCard index={1} label="Energy Delivered" value={(isAllTime ? allTimeStats?.totalEnergyKwh : (providerReport?.totalEnergyKwh ?? providerReport?.totalEnergyKWh) ?? 0).toFixed(1)} unit="kWh" color="#2979ff" />
              <StatCard index={2} label="Sessions" value={isAllTime ? (allTimeStats?.totalReservations ?? '0') : (providerReport?.totalReservations ?? providerReport?.totalSessions ?? '0')} unit="" color="#ffab00" />
            </div>

            {historyLoading ? (
              <div className={styles.chartSection}>
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>Loading trend data...</p>
                </div>
              </div>
            ) : history.length > 0 && (
              <motion.div
                className={styles.chartSection}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p className={styles.chartTitle}>Revenue & Sessions — {isAllTime ? 'All Time' : selYear}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `€${v}`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--outline)', borderRadius: '10px', color: 'var(--secondary)', fontSize: '0.85rem' }}
                      labelStyle={{ color: 'var(--muted)', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8rem', color: 'var(--muted)', paddingTop: '0.5rem' }} />
                    <Area yAxisId="left" type="monotone" dataKey="totalReservations" name="Sessions" stroke="#2979ff" fill="rgba(41,121,255,0.12)" strokeWidth={2} dot={false} />
                    <Area yAxisId="right" type="monotone" dataKey="totalRevenue" name="Revenue (€)" stroke="#00c853" fill="rgba(0,200,83,0.08)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            <div className={styles.mainGrid}>
              <section className={styles.historySection}>
                <div className={styles.sectionHeader}>
                  <h2>Fleet Status</h2>
                  <span className={styles.countBadge}>{providerReport?.totalChargers || 0} Stations</span>
                </div>
                <div className={styles.tableCard}>
                  {loading ? (
                    <div className={styles.loading}>
                      <div className={styles.spinner} />
                      <p>Loading fleet data...</p>
                    </div>
                  ) : providerReport ? (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Count</th>
                          <th>Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(providerReport.chargersByStatus || {})
                          .filter(([, count]) => count > 0)
                          .map(([status, count], idx) => {
                            const pct = providerReport.totalChargers > 0
                              ? Math.round(count / providerReport.totalChargers * 100)
                              : 0;
                            return (
                              <motion.tr
                                key={status}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 + idx * 0.05 }}
                              >
                                <td><strong className={styles.capitalize}>{status}</strong></td>
                                <td>{count}</td>
                                <td>
                                  <div className={`${styles.progressTrack} ${styles.progressTrackNarrow}`}>
                                    <div className={styles.progressBar} style={{ width: `${pct}%` }} />
                                  </div>
                                  <small className={styles.tinyMuted}>{pct}%</small>
                                </td>
                              </motion.tr>
                            );
                          })}
                      </tbody>
                    </table>
                  ) : (
                    <div className={styles.emptyTable}><p>No fleet data available.</p></div>
                  )}
                </div>
              </section>

              <aside className={styles.sidebar}>
                <div className={`${styles.impactCard} ${styles.impactCardDark}`}>
                  <div className={styles.impactHeader}>
                    <span className={styles.leafIcon}>⚡</span>
                    <h3>Fleet Health</h3>
                  </div>
                  {(() => {
                    const s = providerReport?.chargersByStatus || {};
                    const total = providerReport?.totalChargers || 0;
                    const healthy = (s.available || 0) + (s.charging || 0) + (s.reserved || 0);
                    const utilized = (s.charging || 0) + (s.reserved || 0);
                    const healthPct = total > 0 ? Math.round(healthy / total * 100) : 0;
                    const utilizePct = total > 0 ? Math.round(utilized / total * 100) : 0;
                    return (
                      <>
                        <div className={styles.impactValue}>
                          {healthPct}
                          <span className={styles.impactUnitLarge}>% Healthy</span>
                        </div>
                        <div className={styles.impactValue}>
                          {utilizePct}
                          <span className={styles.impactUnitLarge}>% Utilized</span>
                        </div>
                      </>
                    );
                  })()}
                  <div className={styles.impactMetric}>
                    <div className={styles.metricItem}>
                      <strong>{providerReport?.averageDurationMinutes?.toFixed(0) || 0}m</strong>
                      <span>Avg Session</span>
                    </div>
                    <div className={styles.divider} />
                    <div className={styles.metricItem}>
                      <strong>€{providerReport?.averageKwhPrice?.toFixed(3) || '0.00'}</strong>
                      <span>Avg kWh Price</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </motion.div>
        ) : isAdmin ? (
          <motion.div
            key="admin-stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className={styles.statsGrid}>
              <StatCard index={0} label="Total Revenue" value={(isAllTime ? allTimeStats?.totalRevenue : globalStats?.totalRevenue)?.toFixed(2) || '0.00'} unit="€" color="#00c853" />
              <StatCard index={1} label="Network Energy" value={(isAllTime ? allTimeStats?.totalEnergyKwh : (globalStats?.totalEnergyKwh ?? globalStats?.totalEnergyKWh) ?? 0).toFixed(1)} unit="kWh" color="#2979ff" />
              <StatCard index={2} label="Global Sessions" value={isAllTime ? (allTimeStats?.totalReservations ?? '0') : (globalStats?.totalReservations ?? globalStats?.totalSessions ?? '0')} unit="" color="#ffab00" />
            </div>

            {historyLoading ? (
              <div className={styles.chartSection}>
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>Loading trend data...</p>
                </div>
              </div>
            ) : history.length > 0 && (
              <motion.div
                className={styles.chartSection}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p className={styles.chartTitle}>Revenue & Sessions — {isAllTime ? 'All Time' : selYear}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `€${v}`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--outline)', borderRadius: '10px', color: 'var(--secondary)', fontSize: '0.85rem' }}
                      labelStyle={{ color: 'var(--muted)', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8rem', color: 'var(--muted)', paddingTop: '0.5rem' }} />
                    <Area yAxisId="left" type="monotone" dataKey="totalReservations" name="Sessions" stroke="#2979ff" fill="rgba(41,121,255,0.12)" strokeWidth={2} dot={false} />
                    <Area yAxisId="right" type="monotone" dataKey="totalRevenue" name="Revenue (€)" stroke="#00c853" fill="rgba(0,200,83,0.08)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            <div className={styles.mainGrid}>
              <section className={styles.historySection}>
                <div className={styles.sectionHeader}>
                  <h2>Network Performance</h2>
                  <span className={styles.countBadge}>{providerStats.length} Providers</span>
                </div>
                <div className={styles.tableCard}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Fleet Size</th>
                        <th>Operational</th>
                        <th>Occupancy</th>
                        <th>Energy Delivered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerStats.map((p, idx) => (
                        <motion.tr
                          key={p.providerName || idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + idx * 0.05 }}
                        >
                          <td><strong>{p.providerName}</strong></td>
                          <td>{p.totalChargers} units</td>
                          <td>
                            {(() => {
                              const s = p.chargersByStatus || {};
                              const operational = (s.available || 0) + (s.charging || 0) + (s.reserved || 0);
                              const offline = (s.offline || 0) + (s.malfunction || 0);
                              return (
                                <span>
                                  {operational}/{p.totalChargers}
                                  {offline > 0 && <small className={styles.alertText}>({offline} down)</small>}
                                </span>
                              );
                            })()}
                          </td>
                          <td>
                            {(() => {
                              const active = (p.chargersByStatus?.charging || 0) + (p.chargersByStatus?.reserved || 0);
                              const pct = p.totalChargers > 0 ? Math.round(active / p.totalChargers * 100) : 0;
                              return (
                                <>
                                  <div className={`${styles.progressTrack} ${styles.progressTrackNarrow}`}>
                                    <div className={styles.progressBar} style={{ width: `${pct}%` }} />
                                  </div>
                                  <small className={styles.tinyMuted}>{pct}% in use</small>
                                </>
                              );
                            })()}
                          </td>
                          <td><span className={styles.costBadge}>{(p.totalEnergyKwh ?? p.totalEnergyKWh ?? 0).toFixed(1)} kWh</span></td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <aside className={styles.sidebar}>
                <div className={`${styles.impactCard} ${styles.impactCardDark}`}>
                  <div className={styles.impactHeader}>
                    <span className={styles.leafIcon}>🌐</span>
                    <h3>Ecosystem Health</h3>
                  </div>
                  <div className={styles.impactValue}>
                    {Math.round(((globalStats?.totalReservations ?? globalStats?.totalSessions ?? 0) / 1000) * 100) / 100} <span className={styles.impactUnit}>k-Sessions</span>
                  </div>
                  <p className={styles.impactDesc}>
                    The saasPlug network is currently processing high-volume energy transactions across all regions.
                  </p>
                  <div className={styles.impactMetric}>
                    <div className={styles.metricItem}>
                      <strong>{globalStats?.averageDurationMinutes?.toFixed(0) ?? globalStats?.avgSessionDuration ?? 0}m</strong>
                      <span>Avg Duration</span>
                    </div>
                    <div className={styles.divider} />
                    <div className={styles.metricItem}>
                      <strong>{globalStats?.chargersByStatus?.charging ?? globalStats?.activeChargers ?? 0}</strong>
                      <span>Active Units</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="user-stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className={styles.statsGrid}>
              <StatCard index={0} label="Total Energy" value={overview?.energy} unit="kWh" color="#00c853" />
              <StatCard index={1} label="Connection Time" value={formatDuration(overview?.totalSeconds)} unit="" color="#2979ff" />
              <StatCard index={2} label="Avg Session" value={formatDuration(overview?.avgSeconds)} unit="" color="#ffab00" />
            </div>

            {userChartData.length > 0 && (
              <motion.div
                className={styles.chartSection}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p className={styles.chartTitle}>Sessions per Month</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={userChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={35} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--outline)', borderRadius: '10px', color: 'var(--secondary)', fontSize: '0.85rem' }}
                      labelStyle={{ color: 'var(--muted)', marginBottom: '4px' }}
                    />
                    <Bar dataKey="count" name="Sessions" fill="#2979ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            <div className={styles.mainGrid}>
              <section className={styles.historySection}>
                <div className={styles.sectionHeader}>
                  <h2>Session History</h2>
                  <span className={styles.countBadge}>{sessions.length} Sessions</span>
                </div>
                <div className={styles.tableCard}>
                   {loading ? (
                     <div className={styles.loading}>
                       <div className={styles.spinner} />
                       <p>Loading records...</p>
                     </div>
                   ) : sessions.length > 0 ? (
                     <>
                       <table className={styles.table}>
                         <thead>
                           <tr>
                             <th>Station</th>
                             <th>Network</th>
                             <th>Date</th>
                             <th>Duration</th>
                             <th>Cost</th>
                           </tr>
                         </thead>
                         <tbody>
                           {sortedSessions.slice(0, showCount).map((s, idx) => (
                             <motion.tr
                               key={s.id}
                               initial={{ opacity: 0, x: -10 }}
                               animate={{ opacity: 1, x: 0 }}
                               transition={{ delay: 0.3 + idx * 0.05 }}
                             >
                               <td>
                                 <strong>{s.locationName || `Station #${s.chargerId}`}</strong>
                                 <small className={styles.smallMutedBlock}>#{s.chargerId}</small>
                               </td>
                               <td>{s.providerName || 'saasPlug'}</td>
                               <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                               <td>{formatDuration((s.actualDurationSeconds ?? s.durationSeconds) ?? 0)}</td>
                               <td><span className={styles.costBadge}>€{(((s.actualDurationSeconds ?? s.durationSeconds) ?? 0) / 3600 * (s.capacityKw || 22) * (s.kwhPrice ?? 0)).toFixed(2)}</span></td>
                             </motion.tr>
                           ))}
                         </tbody>
                       </table>
                       {sortedSessions.length > showCount && (
                         <button
                           className={styles.showMoreBtn}
                           onClick={() => setShowCount(c => c + 8)}
                         >
                           Show More ({sortedSessions.length - showCount} remaining)
                         </button>
                       )}
                     </>
                   ) : (
                     <div className={styles.emptyTable}>
                       <p>No session data available yet.</p>
                     </div>
                   )}
                </div>
              </section>

              <aside className={styles.sidebar}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className={styles.impactCard}
                >
                  <div className={styles.impactHeader}>
                    <span className={styles.leafIcon}>🍃</span>
                    <h3>CO2 Emissions Prevented</h3>
                  </div>
                  <div className={styles.impactValue}>
                    {overview?.co2} <span className={styles.impactUnit}>kg CO₂</span>
                  </div>
                  <p className={styles.impactDesc}>
                    By choosing electric, you've prevented this much CO₂ from entering the atmosphere.
                  </p>
                  <div className={styles.impactMetric}>
                    <div className={styles.metricItem}>
                      <strong>{Math.ceil((overview?.energy || 0) / 10)}</strong>
                      <span>Trees Equivalent</span>
                    </div>
                    <div className={styles.divider} />
                    <div className={styles.metricItem}>
                      <strong>{Math.ceil((overview?.totalSeconds || 0) / 3600)}</strong>
                      <span>Hours Connected</span>
                    </div>
                  </div>
                </motion.div>
                
                {dominantProvider && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className={styles.providerCard}
                  >
                    <h3>Network Affinity</h3>
                    <div className={styles.providerInfo}>
                       <div className={styles.providerLogo}>{dominantProvider.name.substring(0, 2).toUpperCase()}</div>
                       <div>
                          <p className={styles.providerName}>{dominantProvider.name}</p>
                          <p className={styles.providerStat}>Dominant Provider ({dominantProvider.percentage}%)</p>
                       </div>
                    </div>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressBar} style={{ width: `${dominantProvider.percentage}%` }} />
                    </div>
                  </motion.div>
                )}
              </aside>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StatsPage;