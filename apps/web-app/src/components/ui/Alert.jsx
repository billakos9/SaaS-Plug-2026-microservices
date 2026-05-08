import styles from './Alert.module.css';

const variantClass = {
  success: styles.success,
  error: styles.error,
  info: styles.info,
};

const Alert = ({ variant = 'info', className = '', children }) => (
  <div className={`${styles.alert} ${variantClass[variant] || styles.info} ${className}`.trim()}>
    {children}
  </div>
);

export default Alert;
