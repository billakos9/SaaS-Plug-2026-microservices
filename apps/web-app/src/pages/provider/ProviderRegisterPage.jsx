import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { selfRegisterProvider } from '../../services/providers';
import logo from '../../assets/LogoOnly.png';
import styles from './ProviderRegisterPage.module.css';

const ProviderRegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    providerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    apiBaseUrl: '',
    apiKey: '',
    registrationCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await selfRegisterProvider({
        providerName: form.providerName,
        email: form.email,
        password: form.password,
        apiBaseUrl: form.apiBaseUrl,
        apiKey: form.apiKey,
        registrationCode: form.registrationCode,
      });
      setMessage('Account created! Redirecting to login…');
      setTimeout(() => navigate('/login', { state: { message: 'Provider account created. Please log in.' } }), 2000);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.authPage}>
      <div className={styles.authGlow} aria-hidden="true" />
      <div className={styles.authCard}>
        <header className={styles.authHeader}>
          <img src={logo} className={styles.authLogo} alt="saasPlug" />
          <p className={styles.eyebrow}>Provider Onboarding</p>
          <h1>Join saasPlug</h1>
          <p className={styles.subtitle}>Register your charging network on the platform.</p>
        </header>

        <form className={styles.authForm} onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <label className={styles.authField}>
              Network Name
              <input
                value={form.providerName}
                onChange={set('providerName')}
                placeholder="e.g. myPlug"
                required
                disabled={loading}
              />
            </label>
            <label className={styles.authField}>
              Email
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@yourcompany.com"
                required
                disabled={loading}
              />
            </label>
          </div>

          <div className={styles.formRow}>
            <label className={styles.authField}>
              Password
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </label>
            <label className={styles.authField}>
              Confirm Password
              <input
                type="password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </label>
          </div>

          <label className={styles.authField}>
            API Base URL
            <input
              type="url"
              value={form.apiBaseUrl}
              onChange={set('apiBaseUrl')}
              placeholder="https://api.yournetwork.com"
              required
              disabled={loading}
            />
          </label>

          <label className={styles.authField}>
            API Key
            <input
              value={form.apiKey}
              onChange={set('apiKey')}
              placeholder="Your provider API key"
              required
              disabled={loading}
            />
          </label>

          <label className={styles.authField}>
            Platform Registration Code
            <input
              value={form.registrationCode}
              onChange={set('registrationCode')}
              placeholder="Provided by saasPlug"
              required
              disabled={loading}
            />
          </label>

          {message && <div className={styles.msgSuccess}>{message}</div>}
          {error   && <div className={styles.msgError}>{error}</div>}

          <button type="submit" className={styles.authButton} disabled={loading}>
            {loading ? 'Registering…' : 'Register Network'}
          </button>
        </form>

        <p className={styles.authFooter}>
          Already have an account?{' '}
          <Link className={styles.authLink} to="/login">Log in</Link>
        </p>
      </div>
    </section>
  );
};

export default ProviderRegisterPage;
