import { useEffect, useState } from 'react';
import { getProviderProfile } from '../../services/providers';
import styles from './ProviderDashboardPage.module.css';

const ProviderDashboardPage = () => {
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    getProviderProfile()
      .then((profile) => {
        if (active) setProvider(profile);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load provider profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>Provider</p>
      <h1>Provider dashboard</h1>

      {loading && <p className={styles.muted}>Loading provider data...</p>}
      {error && <div className={styles.alertError}>{error}</div>}
      {provider && (
        <div className={styles.grid}>
          <div className={styles.panel}>
            <span className={styles.label}>Name</span>
            <strong>{provider.name || 'Unknown provider'}</strong>
          </div>
          <div className={styles.panel}>
            <span className={styles.label}>Email</span>
            <strong>{provider.email || '-'}</strong>
          </div>
          <div className={styles.panel}>
            <span className={styles.label}>Status</span>
            <strong>{provider.status || 'pending'}</strong>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProviderDashboardPage;
