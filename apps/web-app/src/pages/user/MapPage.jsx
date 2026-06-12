import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import ChargerMap from '../../components/map/ChargerMap';
import { getChargers } from '../../services/chargers';
import styles from './MapPage.module.css';

const MapPage = ({ onSelect }) => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initMap = async () => {
      setLoading(true);
      try {
        // Fetch chargers with synchronous normalization (fast fallback)
        const raw = await getChargers();
        setChargers(raw);
      } catch (err) {
        console.error('Map initialization failed', err);
      } finally {
        setLoading(false);
      }
    };
    initMap();
  }, []);

  const handleReserve = (charger) => {
    if (isAdmin) return;
    onSelect(charger);
    navigate('/reserve');
  };

  return (
    <section className={styles.mapPage}>
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={styles.header}
      >
        <span className={styles.eyebrow}>{isAdmin ? 'System Monitoring' : 'Global Network'}</span>
        <h1 className={styles.title}>{isAdmin ? 'Infrastructure Oversight' : 'Infrastructure Hub'}</h1>
        <p className={styles.description}>
          {isAdmin 
            ? 'Monitor the next generation of smart energy. View real-time status and telemetry across the saasPlug ecosystem.'
            : 'Navigate the next generation of smart energy. Locate, monitor, and reserve premium charging points across the saasPlug ecosystem in real-time.'
          }
        </p>
      </motion.header>
      <ChargerMap
        chargers={chargers}
        loading={loading}
        onReserve={handleReserve}
        isAdmin={isAdmin}
      />
    </section>
  );
};

export default MapPage;
