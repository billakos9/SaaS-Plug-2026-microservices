import styles from './StatusBadge.module.css';

const statusClass = {
  available: styles.available,
  charging: styles.occupied,
  occupied: styles.occupied,
  reserved: styles.reserved,
  malfunction: styles.outOfOrder,
  offline: styles.outOfOrder,
  out_of_order: styles.outOfOrder,
};

const StatusBadge = ({ status }) => (
  <span className={`${styles.badge} ${statusClass[status] || styles.outOfOrder}`}>
    {status || 'unknown'}
  </span>
);

export default StatusBadge;
