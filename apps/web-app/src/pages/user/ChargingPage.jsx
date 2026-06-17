import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyReservations, cancelReservation, completeReservation } from '../../services/reservations';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ChargingPage.module.css';

const DEFAULT_SESSION_LIMIT = 30 * 60; // Fallback

/**
 * High-quality animated progress ring.
 */
const ProgressRing = ({ elapsed, label, durationSeconds }) => {
  const limit = durationSeconds || DEFAULT_SESSION_LIMIT;
  const remaining = Math.max(limit - elapsed, 0);
  const progress = (remaining / limit) * 100;

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: 628.3 - (628.3 * progress) / 100 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
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
          {formatTimer(remaining)}
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
  const completionTriggered = useRef(false);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    const loadData = async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      try {
        const data = await getMyReservations(user.id);
        setSessions(data);
      } catch (err) {
        console.error('Failed to load charging data', err);
      } finally {
        if (!isSilent) setLoading(false);
      }
    };

    loadData();
    // Refresh every 30 seconds to pick up status changes from backend monitor
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  const activeSession = useMemo(() => {
    if (!sessions.length) return null;
    // Sort by createdAt descending to get the newest first
    const sorted = [...sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sorted.find(s => ['active', 'charging', 'reserved'].includes(s.status));
  }, [sessions]);

  useEffect(() => {
    if (activeSession?.createdAt) {
      const start = new Date(activeSession.createdAt).getTime();
      const updateElapsed = () => {
        const delta = Math.floor((Date.now() - start) / 1000);
        setElapsed(Math.max(0, delta));
      };
      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession) {
      completionTriggered.current = false;
      return;
    }
    const durationSeconds = (activeSession.duration || 30) * 60;
    if (elapsed < durationSeconds || completionTriggered.current) return;

    completionTriggered.current = true;
    completeReservation(activeSession.id)
      .then(updated => setSessions(prev => prev.map(s => s.id === updated.id ? updated : s)))
      .catch(err => console.error('[ChargingPage] auto-complete failed, monitor will catch it:', err.message));
  }, [elapsed, activeSession]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDurationPrecise = (seconds) => {
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

  const handleCancel = async () => {
    if (!activeSession) return;
    if (!window.confirm('Are you sure you want to terminate this charging session?')) return;

    try {
      const updated = await cancelReservation(activeSession.id);
      setSessions(prev => prev.map(s => s.id === activeSession.id ? updated : s));
    } catch (err) {
      console.error('Failed to cancel reservation', err);
      alert('Could not cancel the session. It may have already expired.');
    }
  };

  const recentHistory = useMemo(() => {
    // Filter out the currently active session from the history list
    const filtered = sessions.filter(s => s.id !== activeSession?.id);
    // Sort by newest first
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
  }, [sessions, activeSession]);

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
              <ProgressRing 
                elapsed={elapsed} 
                label="REMAINING" 
                durationSeconds={(activeSession.duration || 30) * 60} 
              />
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
                   <span className={styles.infoLabel}>Station</span>
                   <span className={styles.infoValue}>{activeSession.locationName || `Station #${activeSession.chargerId}`}</span>
                 </div>
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

              <button className={styles.cancelBtn} onClick={handleCancel}>
                Cancel Charge
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
            {recentHistory.map((s, idx) => (
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
                    <p className={styles.historyTitle}>{s.locationName || `Station #${s.chargerId}`}</p>
                    <p className={styles.historyDate}>{new Date(s.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className={styles.historyMetrics}>
                  <span className={styles.historyBadge}>{s.status}</span>
                  <p className={styles.historyDuration}>{formatDurationPrecise(s.duration)}</p>
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