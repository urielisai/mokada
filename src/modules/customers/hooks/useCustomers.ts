import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerKeys } from '../../../utils/queryKeys';
import {
  customersService,
  type BranchFormValues,
  type CustomerBranch,
  type CustomerBranchOption,
  type CustomerFiscalProfile,
  type CustomerFormValues,
  type FiscalFormValues,
} from '../services/customers.service';

export const useCustomers = (filters: { search?: string }) => {
  return useQuery({
    queryKey: customerKeys.list(filters),
    queryFn: () => customersService.getCustomers(filters),
  });
};

export const useCustomerFiscalProfiles = (customerId: string | null) => {
  return useQuery({
    queryKey: customerKeys.fiscalProfiles(customerId),
    queryFn: () => customersService.getFiscalProfiles(customerId!),
    enabled: Boolean(customerId),
  });
};

export const useCustomerBranches = (customerId: string | null) => {
  return useQuery({
    queryKey: customerKeys.branches(customerId),
    queryFn: () => customersService.getBranches(customerId!),
    enabled: Boolean(customerId),
  });
};

export const useCustomer = (id: string | null) => {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => customersService.getCustomer(id!),
    enabled: Boolean(id),
  });
};

export const useCustomerRoutes = () => {
  return useQuery({
    queryKey: customerKeys.routes(),
    queryFn: customersService.getRoutes,
  });
};

export const useCustomerBranchOptions = () => {
  return useQuery({
    queryKey: customerKeys.branchOptions(),
    queryFn: customersService.getBranchOptions,
  });
};

export const useSaveCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: CustomerFormValues }) =>
      id ? customersService.updateCustomer(id, payload) : customersService.createCustomer(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
};

export const useSaveFiscalProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: FiscalFormValues) => customersService.saveFiscalProfile(payload),
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.fiscalProfiles(profile.customer_id) });
    },
  });
};

export const useToggleFiscalProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profile: CustomerFiscalProfile) => customersService.toggleFiscalProfile(profile),
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.fiscalProfiles(profile.customer_id) });
    },
  });
};

export const useSaveBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BranchFormValues) => customersService.saveBranch(payload),
    onSuccess: (branch) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.branches(branch.customer_id) });
    },
  });
};

export const useUploadBranchImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ branchId, file }: { branchId: string; file: File }) =>
      customersService.uploadBranchImage(branchId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
};

export const useUpdateBranchImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ branchId, imagePath }: { branchId: string; imagePath: string | null }) =>
      customersService.updateBranchImage(branchId, imagePath),
    onSuccess: (branch) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.branches(branch.customer_id) });
    },
  });
};

export const useToggleBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (branch: CustomerBranch) => customersService.toggleBranch(branch),
    onSuccess: (branch) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.branches(branch.customer_id) });
    },
  });
};

export const useAssignBranchRoute = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ branchId, routeId }: { branchId: string; routeId: string | null }) =>
      customersService.assignBranchRoute(branchId, routeId),
    onSuccess: (branch: CustomerBranchOption) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.branches(branch.customer_id) });
    },
  });
};

export const useCustomersWithoutBranches = (enabled = true) => {
  return useQuery({
    queryKey: [...customerKeys.all, 'without-branches'],
    queryFn: customersService.getCustomersWithoutBranches,
    enabled,
  });
};

export const useDeleteCustomersWithoutBranches = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: customersService.deleteCustomersWithoutBranches,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
};
