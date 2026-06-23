import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { APP_ROUTES } from '../config/routes';

const ProtectedRoute = ({ children, roles }) => {
  const location = useLocation();
  const { loading, user } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to={APP_ROUTES.login} replace state={{ from: location }} />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to={APP_ROUTES.home} replace />;
  }

  return children;
};

export default ProtectedRoute;
