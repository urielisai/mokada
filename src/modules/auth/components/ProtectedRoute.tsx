import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '../../../components/ui/LoadingState';
import { useAuth } from '../context/useAuth';

export const ProtectedRoute = () => {
  const { session, profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas p-6">
        <LoadingState message="Validando sesion..." className="min-h-[calc(100vh-3rem)]" />
      </div>
    );
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};
