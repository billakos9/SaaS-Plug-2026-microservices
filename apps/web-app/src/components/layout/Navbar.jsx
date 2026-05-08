import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import brandLogo from '../../assets/LogoOnly.png';
import { useAuth } from '../../hooks/useAuth';
import styles from './Navbar.module.css';

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();

  const closeMenu = () => setOpen(false);

  const handleLogout = () => {
    logout();
    closeMenu();
  };

  return (
    <>
      <header className={`${styles.navbar} ${open ? styles.navOpen : ''}`}>
        <div className={styles.navContainer}>
          <NavLink to="/" className={styles.brand} aria-label="IonOS home" onClick={closeMenu}>
            <img src={brandLogo} alt="IonOS logo" className={styles.logoMark} />
          </NavLink>

          <button
            type="button"
            className={styles.navToggle}
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls="primary-navigation"
          >
            {open ? 'Close' : 'Menu'}
          </button>

          <ul className={styles.navMenu} id="primary-navigation">
            <li>
              <NavLink to="/" end onClick={closeMenu}>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/map" onClick={closeMenu}>
                Map
              </NavLink>
            </li>
            <li>
              <NavLink to="/charging" onClick={closeMenu}>
                Charging
              </NavLink>
            </li>
            <li>
              <NavLink to="/stats" onClick={closeMenu}>
                Statistics
              </NavLink>
            </li>
            {isAdmin && (
              <li>
                <NavLink to="/admin" onClick={closeMenu}>
                  Admin
                </NavLink>
              </li>
            )}
            <li>
              <NavLink to={user ? '/profile' : '/login'} onClick={closeMenu}>
                {user ? 'Profile' : 'Login'}
              </NavLink>
            </li>
            {user && (
              <li>
                <button type="button" className={styles.logoutButton} onClick={handleLogout}>
                  Logout
                </button>
              </li>
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
