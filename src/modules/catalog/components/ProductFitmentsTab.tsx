import { useFormContext, useFieldArray } from 'react-hook-form';
import { useVehicles } from '../hooks/useCatalog';
import { Plus, Trash2 } from 'lucide-react';
import { SearchSelect } from '../../../components/ui/SearchSelect';

export const ProductFitmentsTab = () => {
  const { register, control, watch, setValue } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'fitments'
  });
  
  const { data: vehicles } = useVehicles();

  const vehicleOptions = vehicles?.map((v: any) => ({
    value: v.id,
    label: `${v.vehicle_makes?.name || ''} ${v.name || ''} ${v.generation ? `(${v.generation})` : ''}`.trim()
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-[17px] font-semibold text-ink">Compatibilidad (Aplicaciones)</h3>
        <button
          type="button"
          onClick={() => append({ vehicle_model_id: '', year_from: null, year_to: null, engine: '', notes: '' })}
          className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Añadir Vehículo
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200/60 border-dashed">
          <p className="text-[14px] text-muted">No hay vehículos asignados a este producto.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="p-4 bg-white border border-gray-200/60 rounded-xl relative group">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                
                {/* Vehículo */}
                <div className="md:col-span-4">
                  <SearchSelect
                    label="Vehículo *"
                    options={vehicleOptions}
                    value={watch(`fitments.${index}.vehicle_model_id`)}
                    onChange={v => setValue(`fitments.${index}.vehicle_model_id`, v, { shouldDirty: true, shouldValidate: true })}
                    onClear={() => setValue(`fitments.${index}.vehicle_model_id`, '', { shouldDirty: true })}
                    placeholder="Seleccionar vehículo"
                  />
                </div>

                {/* Año Desde */}
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-medium text-muted mb-1">Año Desde</label>
                  <input
                    type="number"
                    placeholder="Ej: 2015"
                    {...register(`fitments.${index}.year_from`, { valueAsNumber: true })}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition"
                  />
                </div>

                {/* Año Hasta */}
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-medium text-muted mb-1">Año Hasta</label>
                  <input
                    type="number"
                    placeholder="Ej: 2020"
                    {...register(`fitments.${index}.year_to`, { valueAsNumber: true })}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition"
                  />
                </div>

                {/* Motor */}
                <div className="md:col-span-3">
                  <label className="block text-[12px] font-medium text-muted mb-1">Motor / Notas</label>
                  <input
                    type="text"
                    placeholder="Ej: 1.6L 4Cyl"
                    {...register(`fitments.${index}.engine`)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition"
                  />
                </div>

                {/* Actions */}
                <div className="md:col-span-1 flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar vehículo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
