import { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { updateProfile } from '../../services/auth';
import { APP_ROUTES } from '../../config/routes';
import styles from './ProfilePage.module.css';

const ProfilePage = () => {
  const { user, setUser } = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phoneNumber: user?.phoneNumber || '',
    birthdate: user?.birthdate ? new Date(user.birthdate).toISOString().split('T')[0] : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Derive 'name' from first and last name for backend compatibility
      const submissionData = {
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`.trim() || formData.username || formData.email
      };
      const updatedUser = await updateProfile(submissionData);
      setUser(updatedUser);
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const renderField = (label, name, type = 'text') => {
    const value = formData[name];
    if (isEditing) {
      return (
        <div className={styles.profileRow}>
          <span className={styles.profileLabel}>{label}</span>
          <input
            className={styles.profileInput}
            type={type}
            name={name}
            value={value}
            onChange={handleChange}
            placeholder={`Enter ${label}`}
          />
        </div>
      );
    }
    return (
      <div className={styles.profileRow}>
        <span className={styles.profileLabel}>{label}</span>
        <span className={styles.profileValue}>{value || '—'}</span>
      </div>
    );
  };

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
          <form className={styles.profileContent} onSubmit={handleSubmit}>
            {error && <p className={styles.errorText}>{error}</p>}
            
            {renderField('Username', 'username')}
            {renderField('Email', 'email', 'email')}
            {renderField('First Name', 'firstName')}
            {renderField('Last Name', 'lastName')}
            {renderField('Phone Number', 'phoneNumber', 'tel')}
            {renderField('Birthdate', 'birthdate', 'date')}

            {!isEditing ? (
              <button 
                type="button" 
                className={styles.editBtn} 
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </button>
            ) : (
              <div className={styles.formActions}>
                <button 
                  type="button" 
                  className={styles.cancelBtn} 
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={styles.saveBtn}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>
        ) : (
          <div className={styles.profileEmpty}>
            <p className={styles.profileSubtle}>You are not logged in yet.</p>
            <Link className={styles.profileLogout} to={APP_ROUTES.login}>
              Go to Login
            </Link>
          </div>
        )}
      </div>

      {user && (
        <section className={styles.dashboardSection} style={{ width: '460px', marginTop: '1rem' }}>
          <header>
            <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Support & Help</h3>
          </header>
          <p style={{ color: '#a0a8b5', fontSize: '0.9rem' }}>
            Need assistance? Contact <a href="mailto:support@saasplug.app" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>support@saasplug.app</a> or visit our Help Center.
          </p>
        </section>
      )}
    </section>
  );
};

export default ProfilePage;
