import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMyInvoices, payMyInvoice, getInvoiceDetail } from '../../services/invoices';
import styles from './ProviderDashboardPage.module.css';

const DetailModal = ({ invoiceId, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    getInvoiceDetail(invoiceId)
      .then(setDetail)
      .catch(err => setError(err.message || 'Failed to load detail'))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const inv = detail?.invoice;
  const lines = detail?.lines || [];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            {inv && <p className={styles.modalSubtitle}>{inv.providerName} · {inv.period}</p>}
            <h2 className={styles.modalTitle}>Invoice #{invoiceId}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <p className={styles.muted}>Loading reservations...</p>
        ) : error ? (
          <div className={styles.alertError}>{error}</div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.invoiceTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Location</th>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Energy (kWh)</th>
                    <th>Rate (€/kWh)</th>
                    <th>Cost (€)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={styles.emptyRow}>No reservations found for this period.</td>
                    </tr>
                  ) : lines.map(line => (
                    <tr key={line.reservationId}>
                      <td>{line.reservationId}</td>
                      <td>{line.locationName}</td>
                      <td>{new Date(line.date).toLocaleDateString()}</td>
                      <td>{line.durationMin} min</td>
                      <td>{line.energyKwh}</td>
                      <td>{line.kwhPrice?.toFixed(2)}</td>
                      <td>{line.cost?.toFixed(2)}</td>
                      <td>
                        <span className={line.status === 'completed' ? styles.paidBadge : styles.pendingBadge}>
                          {line.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {inv && (
              <div className={styles.invoiceSummary}>
                <div className={styles.summaryRow}>
                  <span>Sessions ({inv.totalSessions})</span>
                  <span>€{inv.totalRevenue?.toFixed(2)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Commission ({(inv.commissionRate * 100).toFixed(0)}%)</span>
                  <span>€{inv.commissionAmount?.toFixed(2)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Session fee ({inv.totalSessions} × €{inv.feePerSession?.toFixed(2)})</span>
                  <span>€{inv.sessionFee?.toFixed(2)}</span>
                </div>
                <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                  <span>Total Due</span>
                  <span>€{inv.totalDue?.toFixed(2)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};

const ProviderInvoicesPage = () => {
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [paying, setPaying]       = useState(null);
  const [detailId, setDetailId]   = useState(null);

  useEffect(() => {
    getMyInvoices()
      .then(setInvoices)
      .catch(err => setError(err.message || 'Failed to load invoices'))
      .finally(() => setLoading(false));
  }, []);

  const handlePay = async (invoiceId) => {
    if (!window.confirm(`Pay invoice #${invoiceId}?`)) return;
    setPaying(invoiceId);
    try {
      const updated = await payMyInvoice(invoiceId);
      setInvoices(prev => prev.map(inv => inv.invoiceId === invoiceId ? updated : inv));
    } catch (err) {
      alert(err.message || 'Payment failed');
    } finally {
      setPaying(null);
    }
  };

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Billing</p>
      <h1 className={styles.heading}>My Invoices</h1>

      {loading ? (
        <p className={styles.muted}>Loading invoices...</p>
      ) : error ? (
        <div className={styles.alertError}>{error}</div>
      ) : invoices.length === 0 ? (
        <p className={styles.muted}>No invoices have been issued yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.invoiceTable}>
            <thead>
              <tr>
                <th>Period</th>
                <th>Sessions</th>
                <th>Revenue (€)</th>
                <th>Commission (€)</th>
                <th>Session Fees (€)</th>
                <th>Total Due (€)</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.invoiceId}>
                  <td>{inv.period}</td>
                  <td>{inv.totalSessions}</td>
                  <td>{inv.totalRevenue?.toFixed(2)}</td>
                  <td>{inv.commissionAmount?.toFixed(2)}</td>
                  <td>{inv.sessionFee?.toFixed(2)}</td>
                  <td><strong>{inv.totalDue?.toFixed(2)}</strong></td>
                  <td>
                    <span className={inv.status === 'paid' ? styles.paidBadge : styles.pendingBadge}>
                      {inv.status}
                    </span>
                  </td>
                  <td className={styles.rowActions}>
                    <button className={styles.viewBtn} onClick={() => setDetailId(inv.invoiceId)}>
                      View
                    </button>
                    {inv.status === 'pending' && (
                      <button
                        className={styles.payBtn}
                        onClick={() => handlePay(inv.invoiceId)}
                        disabled={paying === inv.invoiceId}
                      >
                        {paying === inv.invoiceId ? 'Processing...' : 'Pay'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {detailId !== null && (
          <DetailModal invoiceId={detailId} onClose={() => setDetailId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProviderInvoicesPage;
