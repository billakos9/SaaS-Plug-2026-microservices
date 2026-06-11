import { useEffect, useState } from 'react';
import { getGlobalStats, getAllUsers, getAllProviders, deleteUser } from '../../services/admin';
import styles from './AdminPage.module.css';

const AdminPage = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsData, usersData, providersData] = await Promise.all([
          getGlobalStats(),
          getAllUsers(),
          getAllProviders(),
        ]);
        setStats(statsData);
        setUsers(usersData);
        setProviders(providersData);
      } catch (err) {
        setError(err.message || 'Failed to fetch admin data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
    } catch (err) {
      alert('Failed to delete user: ' + err.message);
    }
  };

  if (loading) return <div className="card"><p className="muted">Loading management console...</p></div>;

  return (
    <div className="card">
      <header className={styles.header}>
        <p className="eyebrow">Administrator</p>
        <h1>saasPlug Management</h1>
        <p className="muted">System-wide monitoring and resource control.</p>
      </header>

      <div className={styles.tabs}>
        <button onClick={() => setActiveTab('stats')} className={activeTab === 'stats' ? 'btn btn-primary' : 'btn'}>System Stats</button>
        <button onClick={() => setActiveTab('users')} className={activeTab === 'users' ? 'btn btn-primary' : 'btn'}>Users</button>
        <button onClick={() => setActiveTab('providers')} className={activeTab === 'providers' ? 'btn btn-primary' : 'btn'}>Providers</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {activeTab === 'stats' && stats && (
        <div className={styles.statsGrid}>
          <div className="panel">
            <p className="eyebrow">Global Energy</p>
            <p className="big-number">{stats.totalEnergyKWh?.toFixed(1) || 0} <span style={{fontSize: '1rem'}}>kWh</span></p>
          </div>
          <div className="panel">
            <p className="eyebrow">Total Sessions</p>
            <p className="big-number">{stats.totalSessions || 0}</p>
          </div>
          <div className="panel">
            <p className="eyebrow">Active Users</p>
            <p className="big-number">{users.length}</p>
          </div>
        </div>
      )}

      {(activeTab === 'users' || activeTab === 'providers') && (
        <div className="panel" style={{ padding: '0.5rem' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--outline)' }}>
                <th style={{ padding: '1rem' }}>Name</th>
                <th style={{ padding: '1rem' }}>Email</th>
                <th style={{ padding: '1rem' }}>{activeTab === 'users' ? 'Role' : 'Status'}</th>
                <th style={{ padding: '1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeTab === 'users' ? users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <td style={{ padding: '1rem' }}>{user.username}</td>
                  <td style={{ padding: '1rem' }}>{user.email}</td>
                  <td style={{ padding: '1rem' }}><span className="badge">{user.role}</span></td>
                  <td style={{ padding: '1rem' }}>
                    <button onClick={() => handleDeleteUser(user.id)} className="btn btn-danger btn-sm">Delete</button>
                  </td>
                </tr>
              )) : providers.map(provider => (
                <tr key={provider.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <td style={{ padding: '1rem' }}>{provider.name}</td>
                  <td style={{ padding: '1rem' }}>{provider.email}</td>
                  <td style={{ padding: '1rem' }}><span className="badge">Active</span></td>
                  <td style={{ padding: '1rem' }}>
                    <button className="btn btn-secondary btn-sm">Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
