import { useEffect, useState } from 'react';
import { getProviderReport } from '../../services/analytics';
import { getChargers } from '../../services/chargers';
import { useAuth } from '../../hooks/useAuth';
import styles from './ProviderDashboardPage.module.css';

const ProviderDashboardPage = () => {
  const { user } = useAuth();
  const [report, setReport]       = useState(null);
  const [myChargers, setMyChargers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

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
        setMyChargers(allChargers.filter(c => c.providerName === user.name));
      } catch (err) {
        setError(err.message || 'Failed to fetch provider dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) return <div className={styles.card}><p className={styles.muted}>Loading provider dashboard...</p></div>;

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Provider Partner</p>
      <h1 className={styles.heading}>{user?.name || 'Provider'} Dashboard</h1>

      {error && <div className={styles.alertError}>{error}</div>}

      <div className={styles.grid}>
        <div className={styles.panel}>
          <span className={styles.label}>Total Energy Sold</span>
          <p className={styles.bigNumber}>{report?.totalEnergyKWh?.toFixed(1) ?? 0} kWh</p>
        </div>
        <div className={styles.panel}>
          <span className={styles.label}>Total Sessions</span>
          <p className={styles.bigNumber}>{report?.totalSessions ?? 0}</p>
        </div>
        <div className={styles.panel}>
          <span className={styles.label}>My Stations</span>
          <p className={styles.bigNumber}>{myChargers.length}</p>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <h3 className={styles.tableHeading}>My Charging Stations</h3>
        <table className={styles.chargerTable}>
          <thead>
            <tr>
              <th>Location</th>
              <th>Address</th>
              <th>Status</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {myChargers.length > 0 ? (
              myChargers.map(charger => (
                <tr key={charger.id}>
                  <td>{charger.locationName}</td>
                  <td>{charger.address}</td>
                  <td>
                    <span className={charger.status === 'available' ? styles.badgeSuccess : styles.badgeWarning}>
                      {charger.status}
                    </span>
                  </td>
                  <td>{charger.kwhPrice != null ? `€${charger.kwhPrice.toFixed(2)}/kWh` : '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className={styles.emptyRow}>No chargers found for your account.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProviderDashboardPage;
