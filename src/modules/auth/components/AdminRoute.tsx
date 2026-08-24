import { Navigate, Outlet } from 'react-router-dom';
import { LoadingState } from '../../../components/ui/LoadingState';
import { useAuth } from '../context/useAuth';

export const AdminRoute = ({ children }: { children?: React.ReactNode }) => {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState message="Validando permisos..." />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
