import { useVehicles } from '../hooks/useCatalog';
import { Table, type Column } from '../../../components/ui/Table';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { VehicleFormModal } from '../components/VehicleFormModal';
import { useState } from 'react';
import { Plus, Edit2 } from 'lucide-react';

export const VehiclesPage = () => {
  const { data, isLoading } = useVehicles();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  const handleEdit = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedVehicle(null);
    setIsModalOpen(true);
  };

  const columns: Column<any>[] = [
    { 
      header: 'Marca', 
      accessorKey: 'vehicle_makes.name',
      className: 'font-medium text-slate-900',
      cell: (item) => item.vehicle_makes?.name 
    },
    { header: 'Modelo', accessorKey: 'name' },
    { header: 'Generación/Años', accessorKey: 'generation', cell: (item) => item.generation || '-' },
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
            className="p-2 text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
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
          <h2 className="text-[28px] font-bold tracking-tight text-ink">Vehículos</h2>
          <p className="text-[15px] text-muted">Catálogo de aplicaciones y compatibilidad</p>
        </div>

        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors text-[14px] font-medium"
        >
          <Plus className="w-4 h-4" />
          Nuevo Vehículo
        </button>
      </div>

      <Table 
        data={data || []} 
        columns={columns}
        isLoading={isLoading}
        isEmpty={!data?.length}
        emptyTitle="No hay vehículos"
        emptyMessage="Aún no se han registrado vehículos en el sistema."
      />

      <VehicleFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        vehicle={selectedVehicle}
      />
    </div>
  );
};
