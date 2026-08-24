import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, ExternalLink, Image as ImageIcon, LocateFixed, MapPin } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import {
  customersService,
  type BranchFormValues,
  type CustomerBranch,
  type CustomerRouteOption,
  type CustomerSummary,
} from '../services/customers.service';

interface Props {
  branch: CustomerBranch | null;
  customers?: CustomerSummary[];
  fixedCustomer?: CustomerSummary | null;
  defaultRouteId?: string | null;
  routeOptions: CustomerRouteOption[];
  isPending: boolean;
  errorMessage?: string;
  onClose: () => void;
  onImageUpload?: (branchId: string, file: File) => Promise<string>;
  onSubmit: (payload: BranchFormValues, imageFile: File | null) => void;
}

const onlyDigits = (value: string, maxLength: number) => value.replace(/\D/g, '').slice(0, maxLength);
const SEPOMEX_API_URL = 'https://sepomex.kurenn.dev/api/v1/zip_codes';

interface SepomexZipCode {
  d_codigo?: string;
  d_asenta?: string;
  d_mnpio?: string;
  d_estado?: string;
  d_ciudad?: string;
}

interface SepomexResponse {
  zip_codes?: SepomexZipCode[];
  error?: string;
  message?: string;
}

const normalizeCoordinate = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildMapUrl = (latitude: number, longitude: number) => {
  const delta = 0.006;
  const left = longitude - delta;
  const right = longitude + delta;
  const top = latitude + delta;
  const bottom = latitude - delta;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${latitude}%2C${longitude}`;
};

const toInitialForm = (
  branch: CustomerBranch | null,
  fixedCustomer: CustomerSummary | null | undefined,
  defaultRouteId: string | null | undefined,
): BranchFormValues => ({
  id: branch?.id,
  customer_id: branch?.customer_id || fixedCustomer?.id || '',
  name: branch?.name || '',
  manager_name: branch?.manager_name || '',
  phone_primary: branch?.phone_primary || fixedCustomer?.phone || '',
  phone_secondary: branch?.phone_secondary || '',
  street: branch?.street || '',
  exterior_number: branch?.exterior_number || '',
  interior_number: branch?.interior_number || '',
  neighborhood: branch?.neighborhood || '',
  postal_code: branch?.postal_code || '',
  municipality: branch?.municipality || '',
  state: branch?.state || '',
  location_references: branch?.location_references || '',
  latitude: branch?.latitude ?? '',
  longitude: branch?.longitude ?? '',
  route_id: branch?.route_id || defaultRouteId || '',
  image_path: branch?.image_path || null,
  is_main: branch?.is_main || false,
  is_active: branch?.is_active ?? true,
});

export const CustomerBranchFormModal = ({
  branch,
  customers = [],
  fixedCustomer,
  defaultRouteId,
  routeOptions,
  isPending,
  errorMessage,
  onClose,
  onImageUpload,
  onSubmit,
}: Props) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(
    customersService.getBranchImageUrl(branch?.image_path || null),
  );
  const [form, setForm] = useState<BranchFormValues>(() => toInitialForm(branch, fixedCustomer, defaultRouteId));
  const [locationError, setLocationError] = useState('');
  const [imageError, setImageError] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isPostalLookupLoading, setIsPostalLookupLoading] = useState(false);
  const [postalLookupError, setPostalLookupError] = useState('');
  const [postalNeighborhoods, setPostalNeighborhoods] = useState<string[]>([]);
  const [isZipCodeLookupLoading, setIsZipCodeLookupLoading] = useState(false);
  const [zipCodeLookupError, setZipCodeLookupError] = useState('');
  const [zipCodeOptions, setZipCodeOptions] = useState<string[]>([]);
  const latitude = normalizeCoordinate(form.latitude);
  const longitude = normalizeCoordinate(form.longitude);
  const hasLocation = latitude !== null && longitude !== null;
  const hasPostalData = postalNeighborhoods.length > 0;
  const hasZipCodeSuggestions = zipCodeOptions.length > 0 && onlyDigits(form.postal_code || '', 5).length < 5;

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: customer.id,
        label: customer.name,
        description: customer.email,
        keywords: `${customer.name} ${customer.email} ${customer.phone}`,
      })),
    [customers],
  );

  const routeSearchOptions = useMemo(
    () =>
      routeOptions.map((routeOption) => ({
        value: routeOption.id,
        label: `${routeOption.code} - ${routeOption.name}`,
        description: routeOption.is_active ? 'Ruta activa' : 'Ruta inactiva',
        keywords: `${routeOption.code} ${routeOption.name}`,
      })),
    [routeOptions],
  );

  useEffect(() => {
    if (!fixedCustomer || branch || form.phone_primary.trim()) return;
    setForm((current) => ({ ...current, phone_primary: fixedCustomer.phone }));
  }, [branch, fixedCustomer, form.phone_primary]);

  useEffect(() => {
    const postalCode = onlyDigits(form.postal_code || '', 5);

    if (postalCode.length !== 5) {
      setPostalNeighborhoods([]);
      setPostalLookupError('');
      setIsPostalLookupLoading(false);
      return;
    }

    const abortController = new AbortController();

    const lookupPostalCode = async () => {
      setIsPostalLookupLoading(true);
      setPostalLookupError('');

      try {
        const params = new URLSearchParams({ zip_code: postalCode, per_page: '200' });
        const response = await fetch(`${SEPOMEX_API_URL}?${params.toString()}`, { signal: abortController.signal });
        const data = (await response.json()) as SepomexResponse;
        const zipCodes = data.zip_codes || [];

        if (!response.ok || !zipCodes.length) {
          throw new Error(data.message || 'No se encontró información para este código postal.');
        }

        const firstZipCode = zipCodes[0];
        const neighborhoods = Array.from(
          new Set(zipCodes.map((zipCode) => zipCode.d_asenta).filter((neighborhood): neighborhood is string => Boolean(neighborhood))),
        );
        setPostalNeighborhoods(neighborhoods);

        setForm((current) => ({
          ...current,
          neighborhood:
            current.neighborhood && (!neighborhoods.length || neighborhoods.includes(current.neighborhood))
              ? current.neighborhood
              : neighborhoods[0] || current.neighborhood,
          municipality: firstZipCode?.d_mnpio || current.municipality,
          state: firstZipCode?.d_estado || current.state,
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        const message = error instanceof Error ? error.message : 'No se pudo consultar el código postal.';
        setPostalNeighborhoods([]);
        setPostalLookupError(message);
      } finally {
        if (!abortController.signal.aborted) setIsPostalLookupLoading(false);
      }
    };

    lookupPostalCode();

    return () => abortController.abort();
  }, [form.postal_code]);

  useEffect(() => {
    const postalCode = onlyDigits(form.postal_code || '', 5);
    const municipality = (form.municipality || '').trim();
    const state = (form.state || '').trim();

    if (postalCode.length === 5 || municipality.length < 3 || state.length < 3 || hasPostalData) {
      setZipCodeOptions([]);
      setZipCodeLookupError('');
      setIsZipCodeLookupLoading(false);
      return;
    }

    const abortController = new AbortController();
    const lookupDelay = window.setTimeout(async () => {
      setIsZipCodeLookupLoading(true);
      setZipCodeLookupError('');

      try {
        const params = new URLSearchParams({ state, city: municipality, per_page: '200' });
        const response = await fetch(`${SEPOMEX_API_URL}?${params.toString()}`, { signal: abortController.signal });
        const data = (await response.json()) as SepomexResponse;
        const zipCodes = data.zip_codes || [];

        if (!response.ok || !zipCodes.length) {
          throw new Error(data.message || 'No se encontraron códigos postales para ese municipio y estado.');
        }

        const suggestions = Array.from(
          new Set(zipCodes.map((zipCode) => zipCode.d_codigo).filter((zipCode): zipCode is string => Boolean(zipCode))),
        );
        setZipCodeOptions(suggestions);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        const message = error instanceof Error ? error.message : 'No se pudieron consultar códigos postales.';
        setZipCodeOptions([]);
        setZipCodeLookupError(message);
      } finally {
        if (!abortController.signal.aborted) setIsZipCodeLookupLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(lookupDelay);
      abortController.abort();
    };
  }, [form.municipality, form.postal_code, form.state, hasPostalData]);

  const handleCustomerChange = (customerId: string) => {
    const selectedCustomer = customers.find((customer) => customer.id === customerId);

    setForm((current) => ({
      ...current,
      customer_id: customerId,
      phone_primary: current.phone_primary.trim() || selectedCustomer?.phone || '',
    }));
  };

  const handlePostalCodeChange = (value: string) => {
    const postalCode = onlyDigits(value, 5);

    setPostalNeighborhoods([]);
    setPostalLookupError('');
    setZipCodeOptions([]);
    setZipCodeLookupError('');
    setForm((current) => ({
      ...current,
      postal_code: postalCode,
      neighborhood: postalCode === current.postal_code ? current.neighborhood : '',
      municipality: postalCode === current.postal_code ? current.municipality : '',
      state: postalCode === current.postal_code ? current.state : '',
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(form, imageFile);
  };

  const handleImageChange = async (file: File | null) => {
    setImageError('');

    if (!file) {
      setImageFile(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setImageError('Selecciona una imagen válida para la sucursal.');
      return;
    }

    if (branch?.id && onImageUpload) {
      setIsImageUploading(true);

      try {
        const imagePath = await onImageUpload(branch.id, file);
        setImageFile(null);
        setExistingImageUrl(customersService.getBranchImageUrl(imagePath));
        setForm((current) => ({ ...current, image_path: imagePath }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo actualizar la foto.';
        setImageError(message);
      } finally {
        setIsImageUploading(false);
      }

      return;
    }

    setImageFile(file);
  };

  const fillAddressFromCoordinates = async (nextLatitude: number, nextLongitude: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${nextLatitude}&lon=${nextLongitude}&addressdetails=1`,
      );

      if (!response.ok) return;

      const data = await response.json();
      const address = data?.address || {};
      const road = address.road || address.pedestrian || address.footway || address.residential || '';
      const city = address.city || address.town || address.village || address.municipality || address.county || '';
      const neighborhood = address.neighbourhood || address.suburb || address.quarter || '';

      setForm((current) => ({
        ...current,
        street: current.street || road,
        exterior_number: current.exterior_number || address.house_number || '',
        neighborhood: current.neighborhood || neighborhood,
        postal_code: current.postal_code || onlyDigits(address.postcode || '', 5),
        municipality: current.municipality || city,
        state: current.state || address.state || '',
      }));
    } catch {
      // La ubicación principal ya quedó capturada; la dirección inversa es una ayuda opcional.
    }
  };

  const useCurrentLocation = () => {
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Este navegador no permite tomar la ubicación actual.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLatitude = Number(position.coords.latitude.toFixed(7));
        const nextLongitude = Number(position.coords.longitude.toFixed(7));

        setForm((current) => ({
          ...current,
          latitude: nextLatitude,
          longitude: nextLongitude,
        }));

        await fillAddressFromCoordinates(nextLatitude, nextLongitude);
        setIsLocating(false);
      },
      () => {
        setLocationError('No se pudo obtener la ubicación. Revisa permisos del navegador.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  return (
    <Modal isOpen onClose={onClose} title={branch ? 'Editar sucursal' : 'Nueva sucursal'} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-[#F5F5F7] p-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#1D1D1F]">
                <MapPin className="h-4 w-4 text-[#0066CC]" />
                Ubicación
              </h3>
              <p className="mt-0.5 text-[12px] text-[#86868B]">
                Usa tu ubicación actual o captura las coordenadas manualmente.
              </p>
            </div>
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={isLocating}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-semibold text-[#1D1D1F] transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:text-gray-400"
            >
              <LocateFixed className="h-4 w-4" />
              {isLocating ? 'Tomando ubicación...' : 'Tomar ubicación actual'}
            </button>
          </div>

          {locationError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {locationError}
            </div>
          )}

          {hasLocation ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <iframe
                title="Mapa de la sucursal"
                src={buildMapUrl(latitude, longitude)}
                className="h-56 w-full border-0"
                loading="lazy"
              />
              <div className="flex flex-col gap-2 border-t border-gray-100 px-3 py-2 text-[12px] text-[#86868B] sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {latitude.toFixed(7)}, {longitude.toFixed(7)}
                </span>
                <a
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-[#0066CC] hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir mapa
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-5 text-center text-[13px] text-[#86868B]">
              Aún no hay coordenadas para mostrar el mapa.
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.42fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <EditableBranchImage
              value={imageFile || existingImageUrl}
              isUploading={isImageUploading}
              onChange={handleImageChange}
              onPreview={(url) => setImagePreviewUrl(url)}
            />
            {imageError && <p className="mt-2 text-[12px] text-red-600">{imageError}</p>}
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {!fixedCustomer && (
              <div className="sm:col-span-2">
                <SearchSelect
                  label="Cliente *"
                  options={customerOptions}
                  value={form.customer_id}
                  placeholder="Buscar cliente por nombre o correo"
                  emptyMessage="No hay clientes con ese texto"
                  required
                  onChange={handleCustomerChange}
                />
              </div>
            )}

            <TextInput
              label="Nombre de la sucursal *"
              value={form.name}
              maxLength={90}
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            />
            <TextInput
              label="Nombre del encargado"
              value={form.manager_name || ''}
              required={false}
              maxLength={90}
              onChange={(value) => setForm((current) => ({ ...current, manager_name: value }))}
            />
            <TextInput
              label="Teléfono principal *"
              type="tel"
              value={form.phone_primary}
              maxLength={20}
              onChange={(value) => setForm((current) => ({ ...current, phone_primary: value }))}
            />
            <TextInput
              label="Teléfono secundario"
              type="tel"
              value={form.phone_secondary || ''}
              required={false}
              maxLength={20}
              onChange={(value) => setForm((current) => ({ ...current, phone_secondary: value }))}
            />
            <div className="sm:col-span-2">
              <SearchSelect
                label="Ruta asignada"
                options={routeSearchOptions}
                value={form.route_id || ''}
                placeholder="Buscar ruta por código o nombre"
                emptyMessage="No hay rutas con ese texto"
                onChange={(value) => setForm((current) => ({ ...current, route_id: value }))}
                onClear={() => setForm((current) => ({ ...current, route_id: '' }))}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="Calle" value={form.street || ''} required={false} maxLength={120} onChange={(value) => setForm((current) => ({ ...current, street: value }))} />
          <TextInput label="Número exterior" value={form.exterior_number || ''} required={false} maxLength={20} onChange={(value) => setForm((current) => ({ ...current, exterior_number: value }))} />
          <TextInput label="Número interior" value={form.interior_number || ''} required={false} maxLength={20} onChange={(value) => setForm((current) => ({ ...current, interior_number: value }))} />
          <div className="min-w-0">
            <TextInput label="Código postal" value={form.postal_code || ''} inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required={false} onChange={handlePostalCodeChange} />
            {isPostalLookupLoading && <p className="mt-1 text-[12px] text-[#86868B]">Consultando código postal...</p>}
            {postalLookupError && <p className="mt-1 text-[12px] text-red-600">{postalLookupError}</p>}
          </div>
          <TextInput label="Estado" value={form.state || ''} required={false} maxLength={90} disabled={hasPostalData} onChange={(value) => setForm((current) => ({ ...current, state: value }))} />
          <TextInput label="Municipio o alcaldía" value={form.municipality || ''} required={false} maxLength={90} disabled={hasPostalData} onChange={(value) => setForm((current) => ({ ...current, municipality: value }))} />
          {hasPostalData ? (
            <SelectInput
              label="Colonia"
              value={form.neighborhood || ''}
              options={postalNeighborhoods}
              disabled={postalNeighborhoods.length === 1}
              onChange={(value) => setForm((current) => ({ ...current, neighborhood: value }))}
            />
          ) : (
            <TextInput label="Colonia" value={form.neighborhood || ''} required={false} maxLength={90} onChange={(value) => setForm((current) => ({ ...current, neighborhood: value }))} />
          )}
          {(hasZipCodeSuggestions || isZipCodeLookupLoading || zipCodeLookupError) && (
            <div className="min-w-0 sm:col-span-2">
              {hasZipCodeSuggestions && (
                <SelectInput
                  label="Código postal sugerido"
                  value=""
                  options={zipCodeOptions}
                  placeholder="Selecciona un código postal"
                  onChange={handlePostalCodeChange}
                />
              )}
              {isZipCodeLookupLoading && <p className="mt-1 text-[12px] text-[#86868B]">Buscando códigos postales...</p>}
              {zipCodeLookupError && <p className="mt-1 text-[12px] text-red-600">{zipCodeLookupError}</p>}
            </div>
          )}

          <label className="block min-w-0 sm:col-span-2">
            <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">Referencias de ubicación</span>
            <textarea
              value={form.location_references || ''}
              maxLength={240}
              onChange={(event) => setForm((current) => ({ ...current, location_references: event.target.value }))}
              rows={3}
              className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15"
            />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <CheckboxField
            label="Sucursal principal"
            checked={form.is_main}
            onChange={(checked) => setForm((current) => ({ ...current, is_main: checked }))}
          />
          <CheckboxField
            label="Sucursal activa"
            checked={form.is_active}
            onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
          />
        </div>

        {errorMessage && <FormError message={errorMessage} />}
        <ModalActions onClose={onClose} submitLabel="Guardar sucursal" isPending={isPending} />
      </form>

      {imagePreviewUrl && (
        <Modal isOpen onClose={() => setImagePreviewUrl('')} title="Foto de la sucursal" size="lg">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-[#F5F5F7]">
            <img src={imagePreviewUrl} alt="Foto de la sucursal" className="max-h-[72vh] w-full object-contain" />
          </div>
        </Modal>
      )}
    </Modal>
  );
};

const EditableBranchImage = ({
  value,
  isUploading,
  onChange,
  onPreview,
}: {
  value: string | File | null;
  isUploading: boolean;
  onChange: (file: File | null) => void;
  onPreview: (url: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const pressTimerRef = useRef<number | null>(null);
  const didOpenPreviewRef = useRef(false);
  const [localImageUrl, setLocalImageUrl] = useState('');
  const imageUrl = value instanceof File ? localImageUrl : value || '';
  const canPreview = Boolean(imageUrl);

  const clearPressTimer = () => {
    if (!pressTimerRef.current) return;
    window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
  };

  useEffect(() => {
    if (!(value instanceof File)) {
      setLocalImageUrl('');
      return;
    }

    const nextUrl = URL.createObjectURL(value);
    setLocalImageUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [value]);

  useEffect(() => {
    return () => clearPressTimer();
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    onChange(file);
  };

  const startPress = () => {
    didOpenPreviewRef.current = false;
    clearPressTimer();

    if (!canPreview || isUploading) return;

    pressTimerRef.current = window.setTimeout(() => {
      didOpenPreviewRef.current = true;
      pressTimerRef.current = null;
      onPreview(imageUrl);
    }, 550);
  };

  const handleClick = () => {
    if (didOpenPreviewRef.current) {
      didOpenPreviewRef.current = false;
      return;
    }

    inputRef.current?.click();
  };

  return (
    <div className="group relative h-[220px] w-full overflow-hidden rounded-2xl border border-gray-200/70 bg-[#F5F5F7] sm:h-[240px]">
      {imageUrl ? (
        <img src={imageUrl} alt="Foto de la sucursal" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-4 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <ImageIcon className="h-6 w-6 text-[#86868B]" />
          </div>
          <p className="text-[14px] font-medium text-[#1D1D1F]">Foto del lugar</p>
          <p className="mt-1 text-[12px] text-[#86868B]">Toca para subir o tomar una foto</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        onPointerDown={startPress}
        onPointerUp={clearPressTimer}
        onPointerLeave={clearPressTimer}
        onPointerCancel={clearPressTimer}
        onContextMenu={(event) => event.preventDefault()}
        disabled={isUploading}
        className="absolute inset-0 flex touch-manipulation select-none items-center justify-center gap-2 bg-black/45 text-[13px] font-semibold text-white opacity-100 transition-opacity hover:bg-black/55 disabled:cursor-wait sm:opacity-0 sm:group-hover:opacity-100"
        title="Actualizar foto. Mantener presionado para verla."
        aria-label="Actualizar foto de sucursal. Mantener presionado para verla."
      >
        <Camera className="h-4 w-4" />
        {isUploading ? 'Subiendo...' : 'Actualizar'}
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={handleFileChange} className="sr-only" />
    </div>
  );
};

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
  readOnly = false,
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
  readOnly?: boolean;
}) => (
  <label className={`block min-w-0 ${className}`}>
    <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">{label}</span>
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
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full min-w-0 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15 disabled:bg-gray-50 disabled:text-[#86868B] read-only:bg-gray-50 read-only:text-[#86868B]"
    />
  </label>
);

const SelectInput = ({
  label,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) => (
  <label className="block min-w-0">
    <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">{label}</span>
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15 disabled:bg-gray-50 disabled:text-[#86868B]"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
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
  <label className="flex h-10 items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 rounded border-gray-300 text-[#0066CC] focus:ring-[#0066CC]"
    />
    <span className="text-sm font-medium text-[#1D1D1F]">{label}</span>
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
      className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-gray-50"
    >
      Cancelar
    </button>
    <button
      type="submit"
      disabled={isPending}
      className="h-10 rounded-lg bg-[#0066CC] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0057AD] disabled:cursor-not-allowed disabled:bg-gray-300"
    >
      {isPending ? 'Guardando...' : submitLabel}
    </button>
  </div>
);

const FormError = ({ message }: { message: string }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{message}</div>
);
