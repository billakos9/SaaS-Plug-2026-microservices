import { useState } from 'react';
import { registerProvider } from '../../services/providers';
import styles from './ProviderRegisterPage.module.css';

const ProviderRegisterPage = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    apiBaseUrl: '',
    apiKey: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      await registerProvider(form);
      setMessage('Provider registration submitted.');
    } catch (err) {
      setError(err.message || 'Provider registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>Provider onboarding</p>
      <h1>Register provider</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            required
          />
        </label>
        <label>
          Phone number
          <input
            value={form.phoneNumber}
            onChange={(event) => updateField('phoneNumber', event.target.value)}
          />
        </label>
        <label>
          API base URL
          <input
            value={form.apiBaseUrl}
            onChange={(event) => updateField('apiBaseUrl', event.target.value)}
          />
        </label>
        <label>
          API key
          <input
            value={form.apiKey}
            onChange={(event) => updateField('apiKey', event.target.value)}
          />
        </label>

        {message && <div className={styles.alertSuccess}>{message}</div>}
        {error && <div className={styles.alertError}>{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </section>
  );
};

export default ProviderRegisterPage;
