import { useEffect, useState } from 'react';
import { getProviderReport } from '../../services/analytics';
import { getChargers } from '../../services/chargers';
import { useAuth } from '../../hooks/useAuth';
import styles from './ProviderDashboardPage.module.css';

const ProviderDashboardPage = () => {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [myChargers, setMyChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.name) return;
      setLoading(true);
      try {
        const [reportData, allChargers] = await Promise.all([
          getProviderReport(user.name),
          getChargers(),
        ]);
        setReport(reportData);
        // Filter chargers belonging to this provider
        setMyChargers(allChargers.filter(c => c.providerName === user.name));
      } catch (err) {
        setError(err.message || 'Failed to fetch provider dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) return <div className="card">Loading provider dashboard...</div>;

  return (
    <div className="card">
      <p className="eyebrow">Provider Partner</p>
      <h1>{user?.name || 'Provider'} Dashboard</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <div className={styles.statsGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="panel">
          <h3>Total Energy Sold</h3>
          <p className="big-number">{report?.totalEnergyKWh?.toFixed(1) || 0} kWh</p>
        </div>
        <div className="panel">
          <h3>Total Sessions</h3>
          <p className="big-number">{report?.totalSessions || 0}</p>
        </div>
        <div className="panel">
          <h3>My Stations</h3>
          <p className="big-number">{myChargers.length}</p>
        </div>
      </div>

      <div className="panel">
        <h3>My Charging Stations</h3>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: '0.5rem' }}>Location</th>
              <th style={{ padding: '0.5rem' }}>Address</th>
              <th style={{ padding: '0.5rem' }}>Status</th>
              <th style={{ padding: '0.5rem' }}>Price</th>
            </tr>
          </thead>
          <tbody>
            {myChargers.length > 0 ? (
              myChargers.map(charger => (
                <tr key={charger.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{charger.locationName}</td>
                  <td style={{ padding: '0.5rem' }}>{charger.address}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <span className={`badge badge-${charger.status === 'available' ? 'success' : 'warning'}`}>
                      {charger.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem' }}>€{charger.kwhPrice?.toFixed(2)}/kWh</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ padding: '1rem', textAlign: 'center' }} className="muted">
                  No chargers found for your account.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProviderDashboardPage;
