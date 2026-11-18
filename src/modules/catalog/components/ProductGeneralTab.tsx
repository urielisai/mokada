import { useFormContext } from 'react-hook-form';
import { Copy, CheckCircle2, Info } from 'lucide-react';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { AsyncSelect, type AsyncSelectOption } from '../../../components/ui/AsyncSelect';
import { catalogService } from '../services/catalog.service';

interface Props {
  initialBrand?: AsyncSelectOption;
  initialCategory?: AsyncSelectOption;
  units: any[];
}

export const ProductGeneralTab = ({ initialBrand, initialCategory, units }: Props) => {
  const { register, watch, setValue, clearErrors, formState: { errors } } = useFormContext();

  const unitOptions = units.map(u => ({ value: u.id, label: `${u.name} (${u.code})` }));
  const saleCode = (watch('sale_code') || '').trim();
  const purchaseCode = (watch('purchase_code') || '').trim();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-x-8 md:gap-y-6">

        {/* Clave de venta */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="block text-[13px] font-medium text-ink">
              Clave de venta <span className="text-muted font-normal">(Catálogo y Pedidos)</span>
            </label>
            {purchaseCode && saleCode !== purchaseCode && (
              <button
                type="button"
                onClick={() => {
                  setValue('sale_code', purchaseCode, { shouldDirty: true, shouldValidate: true });
                  clearErrors(['sale_code', 'purchase_code']);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
              >
                <Copy className="w-3 h-3" />
                Usar mismo código
              </button>
            )}
          </div>
          <input
            type="text"
            {...register('sale_code', {
              validate: (value) => {
                const s = (value || '').trim();
                const p = (watch('purchase_code') || '').trim();
                return Boolean(s || p) || 'Captura al menos la Clave de venta o el Código de compra';
              },
            })}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] transition"
            placeholder="Ej: 13465094 o MK-001"
          />
          {errors.sale_code && (
            <p className="text-red-500 text-xs mt-1">{errors.sale_code.message?.toString()}</p>
          )}
        </div>

        {/* Código de compra */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="block text-[13px] font-medium text-ink">
              Código de compra <span className="text-muted font-normal">(Almacén Principal)</span>
            </label>
            {saleCode && purchaseCode !== saleCode && (
              <button
                type="button"
                onClick={() => {
                  setValue('purchase_code', saleCode, { shouldDirty: true, shouldValidate: true });
                  clearErrors(['sale_code', 'purchase_code']);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
              >
                <Copy className="w-3 h-3" />
                Usar misma clave
              </button>
            )}
          </div>
          <input
            type="text"
            {...register('purchase_code')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] transition"
            placeholder="Ej: 13465094"
          />
        </div>

        {/* Status helper banner for Clave & Código */}
        <div className="md:col-span-2 -mt-2">
          {saleCode && purchaseCode ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-[12px] text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Al guardar, el producto quedará registrado y vinculado automáticamente con su{' '}
                <strong>Clave de venta ({saleCode})</strong> para catálogo/pedidos y su{' '}
                <strong>Código de compra ({purchaseCode})</strong> para entradas al Almacén Principal.
              </span>
            </div>
          ) : saleCode && !purchaseCode ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-[12px] text-blue-900">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Si también necesitas darle entrada por compra en el Almacén Principal, indica su{' '}
                  <strong>Código de compra</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setValue('purchase_code', saleCode, { shouldDirty: true, shouldValidate: true });
                  clearErrors(['sale_code', 'purchase_code']);
                }}
                className="shrink-0 font-semibold text-accent hover:underline"
              >
                Usar "{saleCode}" también como código de compra
              </button>
            </div>
          ) : !saleCode && purchaseCode ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-[12px] text-blue-900">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Para que este producto también aparezca en el catálogo de ventas y pedidos, indica su{' '}
                  <strong>Clave de venta</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setValue('sale_code', purchaseCode, { shouldDirty: true, shouldValidate: true });
                  clearErrors(['sale_code', 'purchase_code']);
                }}
                className="shrink-0 font-semibold text-accent hover:underline"
              >
                Usar "{purchaseCode}" también como clave de venta
              </button>
            </div>
          ) : null}
        </div>

        {/* Name */}
        <div className="md:col-span-2">
          <label className="block text-[13px] font-medium text-ink mb-1.5">Nombre del Producto *</label>
          <input 
            type="text" 
            {...register('name', { required: 'El nombre es obligatorio' })}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] transition"
            placeholder="Ej: DEPOSITO ANTICONGELANTE CRUZE 11-16 1.8L 1.4T"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message?.toString()}</p>}
        </div>

        {/* Barcode */}
        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Código de Barras</label>
          <input 
            type="text" 
            {...register('barcode')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] transition"
            placeholder="Opcional"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Estado</label>
          <select 
            {...register('status')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] transition text-ink"
          >
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
            <option value="DISCONTINUED">Descontinuado</option>
          </select>
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

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-[13px] font-medium text-ink mb-1.5">Descripción</label>
          <textarea 
            {...register('description')}
            rows={4}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] transition resize-y"
            placeholder="Detalles adicionales del producto..."
          />
        </div>
      </div>
    </div>
  );
};
