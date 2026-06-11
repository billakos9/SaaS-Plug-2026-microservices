import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../services/auth';
import styles from './RegisterPage.module.css';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    try {
      await register({ email, password, name: email.split('@')[0] || 'saasPlug User' });
      navigate('/login', {
        state: { message: 'Account created. Please log in.' },
      });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles["auth-page"]}>
      <div className={styles["auth-glow"]} aria-hidden="true" />
      <div className={styles["auth-card"]}>
        <header className={styles["auth-header"]}>
          <h1>Create Your Account</h1>
          <p>Join saasPlug to reserve chargers, monitor sessions, and view stats.</p>
        </header>

        <form className={styles["auth-form"]} onSubmit={handleSubmit}>
          <label className={styles["auth-field"]}>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@saasplug.app"
              required
            />
          </label>

          <label className={styles["auth-field"]}>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a password"
              required
            />
          </label>

          <label className={styles["auth-field"]}>
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat password"
              required
            />
          </label>
          {error && <div className={`${styles["auth-message"]} ${styles.error}`}>{error}</div>}

          <button type="submit" className={styles["auth-button"]} disabled={loading}>
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>

        <p className={styles["auth-footer"]}>
          Already have an account?{' '}
          <Link className={styles["auth-link"]} to="/login">
            Login
          </Link>
        </p>
      </div>
    </section>
  );
};

export default RegisterPage;

// Optional enhancements
// - Animated saasPlug logo: add a small glowing icon above the title and animate it with keyframes.
// - Background gradient animation: apply the flow keyframes to .auth-page for a shifting glow.
// - Success/failure popups: show toast notifications after submit using a lightweight toast component.
