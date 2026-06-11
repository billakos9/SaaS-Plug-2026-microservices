import { FiMapPin, FiZap, FiBatteryCharging, FiBarChart } from "react-icons/fi";
import chargerVideo from "../../assets/charger.mp4";
import styles from "./HowItWorks.module.css"

export default function HowItWorksSection() {
    const steps = [
        {
            icon: <FiMapPin size = {40} />,
            title: "Find a Charger",
            text: "Locate nearby saasPlug stations on the interactive map.",
        },
        {
            icon: <FiZap size = {40} />,
            title: "Reserve & Start Charging",
            text: "Select a charger, choose your timeslot, and start charging.",
        },
        {
            icon: <FiBatteryCharging size={40} />,
            title: "Track & Complete Session",
            text: "Check your energy usage, costs, and favorite locations over time.",  
        },
        {
            icon: <FiBarChart size={40} />,
            title: "View your Statistics",
            text: "Monitor your charging progress and receive completion notifications.",
        },
    ];

    return (
        <section className={styles.HowItWorks}>
            <video
                className={styles.HowVideo}
                src={chargerVideo}
                autoPlay
                muted
                loop
                playsInline
                aria-hidden="true"
            />
            <div className={styles.HowOverlay} />
            <div className={styles.HowContent} >
                <h2 className={styles.SectionTitle}>HowItWorks</h2>
                <div className={styles.StepsContainer}>
                    {steps.map((step, i) => (
                        <div className={styles.StepBox} key={i}>
                            <div className={styles.icon}>{step.icon}</div>
                            <h3>{step.title}</h3>
                            <p>{step.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}