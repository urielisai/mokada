import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTransferFull, useCompleteTransfer, useCancelTransfer, useStock } from '../hooks/useInventory';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatDate } from '../../../utils/formatters';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { AlertModal } from '../../../components/ui/AlertModal';
import { Modal } from '../../../components/ui/Modal';
import { Table } from '../../../components/ui/Table';
import { ArrowLeft, CheckCircle2, Pencil, XCircle, Package, List, LayoutGrid } from 'lucide-react';
import { catalogService } from '../../catalog/services/catalog.service';
import { InventoryProductInfo } from '../components/InventoryProductInfo';

export const TransferDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: transfer, isLoading, error: transferError } = useTransferFull(id || null);
  const {data: stock, isLoading: loadingStock, error: stockError, refetch: refreshStock} = useStock();
  const blockers = transfer?.status === 'DRAFT' ? (transfer.items || []).flatMap((item: any) => {
    const source = stock?.find(row => row.product_id === item.product_id && row.warehouse_id === transfer.source_warehouse_id && row.location_id == null);
    const label = item.products?.code || item.product_id;
    if (item.unit_price == null || !Number.isFinite(Number(item.unit_price)) || Number(item.unit_price)<0) return [`${label}: falta precio interno.`];
    if ((source?.available_quantity ?? 0) < item.quantity) return [`${label}: cantidad superior al disponible del origen.`];
    if (source?.average_cost == null || source?.original_average_cost == null) return [`${label}: falta costo en ${transfer.source?.name}.`];
    if (Number(item.unit_price) <= Number(source.average_cost)) return [`${label}: el precio interno debe superar el costo promedio del origen.`];
    const destination = stock?.find(row => row.product_id === item.product_id && row.warehouse_id === transfer.destination_warehouse_id && row.location_id == null);
    if (destination && Number(destination.quantity)>0 && (destination.average_cost == null || destination.original_average_cost == null)) return [`${label}: faltan costos para existencias anteriores del destino.`];
    return [];
  }) : [];
  
  const { mutateAsync: completeTransfer, isPending: isCompleting } = useCompleteTransfer();
  const { mutateAsync: cancelTransfer, isPending: isCancelling } = useCancelTransfer();
  
  const [confirmModal, setConfirmModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'success' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error'
  });

  const handleComplete = async () => {
    if (!transfer?.id) return;
    if (loadingStock || stockError || blockers.length || !transfer.items?.length) {
      setConfirmModal(false);
      setAlertModal({isOpen: true, title: 'Revisa el inventario', message: stockError ? 'No se pudo consultar el inventario.' : blockers.join(' ') || 'Agrega productos y verifica las existencias.', type: 'error'});
      return;
    }
    try {
      await completeTransfer(transfer.id);
      setConfirmModal(false);
      setAlertModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Traspaso completado correctamente.',
        type: 'success'
      });
    } catch (error: any) {
      console.error('Error completing transfer:', error);
      setConfirmModal(false);
      let detail = error?.message || 'Hubo un error al completar el traspaso.';
      if (detail.startsWith('Configura el costo')) {
        detail = 'Falta registrar el costo de compra de un producto en el almacén de origen. Ve a Inventario → Costos y ganancias → Costos del inventario, configura sus costos y vuelve a completar el traspaso. El precio interno del traspaso es distinto del costo de compra.';
      } else if (detail.includes('Insufficient stock') || detail.includes('INSUFFICIENT_STOCK') || detail.includes('Inventario disponible insuficiente')) {
        detail = 'No hay suficiente inventario en el almacén de origen para uno o más productos.';
      }
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: detail,
        type: 'error'
      });
    }
  };

  const handleCancel = async () => {
    if (!transfer?.id) return;
    try {
      await cancelTransfer(transfer.id);
      setCancelModal(false);
      setAlertModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Traspaso cancelado correctamente.',
        type: 'success'
      });
    } catch (error: any) {
      console.error('Error cancelling transfer:', error);
      setCancelModal(false);
      setAlertModal({
        isOpen: true,
        title: 'Error de Sistema',
        message: error?.message || 'Hubo un error al cancelar el traspaso.',
        type: 'error'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066CC]"></div>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="py-12 text-center text-gray-500 text-[14px]">
        {transferError ? `No se pudo consultar el traspaso: ${(transferError as Error).message}` : 'No se encontró el traspaso.'}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/inventory/transfers')}
            className="p-2 text-gray-400 hover:text-[#1D1D1F] hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
                {transfer.transfer_number}
              </h2>
              <StatusBadge status={transfer.status} />
            </div>
            <p className="text-[14px] text-[#86868B] mt-1">
              Creado el {formatDate(transfer.created_at)}
            </p>
          </div>
        </div>

        {transfer.status === 'DRAFT' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCancelModal(true)}
              className="px-4 py-2 text-[14px] font-medium text-[#E02424] bg-white border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={() => navigate(`/inventory/transfers/edit/${transfer.id}`)}
              className="px-4 py-2 text-[14px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
            <button
              onClick={() => setConfirmModal(true)}
              disabled={isCompleting || isCancelling || loadingStock || !!stockError || blockers.length>0 || !transfer.items?.length}
              className="px-5 py-2 text-[14px] font-medium text-white bg-[#0066CC] rounded-xl hover:bg-[#0055FF] transition-colors shadow-sm flex items-center gap-2 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              Completar Traspaso
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {stockError && <p className="text-[13px] text-red-600 mb-4">No se pudo consultar el inventario. <button onClick={() => refreshStock()} className="underline">Reintentar</button></p>}
        {transfer.status === 'DRAFT' && !loadingStock && !stockError && blockers.length>0 && <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800 mb-4">{blockers.map((message: string) => <p key={message}>{message}</p>)}</div>}
        {transfer.status === 'DRAFT' && (
          <p className="text-[13px] text-[#86868B] bg-gray-50 border border-gray-200/60 rounded-xl p-4 mb-6">
            Antes de completar, los productos deben tener su costo registrado en el almacén de origen.{' '}
            <Link to="/admin/margins" className="text-[#0066CC] font-medium hover:underline">Configurar costos del inventario</Link>
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-[12px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Almacén de Origen</p>
            <p className="text-[16px] font-medium text-[#1D1D1F]">{transfer.source?.name}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Almacén de Destino</p>
            <p className="text-[16px] font-medium text-[#1D1D1F]">{transfer.destination?.name}</p>
          </div>
        </div>

        {transfer.notes && (
          <div className="mb-8">
            <p className="text-[12px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Notas / Referencia</p>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-[14px] text-[#1D1D1F]">
              {transfer.notes}
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[17px] font-semibold text-[#1D1D1F]">Productos Involucrados</h3>
            <div className="flex items-center bg-gray-100/80 p-1 rounded-xl border border-gray-200/50">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table' 
                    ? 'bg-white shadow-sm text-[#1D1D1F]' 
                    : 'text-gray-500 hover:text-[#1D1D1F]'
                }`}
                title="Vista de Tabla"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-white shadow-sm text-[#1D1D1F]' 
                    : 'text-gray-500 hover:text-[#1D1D1F]'
                }`}
                title="Vista de Cuadrícula"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {viewMode === 'table' ? (
            <Table
              data={transfer.items || []}
              columns={[
                { 
                  header: 'Código', 
                  cell: (item: any) => <span className="font-medium text-[#0066CC]">{item.products?.code}</span> 
                },
                { 
                  header: 'Producto', 
                  cell: (item: any) => (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center shrink-0 bg-gray-50 border border-gray-100 rounded-lg overflow-hidden">
                        {item.products?.image_url ? (
                          <img 
                            src={catalogService.getProductImageUrl(item.products.image_url) ?? undefined}
                            alt={item.products?.name} 
                            className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setPreviewImage({ url: catalogService.getProductImageUrl(item.products.image_url) || '', title: item.products?.name })}
                          />
                        ) : (
                          <Package className="w-5 h-5 text-gray-300 stroke-[1.5]" />
                        )}
                      </div>
                      <span className="font-medium text-[#1D1D1F]">{item.products?.name}</span>
                    </div>
                  )
                },
                { header: 'Cantidad', accessorKey: 'quantity', className: 'font-semibold' },
                { header: 'Precio interno', cell: (item: any) => item.unit_price == null ? 'Sin precio' : new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'}).format(item.unit_price) },
                { header: 'Inventario y precios', cell: (item: any) => <div className="min-w-80"><InventoryProductInfo productId={item.product_id} source={stock?.find(row => row.product_id===item.product_id && row.warehouse_id===transfer.source_warehouse_id && row.location_id==null)} destination={stock?.find(row => row.product_id===item.product_id && row.warehouse_id===transfer.destination_warehouse_id && row.location_id==null)} sourceName={transfer.source?.name} destinationName={transfer.destination?.name} quantity={transfer.status==='DRAFT' ? Number(item.quantity) : undefined} unitPrice={item.unit_price} stockLoaded={!loadingStock && !stockError} /></div> }
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {transfer.items?.map((item: any, index: number) => {
                const imageUrl = item.products?.image_url ? catalogService.getProductImageUrl(item.products.image_url) : null;
                return (
                  <div 
                    key={item.id || index}
                    className="group bg-white border border-gray-200/60 rounded-[24px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col"
                  >
                    {/* Image Section */}
                    <div className="relative aspect-square bg-white border-b border-gray-50 p-6 flex items-center justify-center overflow-hidden">
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={item.products?.name} 
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                          onClick={() => setPreviewImage({ url: imageUrl, title: item.products?.name })}
                        />
                      ) : (
                        <Package className="w-20 h-20 text-gray-200 stroke-[1] group-hover:scale-105 transition-transform duration-500" />
                      )}
                    </div>

                    {/* Info Section */}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[12px] font-medium text-[#0066CC] truncate">
                          {item.products?.code}
                        </span>
                        <span className="text-[12px] font-medium text-emerald-600">
                          • Traspaso
                        </span>
                      </div>
                      
                      <h3 className="text-[15px] font-semibold text-[#1D1D1F] leading-tight mb-2 line-clamp-2" title={item.products?.name}>
                        {item.products?.name}
                      </h3>
                      <InventoryProductInfo productId={item.product_id} source={stock?.find(row => row.product_id===item.product_id && row.warehouse_id===transfer.source_warehouse_id && row.location_id==null)} destination={stock?.find(row => row.product_id===item.product_id && row.warehouse_id===transfer.destination_warehouse_id && row.location_id==null)} sourceName={transfer.source?.name} destinationName={transfer.destination?.name} quantity={transfer.status==='DRAFT' ? Number(item.quantity) : undefined} unitPrice={item.unit_price} stockLoaded={!loadingStock && !stockError} />
                      
                      <div className="mt-auto pt-4 border-t border-gray-100 flex justify-center text-center">
                        <div>
                          <p className="text-[11px] text-[#86868B] uppercase tracking-wider mb-0.5">Cantidad</p>
                          <p className="text-[14px] font-semibold text-[#1D1D1F]">
                            {item.quantity}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">Precio interno: {item.unit_price == null ? 'Sin precio' : new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'}).format(item.unit_price)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal}
        onClose={() => setConfirmModal(false)}
        onConfirm={handleComplete}
        title="Completar Traspaso"
        message="¿Estás seguro de completar este traspaso? El inventario se descontará del almacén origen y se agregará al almacén destino. Esta acción no se puede deshacer."
        confirmText="Completar Traspaso"
        isPending={isCompleting}
      />

      <ConfirmModal
        isOpen={cancelModal}
        onClose={() => setCancelModal(false)}
        onConfirm={handleCancel}
        title="Cancelar Traspaso"
        message="¿Estás seguro de que deseas cancelar este traspaso? Esta acción no se puede deshacer."
        confirmText={isCancelling ? 'Cancelando...' : 'Sí, cancelar traspaso'}
        cancelText="No, mantener"
        isDestructive={true}
        isPending={isCancelling}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

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
    </div>
  );
};
