import { supabase } from '../../../lib/supabase/client';
import { storageService } from '../../../lib/supabase/storage';

export type FiscalPersonType = 'INDIVIDUAL' | 'LEGAL_ENTITY';

export interface CustomerSummary {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  phone: string;
  requires_invoice: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  fiscal_profile_count: number;
  active_fiscal_profile_count: number;
  branch_count: number;
  active_branch_count: number;
  default_fiscal_legal_name: string | null;
  default_fiscal_rfc: string | null;
  main_branch_name: string | null;
  main_branch_municipality: string | null;
  main_branch_state: string | null;
  main_branch_image_path: string | null;
  main_branch_route_id: string | null;
  main_branch_route_code: string | null;
  main_branch_route_name: string | null;
}

export interface CustomerRecord {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  phone: string;
  requires_invoice: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerFiscalProfile {
  id: string;
  customer_id: string;
  person_type: FiscalPersonType;
  rfc: string;
  legal_name: string;
  tax_regime: string;
  cfdi_use: string;
  fiscal_zip_code: string;
  billing_email: string;
  billing_street: string | null;
  billing_exterior_number: string | null;
  billing_interior_number: string | null;
  billing_neighborhood: string | null;
  billing_municipality: string | null;
  billing_state: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerBranch {
  id: string;
  customer_id: string;
  name: string;
  manager_name: string | null;
  phone_primary: string;
  phone_secondary: string | null;
  street: string | null;
  exterior_number: string | null;
  interior_number: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  municipality: string | null;
  state: string | null;
  location_references: string | null;
  latitude: number | null;
  longitude: number | null;
  route_id: string | null;
  image_path: string | null;
  is_main: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  routes?: CustomerRouteOption | null;
  customers?: Pick<CustomerRecord, 'name'> | null;
}

export interface CustomerBranchOption extends CustomerBranch {
  customers: Pick<CustomerRecord, 'id' | 'name'> | null;
}

export interface CustomerRouteOption {
  created_at: string;
  updated_at: string;
}

export interface CustomerBranch {
  id: string;
  customer_id: string;
  name: string;
  manager_name: string | null;
  phone_primary: string;
  phone_secondary: string | null;
  street: string | null;
  exterior_number: string | null;
  interior_number: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  municipality: string | null;
  state: string | null;
  location_references: string | null;
  latitude: number | null;
  longitude: number | null;
  route_id: string | null;
  image_path: string | null;
  is_main: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  routes?: CustomerRouteOption | null;
  customers?: Pick<CustomerRecord, 'name'> | null;
}

export interface CustomerBranchOption extends CustomerBranch {
  customers: Pick<CustomerRecord, 'id' | 'name'> | null;
}

export interface CustomerRouteOption {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface CustomerFormValues {
  name: string;
  email: string;
  phone: string;
  requires_invoice: boolean;
  is_active: boolean;
  password?: string;
}

export interface FiscalFormValues {
  id?: string;
  customer_id: string;
  person_type: FiscalPersonType;
  rfc: string;
  legal_name: string;
  tax_regime: string;
  cfdi_use: string;
  fiscal_zip_code: string;
  billing_email: string;
  billing_street?: string | null;
  billing_exterior_number?: string | null;
  billing_interior_number?: string | null;
  billing_neighborhood?: string | null;
  billing_municipality?: string | null;
  billing_state?: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface BranchFormValues {
  id?: string;
  customer_id: string;
  name: string;
  manager_name?: string | null;
  phone_primary: string;
  phone_secondary?: string | null;
  street?: string | null;
  exterior_number?: string | null;
  interior_number?: string | null;
  neighborhood?: string | null;
  postal_code?: string | null;
  municipality?: string | null;
  state?: string | null;
  location_references?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  route_id?: string | null;
  image_path?: string | null;
  is_main: boolean;
  is_active: boolean;
}

interface FunctionResponse<T> {
  data?: T;
  error?: string;
}

export interface CustomerSaveResult {
  customer: CustomerRecord;
  temporary_password?: string;
}

const trimOrNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const trimUpper = (value: string) => value.trim().toUpperCase();
const trimUpperOrNull = (value?: string | null) => {
  const trimmed = trimOrNull(value);
  return trimmed ? trimmed.toUpperCase() : null;
};

const toNumberOrNull = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const invokeCustomers = async <T>(body: Record<string, unknown>, fallbackMessage: string) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/customers`, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as FunctionResponse<T> | null;

  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut();
      throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
    }

    throw new Error(data?.error || fallbackMessage);
  }

  if (data?.error) throw new Error(data.error);
  if (data?.data === undefined) throw new Error(fallbackMessage);

  return data.data;
};

const normalizeCustomerPayload = (payload: CustomerFormValues) => {
  const normalized: any = {
    name: trimUpper(payload.name),
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone.trim(),
    requires_invoice: payload.requires_invoice,
    is_active: payload.is_active,
  };
  if (payload.password !== undefined) {
    normalized.password = payload.password;
  }
  return normalized;
};

const validateCustomerPayload = (payload: CustomerFormValues) => {
  if (!payload.name.trim()) throw new Error('El nombre del cliente es obligatorio.');
  if (!payload.email.trim()) throw new Error('El correo del cliente es obligatorio.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
    throw new Error('Escribe un correo válido para el cliente.');
  }
  if (payload.password !== undefined) {
    if (!payload.password.trim()) {
      throw new Error('La contraseña es obligatoria.');
    }
    if (payload.password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }
  }
};

const normalizeFiscalPayload = (payload: FiscalFormValues) => ({
  customer_id: payload.customer_id,
  person_type: payload.person_type,
  rfc: trimUpper(payload.rfc),
  legal_name: trimUpper(payload.legal_name),
  tax_regime: trimUpper(payload.tax_regime),
  cfdi_use: trimUpper(payload.cfdi_use),
  fiscal_zip_code: payload.fiscal_zip_code.trim(),
  billing_email: payload.billing_email.trim().toLowerCase(),
  billing_street: trimUpperOrNull(payload.billing_street),
  billing_exterior_number: trimUpperOrNull(payload.billing_exterior_number),
  billing_interior_number: trimUpperOrNull(payload.billing_interior_number),
  billing_neighborhood: trimUpperOrNull(payload.billing_neighborhood),
  billing_municipality: trimUpperOrNull(payload.billing_municipality),
  billing_state: trimUpperOrNull(payload.billing_state),
  is_default: payload.is_default,
  is_active: payload.is_active,
});

const normalizeBranchPayload = (payload: BranchFormValues) => ({
  customer_id: payload.customer_id,
  name: trimUpper(payload.name),
  manager_name: trimUpperOrNull(payload.manager_name),
  phone_primary: payload.phone_primary.trim(),
  phone_secondary: trimOrNull(payload.phone_secondary),
  street: trimUpperOrNull(payload.street),
  exterior_number: trimUpperOrNull(payload.exterior_number),
  interior_number: trimUpperOrNull(payload.interior_number),
  neighborhood: trimUpperOrNull(payload.neighborhood),
  postal_code: trimOrNull(payload.postal_code),
  municipality: trimUpperOrNull(payload.municipality),
  state: trimUpperOrNull(payload.state),
  location_references: trimUpperOrNull(payload.location_references),
  latitude: toNumberOrNull(payload.latitude),
  longitude: toNumberOrNull(payload.longitude),
  route_id: trimOrNull(payload.route_id),
  image_path: trimOrNull(payload.image_path),
  is_main: payload.is_main,
  is_active: payload.is_active,
});

const validateBranchPayload = (payload: BranchFormValues) => {
  const postalCode = trimOrNull(payload.postal_code);
  const latitude = toNumberOrNull(payload.latitude);
  const longitude = toNumberOrNull(payload.longitude);

  if (!payload.customer_id?.trim()) throw new Error('Selecciona un cliente para la sucursal.');
  if (!payload.name.trim()) throw new Error('El nombre de la sucursal es obligatorio.');
  if (!payload.phone_primary.trim()) throw new Error('El teléfono principal de la sucursal es obligatorio.');
  if (postalCode && !/^\d{5}$/.test(postalCode)) throw new Error('El código postal debe tener 5 dígitos.');
  if (latitude !== null && (latitude < -90 || latitude > 90)) throw new Error('La latitud debe estar entre -90 y 90.');
  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    throw new Error('La longitud debe estar entre -180 y 180.');
  }
};

const getRoutes = async () => {
  const { data, error } = await (supabase as any)
    .from('routes')
    .select('id, code, name, is_active')
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) throw error;
  return (data || []) as CustomerRouteOption[];
};

const getCustomers = async ({ search = '' }: { search?: string }) => {
  let query = (supabase as any).from('customer_summaries').select('*').order('created_at', { ascending: false });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    query = query.or(
      `name.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CustomerSummary[];
};

const getCustomer = async (id: string) => {
  const { data, error } = await (supabase as any)
    .from('customer_summaries')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as CustomerSummary;
};

const createCustomer = async (payload: CustomerFormValues) => {
  validateCustomerPayload(payload);

  return invokeCustomers<CustomerSaveResult>(
    { action: 'create', payload: normalizeCustomerPayload(payload) },
    'No se pudo crear el cliente.',
  );
};

const updateCustomer = async (id: string, payload: CustomerFormValues) => {
  validateCustomerPayload(payload);

  return invokeCustomers<CustomerSaveResult>(
    { action: 'update', id, payload: normalizeCustomerPayload(payload) },
    'No se pudo actualizar el cliente.',
  );
};

const getFiscalProfiles = async (customerId: string) => {
  const { data, error } = await (supabase as any)
    .from('customer_fiscal_profiles')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CustomerFiscalProfile[];
};

const saveFiscalProfile = async (payload: FiscalFormValues) => {
  const { id, ...rest } = payload;
  const dataToSave = normalizeFiscalPayload(rest);
  const request = id
    ? (supabase as any).from('customer_fiscal_profiles').update(dataToSave).eq('id', id)
    : (supabase as any).from('customer_fiscal_profiles').insert([dataToSave]);

  const { data, error } = await request.select('*').single();
  if (error) throw error;
  return data as CustomerFiscalProfile;
};

const toggleFiscalProfile = async (profile: CustomerFiscalProfile) => {
  const { data, error } = await (supabase as any)
    .from('customer_fiscal_profiles')
    .update({ is_active: !profile.is_active })
    .eq('id', profile.id)
    .select('*')
    .single();

  if (error) throw error;
  return data as CustomerFiscalProfile;
};

const getBranches = async (customerId: string) => {
  const { data, error } = await (supabase as any)
    .from('customer_branches')
    .select('*, routes(id, code, name, is_active), customers(name)')
    .eq('customer_id', customerId)
    .order('is_main', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CustomerBranch[];
};

const getBranchOptions = async () => {
  const { data, error } = await (supabase as any)
    .from('customer_branches')
    .select('*, routes(id, code, name, is_active), customers(id, name)')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as CustomerBranchOption[];
};

const saveBranch = async (payload: BranchFormValues) => {
  validateBranchPayload(payload);

  const { id, ...rest } = payload;
  const dataToSave = normalizeBranchPayload(rest);
  const request = id
    ? (supabase as any).from('customer_branches').update(dataToSave).eq('id', id)
    : (supabase as any).from('customer_branches').insert([dataToSave]);

  const { data, error } = await request.select('*').single();
  if (error) throw error;
  return data as CustomerBranch;
};

const uploadBranchImage = async (branchId: string, file: File) => {
  return storageService.uploadFile({
    bucket: 'customer-branches',
    file,
    ownerId: branchId,
    folder: 'branches',
    upsert: false,
  });
};

const updateBranchImage = async (branchId: string, imagePath: string | null) => {
  const { data, error } = await (supabase as any)
    .from('customer_branches')
    .update({ image_path: imagePath })
    .eq('id', branchId)
    .select('*, routes(id, code, name, is_active), customers(id, name)')
    .single();

  if (error) throw error;
  return data as CustomerBranchOption;
};

const getBranchImageUrl = (path: string | null) => {
  return storageService.getPublicUrl('customer-branches', path);
};

const toggleBranch = async (branch: CustomerBranch) => {
  const { data, error } = await (supabase as any)
    .from('customer_branches')
    .update({ is_active: !branch.is_active })
    .eq('id', branch.id)
    .select('*')
    .single();

  if (error) throw error;
  return data as CustomerBranch;
};

const assignBranchRoute = async (branchId: string, routeId: string | null) => {
  const { data, error } = await (supabase as any)
    .from('customer_branches')
    .update({ route_id: routeId || null })
    .eq('id', branchId)
    .select('*, routes(id, code, name, is_active), customers(id, name)')
    .single();

  if (error) throw error;
  return data as CustomerBranchOption;
};

export const fiscalPersonTypeLabels: Record<FiscalPersonType, string> = {
  INDIVIDUAL: 'Persona física',
  LEGAL_ENTITY: 'Persona moral',
};

export const customersService = {
  assignBranchRoute,
  createCustomer,
  getBranchImageUrl,
  getBranchOptions,
  getBranches,
  getCustomer,
  getCustomers,
  getFiscalProfiles,
  getRoutes,
  saveBranch,
  saveFiscalProfile,
  toggleBranch,
  toggleFiscalProfile,
  updateBranchImage,
  updateCustomer,
  uploadBranchImage,
};
