import { useForm } from 'react-hook-form';
import { Modal } from '../../../components/ui/Modal';
import { useSaveBrand } from '../hooks/useCatalog';
import { useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  brand?: any;
}

export const BrandFormModal = ({ isOpen, onClose, brand }: Props) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const { mutateAsync: saveBrand, isPending } = useSaveBrand();

  useEffect(() => {
    if (isOpen) {
      if (brand) {
        reset({
          id: brand.id,
          code: brand.code || '',
          name: brand.name || '',
          is_active: brand.is_active
        });
      } else {
        reset({
          id: null,
          code: '',
          name: '',
          is_active: true
        });
      }
    }
  }, [isOpen, brand, reset]);

  const onSubmit = async (data: any) => {
    try {
      await saveBrand(data);
      onClose();
    } catch (error) {
      console.error('Error guardando marca:', error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={brand ? 'Editar Marca' : 'Nueva Marca'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Código</label>
          <input
            type="text"
            {...register('code')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px]"
            placeholder="Opcional"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Nombre *</label>
          <input
            type="text"
            {...register('name', { required: 'El nombre es obligatorio' })}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px]"
            placeholder="Ej: Bosch"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message?.toString()}</p>}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="is_active"
            {...register('is_active')}
            className="rounded border-gray-300 text-accent focus:ring-accent"
          />
          <label htmlFor="is_active" className="text-[14px] text-ink">
            Marca Activa
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
            disabled={isPending}
            className="px-4 py-2 text-[14px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : 'Guardar Marca'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
