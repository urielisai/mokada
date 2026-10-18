import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTransferFull, useCompleteTransfer, useCancelTransfer, useStock } from '../hooks/useInventory';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { AlertModal } from '../../../components/ui/AlertModal';
import { Modal } from '../../../components/ui/Modal';
import { ArrowLeft, CheckCircle2, Pencil, XCircle } from 'lucide-react';
import { catalogService } from '../../catalog/services/catalog.service';
import { TransferLine } from '../components/TransferLine';

export const TransferDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: transfer, isLoading, error: transferError } = useTransferFull(id || null);
  const {data: stock, isLoading: loadingStock, error: stockError, refetch: refreshStock} = useStock();
  const blockers = transfer?.status === 'DRAFT' ? (transfer.items || []).flatMap((item: any) => {
    const source = stock?.find(row => row.product_id === item.product_id && row.warehouse_id === transfer.source_warehouse_id && row.location_id == null);
    const label = item.products?.code || item.product_id;
    if ((source?.available_quantity ?? 0) < item.quantity) return [`${label}: cantidad superior al disponible del origen.`];
    if (source?.average_cost == null || source?.original_average_cost == null) return [`${label}: falta costo en ${transfer.source?.name}.`];
    return [];
  }) : [];
  
  const { mutateAsync: completeTransfer, isPending: isCompleting } = useCompleteTransfer();
  const { mutateAsync: cancelTransfer, isPending: isCancelling } = useCancelTransfer();
  
  const [confirmModal, setConfirmModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  
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
        detail = 'Falta registrar el costo de compra de un producto en el almacén de origen. Ve a Inventario → Costos y ganancias → Costos del inventario, configura sus costos y vuelve a completar el traspaso.';
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
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
            className="p-2 text-gray-400 hover:text-ink hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-[28px] font-bold tracking-tight text-ink">
                {transfer.transfer_number}
              </h2>
              <StatusBadge status={transfer.status} />
            </div>
            <p className="text-[14px] text-muted mt-1">
              Creado el {formatDate(transfer.created_at)}
            </p>
          </div>
        </div>

        {transfer.status === 'DRAFT' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCancelModal(true)}
              className="px-4 py-2 text-[14px] font-medium text-red-600 bg-white border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm flex items-center gap-2"
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
              className="px-5 py-2 text-[14px] font-medium text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors shadow-sm flex items-center gap-2 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <p className="text-[13px] text-muted bg-gray-50 border border-gray-200/60 rounded-xl p-4 mb-6">
            Antes de completar, los productos deben tener su costo registrado en el almacén de origen.{' '}
            <Link to="/admin/margins" className="text-accent font-medium hover:underline">Configurar costos del inventario</Link>
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-2">Almacén de Origen</p>
            <p className="text-[16px] font-medium text-ink">{transfer.source?.name}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-2">Almacén de Destino</p>
            <p className="text-[16px] font-medium text-ink">{transfer.destination?.name}</p>
          </div>
        </div>

        {transfer.notes && (
          <div className="mb-8">
            <p className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-2">Notas / Referencia</p>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-[14px] text-ink">
              {transfer.notes}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-[17px] font-semibold text-ink">Productos</h3>
            {transfer.items?.length > 0 && <p className="text-[13px] text-muted">
              {transfer.items.length} {transfer.items.length === 1 ? 'partida' : 'partidas'} · Total {formatCurrency(transfer.items.reduce((sum: number, item: any) => sum + Number(item.unit_price ?? 0) * Number(item.quantity), 0))}
            </p>}
          </div>
          <div className="space-y-3">
            {transfer.items?.map((item: any, index: number) => {
              const imageUrl = item.products?.image_url ? catalogService.getProductImageUrl(item.products.image_url) : null;
              const source = stock?.find(row => row.product_id === item.product_id && row.warehouse_id === transfer.source_warehouse_id && row.location_id == null);
              return (
                <TransferLine
                  key={item.id || index}
                  code={item.products?.code}
                  destinationCode={item.destination?.code}
                  name={item.products?.name}
                  imageUrl={imageUrl}
                  quantity={Number(item.quantity)}
                  unitPrice={item.unit_price}
                  isDraft={transfer.status === 'DRAFT' && !loadingStock && !stockError}
                  available={source?.available_quantity ?? 0}
                  missingCost={source?.average_cost == null || source?.original_average_cost == null}
                  onImageClick={imageUrl ? () => setPreviewImage({ url: imageUrl, title: item.products?.name }) : undefined}
                />
              );
            })}
          </div>
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
