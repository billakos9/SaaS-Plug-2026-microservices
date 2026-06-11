import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyReservations } from '../../services/reservations';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ChargingPage.module.css';

const SESSION_LIMIT_SECONDS = 30 * 60; // 30 minutes

/**
 * High-quality animated progress ring.
 */
const ProgressRing = ({ elapsed, label }) => {
  const progress = Math.min((elapsed / SESSION_LIMIT_SECONDS) * 100, 100);
  const remaining = Math.max(SESSION_LIMIT_SECONDS - elapsed, 0);
  const mins = Math.floor(remaining / 60);

  return (
    <div className={styles.progressContainer}>
      <svg className={styles.progressRing} width="240" height="240">
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="#00d2ff" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle 
          className={styles.progressRingBg} 
          stroke="var(--outline)" 
          strokeWidth="14" 
          fill="transparent" 
          r="100" 
          cx="120" 
          cy="120" 
        />
        <motion.circle
          className={styles.progressRingFill}
          stroke="url(#ringGradient)"
          strokeWidth="14"
          strokeDasharray="628.3"
          initial={{ strokeDashoffset: 628.3 }}
          animate={{ strokeDashoffset: 628.3 - (628.3 * progress) / 100 }}
          transition={{ duration: 1, ease: "linear" }}
          strokeLinecap="round"
          fill="transparent"
          r="100"
          cx="120"
          cy="120"
          style={{ filter: 'url(#glow)' }}
        />
      </svg>
      <div className={styles.progressContent}>
        <motion.span 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.progressNumber}
        >
          {mins}m
        </motion.span>
        <span className={styles.progressLabel}>{label}</span>
      </div>
    </div>
  );
};

const ChargingPage = ({ user }) => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getMyReservations(user.id);
        setSessions(data);
      } catch (err) {
        console.error('Failed to load charging data', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, navigate]);

  const activeSession = useMemo(() => 
    sessions.find(s => ['active', 'charging', 'reserved'].includes(s.status)), 
  [sessions]);

  useEffect(() => {
    if (activeSession?.createdAt) {
      const start = new Date(activeSession.createdAt).getTime();
      setElapsed(Math.floor((Date.now() - start) / 1000));
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeSession]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={styles.container}
    >
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.eyebrow}>Energy Hub</span>
          <h1>Session Monitor</h1>
          <p className={styles.muted}>Live status and performance of your current saasPlug connection.</p>
        </div>
        {activeSession && (
          <div className={styles.liveStatus}>
             <span className={styles.pulseDot} />
             LIVE CONNECTION
          </div>
        )}
      </header>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.loadingPanel}
          >
            <div className={styles.spinner} />
            <p>Synchronizing with smart network...</p>
          </motion.div>
        ) : activeSession ? (
          <motion.div 
            key="active"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={styles.activeGrid}
          >
            <div className={styles.visualPanel}>
              <ProgressRing elapsed={elapsed} label="REMAINING" />
            </div>

            <div className={styles.dataPanel}>
              <div className={styles.panelHeader}>
                <span className={styles.statusBadge}>
                   {activeSession.status.toUpperCase()}
                </span>
                <div className={styles.timerContainer}>
                  <span className={styles.timerLabel}>ELAPSED TIME</span>
                  <span className={styles.timerValue}>{formatTime(elapsed)}</span>
                </div>
              </div>

              <div className={styles.infoSection}>
                 <div className={styles.infoRow}>
                   <span className={styles.infoLabel}>Station ID</span>
                   <span className={styles.infoValue}>#{activeSession.chargerId}</span>
                 </div>
                 <div className={styles.infoRow}>
                   <span className={styles.infoLabel}>Network</span>
                   <span className={styles.infoValue}>{activeSession.providerName || 'saasPlug'}</span>
                 </div>
                 <div className={styles.infoRow}>
                   <span className={styles.infoLabel}>Started At</span>
                   <span className={styles.infoValue}>{new Date(activeSession.createdAt).toLocaleTimeString()}</span>
                 </div>
              </div>

              <button className={styles.terminateBtn}>
                Terminate Session
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={styles.emptyState}
          >
            <div className={styles.emptyIcon}>⚡</div>
            <h2>No Active Connection</h2>
            <p>Your vehicle is not currently connected to any saasPlug station.</p>
            <button className={styles.primaryBtn} onClick={() => navigate('/map')}>
              Locate a Station
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {sessions.length > 0 && (
        <section className={styles.historySection}>
          <div className={styles.sectionHeader}>
            <h2>Recent Activity</h2>
            <button className={styles.linkBtn} onClick={() => navigate('/stats')}>
              Full Analytics →
            </button>
          </div>
          <div className={styles.historyList}>
            {sessions.slice(0, 3).map((s, idx) => (
              <motion.div 
                key={s.id} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={styles.historyItem}
              >
                <div className={styles.historyInfo}>
                  <div className={styles.brandIndicator} style={{ background: s.providerName === 'bluePlug' ? '#2979ff' : s.providerName === 'redPlug' ? '#ff1744' : '#00c853' }} />
                  <div>
                    <p className={styles.historyTitle}>Station {s.chargerId}</p>
                    <p className={styles.historyDate}>{new Date(s.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className={styles.historyMetrics}>
                  <span className={styles.historyBadge}>{s.status}</span>
                  <p className={styles.historyDuration}>{s.duration || 0} min</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
};

export default ChargingPage;