import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyReservations } from '../../services/reservations';
import { getGlobalStats, getProviderBreakdown } from '../../services/admin';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
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
  const { user, isAdmin } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [providerStats, setProviderStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getMyReservations(user.id);
      const finished = data.filter(s => ['completed', 'cancelled'].includes(s.status));
      setSessions(finished);
    } catch (err) {
      console.error('Failed to fetch user stats', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchAdminData = useCallback(async () => {
    try {
      const [stats, providers] = await Promise.all([
        getGlobalStats(),
        getProviderBreakdown()
      ]);
      setGlobalStats(stats);
      setProviderStats(providers);
    } catch (err) {
      console.error('Failed to fetch global stats', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return; }
    if (isAdmin) {
      fetchAdminData();
    } else {
      fetchUserData();
    }
  }, [user, isAdmin, navigate, fetchAdminData, fetchUserData]);

  const overview = useMemo(() => {
    if (isAdmin) return null;
    const total = sessions.length;
    const totalSeconds = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
    const energy = sessions.reduce((acc, s) => {
      const durationHrs = (s.duration || 0) / 3600;
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
    if (isAdmin || !sessions.length) return null;
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

  if (!user) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={styles.container}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{isAdmin ? 'Network Ecosystem' : 'Personal Insights'}</span>
          <h1>{isAdmin ? 'Global Analytics' : 'Usage Analytics'}</h1>
          <p className={styles.muted}>
            {isAdmin 
              ? 'Real-time monitoring of global energy flow and network performance.' 
              : 'Detailed breakdown of your charging behavior and energy footprint.'}
          </p>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {isAdmin ? (
          <motion.div 
            key="admin-stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className={styles.statsGrid}>
              <StatCard index={0} label="Total Revenue" value={globalStats?.totalRevenue?.toFixed(2) || '0.00'} unit="€" color="#00c853" />
              <StatCard index={1} label="Network Energy" value={globalStats?.totalEnergyKWh?.toFixed(1) || '0.0'} unit="kWh" color="#2979ff" />
              <StatCard index={2} label="Global Sessions" value={globalStats?.totalSessions || '0'} unit="" color="#ffab00" />
            </div>

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
                        <th>Occupancy</th>
                        <th>Energy Delivered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerStats.map((p, idx) => (
                        <motion.tr 
                          key={p.providerId}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + idx * 0.05 }}
                        >
                          <td><strong>{p.providerName}</strong></td>
                          <td>{p.totalChargers} units</td>
                          <td>
                             <div className={styles.progressTrack} style={{ width: '80px', margin: 0 }}>
                                <div 
                                  className={styles.progressBar} 
                                  style={{ 
                                    width: `${(p.chargersByStatus?.occupied || 0) / p.totalChargers * 100}%`,
                                    background: 'var(--primary)'
                                  }} 
                                />
                             </div>
                             <small style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                               {Math.round((p.chargersByStatus?.occupied || 0) / p.totalChargers * 100)}% active
                             </small>
                          </td>
                          <td><span className={styles.costBadge}>{p.totalEnergyKWh?.toFixed(1) || 0} kWh</span></td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <aside className={styles.sidebar}>
                <div className={styles.impactCard} style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)' }}>
                  <div className={styles.impactHeader}>
                    <span className={styles.leafIcon}>🌐</span>
                    <h3>Ecosystem Health</h3>
                  </div>
                  <div className={styles.impactValue}>
                    {Math.round(((globalStats?.totalSessions || 0) / 1000) * 100) / 100} <span className={styles.impactUnit}>k-Sessions</span>
                  </div>
                  <p className={styles.impactDesc}>
                    The saasPlug network is currently processing high-volume energy transactions across all regions.
                  </p>
                  <div className={styles.impactMetric}>
                    <div className={styles.metricItem}>
                      <strong>{globalStats?.avgSessionDuration || 0}m</strong>
                      <span>Avg Duration</span>
                    </div>
                    <div className={styles.divider} />
                    <div className={styles.metricItem}>
                      <strong>{globalStats?.activeChargers || 0}</strong>
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
                         {sessions.slice(0, 8).map((s, idx) => (
                           <motion.tr 
                             key={s.id}
                             initial={{ opacity: 0, x: -10 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: 0.3 + idx * 0.05 }}
                           >
                             <td>
                               <strong>{s.locationName || `Station #${s.chargerId}`}</strong>
                               <small style={{ display: 'block', opacity: 0.6, fontSize: '0.7rem' }}>#{s.chargerId}</small>
                             </td>
                             <td>{s.providerName || 'saasPlug'}</td>
                             <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                             <td>{formatDuration(s.duration)}</td>
                             <td><span className={styles.costBadge}>€{((s.duration || 0) / 3600 * (s.capacityKw || 22) * (s.kwhPrice || 0.45)).toFixed(2)}</span></td>
                           </motion.tr>
                         ))}
                       </tbody>
                     </table>
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