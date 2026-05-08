import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ children, roles }) => {
  const location = useLocation();
  const { loading, user } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
