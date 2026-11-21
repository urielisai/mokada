import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Download,
  ExternalLink,
  LocateFixed,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  ReceiptText,
  Save,
  ToggleLeft,
  ToggleRight,
  UserRound,
} from 'lucide-react';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Modal } from '../../../components/ui/Modal';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { AlertModal } from '../../../components/ui/AlertModal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { IconButton } from '../../../components/ui/IconButton';
import mokadaLogo from '../../../assets/logo.svg';
import { createBrandedQrDataUrl } from '../../../utils/qr';
import { cfdiUseOptions, fiscalRegimeOptions } from '../../../utils/fiscalCatalogs';
import { EditableBranchImage } from '../components/CustomerBranchFormModal';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { useRouteScope } from '../../route-operations/hooks/useRouteScope';
import {
  useCustomer,
  useCustomerBranches,
  useCustomerFiscalProfiles,
  useCustomerRoutes,
  useSaveBranch,
  useSaveCustomer,
  useSaveFiscalProfile,
  useToggleFiscalProfile,
  useUploadBranchImage,
} from '../hooks/useCustomers';
import {
  customersService,
  fiscalPersonTypeLabels,
  type BranchFormValues,
  type CustomerBranch,
  type CustomerFiscalProfile,
  type CustomerFormValues,
  type CustomerRouteOption,
  type CustomerSummary,
  type FiscalFormValues,
  type FiscalPersonType,
} from '../services/customers.service';

type TabId = 'general' | 'fiscal';
type FiscalDialogState = { mode: 'create' } | { mode: 'edit'; profile: CustomerFiscalProfile };
type ConfirmAction = { type: 'fiscal'; profile: CustomerFiscalProfile };

interface CredentialNotice {
  email: string;
  password: string;
}

const sepomexApiUrl = 'https://sepomex.kurenn.dev/api/v1/zip_codes';

interface SepomexZipCode {
  d_asenta?: string;
  d_mnpio?: string;
  d_estado?: string;
}

interface SepomexResponse {
  zip_codes?: SepomexZipCode[];
  message?: string;
}

const emptyCustomerForm: CustomerFormValues = {
  name: '',
  email: '',
  phone: '',
  requires_invoice: false,
  is_active: true,
  password: '12345678',
};

const createEmptyGeneralBranchForm = (routeId = ''): BranchFormValues => ({
  customer_id: '',
  name: '',
  manager_name: '',
  phone_primary: '',
  phone_secondary: '',
  street: '',
  exterior_number: '',
  interior_number: '',
  neighborhood: '',
  postal_code: '',
  municipality: '',
  state: '',
  location_references: '',
  latitude: '',
  longitude: '',
  route_id: routeId,
  image_path: null,
  is_main: true,
  is_active: true,
});

