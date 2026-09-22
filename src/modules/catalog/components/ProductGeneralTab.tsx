import { useFormContext } from 'react-hook-form';

interface Props {
  brands: any[];
  categories: any[];
  units: any[];
}

export const ProductGeneralTab = ({ brands, categories, units }: Props) => {
  const { register, formState: { errors } } = useFormContext();

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
        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Marca</label>
          <select 
            {...register('brand_id')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all text-[#1D1D1F]"
          >
            <option value="">Seleccione una marca</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Categoría</label>
          <select 
            {...register('category_id')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all text-[#1D1D1F]"
          >
            <option value="">Seleccione una categoría</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* UOM */}
        <div>
          <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Unidad de Medida</label>
          <select 
            {...register('unit_of_measure_id')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all text-[#1D1D1F]"
          >
            <option value="">Seleccione UOM</option>
            {units.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
            ))}
          </select>
        </div>

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
