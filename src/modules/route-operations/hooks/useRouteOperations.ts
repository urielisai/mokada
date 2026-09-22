import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { routeService } from '../services/route.service';
import { expenseService } from '../services/expense.service';
import { routeKeys, expenseKeys, settlementKeys, routeOpsKeys } from '../../../utils/queryKeys';

// Routes
export const useRoutes = () => {
  return useQuery({
    queryKey: routeKeys.routes(),
    queryFn: routeService.getRoutes,
  });
};

export const useRoute = (id: string | null) => {
  return useQuery({
    queryKey: routeKeys.route(id!),
    queryFn: () => routeService.getRoute(id!),
    enabled: !!id,
  });
};

export const useSaveRoute = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: routeService.saveRoute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routeKeys.routes() });
    },
  });
};

export const useDeleteRoute = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: routeService.deleteRoute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routeKeys.routes() });
    },
  });
};

// Route Trips
export const useRouteTrips = (filters?: any) => {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel('route-trips-admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'route_trips' }, () => {
        queryClient.invalidateQueries({ queryKey: routeKeys.all });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
  return useQuery({
    queryKey: routeKeys.trips(filters),
    queryFn: () => routeService.getTrips(filters),
  });
};

export const useRouteTrip = (id: string | null) => {
  return useQuery({
    queryKey: routeKeys.trip(id!),
    queryFn: () => routeService.getTrip(id!),
    enabled: !!id,
  });
};

export const useSaveRouteTrip = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: routeService.saveTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routeKeys.all });
    },
  });
};

export const useUpdateTripStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => routeService.updateTripStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routeKeys.all });
    },
  });
};

export const useMyCurrentTrip = (agentProfileId: string | null) => {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!agentProfileId) return;
    const channel = supabase.channel(`route-trips-agent-live-${agentProfileId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'route_trips' }, () => {
        queryClient.invalidateQueries({ queryKey: routeKeys.myTrip() });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [agentProfileId, queryClient]);
  return useQuery({
    queryKey: [...routeKeys.myTrip(), agentProfileId],
    queryFn: () => routeService.getMyCurrentTrip(agentProfileId!),
    enabled: !!agentProfileId,
    refetchInterval: 10000,
  });
};

export const useAgents = () => {
  return useQuery({
    queryKey: ['agents'],
    queryFn: routeService.getAgents,
  });
};

export const useAvailableVehicles = () => {
  return useQuery({
    queryKey: ['available-vehicles'],
    queryFn: routeService.getAvailableVehicles,
  });
};

// Expenses
export const useExpenseCategories = () => {
  return useQuery({
    queryKey: expenseKeys.categories(),
    queryFn: expenseService.getCategories,
  });
};

export const useTripExpenses = (tripId: string | null) => {
  return useQuery({
    queryKey: expenseKeys.tripExpenses(tripId!),
    queryFn: () => expenseService.getTripExpenses(tripId!),
    enabled: !!tripId,
  });
};

export const useSaveExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: expenseService.saveExpense,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.tripExpenses(variables.route_trip_id) });
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
      queryClient.invalidateQueries({ queryKey: routeOpsKeys.dashboard() });
    },
  });
};

export const useUpdateExpenseStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => expenseService.updateExpenseStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
    },
  });
};

export const useUploadExpenseAttachment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expense, file, attachmentType, uploadedBy }: { expense: { id: string; route_trip_id: string }; file: File; attachmentType: string; uploadedBy: string }) =>
      expenseService.uploadAttachment(expense, file, attachmentType, uploadedBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.tripExpenses(variables.expense.route_trip_id) });
    },
  });
};

// Financial & Settlements
export const useFinancialSummary = (filters?: any) => {
  return useQuery({
    queryKey: settlementKeys.financialSummary(filters),
    queryFn: () => expenseService.getFinancialSummary(filters),
  });
};

export const useSettlements = () => {
  return useQuery({
    queryKey: settlementKeys.list(),
    queryFn: expenseService.getSettlements,
  });
};

export const useCreateSettlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: expenseService.createSettlement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settlementKeys.all });
      queryClient.invalidateQueries({ queryKey: routeKeys.all });
      queryClient.invalidateQueries({ queryKey: routeOpsKeys.dashboard() });
    },
  });
};

// Dashboard
export const useRouteOpsDashboard = () => {
  return useQuery({
    queryKey: routeOpsKeys.dashboard(),
    queryFn: expenseService.getDashboardStats,
  });
};
