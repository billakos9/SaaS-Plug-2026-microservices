import { Link } from 'react-router-dom';
import AccountDashboard from './AccountDashboard';
import styles from './ProfilePage.module.css';

const ProfilePage = ({ user }) => {
  return (
    <section className={styles.profilePage}>
      <div className={styles.profileCard}>
        <div className={styles.profileAvatar} aria-hidden="true" />
        <header className={styles.profileHeader}>
          <h1>Profile</h1>
          <p>Manage your saasPlug account details and access preferences.</p>
          <div className={styles.profileDivider} />
        </header>

        {user ? (
          <div className={styles.profileContent}>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Username</span>
              <span className={styles.profileValue}>
                {user.username || user.name || user.email?.split('@')[0] || '—'}
              </span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Email</span>
              <span className={styles.profileValue}>{user.email || '—'}</span>
            </div>
          </div>
        ) : (
          <div className={styles.profileEmpty}>
            <p className={styles.profileSubtle}>You are not logged in yet.</p>
            <Link className={styles.profileLogout} to="/login">
              Go to Login
            </Link>
          </div>
        )}
      </div>
      {user && <AccountDashboard user={user} />}
    </section>
  );
};

export default ProfilePage;
