import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useSaveTransfer, useUpdateTransfer, useTransferFull, useWarehouses, useStock } from '../hooks/useInventory';
import { Plus, Trash2, Package, Tag } from 'lucide-react';
import { AlertModal } from '../../../components/ui/AlertModal';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { Modal } from '../../../components/ui/Modal';
import { catalogService } from '../../catalog/services/catalog.service';
import { InventoryProductInfo } from '../components/InventoryProductInfo';
import { createClientUuid } from '../../../utils/createClientUuid';

export const TransferFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const { data: transferData, isLoading: isLoadingTransfer } = useTransferFull(id || null);
  const { mutateAsync: saveTransfer, isPending: isSaving } = useSaveTransfer();
  const { mutateAsync: updateTransfer, isPending: isUpdating } = useUpdateTransfer();
  const isPending = isSaving || isUpdating;

  const { data: warehouses } = useWarehouses();
  const { data: stockData, isLoading: loadingStock, error: stockError, refetch: refreshStock } = useStock();

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'success' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error'
  });
  
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors, isDirty } } = useForm({
    defaultValues: {
      transfer_number: `TR-${createClientUuid().slice(0, 8).toUpperCase()}`,
      source_warehouse_id: '',
      destination_warehouse_id: '',
      notes: '',
      items: [{ product_id: '', quantity: 1, unit_price: null as number | null }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const sourceWarehouseId = watch('source_warehouse_id');
  const destinationWarehouseId = watch('destination_warehouse_id');
  const watchedItems = watch('items');
  const sourceWarehouse = warehouses?.find(w => w.id === sourceWarehouseId);
  const destinationWarehouse = warehouses?.find(w => w.id === destinationWarehouseId);

  // Filter available stock based on selected source warehouse
  const availableStock = stockData?.filter((item: any) => 
    item.warehouse_id === sourceWarehouseId && item.location_id == null && item.available_quantity > 0
  ) || [];

  // Populate form if editing
  useEffect(() => {
    if (transferData && id && !isDirty) {
      reset({
        transfer_number: transferData.transfer_number,
        source_warehouse_id: transferData.source_warehouse_id,
        destination_warehouse_id: transferData.destination_warehouse_id,
        notes: transferData.notes || '',
        items: transferData.items?.length > 0 
          ? transferData.items.map((item: any) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price ?? null
            }))
          : [{ product_id: '', quantity: 1, unit_price: null }]
      });
    }
  }, [transferData, reset, id, isDirty]);

  const onSubmit = async (data: any) => {
    try {
      if (data.source_warehouse_id === data.destination_warehouse_id) {
        setAlertModal({
          isOpen: true,
          title: 'Almacenes Inválidos',
          message: 'El almacén de origen y destino no pueden ser el mismo.',
          type: 'error'
        });
        return;
      }

      // Filter out empty items
      const validItems = data.items.filter((item: any) => item.product_id && Number(item.quantity) > 0);
      if (loadingStock || stockError) throw new Error('No se pudo verificar el inventario. Actualiza los datos antes de guardar.');
      if (id && transferData?.status !== 'DRAFT') throw new Error('Solo se pueden editar traspasos en borrador.');
      if (!sourceWarehouse?.is_active || !destinationWarehouse?.is_active) throw new Error('Selecciona almacenes activos.');
      if (sourceWarehouse.warehouse_role !== 'PURCHASE' || destinationWarehouse.warehouse_role !== 'SALES') throw new Error('El traspaso debe ir del almacén de compras al de ventas.');
      if (new Set(validItems.map((item: any) => item.product_id)).size !== validItems.length) throw new Error('El producto está repetido. Agrupa la cantidad en una sola partida.');
      for (const item of validItems) {
        const stock = availableStock.find(row => row.product_id === item.product_id);
        if (!Number.isFinite(Number(item.quantity)) || !stock || Number(item.quantity) > Number(stock.available_quantity)) throw new Error('La cantidad de un producto supera el disponible del almacén de origen.');
        if (item.unit_price == null || item.unit_price === '' || !Number.isFinite(Number(item.unit_price)) || Number(item.unit_price) < 0) throw new Error('Captura un precio interno válido para cada producto.');
        if (stock.average_cost != null && Number(item.unit_price) <= Number(stock.average_cost)) throw new Error('El precio interno debe ser mayor que el costo promedio del almacén de compras.');
        const destinationStock = stockData?.find(row => row.product_id === item.product_id && row.warehouse_id === data.destination_warehouse_id && row.location_id == null);
        if (destinationStock && Number(destinationStock.quantity) > 0 && (destinationStock.average_cost == null || destinationStock.original_average_cost == null)) throw new Error('Hay existencias antiguas sin costo en el almacén de ventas. Configura sus costos antes de completar el traspaso.');
      }
      
      if (validItems.length === 0) {
         setAlertModal({
          isOpen: true,
          title: 'Traspaso Vacío',
          message: 'Debes añadir al menos un producto válido al traspaso.',
          type: 'error'
        });
        return;
      }
      
      const cleanData = {
        source_warehouse_id: data.source_warehouse_id,
        destination_warehouse_id: data.destination_warehouse_id,
        notes: data.notes,
        items: validItems.map((item: any) => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_price: item.unit_price != null && item.unit_price !== '' ? Number(item.unit_price) : null
        }))
      };
      
      if (id) {
        await updateTransfer({ id, payload: cleanData });
      } else {
        await saveTransfer({ transfer_number: data.transfer_number, ...cleanData });
      }
      navigate('/inventory/transfers');
    } catch (error) {
      console.error('Error guardando traspaso:', error);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: (error as {message?: string})?.message || 'Ocurrió un error al guardar el traspaso.',
        type: 'error'
      });
    }
  };

  if (id && isLoadingTransfer) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066CC]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
          {id ? 'Editar Traspaso' : 'Nuevo Traspaso'}
        </h2>
        <p className="text-[15px] text-[#86868B]">
          {id ? `Editando borrador ${transferData?.transfer_number}` : 'Mover inventario entre almacenes'}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {stockError && <div className="text-[13px] text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl mb-4">No se pudo consultar el inventario: {(stockError as Error).message}. <button type="button" className="underline" onClick={() => refreshStock()}>Reintentar</button></div>}
        {id && transferData && transferData.status !== 'DRAFT' && <p className="text-red-600 text-sm mb-4">Este traspaso ya no permite modificaciones.</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Controller
              name="source_warehouse_id"
              control={control}
              rules={{ required: 'El origen es obligatorio' }}
              render={({ field }) => (
                <div>
                  <SearchSelect
                    label="Almacén Origen *"
                    options={warehouses?.filter(w => w.is_active && w.warehouse_role === 'PURCHASE').map((w: any) => ({
                      value: w.id,
                      label: w.name
                    })) || []}
                    value={field.value}
                    onChange={(val) => {
                      if (val !== field.value) {
                        setValue('items', [{ product_id: '', quantity: 1, unit_price: null }]);
                        if (val === destinationWarehouseId) setValue('destination_warehouse_id', '');
                      }
                      field.onChange(val);
                    }}
                    placeholder="Seleccionar origen"
                  />
                  {errors.source_warehouse_id && <p className="text-red-500 text-xs mt-1">{errors.source_warehouse_id.message?.toString()}</p>}
                </div>
              )}
            />

            <Controller
              name="destination_warehouse_id"
              control={control}
              rules={{ required: 'El destino es obligatorio' }}
              render={({ field }) => (
                <div>
                  <SearchSelect
                    label="Almacén Destino *"
                    options={warehouses?.filter((w: any) => w.is_active && w.warehouse_role === 'SALES' && w.id !== sourceWarehouseId).map((w: any) => ({
                      value: w.id,
                      label: w.name
                    })) || []}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Seleccionar destino"
                  />
                  {errors.destination_warehouse_id && <p className="text-red-500 text-xs mt-1">{errors.destination_warehouse_id.message?.toString()}</p>}
                </div>
              )}
            />
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800">
            <Tag className="w-5 h-5 shrink-0" />
            El precio interno debe ser mayor que el costo promedio de compra. Se convierte en el costo del almacén de ventas; el precio público, los descuentos y mayoreo se configuran en el producto.
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Notas / Referencia</label>
            <input
              type="text"
              {...register('notes')}
              className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] text-[14px] transition-all"
              placeholder="Ej: Traspaso urgente para sucursal norte"
            />
          </div>

          <div className="border-t border-gray-100 pt-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-[17px] font-semibold text-[#1D1D1F]">Productos a Transferir</h3>
                <p className="text-[13px] text-[#86868B]">
                  {sourceWarehouseId 
                    ? `Mostrando ${availableStock.length} productos disponibles en el origen.`
                    : 'Selecciona un almacén de origen para ver el inventario disponible.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => append({ product_id: '', quantity: 1, unit_price: null })}
                disabled={!sourceWarehouseId}
                className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-[#0066CC] bg-[#0066CC]/10 rounded-lg hover:bg-[#0066CC]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Añadir Producto
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => {
                const currentProductId = watch(`items.${index}.product_id`);
                const stockItem = stockData?.find(s => s.product_id === currentProductId && s.warehouse_id === sourceWarehouseId && s.location_id == null);
                const destinationStock = stockData?.find(s => s.product_id === currentProductId && s.warehouse_id === destinationWarehouseId && s.location_id == null);
                const transferItem = transferData?.items?.find((i: any) => i.product_id === currentProductId);
                const productStockInfo = stockItem || (transferItem ? {
                  product_code: transferItem.products?.code,
                  product_name: transferItem.products?.name,
                  product_image: transferItem.products?.image_url,
                  available_quantity: 0
                } : null);
                
                const imageUrl = productStockInfo?.product_image ? catalogService.getProductImageUrl(productStockInfo.product_image) : null;

                return (
                  <div key={field.id} className="p-4 bg-white border border-gray-200/60 shadow-sm rounded-[16px] relative group">
                    <div className="flex flex-col md:flex-row gap-6">
                      
                      {/* Product Selector / Visual Info */}
                      <div className="flex-1">
                        {!currentProductId ? (
                          <Controller
                            name={`items.${index}.product_id`}
                            control={control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <SearchSelect
                                label="Buscar Producto *"
                                options={availableStock.filter(p => !watchedItems.some((item, otherIndex) => otherIndex !== index && item.product_id === p.product_id)).map((p: any) => ({
                                  value: p.product_id,
                                  label: `[${p.product_code}] ${p.product_name}`,
                                  description: `Disponible: ${p.available_quantity}`,
                                  keywords: p.product_code
                                }))}
                                value={field.value}
                                onChange={value => {field.onChange(value); setValue(`items.${index}.quantity`, 1); setValue(`items.${index}.unit_price`, null);}}
                                placeholder="Busca en el inventario del origen..."
                                disabled={!sourceWarehouseId}
                              />
                            )}
                          />
                        ) : (
                          <div className="flex items-start gap-4">
                            <button 
                              type="button"
                              onClick={() => imageUrl && setPreviewImage({ url: imageUrl, title: productStockInfo?.product_name || 'Producto' })}
                              className="w-16 h-16 flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              {imageUrl ? (
                                <img src={imageUrl} alt={productStockInfo?.product_name || 'Producto'} className="w-full h-full object-cover rounded-xl border border-gray-200/60 shadow-sm" />
                              ) : (
                                <Package className="w-8 h-8 text-gray-300 stroke-[1.5]" />
                              )}
                            </button>
                            <div className="flex-1 mt-1">
                              <div>
                                <span className="text-[12px] font-medium text-[#0066CC] block mb-0.5">
                                  {productStockInfo?.product_code || '---'}
                                </span>
                                <h4 className="text-[14px] font-semibold text-[#1D1D1F] line-clamp-1 pr-4">
                                  {productStockInfo?.product_name || 'Cargando producto...'}
                                </h4>
                              </div>
                              <div className="mt-2 flex items-center gap-4">
                                <div className="inline-flex items-center gap-1.5 text-[12px] text-gray-600 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                  <span>Disponible en origen:</span>
                                  <span className="font-semibold text-[#1D1D1F]">{productStockInfo?.available_quantity || 0}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {setValue(`items.${index}.product_id`, ''); setValue(`items.${index}.unit_price`, null); setValue(`items.${index}.quantity`, 1);}}
                                  className="text-[12px] text-[#0066CC] hover:underline font-medium"
                                >
                                  Cambiar producto
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Quantity + Price Inputs */}
                      <div className="w-full md:w-72 md:flex-shrink-0 flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 gap-3">
                        <div className="flex items-end gap-3">
                          <div className="w-1/2">
                            <label className="block text-[12px] font-medium text-[#86868B] mb-1">Cantidad *</label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              max={stockItem?.available_quantity ?? 0}
                              {...register(`items.${index}.quantity`, { 
                                required: true, 
                                min: 0.01,
                                max: stockItem?.available_quantity ?? 0,
                                valueAsNumber: true 
                              })}
                              disabled={!currentProductId}
                              className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] text-[14px] transition-all disabled:opacity-50"
                            />
                            {errors.items?.[index]?.quantity && <p className="text-red-600 text-[11px] mt-1">Cantidad inválida o superior al disponible.</p>}
                          </div>

                          <div className="w-1/2">
                            <label className="block text-[12px] font-medium text-[#86868B] mb-1 truncate flex items-center gap-1" title="Precio interno (MXN)">
                              <Tag className="w-3 h-3 text-amber-500" />
                              Precio interno
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-gray-400 font-medium">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                {...register(`items.${index}.unit_price`, {
                                  valueAsNumber: true,
                                  required: true,
                                  min: 0
                                })}
                                disabled={!currentProductId}
                                placeholder="0.00"
                                className="w-full pl-6 pr-2 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all disabled:opacity-50"
                              />
                              {errors.items?.[index]?.unit_price && <p className="text-red-600 text-[11px] mt-1">Captura el precio interno.</p>}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 mb-0.5"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                    </div>
                    {currentProductId && <InventoryProductInfo source={stockItem} destination={destinationStock} sourceName={sourceWarehouse?.name} destinationName={destinationWarehouse?.name} productId={currentProductId} quantity={Number(watch(`items.${index}.quantity`))} unitPrice={watch(`items.${index}.unit_price`)} stockLoaded={!loadingStock && !stockError} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate('/inventory/transfers')}
              className="px-5 py-2.5 text-[14px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || loadingStock || !!stockError || (!!id && transferData?.status !== 'DRAFT')}
              className="px-5 py-2.5 text-[14px] font-medium text-white bg-[#0066CC] rounded-xl hover:bg-[#0055FF] transition-colors shadow-sm disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : id ? 'Actualizar Borrador' : 'Crear Borrador'}
            </button>
          </div>
        </form>
      </div>

      {previewImage && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewImage(null)}
          title={previewImage.title}
          size="md"
        >
          <div className="p-4 flex justify-center items-center bg-gray-50 rounded-xl">
            <img src={previewImage.url} alt={previewImage.title} className="max-w-full max-h-[500px] object-contain rounded-lg shadow-sm mix-blend-multiply" />
          </div>
        </Modal>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
};
