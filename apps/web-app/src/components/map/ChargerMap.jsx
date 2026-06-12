import { useMemo, useState, useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { divIcon } from 'leaflet';
import { motion } from 'framer-motion';
import 'leaflet/dist/leaflet.css';
import styles from './ChargerMap.module.css';

const MAX_SAFE_ZOOM = 19;
const CLUSTER_ZOOM = 15; // Threshold where bubbles disperse

// Professional Pins with saasPlug aesthetic
const createStationIcon = (status) => {
  const color = status === 'available' ? '#00c853' : (status === 'occupied' ? '#ffab00' : '#ff1744');
  return divIcon({
    html: `
      <div class="${styles.customMarker}" style="--marker-color: ${color}">
        <div class="${styles.markerPin}"></div>
        <div class="${styles.markerDot}"></div>
      </div>
    `,
    className: '',
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -40]
  });
};

/**
 * A popup that displays charger details.
 */
const SmartPopup = ({ charger, onReserve, isAdmin }) => {
  return (
    <motion.div 
      className={styles.mapPopup}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <header className={styles.popupHeader}>
        <div className={styles.popupTitleGroup}>
          <strong className={styles.popupTitle}>{charger.locationName || 'Charging Station'}</strong>
          <p className={styles.popupProvider}>Station #{charger.id} • {charger.providerName}</p>
        </div>
        <span className={`${styles.statusBadge} ${styles[charger.status]}`}>{charger.status}</span>
      </header>
      
      <div className={styles.popupInfo}>
        <div className={styles.popupAddressRow}>
          <span className={styles.addressIcon}>📍</span>
          <p className={styles.popupAddress}>{charger.address}</p>
        </div>
        
        <div className={styles.popupSpecsGrid}>
          <div className={styles.specItem}>
            <span className={styles.specLabel}>Power</span>
            <span className={styles.specValue}>{charger.capacityKw} kW</span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specLabel}>Price</span>
            <span className={styles.specValue}>€{charger.kwhPrice}/kWh</span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specLabel}>Type</span>
            <span className={styles.specValue}>{charger.connectionType || 'Type 2'}</span>
          </div>
        </div>
      </div>
      
      {!isAdmin && (
        <button className={styles.primaryButton} onClick={() => onReserve(charger)}>
          Reserve Station
        </button>
      )}
    </motion.div>
  );
};

/**
 * A popup that lists multiple stations at the same location.
 */
