import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
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
          <Link to="/" className={styles.brand} aria-label="saasPlug home" onClick={closeMenu}>
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
            <li><NavLink to="/" end onClick={closeMenu}>Home</NavLink></li>
            <li><NavLink to="/map" onClick={closeMenu}>Map</NavLink></li>
            
            {user ? (
              <>
                <li><NavLink to="/charging" onClick={closeMenu}>Charging</NavLink></li>
                <li><NavLink to="/stats" onClick={closeMenu}>Statistics</NavLink></li>
                {isAdmin && <li><NavLink to="/admin" onClick={closeMenu}>Admin</NavLink></li>}
                <li><NavLink to="/profile" onClick={closeMenu}>Profile</NavLink></li>
                <li>
                  <button type="button" className={styles.logoutButton} onClick={handleLogout}>
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <li><NavLink to="/login" onClick={closeMenu} className={styles.loginBtn}>Login</NavLink></li>
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
