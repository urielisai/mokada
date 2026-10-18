import { useState } from 'react';
import { useFleetVehicles, useSaveFleetVehicle, useUploadVehicleImage } from '../hooks/useFleet';
import { fleetService } from '../services/fleet.service';

import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Modal } from '../../../components/ui/Modal';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { Plus } from 'lucide-react';

const VEHICLE_STATUSES = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
  { value: 'INACTIVE', label: 'Inactivo' },
] as const;

const EMPTY_FORM = {
  internal_code: '',
  plate_number: '',
  vin: '',
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  color: '',
  vehicle_type: '',
  fuel_type: '',
  transmission: '',
  engine: '',
  mileage: 0,
  status: 'AVAILABLE' as string,
  notes: '',
};

export const FleetVehiclesPage = () => {
  const { data, isLoading } = useFleetVehicles();
  const saveVehicle = useSaveFleetVehicle();
  const uploadImage = useUploadVehicleImage();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setImageFile(null);
    setExistingImageUrl(null);
    setModalOpen(true);
  };

  const openEdit = (vehicle: any) => {
    setForm({
      internal_code: vehicle.internal_code || '',
      plate_number: vehicle.plate_number || '',
      vin: vehicle.vin || '',
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      year: vehicle.year || new Date().getFullYear(),
      color: vehicle.color || '',
      vehicle_type: vehicle.vehicle_type || '',
      fuel_type: vehicle.fuel_type || '',
      transmission: vehicle.transmission || '',
      engine: vehicle.engine || '',
      mileage: vehicle.mileage || 0,
      status: vehicle.status || 'AVAILABLE',
      notes: vehicle.notes || '',
    });
    setEditId(vehicle.id);
    setImageFile(null);
    setExistingImageUrl(fleetService.getVehicleImageUrl(vehicle.image_url));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = await saveVehicle.mutateAsync({ id: editId, ...form });

      // Upload image if one was selected
      if (imageFile && saved?.id) {
        const imagePath = await uploadImage.mutateAsync({ vehicleId: saved.id, file: imageFile });
        // Update vehicle with image_url
        await saveVehicle.mutateAsync({ id: saved.id, image_url: imagePath });
      }

      setModalOpen(false);
    } catch (err) {
      console.error('Error saving vehicle', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-ink">Flotilla</h2>
          <p className="text-[15px] text-muted">Gestión de unidades y vehículos de la empresa</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva unidad
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data?.length ? (
        <div className="bg-white border border-gray-200/60 rounded-2xl p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <span className="text-gray-400 text-2xl font-bold">?</span>
          </div>
          <h3 className="text-[16px] font-semibold text-ink mb-1">Sin unidades</h3>
          <p className="text-[14px] text-muted">No se han registrado unidades aún.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.map((item: any) => {
            const imageUrl = fleetService.getVehicleImageUrl(item.image_url);

            return (
              <div 
                key={item.id}
                onClick={() => openEdit(item)}
                className="group bg-white border border-gray-200/60 rounded-[24px] overflow-hidden shadow-sm hover-lift cursor-pointer flex flex-col"
              >
                {/* Image Section */}
                <div className="relative aspect-video bg-canvas p-6 flex items-center justify-center overflow-hidden">
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={item.internal_code} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                      <span className="text-gray-400 text-2xl font-bold">{(item.brand || '?')[0]}</span>
                    </div>
                  )}
                </div>

                {/* Info Section */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[12px] font-medium text-accent truncate px-2 py-0.5 bg-accent/10 rounded-md">
                      {item.internal_code}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  
                  <h3 className="text-[15px] font-semibold text-ink leading-tight mb-2 line-clamp-2">
                    {item.brand} {item.model} {item.year}
                  </h3>
                  
                  <div className="mt-auto pt-3">
                    <div className="flex flex-col gap-1 text-[13px] text-muted">
                      {item.plate_number && (
                        <span className="truncate">Placas: <span className="font-medium text-ink">{item.plate_number}</span></span>
                      )}
                      {item.mileage !== undefined && item.mileage !== null && (
                        <span className="truncate">Km: <span className="font-medium text-ink">{new Intl.NumberFormat('es-MX').format(Number(item.mileage))}</span></span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar unidad' : 'Nueva unidad'} maxWidth="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Image upload */}
          <div className="flex justify-center">
            <div className="w-full max-w-[280px] h-[180px]">
              <ImageUpload
                value={imageFile || existingImageUrl}
                onChange={(file) => {
                  setImageFile(file);
                  if (!file) setExistingImageUrl(null);
                }}
                onClear={() => {
                  setImageFile(null);
                  setExistingImageUrl(null);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Código interno *</label>
              <input value={form.internal_code} onChange={e => setForm({ ...form, internal_code: e.target.value })} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Placas</label>
              <input value={form.plate_number} onChange={e => setForm({ ...form, plate_number: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">VIN</label>
              <input value={form.vin} onChange={e => setForm({ ...form, vin: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Marca</label>
              <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Modelo</label>
              <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Año</label>
              <input type="number" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Color</label>
              <div className="relative flex items-center">
                <input
                  type="color"
                  value={form.color?.startsWith('#') ? form.color : '#000000'}
                  onChange={e => setForm({ ...form, color: e.target.value })}
                  className="absolute left-2 h-6 w-6 cursor-pointer appearance-none rounded-md border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-gray-200 [&::-webkit-color-swatch]:border"
                />
                <input
                  value={form.color}
                  onChange={e => setForm({ ...form, color: e.target.value })}
                  placeholder="Ej. #FFFFFF o Blanco"
                  className="w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2 text-[14px] uppercase focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Tipo de vehículo</label>
              <select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none bg-white">
                <option value="">Seleccionar...</option>
                <option value="Sedán">Sedán</option>
                <option value="SUV">SUV</option>
                <option value="Pick-up">Pick-up</option>
                <option value="Hatchback">Hatchback</option>
                <option value="Minivan">Minivan</option>
                <option value="Furgoneta">Furgoneta</option>
                <option value="Motocicleta">Motocicleta</option>
                <option value="Camión">Camión</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Combustible</label>
              <select value={form.fuel_type} onChange={e => setForm({ ...form, fuel_type: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none bg-white">
                <option value="">Seleccionar...</option>
                <option value="Gasolina">Gasolina</option>
                <option value="Diésel">Diésel</option>
                <option value="Híbrido">Híbrido</option>
                <option value="Eléctrico">Eléctrico</option>
                <option value="Gas LP">Gas LP</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Transmisión</label>
              <select value={form.transmission} onChange={e => setForm({ ...form, transmission: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none bg-white">
                <option value="">Seleccionar...</option>
                <option value="Automática">Automática</option>
                <option value="Manual">Manual</option>
                <option value="CVT">CVT</option>
                <option value="Semi-automática">Semi-automática</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Motor</label>
              <input value={form.engine} onChange={e => setForm({ ...form, engine: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Kilometraje</label>
              <input type="number" value={form.mileage} onChange={e => setForm({ ...form, mileage: Number(e.target.value) })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Estado</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none bg-white">
                {VEHICLE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1">Notas</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-[13px] font-medium text-muted hover:text-ink transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saveVehicle.isPending || uploadImage.isPending} className="rounded-xl bg-accent px-5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-50 transition-colors">
              {saveVehicle.isPending || uploadImage.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
