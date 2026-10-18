import { useUnits, useDeleteUnit } from '../hooks/useConfig';
import { Table, type Column } from '../../../components/ui/Table';
import { UnitFormModal } from '../components/UnitFormModal';
import { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

export const UnitsPage = () => {
  const { data, isLoading } = useUnits();
  const { mutateAsync: deleteUnit } = useDeleteUnit();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<any>(null);

  const handleEdit = (unit: any) => {
    setSelectedUnit(unit);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (unit: any) => {
    setUnitToDelete(unit);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!unitToDelete) return;
    try {
      await deleteUnit(unitToDelete.id);
      toast.success('Unidad eliminada exitosamente');
      setIsDeleteModalOpen(false);
      setUnitToDelete(null);
    } catch (error: any) {
      console.error('Error deleting unit:', error);
      toast.error(error.message || 'Error al eliminar la unidad');
    }
  };

  const columns: Column<any>[] = [
    { header: 'Código', accessorKey: 'code', className: 'font-medium text-slate-900' },
    { header: 'Nombre', accessorKey: 'name' },
    { 
      header: 'Permite Decimales', 
      cell: (item) => item.allows_decimals ? 'Sí' : 'No'
    },
    {
      header: '',
      id: 'actions',
      cell: (item) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleEdit(item)}
            className="p-1.5 text-slate-400 hover:text-accent hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar unidad"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(item)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar unidad"
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
          <h2 className="text-[28px] font-bold tracking-tight text-ink">Unidades de Medida</h2>
          <p className="text-[15px] text-muted">Configuración de unidades para inventario</p>
        </div>
        <button
          onClick={() => {
            setSelectedUnit(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors text-[14px] font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva Unidad
        </button>
      </div>

      <Table 
        data={data || []} 
        columns={columns}
        isLoading={isLoading}
        isEmpty={!data?.length}
        emptyTitle="No hay unidades"
        emptyMessage="Aún no se han registrado unidades de medida en el sistema."
      />

      <UnitFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        unit={selectedUnit}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Eliminar Unidad"
        message={`¿Estás seguro de que deseas eliminar la unidad "${unitToDelete?.name}"? Esta acción no se puede deshacer y podría afectar productos existentes.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};
