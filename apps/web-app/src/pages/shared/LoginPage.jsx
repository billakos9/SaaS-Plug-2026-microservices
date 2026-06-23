// Login page — email + password form, redirects to home on success
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './LoginPage.module.css';
import logo from '../../assets/LogoOnly.png';

const LoginPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { login, user: currentUser } = useAuth();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [info, setInfo] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (currentUser) {
            navigate('/', { replace: true });
        }
    }, [currentUser, navigate]);

    useEffect(() => {
        const message = location.state?.message;
        if(message) {
            setInfo(message);
        }
    }, [location.state]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setError(null);
        
        try {
            const user = await login(email, password);
            if (user) {
              setInfo('Authenticating...');
              // Navigation will be handled by the useEffect once state propagates
            }
        } catch (err) {
            setError(err.message || 'Login failed');
            setIsSubmitting(false);
        }
    };

    return (
        <section className={styles.AuthPage}>
            <div className={styles.AuthGlow} aria-hidden='true' />
            <div className={styles.AuthCard}>
                <header className={styles.AuthHeader}>
                    <img src={logo} className={styles.AuthLogo} alt="saasPlug" />
                    <h1>Login to saasPlug</h1>
                    <p>Access your account to reserve chargers and track sessions.</p>
                </header>

                <form className={styles.AuthForm} onSubmit={handleSubmit}>
                    <label className={styles.AuthField}>
                        Email
                        <input 
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@saasplug.app"
                            required
                            disabled={isSubmitting}
                        />
                    </label>

                    <label className={styles.AuthField}>
                        Password
                        <input  
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="••••••••"
                            required
                            disabled={isSubmitting}
                        />
                    </label>

                    {info && <div className={styles.AuthMessageSucces}>{info}</div>}
                    {error && <div className={styles.AuthMessageError}>{error}</div>}

                    <button type="submit" className={styles.AuthButton} disabled={isSubmitting}>
                        {isSubmitting ? 'Authenticating...' : 'Login'}
                    </button>
                </form>

                <p className={styles.AuthFooter}>
                    Need an account?{' '}
                    <Link className={styles.AuthLink} to="/register">
                        Register
                    </Link>
                </p>
                <p className={styles.AuthFooter}>
                    Are you a provider?{' '}
                    <Link className={styles.AuthLink} to="/provider/register">
                        Register your network
                    </Link>
                </p>
            </div>
        </section>
    );
};

export default LoginPage;
