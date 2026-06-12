import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import styles from './ProviderProfilePage.module.css';

const ProviderProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = user?.providerName
    ? user.providerName.substring(0, 2).toUpperCase()
    : 'OP';

  return (
    <motion.section
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className={styles.avatarWrap}>
          <div className={styles.avatar}>{initials}</div>
        </div>

        <header className={styles.header}>
          <span className={styles.eyebrow}>Provider Account</span>
          <h1>{user?.providerName || 'Operator'}</h1>
          <span className={styles.roleBadge}>Provider Operator</span>
        </header>

        <div className={styles.divider} />

        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Network Handle</span>
            <span className={styles.fieldValue}>{user?.providerName || '—'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
            <span className={styles.fieldValue}>{user?.email || '—'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Role</span>
            <span className={styles.fieldValue}>Provider Operator</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Access Level</span>
            <span className={styles.fieldValue}>Fleet Read + Analytics</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        className={styles.infoPanel}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
      >
        <h3>Network Access</h3>
        <p>
          Your account grants read access to all charging stations registered under the{' '}
          <strong>{user?.providerName}</strong> network, plus real-time fleet analytics.
        </p>
        <p>
          To update network configuration or manage chargers, contact{' '}
          <a href="mailto:support@saasplug.app" className={styles.link}>support@saasplug.app</a>.
        </p>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          Sign Out
        </button>
      </motion.div>
    </motion.section>
  );
};

export default ProviderProfilePage;
