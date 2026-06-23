import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import ChargerMap from '../../components/map/ChargerMap';
import { getChargers } from '../../services/chargers';
import { APP_ROUTES } from '../../config/routes';
import styles from './MapPage.module.css';

const MapPage = ({ onSelect }) => {
  const navigate = useNavigate();
  const { user, isAdmin, isProvider } = useAuth();
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initMap = async () => {
      setLoading(true);
      try {
        const raw = await getChargers();
        if (isProvider && user?.providerName) {
          setChargers(raw.filter(c => c.providerName === user.providerName));
        } else {
          setChargers(raw);
        }
      } catch (err) {
        console.error('Map initialization failed', err);
      } finally {
        setLoading(false);
      }
    };
    initMap();
  }, [isProvider, user?.providerName]);

  const handleReserve = (charger) => {
    if (isAdmin || isProvider) return;
    onSelect(charger);
    navigate(APP_ROUTES.reserve);
  };

  const eyebrow = isAdmin ? 'System Monitoring' : isProvider ? 'Fleet Overview' : 'Global Network';
  const title = isAdmin ? 'Infrastructure Oversight' : isProvider ? 'My Network' : 'Infrastructure Hub';
  const description = isAdmin
    ? 'Monitor the next generation of smart energy. View real-time status and telemetry across the saasPlug ecosystem.'
    : isProvider
    ? 'Monitor your charging fleet in real-time. View live status and telemetry across all your registered stations.'
    : 'Navigate the next generation of smart energy. Locate, monitor, and reserve premium charging points across the saasPlug ecosystem in real-time.';

  return (
    <section className={styles.mapPage}>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={styles.header}
      >
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </motion.header>
      <ChargerMap
        chargers={chargers}
        loading={loading}
        onReserve={handleReserve}
        isAdmin={isAdmin || isProvider}
      />
    </section>
  );
};

export default MapPage;
