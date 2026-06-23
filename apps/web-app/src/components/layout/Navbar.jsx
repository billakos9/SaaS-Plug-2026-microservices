import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import brandLogo from '../../assets/LogoOnly.png';
import { useAuth } from '../../hooks/useAuth';
import { APP_ROUTES } from '../../config/routes';
import styles from './Navbar.module.css';

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user, isAdmin, isProvider, logout } = useAuth();

  const closeMenu = () => setOpen(false);

  const handleLogout = () => {
    logout();
    closeMenu();
  };

  return (
    <>
      <header className={`${styles.navbar} ${open ? styles.navOpen : ''}`}>
        <div className={styles.navContainer}>
          <Link to={APP_ROUTES.home} className={styles.brand} aria-label="saasPlug home" onClick={closeMenu}>
            <img src={brandLogo} alt="saasPlug logo" className={styles.logoMark} />
            <span className={styles.brandName}>saasPlug</span>
          </Link>

          <button
            type="button"
            className={styles.navToggle}
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
          >
            {open ? 'Close' : 'Menu'}
          </button>

          <ul className={styles.navMenu}>
            {!isAdmin && !isProvider && <li><NavLink to={APP_ROUTES.home} end onClick={closeMenu}>Home</NavLink></li>}
            <li>
              <NavLink to={APP_ROUTES.map} onClick={closeMenu}>
                {isAdmin ? 'System Map' : isProvider ? 'My Network' : 'Map'}
              </NavLink>
            </li>

            {user ? (
              <>
                {!isAdmin && !isProvider && <li><NavLink to={APP_ROUTES.charging} onClick={closeMenu}>Charging</NavLink></li>}
                <li>
                  <NavLink to={APP_ROUTES.stats} onClick={closeMenu}>
                    {isAdmin ? 'Global Analytics' : isProvider ? 'Analytics' : 'Statistics'}
                  </NavLink>
                </li>
                {isAdmin ? (
                  <li><NavLink to={APP_ROUTES.admin} onClick={closeMenu}>Management</NavLink></li>
                ) : isProvider ? (
                  <>
                    <li><NavLink to={APP_ROUTES.provider.invoices} onClick={closeMenu}>Invoices</NavLink></li>
                    <li><NavLink to={APP_ROUTES.provider.profile} onClick={closeMenu}>Account</NavLink></li>
                  </>
                ) : (
                  <li><NavLink to={APP_ROUTES.profile} onClick={closeMenu}>Profile</NavLink></li>
                )}
                <li>
                  <button type="button" className={styles.logoutButton} onClick={handleLogout}>
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <li><NavLink to={APP_ROUTES.login} onClick={closeMenu} className={styles.loginBtn}>Login</NavLink></li>
            )}
          </ul>
        </div>
      </header>

      {open && (
        <button
          type="button"
          className={styles.navBackdrop}
          aria-label="Close navigation"
          onClick={closeMenu}
        />
      )}
    </>
  );
};

export default Navbar;
