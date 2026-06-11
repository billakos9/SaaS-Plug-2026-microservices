// Landing page — hero section with video background, how it works, quick action links
import { Link } from 'react-router-dom';
import heroVideo from '../../assets/vid-homepage.mp4';
import HowItWorksSection from '../../components/ui/HowItWorks'
import styles from './HomePage.module.css'


const Home = ({ user, lastReservation, activeSession }) => {
    return (
        <div className={styles.Home}>
            <section className={styles.heroCard}>
                <video
                    className={styles.heroVideobg}
                    src={heroVideo}
                    autoPlay
                    muted
                    loop
                    playsInline
                    aria-label="saasPlug platform walkthrough"
                />
                <div className={styles.heroOverlay} />

                <div className={styles.heroGrid}>
                    <div className={styles.heroCopy}>
                        <p className={styles.eyebrowHighlight}>saasPlug Charging Network</p>
                        <h2>Charge faster with saasPlug</h2>
                        <div className={styles.heroActions}>
                            <Link className= {`${styles.btn} ${styles.btnPrimary} ${styles.heroBtn}`} to="/map">
                                Find the nearest location
                            </Link>
                            <Link className= {`${styles.btn} ${styles.btnGhost} ${styles.heroBtn}`} to="/reserve">
                                Reserve a slot
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <HowItWorksSection />
        </div>
    );
};

export default Home;