import { useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/shared/HomePage';
import LoginPage from './pages/shared/LoginPage';
import RegisterPage from './pages/shared/RegisterPage';
import ProfilePage from './pages/shared/ProfilePage';
import MapPage from './pages/user/MapPage';
import ReservePage from './pages/user/ReservePage';
import ChargingPage from './pages/user/ChargingPage';
import StatsPage from './pages/user/StatsPage';
import AdminPage from './pages/admin/AdminPage';
import ProviderDashboardPage from './pages/provider/ProviderDashboardPage';
import ProviderInvoicesPage from './pages/provider/ProviderInvoicesPage';
import ProviderRegisterPage from './pages/provider/ProviderRegisterPage';
import ProviderProfilePage from './pages/provider/ProviderProfilePage';
import styles from './App.module.css';

const AppRoutes = () => {
  const [selectedCharger, setSelectedCharger] = useState(null);
  const [reservation, setReservation] = useState(null);
  const [activeSession] = useState(null);
  const { user, isAdmin, isProvider, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className={styles.app}>
        <Navbar />
        <main className={styles.mainContent}>
          <div className="card" style={{ textAlign: 'center', padding: '5rem' }}>
            <p className="muted">Synchronizing with saasPlug network...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <Navbar />

      <main className={styles.mainContent}>
        <Routes>
          <Route
            path="/"
            element={
              isAdmin ? (
                <Navigate to="/admin" replace />
              ) : isProvider ? (
                <Navigate to="/map" replace />
              ) : (
                <HomePage
                  user={user}
                  lastReservation={reservation}
                  activeSession={activeSession}
                />
              )
            }
          />
          <Route path="/map" element={<MapPage user={user} onSelect={setSelectedCharger} />} />
          <Route
            path="/reserve"
            element={
              isAdmin || isProvider ? (
                <Navigate to={isAdmin ? "/admin" : "/map"} replace />
              ) : (
                <ReservePage
                  selectedCharger={selectedCharger}
                  user={user}
                  onReserved={setReservation}
                />
              )
            }
          />
          <Route
            path="/charging"
            element={
              isAdmin || isProvider ? (
                <Navigate to={isAdmin ? "/admin" : "/map"} replace />
              ) : (
                <ChargingPage user={user} />
              )
            }
          />
          <Route path="/stats" element={<StatsPage user={user} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/provider/register" element={<ProviderRegisterPage />} />
          <Route path="/provider" element={<ProviderDashboardPage />} />
          <Route
            path="/provider/invoices"
            element={
              isProvider ? (
                <ProviderInvoicesPage />
              ) : (
                <Navigate to={user ? "/" : "/login"} replace />
              )
            }
          />
          <Route
            path="/profile"
            element={
              isAdmin ? (
                <Navigate to="/admin" replace />
              ) : isProvider ? (
                <Navigate to="/provider/profile" replace />
              ) : (
                <ProfilePage user={user} onLogout={logout} />
              )
            }
          />
          <Route
            path="/provider/profile"
            element={
              isProvider ? (
                <ProviderProfilePage />
              ) : (
                <Navigate to={user ? "/" : "/login"} replace />
              )
            }
          />
          <Route
            path="/admin"
            element={
              isAdmin ? (
                <AdminPage />
              ) : (
                <Navigate
                  to={user ? '/' : '/login'}
                  replace
                  state={{ message: 'Admin access only.' }}
                />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
