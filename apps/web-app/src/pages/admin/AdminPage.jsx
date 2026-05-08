import { useState } from 'react';
import { healthCheck, resetPoints, addPoints } from '../../services/admin';
import './AdminPage.module.css';

const Admin = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [pointsFile, setPointsFile] = useState(null);

  const handleHealthCheck = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const data = await healthCheck();
      setHealthStatus(data);
      setMessage('Health check successful!');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Health check failed'
      );
      setHealthStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPoints = async () => {
    if (!window.confirm('Are you sure you want to reset all points? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const data = await resetPoints();
      setMessage(`Points reset successfully! ${data.message || ''}`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to reset points'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddPoints = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      if (!pointsFile) throw new Error('Select a CSV file first');
      const data = await addPoints(pointsFile);
      setMessage(`Points added successfully! ${data.message || ''}`);
      setPointsFile(null);
      e.target.reset();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to add points'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Admin Panel</h2>

        <div style={{ marginBottom: '2rem' }}>
          <h3>Health Check</h3>
          <button
            className="btn btn-primary"
            onClick={handleHealthCheck}
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Run Health Check'}
          </button>
          {healthStatus && (
            <div className="alert alert-success" style={{ marginTop: '1rem' }}>
              <pre>{JSON.stringify(healthStatus, null, 2)}</pre>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3>Reset Points</h3>
          <button
            className="btn btn-danger"
            onClick={handleResetPoints}
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset All Points'}
          </button>
        </div>

        <div>
          <h3>Add Points (CSV upload)</h3>
          <form onSubmit={handleAddPoints}>
            <div className="form-group">
              <label htmlFor="points-file">CSV file *</label>
              <input
                id="points-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setPointsFile(e.target.files?.[0] || null)}
                required
              />
              <p className="muted small">
                Must match the CSV schema used by /admin/resetpoints (same columns as the seed file).
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !pointsFile}
            >
              {loading ? 'Adding...' : 'Add Points'}
            </button>
          </form>
        </div>

        {message && (
          <div className="alert alert-success" style={{ marginTop: '1rem' }}>
            {message}
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
