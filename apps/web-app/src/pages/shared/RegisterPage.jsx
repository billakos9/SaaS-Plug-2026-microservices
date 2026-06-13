import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../services/auth';
import styles from './RegisterPage.module.css';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    username: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    birthdate: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    try {
      // Derive 'name' from first and last name for backend compatibility
      const { name, ...rest } = formData;
      const submissionData = {
        ...rest,
        name: `${formData.firstName} ${formData.lastName}`.trim() || formData.username || formData.email
      };
      await register(submissionData);
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
          <div className={styles["form-row"]}>
            <label className={styles["auth-field"]}>
              First Name
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                required
              />
            </label>
            <label className={styles["auth-field"]}>
              Last Name
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                required
              />
            </label>
          </div>

          <div className={styles["form-row"]}>
            <label className={styles["auth-field"]}>
              Username
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="johndoe88"
                required
              />
            </label>
            <label className={styles["auth-field"]}>
              Phone Number
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="6900000000"
              />
            </label>
          </div>

          <div className={styles["form-row"]}>
            <label className={styles["auth-field"]}>
              Birthdate
              <input
                type="date"
                name="birthdate"
                value={formData.birthdate}
                onChange={handleChange}
              />
            </label>
            <label className={styles["auth-field"]}>
              Email
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@saasplug.app"
                required
              />
            </label>
          </div>

          <label className={styles["auth-field"]}>
            Password
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
              required
            />
          </label>

          <label className={styles["auth-field"]}>
            Confirm Password
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
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
