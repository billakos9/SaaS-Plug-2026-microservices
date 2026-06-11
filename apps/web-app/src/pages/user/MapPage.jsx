import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ChargerMap from '../../components/map/ChargerMap';
import { getChargers } from '../../services/chargers';
import styles from './MapPage.module.css';

const MapPage = ({ onSelect }) => {
  const navigate = useNavigate();
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
    onSelect(charger);
    navigate('/reserve');
  };

  return (
    <section className={styles.mapPage}>
      <header className={styles.header}>
        <p className="eyebrow">Interactive Map</p>
        <h1>Infrastructure Hub</h1>
        <p className="muted">Explore chargers across the city. Zoom in to disperse clusters.</p>
      </header>
      <ChargerMap
        chargers={chargers}
        loading={loading}
        onReserve={handleReserve}
      />
    </section>
  );
};

export default MapPage;
