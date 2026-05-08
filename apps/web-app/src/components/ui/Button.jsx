import styles from './Button.module.css';

const variantClass = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger,
};

const Button = ({ as: Component = 'button', variant = 'primary', className = '', ...props }) => (
  <Component
    className={`${styles.button} ${variantClass[variant] || styles.primary} ${className}`.trim()}
    {...props}
  />
);

export default Button;
