import { usePriceLists, useDeletePriceList } from '../hooks/useConfig';
import { Table, type Column } from '../../../components/ui/Table';
import { PriceListFormModal } from '../components/PriceListFormModal';
import { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import toast from 'react-hot-toast';

export const PriceListsPage = () => {
  const { data, isLoading } = usePriceLists();
  const { mutateAsync: deletePriceList } = useDeletePriceList();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPriceList, setSelectedPriceList] = useState<any>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [priceListToDelete, setPriceListToDelete] = useState<any>(null);

  const handleEdit = (priceList: any) => {
    setSelectedPriceList(priceList);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (priceList: any) => {
    setPriceListToDelete(priceList);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!priceListToDelete) return;
    try {
      await deletePriceList(priceListToDelete.id);
      toast.success('Lista de precios eliminada exitosamente');
      setIsDeleteModalOpen(false);
      setPriceListToDelete(null);
    } catch (error: any) {
      console.error('Error deleting price list:', error);
      toast.error(error.message || 'Error al eliminar la lista de precios');
    }
  };

  const columns: Column<any>[] = [
    { header: 'Código', accessorKey: 'code', className: 'font-medium text-slate-900' },
    { header: 'Nombre', accessorKey: 'name' },
    { 
      header: 'Descuento', 
      cell: (item) => `${item.discount_percentage}%`
    },
    { header: 'Moneda', accessorKey: 'currency' },
    { 
      header: 'Estado', 
      cell: (item) => (
        <StatusBadge 
          status={item.is_active ? 'active' : 'inactive'} 
          text={item.is_active ? 'Activa' : 'Inactiva'} 
        />
      )
    },
    {
      header: '',
      id: 'actions',
      cell: (item) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleEdit(item)}
            className="p-1.5 text-slate-400 hover:text-accent hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar lista"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(item)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar lista"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
      className: 'w-[100px]'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-ink">Listas de Precios</h2>
          <p className="text-[15px] text-muted">Gestión de precios y descuentos especiales</p>
        </div>
        <button
          onClick={() => {
            setSelectedPriceList(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors text-[14px] font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva Lista
        </button>
      </div>

      <Table 
        data={data || []} 
        columns={columns}
        isLoading={isLoading}
        isEmpty={!data?.length}
        emptyTitle="No hay listas de precios"
        emptyMessage="Aún no se han configurado listas de precios alternativas."
      />

      <PriceListFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        priceList={selectedPriceList}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Eliminar Lista de Precios"
        message={`¿Estás seguro de que deseas eliminar la lista "${priceListToDelete?.name}"? Esta acción no se puede deshacer y los productos dejarán de tener este precio especial.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};
