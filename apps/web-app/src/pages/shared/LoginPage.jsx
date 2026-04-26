// Login page — email + password form, redirects to home on success
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../../services/auth';
import styles from './LoginPage.module.css';
import logo from '../../assets/LogoOnly.png';

const LoginPage = ({ onLogin }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [info, setInfo] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const message = location.state?.message;
        if(message) {
            setInfo(message);
        }
    }, [location.state]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const user = await login(email, password);
            onLogin?.(user);
            setInfo('Logged in succesfully.');
            navigate('/');
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className={styles.AuthPage}>
            <div className={styles.AuthGlow} aria-hidden='true' />
            <div className={styles.AuthCard}>
                <header className={styles.AuthHeader}>
                    <img src={logo} className={styles.AuthLogo} alt="IonOS" />
                    <h1> Login to reserve</h1>
                    <p>Access your IonOS account to reserve a charger and track sessions.</p>
                </header>

                <form className={styles.AuthForm} onSubmit={handleSubmit}>
                    <label className={styles.AuthField}>
                        Email
                        <input 
                            type = "email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@ionos.app"
                            required
                        />
                    </label>

                    <label className={styles.AuthField}>
                        Password
                        <input  
                            type = "password"
                            value = {password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="????????????"
                            required
                        />
                    </label>

                    {info && <div className={styles.AuthMessageSucces}>{info}</div>}
                    {error && <div className={styles.AuthMessageError}>{error}</div>}

                    <button type = "submit" className={styles.AuthButton} disabled={loading}>
                        {loading ? 'Signing in ...' : 'Login'}
                    </button>
                </form>

                <p className={styles.AuthFooter}>
                    Need an account?{' '}
                    <Link className={styles.AuthLink} to = "/register">
                        Register
                    </Link>
                </p>
            </div>
        </section>
    );
};

export default LoginPage
