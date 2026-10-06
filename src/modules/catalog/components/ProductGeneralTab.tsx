import { useFormContext } from 'react-hook-form';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { AsyncSelect, type AsyncSelectOption } from '../../../components/ui/AsyncSelect';
import { catalogService } from '../services/catalog.service';

interface Props {
  initialBrand?: AsyncSelectOption;
  initialCategory?: AsyncSelectOption;
  units: any[];
}

export const ProductGeneralTab = ({ initialBrand, initialCategory, units }: Props) => {
  const { register, watch, setValue, formState: { errors } } = useFormContext();

  const unitOptions = units.map(u => ({ value: u.id, label: `${u.name} (${u.code})` }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-x-8 md:gap-y-6">

        {/* Code */}
        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Código *</label>
          <input 
            type="text" 
            {...register('code', { required: 'El código es obligatorio' })}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all"
            placeholder="Ej: PROD-001"
          />
          {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message?.toString()}</p>}
        </div>

        {/* Barcode */}
        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Código de Barras</label>
          <input 
            type="text" 
            {...register('barcode')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all"
            placeholder="Opcional"
          />
        </div>

        {/* Name */}
        <div className="md:col-span-2">
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Nombre del Producto *</label>
          <input 
            type="text" 
            {...register('name', { required: 'El nombre es obligatorio' })}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all"
            placeholder="Ej: Amortiguador Trasero"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message?.toString()}</p>}
        </div>

        {/* Brand */}
        <AsyncSelect
          label="Marca"
          loadOptions={async (query) => {
            const data = await catalogService.searchBrands(query);
            return data.map(b => ({ value: b.id, label: b.name }));
          }}
          defaultOption={initialBrand}
          value={watch('brand_id')}
          onChange={v => setValue('brand_id', v, { shouldDirty: true, shouldValidate: true })}
          onClear={() => setValue('brand_id', null, { shouldDirty: true })}
          placeholder="Buscar marca..."
        />

        {/* Category */}
        <AsyncSelect
          label="Categoría"
          loadOptions={async (query) => {
            const data = await catalogService.searchCategories(query);
            return data.map(c => ({ value: c.id, label: c.name }));
          }}
          defaultOption={initialCategory}
          value={watch('category_id')}
          onChange={v => setValue('category_id', v, { shouldDirty: true, shouldValidate: true })}
          onClear={() => setValue('category_id', null, { shouldDirty: true })}
          placeholder="Buscar categoría..."
        />

        {/* UOM */}
        <SearchSelect
          label="Unidad de Medida"
          options={unitOptions}
          value={watch('unit_of_measure_id')}
          onChange={v => setValue('unit_of_measure_id', v, { shouldDirty: true, shouldValidate: true })}
          onClear={() => setValue('unit_of_measure_id', null, { shouldDirty: true })}
          placeholder="Seleccione UOM"
        />

        {/* Status */}
        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Estado</label>
          <select 
            {...register('status')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all text-[#1D1D1F]"
          >
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
            <option value="DISCONTINUED">Descontinuado</option>
          </select>
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Descripción</label>
          <textarea 
            {...register('description')}
            rows={4}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all resize-y"
            placeholder="Detalles adicionales del producto..."
          />
        </div>
      </div>
    </div>
  );
};
