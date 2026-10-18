import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../auth/context/useAuth';
import { useRouteStore } from '../../../store/routeStore';

export interface ScopedRouteOption {
  id: string;
  code: string | null;
  name: string;
}

/**
 * Routes the current user may work with: admins get every active route,
 * agents only the routes assigned to them in "Roles de rutas" (routes.agent_id).
 * RLS enforces the same rule; the explicit agent filter keeps the UI correct
 * even if a broader policy exists.
 */
const getScopedRoutes = async (profileId: string, isAdmin: boolean) => {
  let query = (supabase as any)
    .from('routes')
    .select('id, code, name')
    .eq('is_active', true);

  if (!isAdmin) query = query.eq('agent_id', profileId);

  const { data, error } = await query
    .order('sequence_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as ScopedRouteOption[];
};

export const useRouteScope = () => {
  const { profile, isAdmin } = useAuth();
  const { globalSelectedRouteId, setGlobalSelectedRouteId } = useRouteStore();
  const profileId = profile?.id;

  const { data: routeOptions = [], isLoading } = useQuery({
    queryKey: ['routes', 'scope', profileId, isAdmin],
    queryFn: () => getScopedRoutes(profileId as string, isAdmin),
    enabled: Boolean(profileId),
  });

  // Ignore a persisted selection that doesn't belong to this user's routes.
  const selectedRouteId = routeOptions.some((route) => route.id === globalSelectedRouteId)
    ? globalSelectedRouteId
    : '';

  // null = no restriction (admin with "Todas las rutas").
  const allowedRouteIds = useMemo<string[] | null>(() => {
    if (selectedRouteId) return [selectedRouteId];
    if (isAdmin) return null;
    return routeOptions.map((route) => route.id);
  }, [isAdmin, routeOptions, selectedRouteId]);

  // Agents also keep records without a route (e.g. a customer they created
  // before assigning a branch route) when no specific route is selected.
  const matchesRoute = useCallback(
    (routeId: string | null | undefined) => {
      if (!allowedRouteIds) return true;
      if (!routeId) return !isAdmin && !selectedRouteId;
      return allowedRouteIds.includes(routeId);
    },
    [allowedRouteIds, isAdmin, selectedRouteId],
  );

  return {
    isAdmin,
    isLoading,
    routeOptions,
    selectedRouteId,
    setSelectedRouteId: setGlobalSelectedRouteId,
    allowedRouteIds,
    matchesRoute,
  };
};
