import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getAllUsers, getAllAdmins, getAllProviders,
  deleteUser, deleteAdminAccount, deleteProvider,
  getProviderById, registerProvider, createAdminAccount, getSystemHealth,
} from '../../services/admin';
import styles from './AdminPage.module.css';

// ── Health Panel ──────────────────────────────────────────────────────────────

const HealthPanel = () => {
  const [health, setHealth] = useState(null);

  const poll = useCallback(async () => {
    try {
      const data = await getSystemHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [poll]);

  if (!health) return <div className={styles.emptyState}><p>Polling system status...</p></div>;

  return (
    <div className={styles.healthGrid}>
      {Object.entries(health).map(([name, status], i) => (
        <motion.div
          key={name}
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className={styles.healthCard}
        >
          <div className={`${styles.statusIndicator} ${
            status === 'operational' ? styles.statusOnline :
            status === 'degraded'    ? styles.statusChecking : styles.statusOffline
          }`} />
          <div className={styles.serviceInfo}>
            <h3>{name}</h3>
            <p>{status}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────────────

const Modal = ({ title, onClose, children }) => (
  <div className={styles.modalOverlay} onClick={onClose}>
    <motion.div
      className={styles.modal}
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={e => e.stopPropagation()}
    >
      <div className={styles.modalHeader}>
        <h2>{title}</h2>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>
      {children}
    </motion.div>
  </div>
);

const Field = ({ label, value }) => (
  <div className={styles.fieldRow}>
    <span className={styles.fieldLabel}>{label}</span>
    <span className={styles.fieldValue}>{value || '—'}</span>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

const AdminPage = () => {
  const [users, setUsers]         = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('health');

  const [inspectProvider, setInspectProvider] = useState(null);
  const [inspectLoading, setInspectLoading]   = useState(false);

  const [showCreateProvider, setShowCreateProvider] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin]       = useState(false);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Provider form state
  const [pForm, setPForm] = useState({ providerName: '', email: '', password: '', apiBaseUrl: '', apiKey: '' });
  // Admin form state
  const [aForm, setAForm] = useState({ firstName: '', lastName: '', email: '', password: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [regularUsers, adminAccounts, p] = await Promise.all([
        getAllUsers(),
        getAllAdmins(),
        getAllProviders(),
      ]);

      // Normalize admin accounts to the same shape as user accounts
      const normalizedAdmins = adminAccounts.map(a => ({
        userId:   `admin-${a.adminId}`,
        _adminId: a.adminId,
        username: `${a.firstName} ${a.lastName}`,
        email:    a.email,
        role:     'admin',
        isAdmin:  true,
      }));

      setUsers([...regularUsers, ...normalizedAdmins]);
      setProviders(p);
    } catch (err) {
      console.error('Failed to sync management data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── User delete ─────────────────────────────────────────────────────────────
  const handleDeleteUser = async (u) => {
    if (!window.confirm(`Terminate account "${u.username}"?`)) return;
    try {
      if (u.isAdmin) {
        await deleteAdminAccount(u._adminId);
      } else {
        await deleteUser(u.userId);
      }
      setUsers(prev => prev.filter(x => x.userId !== u.userId));
    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  // ── Provider delete ─────────────────────────────────────────────────────────
  const handleDeleteProvider = async (id) => {
    if (!window.confirm(`Remove provider #${id} from the network?`)) return;
    try {
      await deleteProvider(id);
      setProviders(prev => prev.filter(p => p.providerId !== id));
    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  // ── Provider inspect ────────────────────────────────────────────────────────
  const handleInspect = async (providerId) => {
    setInspectLoading(true);
    setInspectProvider({ loading: true });
    try {
      const data = await getProviderById(providerId);
      setInspectProvider(data);
    } catch {
      setInspectProvider(null);
    } finally {
      setInspectLoading(false);
    }
  };

  // ── Create provider ─────────────────────────────────────────────────────────
  const handleCreateProvider = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const created = await registerProvider(pForm);
      setProviders(prev => [...prev, { providerId: created.providerId, providerName: created.providerName, apiBaseUrl: pForm.apiBaseUrl }]);
      setPForm({ providerName: '', email: '', password: '', apiBaseUrl: '', apiKey: '' });
      setShowCreateProvider(false);
    } catch (err) {
      setFormError(err.message || 'Failed to register provider');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Create admin ────────────────────────────────────────────────────────────
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const created = await createAdminAccount(aForm);
      setUsers(prev => [...prev, {
        userId:   `admin-${created.adminId}`,
        _adminId: created.adminId,
        username: `${created.firstName} ${created.lastName}`,
        email:    created.email,
        role:     'admin',
        isAdmin:  true,
      }]);
      setAForm({ firstName: '', lastName: '', email: '', password: '' });
      setShowCreateAdmin(false);
    } catch (err) {
      setFormError(err.message || 'Failed to create admin account');
    } finally {
      setFormLoading(false);
    }
  };

  const tabs = [
    { id: 'health',    label: 'System Health' },
    { id: 'users',     label: 'User Registry' },
    { id: 'providers', label: 'Provider Networks' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={styles.eyebrow}>
          System Administrator
        </motion.span>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={styles.title}>
          saasPlug Command Center
        </motion.h1>
      </header>

      <nav className={styles.tabs}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTab : ''}`}>
            {tab.label}
            {activeTab === tab.id && <motion.div layoutId="activeTab" className={styles.activeIndicator} />}
          </button>
        ))}
      </nav>

      <main className={styles.content}>
        <AnimatePresence mode="wait">

          {activeTab === 'health' && (
            <motion.div key="health" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <HealthPanel />
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className={styles.tableActions}>
                <button className={styles.createBtn} onClick={() => { setFormError(''); setShowCreateAdmin(true); }}>
                  + New Admin Account
                </button>
              </div>
              <div className={styles.managementCard}>
                {loading ? (
                  <div className={styles.emptyState}><p>Synchronizing records...</p></div>
                ) : (
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr><th>Identity</th><th>Status</th><th>Role</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {users.length === 0 ? (
                          <tr><td colSpan={4} className={styles.emptyRow}>No user records found.</td></tr>
                        ) : users.map(u => (
                          <tr key={u.userId}>
                            <td>
                              <div className={styles.userCell}>
                                <div className={styles.avatar}>{u.username?.[0]?.toUpperCase() || 'U'}</div>
                                <div>
                                  <div className={styles.cellName}>{u.username || 'Anonymous'}</div>
                                  <div className={styles.email}>{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className={styles.badge}>Active</span></td>
                            <td><span className={`${styles.badge} ${u.role === 'admin' ? styles.adminBadge : ''}`}>{u.role}</span></td>
                            <td>
                              <div className={styles.actions}>
                                <button onClick={() => handleDeleteUser(u)} className={styles.deleteBtn}>Terminate</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'providers' && (
            <motion.div key="providers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className={styles.tableActions}>
                <button className={styles.createBtn} onClick={() => { setFormError(''); setShowCreateProvider(true); }}>
                  + Register Provider
                </button>
              </div>
              <div className={styles.managementCard}>
                {loading ? (
                  <div className={styles.emptyState}><p>Synchronizing records...</p></div>
                ) : (
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr><th>Identity</th><th>Status</th><th>Role</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {providers.length === 0 ? (
                          <tr><td colSpan={4} className={styles.emptyRow}>No provider records found.</td></tr>
                        ) : providers.map(p => (
                          <tr key={p.providerId}>
                            <td>
                              <div className={styles.userCell}>
                                <div className={`${styles.avatar} ${styles.providerAvatar}`}>{p.providerName?.[0]?.toUpperCase() || 'P'}</div>
                                <div>
                                  <div className={styles.cellName}>{p.providerName}</div>
                                  <div className={styles.email}>{p.apiBaseUrl}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className={styles.badge}>Operational</span></td>
                            <td><span className={`${styles.badge} ${styles.providerBadge}`}>Provider</span></td>
                            <td>
                              <div className={styles.actions}>
                                <button className={styles.inspectBtn} onClick={() => handleInspect(p.providerId)}>Inspect</button>
                                <button className={styles.deleteBtn} onClick={() => handleDeleteProvider(p.providerId)}>Remove</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── Inspect Modal ── */}
      <AnimatePresence>
        {inspectProvider && (
          <Modal title="Provider Details" onClose={() => setInspectProvider(null)}>
            {inspectLoading || inspectProvider.loading ? (
              <div className={styles.emptyState}><p>Loading...</p></div>
            ) : (
              <div className={styles.fieldList}>
                <Field label="Provider ID"   value={inspectProvider.providerId} />
                <Field label="Name"          value={inspectProvider.providerName} />
                <Field label="Email"         value={inspectProvider.email} />
                <Field label="API Base URL"  value={inspectProvider.apiBaseUrl} />
                <Field label="API Key"       value="••••••••••••••••" />
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Create Provider Modal ── */}
      <AnimatePresence>
        {showCreateProvider && (
          <Modal title="Register New Provider" onClose={() => setShowCreateProvider(false)}>
            <form onSubmit={handleCreateProvider} className={styles.form}>
              {formError && <p className={styles.formError}>{formError}</p>}
              <label className={styles.formLabel}>Provider Name
                <input className={styles.formInput} value={pForm.providerName} onChange={e => setPForm(f => ({ ...f, providerName: e.target.value }))} required />
              </label>
              <label className={styles.formLabel}>Email
                <input className={styles.formInput} type="email" value={pForm.email} onChange={e => setPForm(f => ({ ...f, email: e.target.value }))} required />
              </label>
              <label className={styles.formLabel}>Password
                <input className={styles.formInput} type="password" value={pForm.password} onChange={e => setPForm(f => ({ ...f, password: e.target.value }))} required />
              </label>
              <label className={styles.formLabel}>API Base URL
                <input className={styles.formInput} placeholder="http://provider-adapter:3000" value={pForm.apiBaseUrl} onChange={e => setPForm(f => ({ ...f, apiBaseUrl: e.target.value }))} required />
              </label>
              <label className={styles.formLabel}>API Key
                <input className={styles.formInput} value={pForm.apiKey} onChange={e => setPForm(f => ({ ...f, apiKey: e.target.value }))} required />
              </label>
              <button className={styles.submitBtn} type="submit" disabled={formLoading}>
                {formLoading ? 'Registering...' : 'Register Provider'}
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Create Admin Modal ── */}
      <AnimatePresence>
        {showCreateAdmin && (
          <Modal title="Create Admin Account" onClose={() => setShowCreateAdmin(false)}>
            <form onSubmit={handleCreateAdmin} className={styles.form}>
              {formError && <p className={styles.formError}>{formError}</p>}
              <label className={styles.formLabel}>First Name
                <input className={styles.formInput} value={aForm.firstName} onChange={e => setAForm(f => ({ ...f, firstName: e.target.value }))} required />
              </label>
              <label className={styles.formLabel}>Last Name
                <input className={styles.formInput} value={aForm.lastName} onChange={e => setAForm(f => ({ ...f, lastName: e.target.value }))} required />
              </label>
              <label className={styles.formLabel}>Email
                <input className={styles.formInput} type="email" value={aForm.email} onChange={e => setAForm(f => ({ ...f, email: e.target.value }))} required />
              </label>
              <label className={styles.formLabel}>Password
                <input className={styles.formInput} type="password" value={aForm.password} onChange={e => setAForm(f => ({ ...f, password: e.target.value }))} required />
              </label>
              <button className={styles.submitBtn} type="submit" disabled={formLoading}>
                {formLoading ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AdminPage;
