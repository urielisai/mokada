import { useForm } from 'react-hook-form';
import { Modal } from '../../../components/ui/Modal';
import { useSaveUnit } from '../hooks/useConfig';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

interface UnitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit?: any;
}

export const UnitFormModal = ({ isOpen, onClose, unit }: UnitFormModalProps) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      code: '',
      name: '',
      allows_decimals: false
    }
  });

  const { mutateAsync: saveUnit, isPending } = useSaveUnit();

  useEffect(() => {
    if (isOpen) {
      if (unit) {
        reset({
          code: unit.code,
          name: unit.name,
          allows_decimals: unit.allows_decimals
        });
      } else {
        reset({
          code: '',
          name: '',
          allows_decimals: false
        });
      }
    }
  }, [isOpen, unit, reset]);

  const onSubmit = async (data: any) => {
    try {
      await saveUnit({
        id: unit?.id,
        ...data
      });
      toast.success(unit ? 'Unidad actualizada' : 'Unidad creada exitosamente');
      onClose();
    } catch (error: any) {
      console.error('Error saving unit:', error);
      toast.error(error.message || 'Error al guardar la unidad');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={unit ? 'Editar Unidad' : 'Nueva Unidad'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Código *</label>
          <input
            type="text"
            {...register('code', { required: 'El código es obligatorio' })}
            placeholder="Ej: PZA, KG, LTS"
            className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition"
            disabled={isPending}
          />
          {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message?.toString()}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Nombre *</label>
          <input
            type="text"
            {...register('name', { required: 'El nombre es obligatorio' })}
            placeholder="Ej: Pieza, Kilogramo"
            className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition"
            disabled={isPending}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message?.toString()}</p>}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allows_decimals"
            {...register('allows_decimals')}
            className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent"
            disabled={isPending}
          />
          <label htmlFor="allows_decimals" className="text-[13px] font-medium text-ink">
            Permite decimales (ej. para kilos, litros)
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[14px] font-medium text-ink bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-[14px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50"
            disabled={isPending}
          >
            {isPending ? 'Guardando...' : 'Guardar Unidad'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
