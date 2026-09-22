import { useForm, Controller } from 'react-hook-form';
import { Modal } from '../../../components/ui/Modal';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { useCreateMovement, useWarehouses, useStock } from '../hooks/useInventory';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../services/inventory.service';
import { InventoryProductInfo } from './InventoryProductInfo';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { Package } from 'lucide-react';
import { catalogService } from '../../catalog/services/catalog.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const MovementFormModal = ({ isOpen, onClose }: Props) => {
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm({shouldUnregister: true});
  const { mutateAsync: createMovement, isPending } = useCreateMovement();
  
  const { data: warehouses } = useWarehouses();
  const {data: products = [], error: productsError, isLoading: loadingProducts} = useQuery({queryKey: ['inventory-products'], queryFn: inventoryService.getInventoryProducts, enabled: isOpen});
  const {data: stock, isLoading: loadingStock, error: stockError} = useStock();
  const warehouseId = watch('warehouse_id');
  const productId = watch('product_id');
  const movementType = watch('movement_type');
  const incoming = movementType !== 'ADJUSTMENT_OUT';
  const selectedStock = stock?.find(row => row.product_id === productId && row.warehouse_id === warehouseId && row.location_id == null);

  useEffect(() => {
    if (isOpen) {
      reset({
        product_id: '',
        warehouse_id: '',
        movement_type: 'PURCHASE',
        unit_cost: '',
        quantity: '',
        notes: ''
      });
    }
  }, [isOpen, reset]);

  useEffect(() => {
    if (incoming && warehouseId && warehouses && warehouses.find(w => w.id === warehouseId)?.warehouse_role !== 'PURCHASE') {
      setValue('warehouse_id', '');
    }
  }, [incoming, warehouseId, warehouses, setValue]);

  const onSubmit = async (data: any) => {
    try {
      if (loadingStock || stockError || productsError) throw new Error('No se pudo verificar el producto y sus existencias.');
      if (!Number.isFinite(Number(data.quantity)) || Number(data.quantity) <= 0) throw new Error('Captura una cantidad válida.');
      if (data.movement_type === 'ADJUSTMENT_OUT' && Number(data.quantity) > (selectedStock?.available_quantity ?? 0)) throw new Error('La salida supera el disponible de este producto en el almacén.');
      await createMovement({
        ...data,
        quantity: Number(data.quantity),
        unit_cost: Number(data.unit_cost)
      });
      onClose();
    } catch (error) {
      toast.error((error as {message?: string})?.message || 'Error al registrar movimiento');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Movimiento de Inventario"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {(productsError || stockError) && <p className="text-[13px] text-red-600">No se pudieron consultar productos o existencias. Cierra y vuelve a abrir el formulario para reintentar.</p>}
        
        <div className="space-y-4">
          <Controller
            name="product_id"
            control={control}
            rules={{ required: 'El producto es obligatorio' }}
            render={({ field }) => {
              const selectedProduct = products.find((p: any) => p.id === field.value);
              const imageUrl = selectedProduct?.image_url ? catalogService.getProductImageUrl(selectedProduct.image_url) : null;

              return (
                <div>
                  {!field.value ? (
                    <SearchSelect
                      label="Producto *"
                      options={products.map((p: any) => ({
                        value: p.id,
                        label: `[${p.code}] ${p.name}`,
                        keywords: p.code
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Busca y selecciona un producto..."
                      disabled={loadingProducts}
                    />
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200/60 rounded-xl relative group">
                      <label className="block text-[13px] font-medium text-[#1D1D1F] mb-3">Producto Seleccionado</label>
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 flex items-center justify-center shrink-0 bg-white border border-gray-200/60 rounded-lg overflow-hidden shadow-sm">
                          {imageUrl ? (
                            <img src={imageUrl ?? undefined} alt={selectedProduct?.name ?? ''} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-8 h-8 text-gray-300 stroke-[1.5]" />
                          )}
                        </div>
                        <div className="flex-1 mt-0.5">
                          <span className="text-[12px] font-medium text-[#0066CC] block mb-0.5">
                            {selectedProduct?.code}
                          </span>
                          <h4 className="text-[14px] font-semibold text-[#1D1D1F] line-clamp-2 pr-4">
                            {selectedProduct?.name}
                          </h4>
                          <button
                            type="button"
                            onClick={() => field.onChange('')}
                            className="mt-2 text-[12px] text-[#0066CC] hover:underline font-medium"
                          >
                            Cambiar producto
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {errors.product_id && <p className="text-red-500 text-xs mt-1">{errors.product_id.message?.toString()}</p>}
                </div>
              );
            }}
          />

          <Controller
            name="warehouse_id"
            control={control}
            rules={{ required: 'El almacén es obligatorio' }}
            render={({ field }) => (
              <div>
                <SearchSelect
                  label="Almacén *"
                  options={warehouses?.filter(w => w.is_active && (!incoming || w.warehouse_role === 'PURCHASE')).map((w: any) => ({
                    value: w.id,
                    label: w.name
                  })) || []}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Selecciona un almacén..."
                />
                {errors.warehouse_id && <p className="text-red-500 text-xs mt-1">{errors.warehouse_id.message?.toString()}</p>}
              </div>
            )}
          />
        </div>

        {productId && warehouseId && <InventoryProductInfo productId={productId} source={selectedStock} sourceName={warehouses?.find(w => w.id === warehouseId)?.name} stockLoaded={!loadingStock && !stockError} />}
        {movementType !== 'ADJUSTMENT_OUT' && selectedStock && (selectedStock.quantity ?? 0)>0 && (selectedStock.average_cost == null || selectedStock.original_average_cost == null) && <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">Hay existencias anteriores sin costo. Configura su costo promedio antes de agregar esta entrada para poder calcular el nuevo promedio.</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Tipo de Movimiento *</label>
            <select
              {...register('movement_type', { required: true })}
              className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px]"
            >
              <option value="PURCHASE">Compra (+)</option>
              <option value="INITIAL_STOCK">Stock Inicial (+)</option>
              <option value="ADJUSTMENT_IN">Ajuste de Entrada (+)</option>
              <option value="ADJUSTMENT_OUT">Ajuste de Salida (-)</option>
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Cantidad *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={movementType === 'ADJUSTMENT_OUT' ? selectedStock?.available_quantity ?? 0 : undefined}
              {...register('quantity', { required: 'La cantidad es obligatoria', min: 0.01, validate: value => movementType !== 'ADJUSTMENT_OUT' || Number(value) <= (selectedStock?.available_quantity ?? 0) || 'La cantidad supera el disponible' })}
              className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px]"
              placeholder="0.00"
            />
            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message?.toString()}</p>}
          </div>
        </div>

        {incoming && (
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">{movementType === 'PURCHASE' ? 'Costo de compra por unidad' : 'Costo de la entrada por unidad'} ($) *</label>
            <input type="number" min="0" step="0.0001" className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all disabled:opacity-50"
              {...register('unit_cost', { required: 'Captura el costo', min: 0 })} />
            {errors.unit_cost && <p className="text-red-500 text-xs">{String(errors.unit_cost.message)}</p>}
            <p className="text-[12px] text-[#86868B] mt-2">Este costo pertenece al almacén de compras. El precio interno se captura después, al traspasar al almacén de ventas.</p>
          </div>
        )}
        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Notas / Referencia</label>
          <textarea
            {...register('notes')}
            rows={2}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] resize-none"
            placeholder="Motivo del ajuste..."
          />
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
              disabled={isPending || loadingStock || loadingProducts || !!stockError || !!productsError}
            className="px-4 py-2 text-[14px] font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#0055FF] transition-colors disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : 'Aplicar Movimiento'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
