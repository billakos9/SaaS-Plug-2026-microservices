import styles from './ProfilePage.module.css';

const AccountDashboard = ({ user }) => (
  <div className={styles.accountDashboard}>
    <header>
      <h2>Account Dashboard</h2>
    </header>

    <section className={styles.dashboardSection}>
      <header>
        <h3>User Information</h3>
      </header>
      <div className={styles.infoGrid}>
        <p><strong>User ID:</strong> {user?.userInfoId ?? user?.id ?? '—'}</p>
        <p><strong>Username:</strong> {user?.username ?? '—'}</p>
        <p><strong>Email:</strong> {user?.email ?? '—'}</p>
        <p><strong>Phone:</strong> {user?.phoneNumber ?? '—'}</p>
        <p><strong>First name:</strong> {user?.firstName ?? '—'}</p>
        <p><strong>Last name:</strong> {user?.lastName ?? '—'}</p>
        <p><strong>Birthdate:</strong> {user?.birthdate ? new Date(user.birthdate).toLocaleDateString() : '—'}</p>
      </div>
    </section>

    <section className={styles.dashboardSection}>
      <header>
        <h3>Support &amp; Help</h3>
      </header>
      <p>
        Need assistance? Contact <a href="mailto:support@saasplug.app" className={styles.link}>support@saasplug.app</a> or visit our Help Center.
      </p>
    </section>
  </div>
);

export default AccountDashboard;
