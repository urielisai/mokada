import { useForm } from 'react-hook-form';
import { Modal } from '../../../components/ui/Modal';
import { useSavePriceList } from '../hooks/useConfig';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

interface PriceListFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceList?: any;
}

export const PriceListFormModal = ({ isOpen, onClose, priceList }: PriceListFormModalProps) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      code: '',
      name: '',
      discount_percentage: 0,
      currency: 'MXN',
      is_active: true
    }
  });

  const { mutateAsync: savePriceList, isPending } = useSavePriceList();

  useEffect(() => {
    if (isOpen) {
      if (priceList) {
        reset({
          code: priceList.code,
          name: priceList.name,
          discount_percentage: priceList.discount_percentage,
          currency: priceList.currency,
          is_active: priceList.is_active
        });
      } else {
        reset({
          code: '',
          name: '',
          discount_percentage: 0,
          currency: 'MXN',
          is_active: true
        });
      }
    }
  }, [isOpen, priceList, reset]);

  const onSubmit = async (data: any) => {
    try {
      await savePriceList({
        id: priceList?.id,
        ...data,
        discount_percentage: parseFloat(data.discount_percentage) || 0
      });
      toast.success(priceList ? 'Lista actualizada' : 'Lista creada exitosamente');
      onClose();
    } catch (error: any) {
      console.error('Error saving price list:', error);
      toast.error(error.message || 'Error al guardar la lista de precios');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={priceList ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Código *</label>
          <input
            type="text"
            {...register('code', { required: 'El código es obligatorio' })}
            placeholder="Ej: MAYOREO, DISTRIBUIDOR"
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
            placeholder="Ej: Lista Mayoreo"
            className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition"
            disabled={isPending}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message?.toString()}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Descuento (%) *</label>
            <input
              type="number"
              step="0.01"
              {...register('discount_percentage', { 
                required: 'El descuento es obligatorio',
                min: { value: 0, message: 'No puede ser negativo' },
                max: { value: 100, message: 'Máximo 100%' }
              })}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition"
              disabled={isPending}
            />
            {errors.discount_percentage && <p className="text-red-500 text-xs mt-1">{errors.discount_percentage.message?.toString()}</p>}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Moneda *</label>
            <select
              {...register('currency')}
              className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition"
              disabled={isPending}
            >
              <option value="MXN">MXN - Pesos</option>
              <option value="USD">USD - Dólares</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            {...register('is_active')}
            className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent"
            disabled={isPending}
          />
          <label htmlFor="is_active" className="text-[13px] font-medium text-ink">
            Lista activa
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
            {isPending ? 'Guardando...' : 'Guardar Lista'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
