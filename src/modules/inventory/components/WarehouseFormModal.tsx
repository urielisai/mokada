import { useForm } from 'react-hook-form';
import { Modal } from '../../../components/ui/Modal';
import { useSaveWarehouse } from '../hooks/useInventory';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { configService } from '../../configuration/services/config.service';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  warehouse?: any;
}

export const WarehouseFormModal = ({ isOpen, onClose, warehouse }: Props) => {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();
  const { mutateAsync: saveWarehouse, isPending } = useSaveWarehouse();
  const {data: priceLists, error: priceError} = useQuery({queryKey: ['price-lists'], queryFn: configService.getPriceLists, enabled: isOpen});

  useEffect(() => {
    if (isOpen) {
      if (warehouse) {
        reset({
          id: warehouse.id,
          code: warehouse.code || '',
          name: warehouse.name || '',
          description: warehouse.description || '',
          warehouse_role: warehouse.warehouse_role || 'SALES',
          price_list_id: warehouse.price_list_id || '',
          is_active: warehouse.is_active
        });
      } else {
        reset({
          id: null,
          code: '',
          name: '',
          description: '',
          warehouse_role: 'PURCHASE',
          price_list_id: '',
          is_active: true
        });
      }
    }
  }, [isOpen, warehouse, reset]);

  const onSubmit = async (data: any) => {
    try {
      await saveWarehouse({...data, code: data.code.trim(), name: data.name.trim(), price_list_id: data.warehouse_role === 'SALES' ? data.price_list_id || null : null});
      onClose();
    } catch (error) {
      toast.error((error as {message?: string})?.message || 'No se pudo guardar el almacén');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={warehouse ? 'Editar Almacén' : 'Nuevo Almacén'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Código *</label>
          <input
            type="text"
            {...register('code', { required: 'El código es obligatorio' })}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px]"
            placeholder="Ej: ALM-01"
          />
          {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message?.toString()}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Nombre del Almacén *</label>
          <input
            type="text"
            {...register('name', { required: 'El nombre es obligatorio' })}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px]"
            placeholder="Ej: Almacén Central"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message?.toString()}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Función del almacén *</label>
          <select {...register('warehouse_role', {required: true})} className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px]">
            <option value="PURCHASE">Compras y abastecimiento</option>
            <option value="SALES">Ventas a clientes</option>
          </select>
          <p className="text-[12px] text-[#86868B] mt-2">Las compras entran al principal; el almacén de ventas recibe mercancía por traspaso.</p>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Descripción</label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] resize-none"
            placeholder="Ubicación o detalles del almacén..."
          />
        </div>

        {watch('warehouse_role') === 'SALES' && <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Lista de venta predeterminada</label>
          <select {...register('price_list_id', {required: watch('warehouse_role') === 'SALES'})} disabled={!!priceError} className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px]">
            <option value="">Selecciona la lista predeterminada</option>
            {priceLists?.filter(list => list.is_active || list.id === warehouse?.price_list_id).map(list => <option key={list.id} value={list.id}>{list.name}{!list.is_active ? ' (inactiva)' : ''}</option>)}
          </select>
          {priceError && <p className="text-red-600 text-xs mt-1">No se pudieron consultar las listas.</p>}
          {errors.price_list_id && <p className="text-red-600 text-xs mt-1">Elige la lista de venta predeterminada.</p>}
          <p className="text-[12px] text-[#86868B] mt-2">Se usa al crear pedidos desde este almacén. Los descuentos y mayoreo se pueden elegir en cada venta.</p>
        </div>}
        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="is_active_warehouse"
            {...register('is_active')}
            className="rounded border-gray-300 text-[#0066CC] focus:ring-[#0066CC]"
          />
          <label htmlFor="is_active_warehouse" className="text-[14px] text-[#1D1D1F]">
            Almacén Activo
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
            className="px-4 py-2 text-[14px] font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#0055FF] transition-colors disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : 'Guardar Almacén'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
