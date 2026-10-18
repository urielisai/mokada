import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routeRolesService } from '../services/roles.service';
import { Save, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';

export const RouteRolesPage = () => {
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentRoutes, setAgentRoutes] = useState<any[]>([]);

  const { data: agents = [], isLoading: isLoadingAgents } = useQuery({
    queryKey: ['agent-roles'],
    queryFn: routeRolesService.getAgentRoles,
  });

  const saveMutation = useMutation({
    mutationFn: ({ agentId, routes }: { agentId: string; routes: any[] }) =>
      routeRolesService.saveAgentRoles(agentId, routes),
    onSuccess: () => {
      toast.success('Roles guardados correctamente');
      queryClient.invalidateQueries({ queryKey: ['agent-roles'] });
    },
    onError: () => {
      toast.error('Error al guardar roles');
    },
  });

  useEffect(() => {
    if (selectedAgentId) {
      const agent = agents.find(a => a.id === selectedAgentId);
      if (agent) {
        setAgentRoutes([...(agent.routes || [])]);
      }
    } else {
      setAgentRoutes([]);
    }
  }, [selectedAgentId, agents]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = Number(e.dataTransfer.getData('text/plain'));
    if (dragIndex === dropIndex) return;

    const newRoutes = [...agentRoutes];
    const [draggedItem] = newRoutes.splice(dragIndex, 1);
    newRoutes.splice(dropIndex, 0, draggedItem);
    setAgentRoutes(newRoutes);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSave = () => {
    if (!selectedAgentId) return;
    saveMutation.mutate({ agentId: selectedAgentId, routes: agentRoutes });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[28px] font-bold tracking-tight text-ink">Roles de Ruta</h2>
        <p className="text-[15px] text-muted">Configura el orden de frecuencia (fija o quincenal) de las rutas asignadas a cada agente.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Agents List */}
        <div className="rounded-2xl border border-gray-200/60 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-gray-200/60 bg-gray-50/50 px-4 py-3">
            <h3 className="font-semibold text-gray-900">Agentes</h3>
          </div>
          <div className="divide-y divide-gray-100 flex-1 overflow-y-auto max-h-[600px]">
            {isLoadingAgents ? (
              <p className="p-4 text-center text-sm text-gray-500">Cargando...</p>
            ) : agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                  selectedAgentId === agent.id ? 'bg-accent/5 border-l-2 border-accent' : 'hover:bg-gray-50 border-l-2 border-transparent'
                }`}
              >
                <div className="font-medium text-gray-900">{agent.first_name} {agent.last_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {agent.routes?.length || 0} ruta(s) asignada(s)
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Editor */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200/60 bg-white shadow-sm flex flex-col p-6">
          {selectedAgentId ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Secuencia de Rutas</h3>
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending || agentRoutes.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar Orden'}
                </button>
              </div>

              <div className="space-y-3">
                {agentRoutes.map((route, index) => (
                  <div
                    key={route.id}
                    draggable={agentRoutes.length > 1}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragOver={handleDragOver}
                    className={`flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition ${agentRoutes.length > 1 ? 'hover:border-accent cursor-move' : ''}`}
                  >
                    {agentRoutes.length > 1 && <GripVertical className="h-5 w-5 text-gray-400" />}
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600 shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{route.name}</p>
                      <p className="text-xs text-gray-500">
                        {agentRoutes.length === 1 ? 'Ruta Fija (Semanal)' : `Frecuencia: ${agentRoutes.length} semanas`}
                      </p>
                    </div>
                  </div>
                ))}

                {agentRoutes.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
                    <p className="text-sm text-gray-500">Este agente no tiene ninguna ruta asignada.</p>
                    <p className="text-xs text-gray-400 mt-1">Asígnale rutas desde el menú de "Rutas".</p>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-blue-50 p-4 mt-6 text-sm text-blue-800">
                <p><strong>¿Cómo funciona?</strong></p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Si un agente tiene <strong>1 ruta asignada</strong>, será <strong>Fija</strong> (cada semana irá a la misma).</li>
                  <li>Si tiene <strong>2 rutas</strong>, serán <strong>Quincenales</strong> (alternará entre la 1 y la 2 cada semana).</li>
                  <li>Puedes arrastrar y soltar las rutas para cambiar cuál toca primero (orden de frecuencia).</li>
                  <li>Para agregar o quitar rutas, hazlo desde la edición general de <strong>Rutas</strong>.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <GripVertical className="h-12 w-12 text-gray-200 mb-4" />
              <p>Selecciona un agente para ver y ordenar sus rutas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