const normalizeBranchCoord = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildBranchEmbedMapUrl = (latitude: number, longitude: number) => {
  const delta = 0.006;
  const left = longitude - delta;
  const right = longitude + delta;
  const top = latitude + delta;
  const bottom = latitude - delta;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${latitude}%2C${longitude}`;
};

export const CustomerFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = Boolean(id);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [form, setForm] = useState<CustomerFormValues>(emptyCustomerForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [credentialNotice, setCredentialNotice] = useState<CredentialNotice | null>(
    (location.state as { credentialNotice?: CredentialNotice } | null)?.credentialNotice || null,
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [fiscalDialog, setFiscalDialog] = useState<FiscalDialogState | null>(null);
  const [qrBranch, setQrBranch] = useState<CustomerBranch | null>(null);
  const [fiscalError, setFiscalError] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'success' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error',
  });

  const { data: customer, isLoading: isCustomerLoading, isError, error } = useCustomer(id || null);
  const { data: fiscalProfiles = [], isLoading: isFiscalLoading } = useCustomerFiscalProfiles(id || null);
  const { data: branches = [] } = useCustomerBranches(id || null);
  const { data: routeOptions = [] } = useCustomerRoutes();
  const { isAdmin, routeOptions: scopedRoutes, selectedRouteId } = useRouteScope();

  const availableRoutes = useMemo<CustomerRouteOption[]>(() => {
    if (routeOptions.length > 0) return routeOptions;
    return scopedRoutes.map((route) => ({
      id: route.id,
      code: route.code || 'RUTA',
      name: route.name,
      is_active: route.is_active ?? true,
    }));
  }, [routeOptions, scopedRoutes]);

  const defaultBranchRouteId = useMemo(() => {
    if (selectedRouteId && availableRoutes.some((route) => route.id === selectedRouteId)) {
      return selectedRouteId;
    }
    if (availableRoutes.length === 1) return availableRoutes[0].id;
    if (!isAdmin && availableRoutes.length > 0) {
      return availableRoutes[0].id;
    }
    return '';
  }, [availableRoutes, isAdmin, selectedRouteId]);

  const branchModalRouteOptions = useMemo<CustomerRouteOption[]>(() => {
    // Un administrador puede elegir cualquier ruta activa.
    // Un vendedor solo puede dar de alta en la ruta que tiene activa en la sesión.
    if (isAdmin) return availableRoutes;
    if (defaultBranchRouteId) {
      return availableRoutes.filter((route) => route.id === defaultBranchRouteId);
    }
    return availableRoutes.slice(0, 1);
  }, [availableRoutes, defaultBranchRouteId, isAdmin]);

  const [generalBranchForm, setGeneralBranchForm] = useState<BranchFormValues>(() =>
    createEmptyGeneralBranchForm(''),
  );
  const [branchNameManuallyEdited, setBranchNameManuallyEdited] = useState(false);
  const [branchPhoneManuallyEdited, setBranchPhoneManuallyEdited] = useState(false);
  const [generalBranchImageFile, setGeneralBranchImageFile] = useState<File | null>(null);
  const [generalBranchExistingImageUrl, setGeneralBranchExistingImageUrl] = useState<string | null>(null);
  const [generalBranchImagePreviewUrl, setGeneralBranchImagePreviewUrl] = useState('');
  const [generalBranchLocationError, setGeneralBranchLocationError] = useState('');
  const [isGeneralBranchLocating, setIsGeneralBranchLocating] = useState(false);
  const [isGeneralPostalLoading, setIsGeneralPostalLoading] = useState(false);
  const [generalPostalError, setGeneralPostalError] = useState('');
  const [generalPostalNeighborhoods, setGeneralPostalNeighborhoods] = useState<string[]>([]);

  const generalBranchRouteSearchOptions = useMemo(
    () =>
      branchModalRouteOptions.map((routeOption) => ({
        value: routeOption.id,
        label: `${routeOption.code} - ${routeOption.name}`,
        description: routeOption.is_active ? 'Ruta activa' : 'Ruta inactiva',
        keywords: `${routeOption.code} ${routeOption.name}`,
      })),
    [branchModalRouteOptions],
  );

  // Mantener sincronizada la ruta activa de la sesión para vendedores (y default inicial para admin)
  useEffect(() => {
    if (!isAdmin && defaultBranchRouteId && generalBranchForm.route_id !== defaultBranchRouteId) {
      setGeneralBranchForm((current) => ({ ...current, route_id: defaultBranchRouteId }));
    } else if (isAdmin && !generalBranchForm.route_id && defaultBranchRouteId) {
      setGeneralBranchForm((current) => ({ ...current, route_id: defaultBranchRouteId }));
    }
  }, [defaultBranchRouteId, generalBranchForm.route_id, isAdmin]);

  // En modo edición, poblar los datos de la sucursal principal en la sección General
  useEffect(() => {
    if (!isEditing || !branches.length) return;
    const mainBranch = branches.find((b) => b.is_main) || branches[0];
    if (!mainBranch) return;

    setGeneralBranchForm({
      id: mainBranch.id,
      customer_id: mainBranch.customer_id,
      name: mainBranch.name || '',
      manager_name: mainBranch.manager_name || '',
      phone_primary: mainBranch.phone_primary || '',
      phone_secondary: mainBranch.phone_secondary || '',
      street: mainBranch.street || '',
      exterior_number: mainBranch.exterior_number || '',
      interior_number: mainBranch.interior_number || '',
      neighborhood: mainBranch.neighborhood || '',
      postal_code: mainBranch.postal_code || '',
      municipality: mainBranch.municipality || '',
      state: mainBranch.state || '',
      location_references: mainBranch.location_references || '',
      latitude: mainBranch.latitude ?? '',
      longitude: mainBranch.longitude ?? '',
      route_id: (!isAdmin && defaultBranchRouteId) ? defaultBranchRouteId : (mainBranch.route_id || defaultBranchRouteId || ''),
      image_path: mainBranch.image_path || null,
      is_main: mainBranch.is_main ?? true,
      is_active: mainBranch.is_active ?? true,
    });
    setGeneralBranchExistingImageUrl(customersService.getBranchImageUrl(mainBranch.image_path || null));
    setBranchNameManuallyEdited(true);
    setBranchPhoneManuallyEdited(true);
  }, [branches, defaultBranchRouteId, isAdmin, isEditing]);

  // Autocompletado de código postal SEPOMEX para la sucursal en General
  useEffect(() => {
    const postalCode = (generalBranchForm.postal_code || '').replace(/\D/g, '').slice(0, 5);
    if (postalCode.length !== 5) {
      setGeneralPostalNeighborhoods([]);
      setGeneralPostalError('');
      setIsGeneralPostalLoading(false);
      return;
    }

    const abortController = new AbortController();
    const lookupPostal = async () => {
      setIsGeneralPostalLoading(true);
      setGeneralPostalError('');
      try {
        const params = new URLSearchParams({ zip_code: postalCode, per_page: '200' });
        const response = await fetch(`${sepomexApiUrl}?${params.toString()}`, { signal: abortController.signal });
        const data = (await response.json()) as SepomexResponse;
        const zipCodes = data.zip_codes || [];
        if (!response.ok || !zipCodes.length) {
          throw new Error(data.message || 'No se encontró información para este código postal.');
        }
        const firstZip = zipCodes[0];
        const neighborhoods = Array.from(
          new Set(zipCodes.map((z) => z.d_asenta).filter((n): n is string => Boolean(n))),
        );
        setGeneralPostalNeighborhoods(neighborhoods);
        setGeneralBranchForm((current) => ({
          ...current,
          neighborhood:
            current.neighborhood && (!neighborhoods.length || neighborhoods.includes(current.neighborhood))
              ? current.neighborhood
              : neighborhoods[0] || current.neighborhood,
          municipality: firstZip?.d_mnpio || current.municipality,
          state: firstZip?.d_estado || current.state,
        }));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setGeneralPostalNeighborhoods([]);
        setGeneralPostalError(err instanceof Error ? err.message : 'No se pudo consultar el código postal.');
      } finally {
        if (!abortController.signal.aborted) setIsGeneralPostalLoading(false);
      }
    };
    void lookupPostal();
    return () => abortController.abort();
  }, [generalBranchForm.postal_code]);

  const handleGeneralPostalCodeChange = (value: string) => {
    const postalCode = value.replace(/\D/g, '').slice(0, 5);
    setGeneralPostalNeighborhoods([]);
    setGeneralPostalError('');
    setGeneralBranchForm((current) => ({
      ...current,
      postal_code: postalCode,
      neighborhood: postalCode === current.postal_code ? current.neighborhood : '',
      municipality: postalCode === current.postal_code ? current.municipality : '',
      state: postalCode === current.postal_code ? current.state : '',
    }));
  };

  const useGeneralBranchCurrentLocation = () => {
    setGeneralBranchLocationError('');
    if (!navigator.geolocation) {
      setGeneralBranchLocationError('Este navegador no permite tomar la ubicación actual.');
      return;
    }
    setIsGeneralBranchLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLat = Number(position.coords.latitude.toFixed(7));
        const nextLng = Number(position.coords.longitude.toFixed(7));
        setGeneralBranchForm((current) => ({
          ...current,
          latitude: nextLat,
          longitude: nextLng,
        }));
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${nextLat}&lon=${nextLng}&addressdetails=1`,
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data?.address || {};
            const road = addr.road || addr.pedestrian || addr.footway || addr.residential || '';
            const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
            const neigh = addr.neighbourhood || addr.suburb || addr.quarter || '';
            setGeneralBranchForm((current) => ({
              ...current,
              street: current.street || road,
              exterior_number: current.exterior_number || addr.house_number || '',
              neighborhood: current.neighborhood || neigh,
              postal_code: current.postal_code || (addr.postcode || '').replace(/\D/g, '').slice(0, 5),
              municipality: current.municipality || city,
              state: current.state || addr.state || '',
            }));
          }
        } catch {
          // Dirección inversa opcional
        }
        setIsGeneralBranchLocating(false);
      },
      () => {
        setGeneralBranchLocationError('No se pudo obtener la ubicación. Revisa permisos del navegador.');
        setIsGeneralBranchLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const saveCustomer = useSaveCustomer();
  const saveFiscalProfile = useSaveFiscalProfile();
  const toggleFiscalProfile = useToggleFiscalProfile();
  const saveBranch = useSaveBranch();
  const uploadBranchImage = useUploadBranchImage();
  const currentMainBranch = useMemo(
    () => branches.find((b) => b.is_main) || branches[0] || null,
    [branches],
  );

  useEffect(() => {
    if (!customer) return;

    setForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      requires_invoice: customer.requires_invoice,
      is_active: customer.is_active,
      password: '',
    });
  }, [customer]);

  const tabs = useMemo(
    () =>
      [
        { id: 'general' as const, label: 'General' },
        { id: 'fiscal' as const, label: 'Fiscal', disabled: !isEditing },
      ],
    [isEditing],
  );

  const persistCustomer = async () => {
    setErrorMessage('');
    setSavedMessage('');
    setAlertModal((current) => ({ ...current, isOpen: false }));

    try {
      const effectiveBranchName = (generalBranchForm.name || form.name).trim();
      const effectiveBranchPhone = (generalBranchForm.phone_primary || form.phone).trim();
      const effectiveManagerName = (generalBranchForm.manager_name || '').trim();
      const effectiveRouteId = (!isAdmin && defaultBranchRouteId)
        ? defaultBranchRouteId
        : (generalBranchForm.route_id || defaultBranchRouteId || '').trim();

      if (!form.name.trim()) {
        throw new Error('El nombre del cliente es obligatorio.');
      }
      if (!form.email.trim()) {
        throw new Error('El correo del cliente es obligatorio.');
      }
      if (!effectiveBranchName) {
        throw new Error('El nombre de la sucursal es obligatorio.');
      }
      if (!effectiveManagerName) {
        throw new Error('El nombre del encargado de la sucursal es obligatorio.');
      }
      if (!effectiveBranchPhone) {
        throw new Error('El teléfono principal de la sucursal es obligatorio.');
      }
      if (!effectiveRouteId) {
        throw new Error('La ruta asignada de la sucursal es obligatoria.');
      }

      const customerPayload: CustomerFormValues = {
        ...form,
        phone: form.phone.trim() || effectiveBranchPhone,
        is_active: isEditing ? form.is_active : true,
      };

      const passwordChanged = Boolean(id && form.password?.trim());
      const result = await saveCustomer.mutateAsync({ id, payload: customerPayload });
      const targetCustomerId = result.customer.id;

      const branchPayload: BranchFormValues = {
        ...generalBranchForm,
        customer_id: targetCustomerId,
        name: effectiveBranchName,
        manager_name: effectiveManagerName,
        phone_primary: effectiveBranchPhone,
        route_id: effectiveRouteId,
        is_main: generalBranchForm.id ? generalBranchForm.is_main : true,
        is_active: generalBranchForm.id ? generalBranchForm.is_active : true,
      };

      const savedBranch = await saveBranch.mutateAsync(branchPayload);

      if (generalBranchImageFile) {
        const imagePath = await uploadBranchImage.mutateAsync({
          branchId: savedBranch.id,
          file: generalBranchImageFile,
        });
        await saveBranch.mutateAsync({
          ...branchPayload,
          id: savedBranch.id,
          image_path: imagePath,
        });
        setGeneralBranchImageFile(null);
        setGeneralBranchExistingImageUrl(customersService.getBranchImageUrl(imagePath));
      }

      if (!id) {
        navigate(`/customers/${targetCustomerId}`, {
          replace: true,
          state: result.temporary_password
            ? {
                credentialNotice: {
                  email: result.customer.email,
                  password: result.temporary_password,
                },
              }
            : undefined,
        });
        return;
      }

      setForm((current) => ({ ...current, password: '' }));
      setSavedMessage(passwordChanged ? 'Cliente, sucursal y contraseña actualizados.' : 'Cliente y sucursal actualizados.');
      setAlertModal({
        isOpen: true,
        title: 'Cliente actualizado',
        message: passwordChanged
          ? 'Los datos del cliente, su sucursal y la contraseña de acceso se actualizaron correctamente.'
          : 'Los cambios del cliente y su sucursal se guardaron correctamente.',
        type: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el cliente.';
      setErrorMessage(message);
      setAlertModal({
        isOpen: true,
        title: 'No se pudo guardar el cliente',
        message,
        type: 'error',
      });
    }
  };

  const handleSaveCustomer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void persistCustomer();
  };

  const handleSaveFiscal = async (payload: FiscalFormValues) => {
    setFiscalError('');

    try {
      await saveFiscalProfile.mutateAsync(payload);
      setFiscalDialog(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la información fiscal.';
      setFiscalError(message);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    try {
      await toggleFiscalProfile.mutateAsync(confirmAction.profile);
      setConfirmAction(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el registro.';
      setAlertModal({
        isOpen: true,
        title: 'No se pudo completar la acción',
        message,
        type: 'error',
      });
    }
  };

  const copyCredentials = async () => {
    if (!credentialNotice) return;

    await navigator.clipboard.writeText(`${credentialNotice.email}\n${credentialNotice.password}`);
    setCopyState('copied');
    window.setTimeout(() => setCopyState('idle'), 1500);
  };

  if (isEditing && isCustomerLoading) return <LoadingState message="Cargando cliente..." />;

  if (isEditing && isError) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el cliente.';
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <BackLink />
        <Alert tone="danger">{message}</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24 sm:space-y-6 sm:pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <BackLink />
          <div className="min-w-0">
            <h2 className="text-[22px] font-bold tracking-tight text-ink sm:text-[28px]">
              {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted sm:mt-1 sm:text-[15px]">
              {isEditing ? 'Datos de la refaccionaria e información fiscal' : 'Registra la refaccionaria y crea su usuario automáticamente'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditing && currentMainBranch && (
            <button
              type="button"
              onClick={() => setQrBranch(currentMainBranch)}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-gray-50 sm:h-10 sm:flex-initial"
            >
              <QrCode className="h-4 w-4 text-accent" />
              QR
            </button>
          )}
          <button
            type="button"
            onClick={() => void persistCustomer()}
            disabled={saveCustomer.isPending || saveBranch.isPending || uploadBranchImage.isPending}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-300 sm:h-10 sm:flex-initial"
          >
            <Save className="h-4 w-4" />
            {saveCustomer.isPending || saveBranch.isPending || uploadBranchImage.isPending ? 'Guardando...' : 'Guardar Cliente'}
          </button>
        </div>
      </div>

      {credentialNotice && (
        <Alert tone="success" onClose={() => setCredentialNotice(null)}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-emerald-800">Usuario cliente creado</p>
              <p className="mt-0.5 text-[13px] text-emerald-700">
                {credentialNotice.email} - contraseña temporal: {credentialNotice.password}
              </p>
            </div>
            <button
              type="button"
              onClick={copyCredentials}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-[12px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-50"
            >
              {copyState === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copyState === 'copied' ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </Alert>
      )}

      {errorMessage && <Alert tone="danger" onClose={() => setErrorMessage('')}>{errorMessage}</Alert>}
      {savedMessage && <Alert tone="success" onClose={() => setSavedMessage('')}>{savedMessage}</Alert>}

      <div className="flex w-full gap-1 rounded-xl bg-gray-200/50 p-1 sm:max-w-md">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={() => setActiveTab(tab.id)}
            className={`h-10 flex-1 rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 ${
              activeTab === tab.id
                ? 'bg-white text-ink shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <form
          id="customer-general-form"
          onSubmit={handleSaveCustomer}
          className="space-y-4 sm:space-y-6"
        >
          <div className="rounded-2xl border border-gray-200/60 bg-white p-3.5 shadow-sm sm:p-6 md:p-8">
            <div className="mb-4 flex min-w-0 items-start gap-3 sm:mb-5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent/8 text-accent sm:h-10 sm:w-10 sm:rounded-2xl">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-ink sm:text-base">Información general</h2>
                <p className="mt-0.5 text-[13px] text-muted sm:mt-1 sm:text-sm">Datos de acceso y cuenta del cliente</p>
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
              <TextInput
                label="Nombre *"
                value={form.name}
                maxLength={120}
                onChange={(value) => {
                  setForm((current) => ({ ...current, name: value }));
                  if (!branchNameManuallyEdited) {
                    setGeneralBranchForm((current) => ({ ...current, name: value }));
                  }
                }}
              />
              <TextInput
                label="Teléfono"
                type="tel"
                inputMode="tel"
                value={form.phone}
                required={false}
                maxLength={20}
                onChange={(value) => {
                  setForm((current) => ({ ...current, phone: value }));
                  if (!branchPhoneManuallyEdited) {
                    setGeneralBranchForm((current) => ({ ...current, phone_primary: value }));
                  }
                }}
              />
              <TextInput
                label="Correo *"
                type="email"
                inputMode="email"
                value={form.email}
                maxLength={160}
                onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                className="sm:col-span-2"
              />
              <TextInput
                label={isEditing ? 'Nueva contraseña de acceso' : 'Contraseña *'}
                type="password"
                value={form.password || ''}
                required={!isEditing}
                maxLength={64}
                onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                className="sm:col-span-2"
              />
              {isEditing && <p className="-mt-2 text-xs text-muted sm:col-span-2">Déjala vacía para conservar la contraseña actual.</p>}
            </div>

            <div className={`mt-4 grid gap-2 sm:mt-5 ${isEditing ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
              <CheckboxField
                label="Requiere facturación"
                checked={form.requires_invoice}
                onChange={(checked) => setForm((current) => ({ ...current, requires_invoice: checked }))}
              />
              {isEditing && (
                <CheckboxField
                  label="Cliente activo"
                  checked={form.is_active}
                  onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
                />
              )}
            </div>
          </div>

          {/* Datos de la sucursal principal (Refaccionaria) en la misma pestaña General */}
          <div className="space-y-4 rounded-2xl border border-gray-200/60 bg-white p-3.5 shadow-sm sm:space-y-5 sm:p-6 md:p-8">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent/8 text-accent sm:h-10 sm:w-10 sm:rounded-2xl">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-ink sm:text-base">Datos de la refaccionaria</h2>
                <p className="mt-0.5 text-[13px] text-muted sm:mt-1 sm:text-sm">
                  Encargado, ruta asignada, teléfonos, dirección y ubicación
                </p>
              </div>
            </div>

            {(() => {
              const lat = normalizeBranchCoord(generalBranchForm.latitude);
              const lng = normalizeBranchCoord(generalBranchForm.longitude);
              const hasCoord = lat !== null && lng !== null;
              const hasPostal = generalPostalNeighborhoods.length > 0;

              return (
                <>
                  <div className="rounded-xl border border-gray-200 bg-canvas p-3">
                    <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink">
                          <MapPin className="h-4 w-4 text-accent" />
                          Ubicación GPS
                        </h3>
                        <p className="mt-0.5 text-[12px] text-muted">
                          Toca el botón para guardar las coordenadas actuales y autocompletar la dirección.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={useGeneralBranchCurrentLocation}
                        disabled={isGeneralBranchLocating}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-white px-3.5 text-[13px] font-semibold text-accent shadow-sm transition-colors hover:bg-accent/5 disabled:cursor-wait disabled:text-gray-400 sm:h-9 sm:w-auto sm:rounded-lg"
                      >
                        <LocateFixed className="h-4 w-4" />
                        {isGeneralBranchLocating ? 'Tomando ubicación...' : 'Tomar ubicación actual'}
                      </button>
                    </div>

                    {generalBranchLocationError && (
                      <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                        {generalBranchLocationError}
                      </div>
                    )}

                    {hasCoord ? (
                      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                        <iframe
                          title="Mapa de la sucursal"
                          src={buildBranchEmbedMapUrl(lat, lng)}
                          className="h-44 w-full border-0 sm:h-56"
                          loading="lazy"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-3 py-2 text-[12px] text-muted">
                          <span className="font-mono text-[11px] sm:text-[12px]">
                            {lat.toFixed(6)}, {lng.toFixed(6)}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir en Maps
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4 text-center text-[13px] text-muted">
                        Aún no hay coordenadas registradas.
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.36fr)_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <EditableBranchImage
                        value={generalBranchImageFile || generalBranchExistingImageUrl}
                        isUploading={uploadBranchImage.isPending}
                        onChange={(file) => setGeneralBranchImageFile(file)}
                        onPreview={(url) => setGeneralBranchImagePreviewUrl(url)}
                      />
                    </div>

                    <div className="grid min-w-0 gap-3.5 sm:grid-cols-2">
                      <TextInput
                        label="Nombre de la sucursal *"
                        value={generalBranchForm.name}
                        maxLength={90}
                        onChange={(value) => {
                          setBranchNameManuallyEdited(true);
                          setGeneralBranchForm((current) => ({ ...current, name: value }));
                        }}
                      />
                      <TextInput
                        label="Nombre del encargado *"
                        value={generalBranchForm.manager_name || ''}
                        required
                        maxLength={90}
                        onChange={(value) =>
                          setGeneralBranchForm((current) => ({ ...current, manager_name: value }))
                        }
                      />
                      <TextInput
                        label="Teléfono principal *"
                        type="tel"
                        inputMode="tel"
                        value={generalBranchForm.phone_primary}
                        maxLength={20}
                        onChange={(value) => {
                          setBranchPhoneManuallyEdited(true);
                          setGeneralBranchForm((current) => ({ ...current, phone_primary: value }));
                          if (!form.phone.trim()) {
                            setForm((current) => ({ ...current, phone: value }));
                          }
                        }}
                      />
                      <TextInput
                        label="Teléfono secundario"
                        type="tel"
                        inputMode="tel"
                        value={generalBranchForm.phone_secondary || ''}
                        required={false}
                        maxLength={20}
                        onChange={(value) =>
                          setGeneralBranchForm((current) => ({ ...current, phone_secondary: value }))
                        }
                      />
                      <div className="sm:col-span-2">
                        <SearchSelect
                          label="Ruta asignada *"
                          options={generalBranchRouteSearchOptions}
                          value={generalBranchForm.route_id || ''}
                          placeholder="Selecciona una ruta asignada"
                          emptyMessage="No hay rutas disponibles"
                          required
                          disabled={!isAdmin || generalBranchRouteSearchOptions.length <= 1}
                          onChange={(value) =>
                            setGeneralBranchForm((current) => ({ ...current, route_id: value }))
                          }
                        />
                        {!isAdmin && (
                          <p className="mt-1 text-[11px] text-muted">
                            Ruta asignada automáticamente según la ruta activa en tu sesión.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                    <TextInput
                      label="Calle"
                      value={generalBranchForm.street || ''}
                      required={false}
                      maxLength={120}
                      className="col-span-2 sm:col-span-2"
                      onChange={(value) =>
                        setGeneralBranchForm((current) => ({ ...current, street: value }))
                      }
                    />
                    <TextInput
                      label="Núm. exterior"
                      value={generalBranchForm.exterior_number || ''}
                      required={false}
                      maxLength={20}
                      onChange={(value) =>
                        setGeneralBranchForm((current) => ({ ...current, exterior_number: value }))
                      }
                    />
                    <TextInput
                      label="Núm. interior"
                      value={generalBranchForm.interior_number || ''}
                      required={false}
                      maxLength={20}
                      onChange={(value) =>
                        setGeneralBranchForm((current) => ({ ...current, interior_number: value }))
                      }
                    />
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <TextInput
                        label="Código postal"
                        value={generalBranchForm.postal_code || ''}
                        inputMode="numeric"
                        pattern="[0-9]{5}"
                        maxLength={5}
                        required={false}
                        onChange={handleGeneralPostalCodeChange}
                      />
                      {isGeneralPostalLoading && (
                        <p className="mt-1 text-[12px] text-muted">Consultando código postal...</p>
                      )}
                      {generalPostalError && (
                        <p className="mt-1 text-[12px] text-red-600">{generalPostalError}</p>
                      )}
                    </div>
                    <TextInput
                      label="Estado"
                      value={generalBranchForm.state || ''}
                      required={false}
                      maxLength={90}
                      disabled={hasPostal}
                      className="col-span-2 sm:col-span-1"
                      onChange={(value) =>
                        setGeneralBranchForm((current) => ({ ...current, state: value }))
                      }
                    />
                    <TextInput
                      label="Municipio o alcaldía"
                      value={generalBranchForm.municipality || ''}
                      required={false}
                      maxLength={90}
                      disabled={hasPostal}
                      className="col-span-2 sm:col-span-1"
                      onChange={(value) =>
                        setGeneralBranchForm((current) => ({ ...current, municipality: value }))
                      }
                    />
                    {hasPostal ? (
                      <label className="col-span-2 block min-w-0 sm:col-span-1">
                        <span className="mb-1.5 block text-[13px] font-medium text-ink">Colonia</span>
                        <select
                          value={generalBranchForm.neighborhood || ''}
                          disabled={generalPostalNeighborhoods.length === 1}
                          onChange={(e) =>
                            setGeneralBranchForm((current) => ({
                              ...current,
                              neighborhood: e.target.value,
                            }))
                          }
                          className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:bg-gray-50 disabled:text-muted sm:h-10"
                        >
                          {generalPostalNeighborhoods.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <TextInput
                        label="Colonia"
                        value={generalBranchForm.neighborhood || ''}
                        required={false}
                        maxLength={90}
                        className="col-span-2 sm:col-span-1"
                        onChange={(value) =>
                          setGeneralBranchForm((current) => ({ ...current, neighborhood: value }))
                        }
                      />
                    )}

                    <label className="col-span-2 block min-w-0">
                      <span className="mb-1.5 block text-[13px] font-medium text-ink">
                        Referencias de ubicación
                      </span>
                      <textarea
                        value={generalBranchForm.location_references || ''}
                        maxLength={240}
                        placeholder="Entre qué calles, color de fachada, referencias cercanas..."
                        onChange={(event) =>
                          setGeneralBranchForm((current) => ({
                            ...current,
                            location_references: event.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
                      />
                    </label>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Barra inferior fija en móvil para guardar fácilmente con el pulgar */}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 p-3 backdrop-blur sm:hidden">
            <button
              type="submit"
              disabled={saveCustomer.isPending || saveBranch.isPending || uploadBranchImage.isPending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Save className="h-4 w-4" />
              {saveCustomer.isPending || saveBranch.isPending || uploadBranchImage.isPending
                ? 'Guardando...'
                : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      )}

      {generalBranchImagePreviewUrl && (
        <Modal
          isOpen
          onClose={() => setGeneralBranchImagePreviewUrl('')}
          title="Foto de la sucursal"
          size="lg"
        >
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-canvas">
            <img
              src={generalBranchImagePreviewUrl}
              alt="Foto de la sucursal"
              className="max-h-[72vh] w-full object-contain"
            />
          </div>
        </Modal>
      )}

      {activeTab === 'fiscal' && customer && (
        <RelatedSection
          title="Información fiscal"
          description="RFC, razón social y correo de facturación"
          icon={<ReceiptText className="h-5 w-5" />}
          actionLabel="Agregar fiscal"
          onAction={() => {
            setFiscalError('');
            setFiscalDialog({ mode: 'create' });
          }}
        >
          {isFiscalLoading ? (
            <LoadingBlock label="Cargando información fiscal..." />
          ) : !fiscalProfiles.length ? (
            <InlineEmpty message="Este cliente aún no tiene datos fiscales." />
          ) : (
            <div className="grid gap-3">
              {fiscalProfiles.map((profile) => (
                <FiscalProfileCard
                  key={profile.id}
                  profile={profile}
                  isPending={toggleFiscalProfile.isPending}
                  onEdit={() => {
                    setFiscalError('');
                    setFiscalDialog({ mode: 'edit', profile });
                  }}
                  onToggle={() => setConfirmAction({ type: 'fiscal', profile })}
                />
              ))}
            </div>
          )}
        </RelatedSection>
      )}

      {fiscalDialog && customer && (
        <FiscalFormModal
          customer={customer}
          profile={fiscalDialog.mode === 'edit' ? fiscalDialog.profile : null}
          isPending={saveFiscalProfile.isPending}
          errorMessage={fiscalError}
          onClose={() => setFiscalDialog(null)}
          onSubmit={handleSaveFiscal}
        />
      )}

      {qrBranch && (
        <BranchQrModal
          branch={qrBranch}
          customer={customer || null}
          onClose={() => setQrBranch(null)}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirmAction()}
        title={
          confirmAction?.profile.is_active
            ? 'Desactivar información fiscal'
            : 'Activar información fiscal'
        }
        message={
          confirmAction?.profile.is_active
            ? `La información fiscal ${confirmAction.profile.rfc} dejará de estar activa.`
            : `La información fiscal ${confirmAction?.profile.rfc || ''} volverá a estar activa.`
        }
        confirmText={confirmAction?.profile.is_active ? 'Desactivar' : 'Activar'}
        isDestructive={Boolean(confirmAction?.profile.is_active)}
        isPending={toggleFiscalProfile.isPending}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((current) => ({ ...current, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
};

const BackLink = () => (
  <Link
    to="/customers"
    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-gray-200/50 hover:text-ink"
  >
    <ArrowLeft className="h-5 w-5" />
  </Link>
);

const getFiscalRegimeLabel = (value: string) =>
  fiscalRegimeOptions.find((option) => option.value === value)?.label || value;
const getCfdiUseLabel = (value: string) => cfdiUseOptions.find((option) => option.value === value)?.label || value;

const FiscalProfileCard = ({
  profile,
  isPending,
  onEdit,
  onToggle,
}: {
  profile: CustomerFiscalProfile;
  isPending: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) => {
  const billingAddress = [
    profile.billing_street,
    profile.billing_exterior_number,
    profile.billing_interior_number ? `INT. ${profile.billing_interior_number}` : null,
    profile.billing_neighborhood,
    profile.fiscal_zip_code ? `CP ${profile.fiscal_zip_code}` : null,
    profile.billing_municipality,
    profile.billing_state,
  ].filter(Boolean).join(', ');

  return (
    <article className="rounded-lg border border-gray-200/70 bg-white p-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="truncate text-sm font-semibold text-ink">{profile.legal_name}</h4>
          {profile.is_default && <SmallBadge label="Predeterminado" />}
          <StatusBadge status={profile.is_active ? 'ACTIVE' : 'INACTIVE'} />
        </div>
        <p className="mt-1 text-[12px] font-medium text-accent">{profile.rfc}</p>
        <p className="mt-1 text-[12px] text-muted">
          {fiscalPersonTypeLabels[profile.person_type]} - {getFiscalRegimeLabel(profile.tax_regime)} - CP {profile.fiscal_zip_code}
        </p>
        <p className="mt-1 text-[12px] text-muted">{getCfdiUseLabel(profile.cfdi_use)}</p>
        <p className="mt-1 truncate text-[12px] text-ink-2">{profile.billing_email}</p>
        {billingAddress && <p className="mt-1 line-clamp-2 text-[12px] text-ink-2">{billingAddress}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <IconButton title="Editar" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </IconButton>
        <IconButton title={profile.is_active ? 'Desactivar' : 'Activar'} onClick={onToggle} disabled={isPending}>
          {profile.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
        </IconButton>
      </div>
    </div>
  </article>
  );
};

const FiscalFormModal = ({
  customer,
  profile,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: {
  customer: CustomerSummary;
  profile: CustomerFiscalProfile | null;
  isPending: boolean;
  errorMessage: string;
  onClose: () => void;
  onSubmit: (payload: FiscalFormValues) => void;
}) => {
  const [form, setForm] = useState<FiscalFormValues>({
    id: profile?.id,
    customer_id: customer.id,
    person_type: profile?.person_type || 'LEGAL_ENTITY',
    rfc: profile?.rfc || '',
    legal_name: profile?.legal_name || '',
    tax_regime: profile?.tax_regime || '',
    cfdi_use: profile?.cfdi_use || '',
    fiscal_zip_code: profile?.fiscal_zip_code || '',
    billing_email: profile?.billing_email || customer.email,
    billing_street: profile?.billing_street || '',
    billing_exterior_number: profile?.billing_exterior_number || '',
    billing_interior_number: profile?.billing_interior_number || '',
    billing_neighborhood: profile?.billing_neighborhood || '',
    billing_municipality: profile?.billing_municipality || '',
    billing_state: profile?.billing_state || '',
    is_default: profile?.is_default || false,
    is_active: profile?.is_active ?? true,
  });
  const [isBillingPostalLoading, setIsBillingPostalLoading] = useState(false);
  const [billingPostalError, setBillingPostalError] = useState('');
  const [billingNeighborhoods, setBillingNeighborhoods] = useState<string[]>([]);
  const availableRegimes = useMemo(
    () => fiscalRegimeOptions.filter((option) => option.personTypes.includes(form.person_type)),
    [form.person_type],
  );
  const availableCfdiUses = useMemo(
    () => {
      const personTypeOptions = cfdiUseOptions.filter((option) => option.personTypes.includes(form.person_type));
      if (!form.tax_regime) return personTypeOptions;

      const regimeOptions = personTypeOptions.filter((option) => option.regimes.includes(form.tax_regime));
      return regimeOptions.length ? regimeOptions : personTypeOptions;
    },
    [form.person_type, form.tax_regime],
  );

  useEffect(() => {
    const currentUseIsValid = availableCfdiUses.some((option) => option.value === form.cfdi_use);
    if (form.cfdi_use && !currentUseIsValid) {
      setForm((current) => ({ ...current, cfdi_use: '' }));
    }
  }, [availableCfdiUses, form.cfdi_use]);

  useEffect(() => {
    const postalCode = (form.fiscal_zip_code || '').replace(/\D/g, '').slice(0, 5);

    if (postalCode.length !== 5) {
      setBillingNeighborhoods([]);
      setBillingPostalError('');
      setIsBillingPostalLoading(false);
      return;
    }

    const abortController = new AbortController();

    const lookupBillingPostalCode = async () => {
      setIsBillingPostalLoading(true);
      setBillingPostalError('');

      try {
        const params = new URLSearchParams({ zip_code: postalCode, per_page: '200' });
        const response = await fetch(`${sepomexApiUrl}?${params.toString()}`, { signal: abortController.signal });
        const data = (await response.json()) as SepomexResponse;
        const zipCodes = data.zip_codes || [];

        if (!response.ok || !zipCodes.length) {
          throw new Error(data.message || 'No se encontró información para este código postal.');
        }

        const firstZipCode = zipCodes[0];
        const neighborhoods = Array.from(
          new Set(zipCodes.map((zipCode) => zipCode.d_asenta).filter((neighborhood): neighborhood is string => Boolean(neighborhood))),
        );

        setBillingNeighborhoods(neighborhoods);
        setForm((current) => ({
          ...current,
          billing_neighborhood:
            current.billing_neighborhood && neighborhoods.includes(current.billing_neighborhood)
              ? current.billing_neighborhood
              : neighborhoods[0] || current.billing_neighborhood,
          billing_municipality: firstZipCode?.d_mnpio || current.billing_municipality,
          billing_state: firstZipCode?.d_estado || current.billing_state,
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        const message = error instanceof Error ? error.message : 'No se pudo consultar el código postal.';
        setBillingNeighborhoods([]);
        setBillingPostalError(message);
      } finally {
        if (!abortController.signal.aborted) setIsBillingPostalLoading(false);
      }
    };

    lookupBillingPostalCode();

    return () => abortController.abort();
  }, [form.fiscal_zip_code]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(form);
  };

  const handleFiscalZipCodeChange = (value: string) => {
    const postalCode = value.replace(/\D/g, '').slice(0, 5);
    setBillingNeighborhoods([]);
    setBillingPostalError('');
    setForm((current) => ({
      ...current,
      fiscal_zip_code: postalCode,
      billing_neighborhood: postalCode === current.fiscal_zip_code ? current.billing_neighborhood : '',
      billing_municipality: postalCode === current.fiscal_zip_code ? current.billing_municipality : '',
      billing_state: postalCode === current.fiscal_zip_code ? current.billing_state : '',
    }));
  };

  return (
    <Modal isOpen onClose={onClose} title={profile ? 'Editar información fiscal' : 'Nueva información fiscal'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">Tipo de persona</span>
            <select
              value={form.person_type}
              onChange={(event) =>
                setForm((current) => {
                  const personType = event.target.value as FiscalPersonType;
                  const currentRegimeIsValid = fiscalRegimeOptions
                    .find((option) => option.value === current.tax_regime)
                    ?.personTypes.includes(personType);

                  return {
                    ...current,
                    person_type: personType,
                    tax_regime: currentRegimeIsValid ? current.tax_regime : '',
                    cfdi_use: '',
                  };
                })
              }
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
            >
              <option value="INDIVIDUAL">Persona física</option>
              <option value="LEGAL_ENTITY">Persona moral</option>
            </select>
          </label>
          <TextInput
            label="RFC"
            value={form.rfc}
            maxLength={13}
            onChange={(value) => setForm((current) => ({ ...current, rfc: value.toUpperCase() }))}
          />
          <TextInput
            label="Nombre o razón social"
            value={form.legal_name}
            maxLength={160}
            onChange={(value) => setForm((current) => ({ ...current, legal_name: value }))}
            className="sm:col-span-2"
          />
          <SearchSelect
            label="Régimen fiscal"
            options={availableRegimes}
            value={form.tax_regime}
            onChange={(v) => setForm((current) => ({ ...current, tax_regime: v }))}
            onClear={() => setForm((current) => ({ ...current, tax_regime: '' }))}
            placeholder="Selecciona un régimen"
          />
          <SearchSelect
            label="Uso del CFDI"
            options={availableCfdiUses}
            value={form.cfdi_use}
            onChange={(v) => setForm((current) => ({ ...current, cfdi_use: v }))}
            onClear={() => setForm((current) => ({ ...current, cfdi_use: '' }))}
            placeholder="Selecciona un uso"
          />
          <TextInput
            label="Correo de facturación"
            type="email"
            value={form.billing_email}
            maxLength={160}
            onChange={(value) => setForm((current) => ({ ...current, billing_email: value }))}
            className="sm:col-span-2"
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-ink">Dirección de facturación</h3>
            <p className="mt-0.5 text-[12px] text-muted">Captura el código postal para completar estado, municipio y colonia.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 sm:col-span-2">
              <TextInput
                label="Código postal"
                value={form.fiscal_zip_code}
                inputMode="numeric"
                pattern="[0-9]{5}"
                maxLength={5}
                onChange={handleFiscalZipCodeChange}
              />
              {isBillingPostalLoading && <p className="mt-1 text-[12px] text-muted">Consultando código postal...</p>}
              {billingPostalError && <p className="mt-1 text-[12px] text-red-600">{billingPostalError}</p>}
            </div>
            <TextInput label="Calle" value={form.billing_street || ''} required={false} maxLength={120} onChange={(value) => setForm((current) => ({ ...current, billing_street: value }))} />
            <TextInput label="Número exterior" value={form.billing_exterior_number || ''} required={false} maxLength={20} onChange={(value) => setForm((current) => ({ ...current, billing_exterior_number: value }))} />
            <TextInput label="Número interior" value={form.billing_interior_number || ''} required={false} maxLength={20} onChange={(value) => setForm((current) => ({ ...current, billing_interior_number: value }))} />
            <TextInput label="Estado" value={form.billing_state || ''} required={false} maxLength={90} disabled={billingNeighborhoods.length > 0} onChange={(value) => setForm((current) => ({ ...current, billing_state: value }))} />
            <TextInput label="Municipio o alcaldía" value={form.billing_municipality || ''} required={false} maxLength={90} disabled={billingNeighborhoods.length > 0} onChange={(value) => setForm((current) => ({ ...current, billing_municipality: value }))} />
            {billingNeighborhoods.length ? (
              <label className="block min-w-0 sm:col-span-2">
                <span className="mb-1.5 block text-[13px] font-medium text-ink">Colonia</span>
                <select
                  value={form.billing_neighborhood || ''}
                  disabled={billingNeighborhoods.length === 1}
                  onChange={(event) => setForm((current) => ({ ...current, billing_neighborhood: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:bg-gray-50 disabled:text-muted"
                >
                  {billingNeighborhoods.map((neighborhood) => (
                    <option key={neighborhood} value={neighborhood}>
                      {neighborhood}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <TextInput label="Colonia" value={form.billing_neighborhood || ''} required={false} maxLength={90} className="sm:col-span-2" onChange={(value) => setForm((current) => ({ ...current, billing_neighborhood: value }))} />
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <CheckboxField
            label="Datos predeterminados"
            checked={form.is_default}
            onChange={(checked) => setForm((current) => ({ ...current, is_default: checked }))}
          />
          <CheckboxField
            label="Registro activo"
            checked={form.is_active}
            onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
          />
        </div>

        {errorMessage && <FormError message={errorMessage} />}
        <ModalActions onClose={onClose} submitLabel="Guardar fiscal" isPending={isPending} />
      </form>
    </Modal>
  );
};

const BranchQrModal = ({
  branch,
  customer,
  onClose,
}: {
  branch: CustomerBranch;
  customer: CustomerSummary | null;
  onClose: () => void;
}) => {
  const [qrUrl, setQrUrl] = useState('');
  const [qrError, setQrError] = useState('');
  const routeLabel = branch.routes ? `${branch.routes.code} - ${branch.routes.name}` : 'Sin ruta';
  const customerName = customer?.name || branch.customers?.name || 'Cliente';
  const payload = useMemo(() => {
    const params = new URLSearchParams({ branch: branch.id });
    if (branch.route_id) params.set('route', branch.route_id);
    return `${window.location.origin}/customers/${branch.customer_id}?${params.toString()}`;
  }, [branch.customer_id, branch.id, branch.route_id]);

  useEffect(() => {
    let isMounted = true;
    setQrUrl('');
    setQrError('');

    createBrandedQrDataUrl({ payload, logoUrl: mokadaLogo })
      .then((dataUrl) => {
        if (isMounted) setQrUrl(dataUrl);
      })
      .catch((error) => {
        if (isMounted) {
          const message = error instanceof Error ? error.message : 'No se pudo generar el QR.';
          setQrError(message);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [payload]);

  const downloadQr = () => {
    if (!qrUrl) return;
    const link = document.createElement('a');
    const fileName = branch.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
    link.href = qrUrl;
    link.download = `qr-${fileName || 'sucursal'}.png`;
    link.click();
  };

  return (
    <Modal isOpen onClose={onClose} title="QR de sucursal" size="lg">
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-canvas p-3">
          <p className="truncate text-sm font-semibold text-ink">{customerName}</p>
          <p className="mt-1 truncate text-[12px] text-muted">{routeLabel}</p>
        </div>
        <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-gray-200 bg-white p-4">
          {qrError ? (
            <FormError message={qrError} />
          ) : qrUrl ? (
            <img src={qrUrl} alt={`QR ${branch.name}`} className="h-auto w-full max-w-[320px]" />
          ) : (
            <LoadingBlock label="Generando QR..." />
          )}
        </div>
        <div className="grid gap-2 sm:flex sm:justify-end">
          <a
            href={payload}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir enlace
          </a>
          <button
            type="button"
            onClick={downloadQr}
            disabled={!qrUrl}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Download className="h-4 w-4" />
            Descargar QR
          </button>
        </div>
      </div>
    </Modal>
  );
};

const RelatedSection = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  actionLabel: string;
  onAction: () => void;
  children: ReactNode;
}) => (
  <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm sm:p-6">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
          <p className="mt-0.5 text-[13px] text-muted">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-gray-50"
      >
        <Plus className="h-4 w-4" />
        {actionLabel}
      </button>
    </div>
    {children}
  </div>
);

const TextInput = ({
  label,
  value,
  onChange,
  type = 'text',
  required = true,
  className = '',
  step,
  min,
  max,
  maxLength,
  pattern,
  inputMode,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
  step?: string;
  min?: string;
  max?: string;
  maxLength?: number;
  pattern?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal';
  disabled?: boolean;
}) => (
  <label className={`block min-w-0 ${className}`}>
    <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
    <input
      type={type}
      value={value}
      required={required}
      step={step}
      min={min}
      max={max}
      maxLength={maxLength}
      pattern={pattern}
      inputMode={inputMode}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full min-w-0 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:bg-gray-50 disabled:text-muted sm:h-10"
    />
  </label>
);

const CheckboxField = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="flex h-11 items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 sm:h-10">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
    />
    <span className="text-sm font-medium text-ink">{label}</span>
  </label>
);

const ModalActions = ({
  onClose,
  submitLabel,
  isPending,
}: {
  onClose: () => void;
  submitLabel: string;
  isPending: boolean;
}) => (
  <div className="grid gap-2 border-t border-gray-200 pt-4 sm:flex sm:justify-end">
    <button
      type="button"
      onClick={onClose}
      className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-gray-50"
    >
      Cancelar
    </button>
    <button
      type="submit"
      disabled={isPending}
      className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-300"
    >
      {isPending ? 'Guardando...' : submitLabel}
    </button>
  </div>
);

const Alert = ({
  tone,
  children,
  onClose,
}: {
  tone: 'danger' | 'success';
  children: ReactNode;
  onClose?: () => void;
}) => {
  const colorClass =
    tone === 'danger' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div className={`rounded-lg border px-3 py-2 text-[13px] ${colorClass}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/70"
            title="Cerrar"
          >
            x
          </button>
        )}
      </div>
    </div>
  );
};

const FormError = ({ message }: { message: string }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{message}</div>
);

const SmallBadge = ({ label }: { label: string }) => (
  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
    {label}
  </span>
);

const LoadingBlock = ({ label }: { label: string }) => (
  <div className="rounded-lg border border-gray-200 bg-canvas px-3 py-4 text-center text-sm text-muted">
    {label}
  </div>
);

const InlineEmpty = ({ message }: { message: string }) => (
  <div className="rounded-lg border border-dashed border-gray-300 bg-canvas px-3 py-5 text-center text-sm text-muted">
    {message}
  </div>
);
