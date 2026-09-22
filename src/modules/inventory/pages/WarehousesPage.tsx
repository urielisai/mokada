import { useWarehouses } from '../hooks/useInventory';
import { Table, type Column } from '../../../components/ui/Table';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { WarehouseFormModal } from '../components/WarehouseFormModal';
import { useState } from 'react';
import { Plus, Edit2 } from 'lucide-react';

export const WarehousesPage = () => {
  const { data, isLoading, error } = useWarehouses();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);

  const handleEdit = (warehouse: any) => {
    setSelectedWarehouse(warehouse);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedWarehouse(null);
    setIsModalOpen(true);
  };

  const columns: Column<any>[] = [
    { header: 'Código', accessorKey: 'code', className: 'font-medium text-slate-900' },
    { header: 'Nombre', accessorKey: 'name' },
    { header: 'Función', cell: item => <span className="text-[#86868B]">{item.warehouse_role === 'PURCHASE' ? 'Compras y abastecimiento' : 'Ventas a clientes'}</span> },
    { header: 'Lista de venta', cell: item => <span className="text-[#86868B]">{item.warehouse_role === 'PURCHASE' ? 'No aplica' : item.price_lists?.name || 'Sin lista predeterminada'}</span> },
    { header: 'Descripción', accessorKey: 'description', cell: (item) => <span className="text-gray-500">{item.description || '-'}</span> },
    { 
      header: 'Estado', 
      cell: (item) => <StatusBadge status={item.is_active ? 'ACTIVE' : 'INACTIVE'} />
    },
    {
      header: '',
      cell: (item) => (
        <div className="flex justify-end">
          <button 
            onClick={() => handleEdit(item)}
            className="p-2 text-gray-400 hover:text-[#0066CC] hover:bg-[#0066CC]/10 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Almacenes</h2>
          <p className="text-[15px] text-[#86868B]">Gestión de almacenes y ubicaciones físicas</p>
        </div>

        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#0066CC] text-white rounded-lg hover:bg-[#0055FF] transition-colors text-[14px] font-medium"
        >
          <Plus className="w-4 h-4" />
          Nuevo Almacén
        </button>
      </div>

      {error && <p className="p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600">No se pudieron consultar los almacenes: {(error as Error).message}</p>}
      <Table 
        data={data || []} 
        columns={columns}
        isLoading={isLoading}
        isEmpty={!data?.length}
        emptyTitle="No hay almacenes"
        emptyMessage="Aún no se han registrado almacenes en el sistema."
      />

      <WarehouseFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        warehouse={selectedWarehouse}
      />
    </div>
  );
};