const MultiStationPopup = ({ chargers, onReserve, isAdmin }) => {
  const displayAddress = chargers.length > 0 ? chargers[0].address : "Multiple chargers registered here.";
  const locationName = chargers.length > 0 ? chargers[0].locationName : "Network Hub";

  return (
    <motion.div 
      className={styles.scrollablePopup}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <header className={styles.multiPopupHeader}>
        <h3 className={styles.multiPopupTitle}>{locationName}</h3>
        <p className={styles.popupAddress}>📍 {displayAddress} ({chargers.length} units)</p>
      </header>
      <ul className={styles.stationList}>
        {chargers.map((charger, idx) => (
          <motion.li 
            key={charger.id} 
            className={styles.stationListItem}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.5) }}
          >
            <div className={styles.stationItemMain}>
              <span className={styles.stationItemName}>Station #{charger.id} • {charger.providerName}</span>
              <span className={`${styles.statusBadge} ${styles[charger.status]}`}>
                {charger.status}
              </span>
            </div>
            <div className={styles.stationItemMeta}>
              <span>{charger.capacityKw} kW</span>
              <span>€{charger.kwhPrice}/kWh</span>
              <span>{charger.connectionType || 'Type 2'}</span>
            </div>
            {!isAdmin && (
              <button 
                className={styles.primaryButton} 
                style={{ padding: '6px 12px', fontSize: '0.75rem', height: 'auto', width: 'auto' }}
                onClick={() => onReserve(charger)}
              >
                Reserve
              </button>
            )}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
};

/**
 * A marker that displays charger details.
 */
const SmartMarker = ({ charger, position, onReserve, isAdmin }) => {
  return (
    <Marker 
      position={position} 
      icon={createStationIcon(charger.status)}
    >
      <Popup className={styles.customPopup}>
        <SmartPopup charger={charger} onReserve={onReserve} isAdmin={isAdmin} />
      </Popup>
    </Marker>
  );
};

/**
 * Renders clustered markers that expand upon zoom or show multi-popups for exact matches.
 */
const ClusterMarkers = ({ items, onReserve, isAdmin }) => {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const clusters = useMemo(() => {
    const valid = (items || []).filter(p => {
      const lat = parseFloat(p.latitude);
      const lon = parseFloat(p.longitude);
      return !isNaN(lat) && !isNaN(lon);
    });
    
    // Group markers that are at the EXACT same location
    const exactGroups = {};
    valid.forEach(p => {
      const lat = parseFloat(p.latitude).toFixed(6);
      const lon = parseFloat(p.longitude).toFixed(6);
      const posKey = `${lat},${lon}`;
      if (!exactGroups[posKey]) exactGroups[posKey] = [];
      exactGroups[posKey].push(p);
    });

    if (zoom >= CLUSTER_ZOOM) {
      const finalMarkers = [];
      Object.entries(exactGroups).forEach(([key, groupPoints]) => {
        const [lat, lon] = key.split(',').map(Number);
        if (groupPoints.length === 1) {
          finalMarkers.push({ points: [groupPoints[0]], lat, lon });
        } else {
          // If multiple chargers share the EXACT same coordinate at high zoom,
          // group them into a single "Multi-Station" marker.
          finalMarkers.push({ points: groupPoints, lat, lon, isMulti: true });
        }
      });
      return finalMarkers;
    }

    const res = zoom >= 13 ? 0.008 : (zoom >= 10 ? 0.05 : 0.2);
    const bucket = {};
    valid.forEach(p => {
      const pLat = parseFloat(p.latitude);
      const pLon = parseFloat(p.longitude);
      const k = `${(Math.round(pLat/res)*res).toFixed(4)}-${(Math.round(pLon/res)*res).toFixed(4)}`;
      if (!bucket[k]) bucket[k] = { lat: pLat, lon: pLon, points: [] };
      bucket[k].points.push(p);
    });
    return Object.values(bucket);
  }, [items, zoom]);

  return clusters.map((c, i) => {
    // Only highlight as "problematic" if there's an actual hardware/network issue.
    // 'reserved' and 'occupied' are normal operational states.
    const hasProblem = c.points.some(p => ['outOfOrder', 'malfunctioning', 'offline', 'out_of_order'].includes(p.status));

    if (c.isMulti) {
      return (
        <Marker 
          key={`multi-${c.lat}-${c.lon}`} 
          position={[c.lat, c.lon]} 
          icon={divIcon({
            html: `
              <div class="${styles.multiMarker}" style="${hasProblem ? 'background: #ff1744; border-color: #ffcdd2;' : ''}">
                <span>${c.points.length}</span>
              </div>
            `,
            className: '',
            iconSize: [38, 38],
            iconAnchor: [19, 38],
            popupAnchor: [0, -35]
          })}
        >
          <Popup className={styles.customPopup}>
            <MultiStationPopup chargers={c.points} onReserve={onReserve} isAdmin={isAdmin} />
          </Popup>
        </Marker>
      );
    }

    if (c.points.length === 1) {
      const p = c.points[0];
      return (
        <SmartMarker 
          key={p.id || `p-${i}`} 
          charger={p} 
          position={[c.lat, c.lon]} 
          onReserve={onReserve}
          isAdmin={isAdmin}
        />
      );
    }

    return (
      <Marker 
        key={`cluster-${i}`} 
        position={[c.lat, c.lon]} 
        icon={divIcon({
          html: `
            <div class="${styles.clusterMarker}" style="${hasProblem ? 'background: #ff1744; box-shadow: 0 4px 15px rgba(255, 23, 68, 0.4);' : ''}">
              <div class="${styles.clusterPulse}" style="${hasProblem ? 'border-color: #ff1744;' : ''}"></div>
              <span>${c.points.length}</span>
            </div>
          `,
          className: styles.clusterIconContainer, 
          iconSize: [46, 46],
          iconAnchor: [23, 23]
        })} 
        eventHandlers={{ 
          click: () => {
             const nextZoom = Math.min(MAX_SAFE_ZOOM, zoom + 3);
             map.flyTo([c.lat, c.lon], nextZoom, {
               duration: 1.5,
               easeLinearity: 0.25
             });
          }
        }} 
      />
    );
  });
};

const ChargerMap = ({ chargers, loading, onReserve, isAdmin }) => (
  <div className={styles.mapWrapper}>
    <MapContainer center={[37.9838, 23.7275]} zoom={12} maxZoom={MAX_SAFE_ZOOM} className={styles.leafletMap}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
      <ClusterMarkers items={chargers} onReserve={onReserve} isAdmin={isAdmin} />
    </MapContainer>
    {loading && <div className={styles.mapLoading}>Syncing Infrastructure...</div>}
  </div>
);

export default ChargerMap;
