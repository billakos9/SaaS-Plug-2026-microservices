import styles from './Footer.module.css';

const Footer = () => (
  <footer className={styles.siteFooter}>
    <div className={styles.footerInner}>
      <div className={styles.footerBrand}>
        <span className={styles.footerLogo}>saasPlug</span>
        <span className={styles.footerCopy}>2026 saasPlug</span>
      </div>

      <div className={styles.footerActions}>
        <a className={styles.footerButton} href="mailto:contact@saasplug.app">
          Contact
        </a>
      </div>

      <div className={styles.footerLocation}>
        <span className={styles.eyebrow}>Headquarters</span>
        <span>NTUA Campus, Zografos, Athens</span>
      </div>
    </div>
  </footer>
);

export default Footer;
