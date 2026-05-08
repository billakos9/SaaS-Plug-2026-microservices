import { useState, useEffect } from 'react';
import { getChargersByStatus as getPoints } from '../../services/chargers';
import './ChargerCard.module.css';

const Points = () => {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadPoints();
  }, [filter]);

  const loadPoints = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPoints(filter || null);
      setPoints(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load points');
      console.error('Error loading points:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    const statusMap = {
      'available': 'status-available',
      'charging': 'status-occupied',
      'reserved': 'status-reserved',
      'malfunction': 'status-out-of-order',
      'offline': 'status-out-of-order',
    };
    return statusMap[status?.toLowerCase()] || '';
  };

  if (loading) {
    return <div className="card loading">Loading charging points...</div>;
  }

  return (
    <div className="card">
      <h2>Charging Points</h2>
      
      <div className="filter-group">
        <label htmlFor="status-filter">Filter by Status:</label>
        <select
          id="status-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="available">Available</option>
          <option value="charging">Charging</option>
          <option value="reserved">Reserved</option>
          <option value="malfunction">Out of Order</option>
          <option value="offline">Offline</option>
        </select>
        <button className="btn btn-secondary" onClick={loadPoints}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {points.length === 0 ? (
        <p>No charging points found.</p>
      ) : (
        <div className="points-grid">
          {points.map((point) => (
            <div key={point.id || point._id} className="point-card">
              <h3>Point {point.id || point._id}</h3>
              <p><strong>Status:</strong> {point.status || 'Unknown'}</p>
              {point.location && <p><strong>Location:</strong> {point.location}</p>}
              {(point.capacityKw || point.power) && (
                <p><strong>Power:</strong> {point.capacityKw || point.power} kW</p>
              )}
              <span className={`status-badge ${getStatusClass(point.status)}`}>
                {point.status || 'Unknown'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Points;
