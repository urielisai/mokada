import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { catalogService } from '../services/catalog.service';
import { catalogKeys } from '../../../utils/queryKeys';

export const useProducts = (filters: any) => {
  return useQuery({
    queryKey: catalogKeys.products(filters),
    queryFn: () => catalogService.getProducts(filters),
  });
};

export const useInfiniteProducts = (filters: any) => {
  return useInfiniteQuery({
    queryKey: catalogKeys.products(filters),
    queryFn: ({ pageParam = 1 }) => catalogService.getProducts({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });
};

export const useBrands = () => {
  return useQuery({
    queryKey: catalogKeys.brands(),
    queryFn: catalogService.getBrands,
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: catalogService.getCategories,
  });
};

export const useVehicles = () => {
  return useQuery({
    queryKey: catalogKeys.vehicles(),
    queryFn: catalogService.getVehicles,
  });
};

export const useProductFull = (productId: string | null) => {
  return useQuery({
    queryKey: [...catalogKeys.products({}), 'full', productId],
    queryFn: () => catalogService.getProductFull(productId!),
    enabled: !!productId,
  });
};

export const useSaveProductFull = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: catalogService.saveProductFull,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.products({}) });
    }
  });
};

export const useSaveBrand = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: catalogService.saveBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.brands() });
    }
  });
};

export const useSaveCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: catalogService.saveCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.categories() });
    }
  });
};

export const useVehicleMakes = () => {
  return useQuery({
    queryKey: [...catalogKeys.vehicles(), 'makes'],
    queryFn: catalogService.getVehicleMakes,
  });
};

export const useSaveVehicleMake = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: catalogService.saveVehicleMake,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...catalogKeys.vehicles(), 'makes'] });
    }
  });
};

export const useSaveVehicleModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: catalogService.saveVehicleModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.vehicles() });
    }
  });
};

export const useUploadProductImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, file }: { productId: string; file: File }) =>
      catalogService.uploadProductImage(productId, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.products({}) });
      queryClient.invalidateQueries({ queryKey: [...catalogKeys.products({}), 'full', variables.productId] });
    }
  });
};
