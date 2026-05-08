import { useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './ChargerMap.module.css';

const CLUSTER_BREAK_ZOOM = 13;
const MAX_CLUSTER_ZOOM_STEP = 2;
const MAX_SAFE_ZOOM = 19;

const defaultIcon = new L.Icon({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString(),
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString(),
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString(),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -32],
  shadowSize: [41, 41],
});

const statusClass = (state) => {
  const map = {
    available: styles.statusAvailable,
    charging: styles.statusOccupied,
    occupied: styles.statusOccupied,
    reserved: styles.statusReserved,
    malfunction: styles.statusOutOfOrder,
    offline: styles.statusOutOfOrder,
    out_of_order: styles.statusOutOfOrder,
  };

  return map[state] || styles.statusOutOfOrder;
};

const MapCenterPicker = ({ enabled, onPick }) => {
  useMapEvents({
    click: (event) => {
      if (!enabled) return;
      onPick?.({
        lat: event.latlng.lat,
        lon: event.latlng.lng,
      });
    },
  });

  return null;
};

const ChargerPopup = ({ charger, onSelect, onReserve }) => (
  <div className={styles.mapPopup}>
    <div className={styles.popupTitle}>Point {charger.id}</div>
    <div className={styles.muted}>{charger.provider || 'Unknown provider'}</div>
    <div className={`${styles.muted} ${styles.small}`}>
      {charger.location || 'Location unavailable'}
    </div>
    <div className={`${styles.statusBadge} ${statusClass(charger.status)}`}>
      {charger.status || 'unknown'}
    </div>
    <div className={styles.popupActions}>
      <button type="button" className={styles.secondaryButton} onClick={() => onSelect?.(charger)}>
        Select
      </button>
      <button type="button" className={styles.primaryButton} onClick={() => onReserve?.(charger)}>
        Reserve here
      </button>
    </div>
  </div>
);

const ClusterMarkers = ({ items, onSelect, onReserve }) => {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  const filtered = useMemo(
    () =>
      (items || []).filter(
        (point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
      ),
    [items]
  );

  const resolution = zoom >= 13 ? 0.008 : zoom >= 11 ? 0.02 : 0.06;
  const clusters = useMemo(() => {
    if (!filtered.length) return [];

    const bucket = {};
    filtered.forEach((point) => {
      const keyLat = Math.round(point.latitude / resolution) * resolution;
      const keyLon = Math.round(point.longitude / resolution) * resolution;
      const key = `${keyLat}-${keyLon}`;

      if (!bucket[key]) {
        bucket[key] = { lat: keyLat, lon: keyLon, points: [] };
      }

      bucket[key].points.push(point);
    });

    return Object.values(bucket);
  }, [filtered, resolution]);

  if (!filtered.length) return null;

  if (zoom >= CLUSTER_BREAK_ZOOM) {
    return filtered.map((point) => (
      <Marker
        key={point.id}
        position={[point.latitude, point.longitude]}
        icon={defaultIcon}
        eventHandlers={{ click: () => onSelect?.(point) }}
      >
        <Popup>
          <ChargerPopup charger={point} onSelect={onSelect} onReserve={onReserve} />
        </Popup>
      </Marker>
    ));
  }

  return clusters.map((cluster) => {
    if (cluster.points.length === 1) {
      const point = cluster.points[0];

      return (
        <Marker
          key={point.id}
          position={[point.latitude, point.longitude]}
          icon={defaultIcon}
          eventHandlers={{ click: () => onSelect?.(point) }}
        >
          <Popup>
            <ChargerPopup charger={point} onSelect={onSelect} onReserve={onReserve} />
          </Popup>
        </Marker>
      );
    }

    const clusterIcon = divIcon({
      html: `<div class="${styles.clusterMarker}"><span>${cluster.points.length}</span></div>`,
      className: styles.clusterIcon,
      iconSize: [46, 46],
    });

    let markerRef = null;

    return (
      <Marker
        key={`${cluster.lat}-${cluster.lon}`}
        position={[cluster.lat, cluster.lon]}
        icon={clusterIcon}
        ref={(ref) => {
          markerRef = ref;
        }}
        eventHandlers={{
          click: (event) => event.target.openPopup(),
        }}
      >
        <Popup className={styles.clusterPopup} closeButton>
          <div className={styles.clusterPopupHeader}>
            <strong>{cluster.points.length} points nearby</strong>
            {zoom < 17 && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  const targetZoom = Math.min(MAX_SAFE_ZOOM, zoom + MAX_CLUSTER_ZOOM_STEP);
                  map.flyTo([cluster.lat, cluster.lon], targetZoom);
                  map.once('moveend', () => markerRef?.openPopup());
                }}
              >
                Zoom here
              </button>
            )}
          </div>

          <div className={styles.clusterList}>
            {cluster.points.map((point) => (
              <div key={point.id} className={styles.clusterItem}>
                <div className={styles.clusterItemInfo}>
                  <span className={styles.clusterItemTitle}>Point {point.id}</span>
                  <span className={styles.clusterItemSub}>{point.status || 'unknown'}</span>
                </div>
                <div className={styles.clusterActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      const targetZoom = Math.max(
                        CLUSTER_BREAK_ZOOM + 1,
                        Math.min(MAX_SAFE_ZOOM, zoom + MAX_CLUSTER_ZOOM_STEP)
                      );
                      map.flyTo([point.latitude, point.longitude], targetZoom);
                      map.once('moveend', () => onSelect?.(point));
                    }}
                  >
                    Zoom
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => onReserve?.(point)}
                  >
                    Reserve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Popup>
      </Marker>
    );
  });
};

const ChargerMap = ({
  center,
  defaultCenter,
  defaultZoom,
  mapRef,
  radiusKm,
  chargers,
  loading,
  pickMode,
  onCenterPick,
  onSelect,
  onReserve,
}) => {
  const initialCenter = defaultCenter || [37.9838, 23.7275];
  const radiusValue = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 8;

  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={initialCenter}
        zoom={defaultZoom || 11}
        maxZoom={MAX_SAFE_ZOOM}
        scrollWheelZoom
        className={styles.leafletMap}
        whenReady={(event) => {
          if (mapRef) mapRef.current = event.target;
        }}
      >
        <MapCenterPicker enabled={pickMode} onPick={onCenterPick} />
        {center && (
          <Circle
            center={[center.lat, center.lon]}
            radius={radiusValue * 1000}
            pathOptions={{
              color: '#00a7b5',
              fillColor: '#00a7b5',
              fillOpacity: 0.12,
            }}
          />
        )}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClusterMarkers items={chargers} onSelect={onSelect} onReserve={onReserve} />
      </MapContainer>

      {!loading && chargers.length === 0 && (
        <div className={styles.mapEmpty}>
          No chargers found within {radiusValue} km. Change center or increase the radius.
        </div>
      )}
    </div>
  );
};

export default ChargerMap;
