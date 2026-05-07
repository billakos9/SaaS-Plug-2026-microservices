import { Link, useNavigate } from 'react-router-dom';
import AccountDashboard from './AccountDashboard';
import './ProfilePage.module.css';

const ProfilePage = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout?.();
    navigate('/login');
  };

  return (
    <section className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar" aria-hidden="true" />
        <header className="profile-header">
          <h1>Profile</h1>
          <p>Manage your IonOS account details and access preferences.</p>
          <div className="profile-divider" />
        </header>

        {user ? (
          <div className="profile-content">
            <div className="profile-row">
              <span className="profile-label">Username</span>
              <span className="profile-value">
                {user.username || user.name || user.email?.split('@')[0] || '—'}
              </span>
            </div>
            <div className="profile-row">
              <span className="profile-label">Email</span>
              <span className="profile-value">{user.email || '—'}</span>
            </div>

            <div className="profile-actions">
              <button type="button" className="profile-logout" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-empty">
            <p className="profile-subtle">You are not logged in yet.</p>
            <Link className="profile-logout" to="/login">
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
