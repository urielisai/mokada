import { useForm } from 'react-hook-form';
import { Modal } from '../../../components/ui/Modal';
import { useSaveVehicleModel, useSaveVehicleMake, useVehicleMakes } from '../hooks/useCatalog';
import { useEffect, useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vehicle?: any;
}

export const VehicleFormModal = ({ isOpen, onClose, vehicle }: Props) => {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();
  const { mutateAsync: saveVehicleModel, isPending: isSavingModel } = useSaveVehicleModel();
  const { mutateAsync: saveVehicleMake, isPending: isSavingMake } = useSaveVehicleMake();
  const { data: makes } = useVehicleMakes();
  
  const [isCreatingMake, setIsCreatingMake] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (vehicle) {
        reset({
          id: vehicle.id,
          make_id: vehicle.make_id || '',
          name: vehicle.name || '',
          generation: vehicle.generation || '',
          is_active: vehicle.is_active,
          new_make_name: ''
        });
        setIsCreatingMake(false);
      } else {
        reset({
          id: null,
          make_id: '',
          name: '',
          generation: '',
          is_active: true,
          new_make_name: ''
        });
        setIsCreatingMake(false);
      }
    }
  }, [isOpen, vehicle, reset]);

  const handleMakeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'NEW') {
      setIsCreatingMake(true);
      setValue('make_id', 'NEW');
    } else {
      setIsCreatingMake(false);
      setValue('make_id', e.target.value);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      let finalMakeId = data.make_id;

      // Si seleccionó crear nueva marca, la creamos primero
      if (isCreatingMake && data.new_make_name) {
        const newMake: any = await saveVehicleMake({
          name: data.new_make_name,
          is_active: true
        });
        finalMakeId = newMake.id;
      }

      // Guardamos el modelo
      await saveVehicleModel({
        id: data.id,
        make_id: finalMakeId,
        name: data.name,
        generation: data.generation || null,
        is_active: data.is_active
      });
      
      onClose();
    } catch (error) {
      console.error('Error guardando vehículo:', error);
    }
  };

  const isSaving = isSavingModel || isSavingMake;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={vehicle ? 'Editar Modelo' : 'Nuevo Modelo de Vehículo'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        
        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Marca del Vehículo *</label>
          <select
            value={watch('make_id')}
            onChange={handleMakeChange}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] text-ink"
            required
          >
            <option value="">Seleccione una marca</option>
            {makes?.map((m: any) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
            <option value="NEW" className="font-semibold text-accent">+ Crear nueva marca...</option>
          </select>
        </div>

        {isCreatingMake && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200/60">
            <label className="block text-[13px] font-medium text-ink mb-1.5">Nombre de la Nueva Marca *</label>
            <input
              type="text"
              {...register('new_make_name', { required: isCreatingMake ? 'El nombre de la marca es requerido' : false })}
              className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px]"
              placeholder="Ej: Toyota"
            />
            {errors.new_make_name && <p className="text-red-500 text-xs mt-1">{errors.new_make_name.message?.toString()}</p>}
          </div>
        )}

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Modelo *</label>
          <input
            type="text"
            {...register('name', { required: 'El modelo es obligatorio' })}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px]"
            placeholder="Ej: Corolla"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message?.toString()}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Generación / Años</label>
          <input
            type="text"
            {...register('generation')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px]"
            placeholder="Ej: 2014-2019, Mk7, etc. (Opcional)"
          />
        </div>

        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="is_active_veh"
            {...register('is_active')}
            className="rounded border-gray-300 text-accent focus:ring-accent"
          />
          <label htmlFor="is_active_veh" className="text-[14px] text-ink">
            Modelo Activo
          </label>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[14px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 text-[14px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar Modelo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
