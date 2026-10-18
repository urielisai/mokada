import { useAttributes, useDeleteAttribute } from '../hooks/useConfig';
import { Table, type Column } from '../../../components/ui/Table';
import { AttributeFormModal } from '../components/AttributeFormModal';
import { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import toast from 'react-hot-toast';

export const AttributesPage = () => {
  const { data, isLoading } = useAttributes();
  const { mutateAsync: deleteAttribute } = useDeleteAttribute();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState<any>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [attributeToDelete, setAttributeToDelete] = useState<any>(null);

  const handleEdit = (attribute: any) => {
    setSelectedAttribute(attribute);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (attribute: any) => {
    setAttributeToDelete(attribute);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!attributeToDelete) return;
    try {
      await deleteAttribute(attributeToDelete.id);
      toast.success('Atributo eliminado exitosamente');
      setIsDeleteModalOpen(false);
      setAttributeToDelete(null);
    } catch (error: any) {
      console.error('Error deleting attribute:', error);
      toast.error(error.message || 'Error al eliminar el atributo');
    }
  };

  const columns: Column<any>[] = [
    { header: 'Código', accessorKey: 'code', className: 'font-medium text-slate-900 uppercase' },
    { header: 'Nombre', accessorKey: 'name' },
    { header: 'Tipo', accessorKey: 'data_type' },
    { 
      header: 'Unidad', 
      cell: (item) => item.unit || '-'
    },
    { 
      header: 'Estado', 
      cell: (item) => (
        <StatusBadge 
          status={item.is_active ? 'active' : 'inactive'} 
          text={item.is_active ? 'Activo' : 'Inactivo'} 
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
            title="Editar atributo"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(item)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar atributo"
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
          <h2 className="text-[28px] font-bold tracking-tight text-ink">Atributos</h2>
          <p className="text-[15px] text-muted">Características configurables para productos</p>
        </div>
        <button
          onClick={() => {
            setSelectedAttribute(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors text-[14px] font-medium"
        >
          <Plus className="w-4 h-4" />
          Nuevo Atributo
        </button>
      </div>

      <Table 
        data={data || []} 
        columns={columns}
        isLoading={isLoading}
        isEmpty={!data?.length}
        emptyTitle="No hay atributos"
        emptyMessage="Aún no se han definido atributos personalizados para los productos."
      />

      <AttributeFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        attribute={selectedAttribute}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Eliminar Atributo"
        message={`¿Estás seguro de que deseas eliminar el atributo "${attributeToDelete?.name}"? Esta acción no se puede deshacer y los productos perderán este valor asignado.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};
