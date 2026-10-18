import { useFieldArray, useFormContext } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { AsyncSelect } from '../../../components/ui/AsyncSelect';
import { catalogService } from '../services/catalog.service';

interface LinkedProduct {
  id: string;
  code: string;
  name: string;
  is_default?: boolean;
}

interface Cost {
  warehouse_id: string;
  warehouse_name: string;
  average_cost: number | null;
}

interface Props {
  itemType: 'SALE' | 'PURCHASE';
  // For a sale key: the purchase codes that feed it (read-only, edited from the code).
  purchaseCodes: LinkedProduct[];
  costs: Cost[];
}

const money = (value: number | null | undefined) =>
  value == null ? 'Sin costo' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));

export const ProductSaleLinksTab = ({ itemType, purchaseCodes, costs }: Props) => {
  const { control, watch, setValue } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'sale_links', keyName: '_local_id' });
  const links = (watch('sale_links') || []) as { sale_product_id: string; is_default?: boolean }[];

  const setDefault = (index: number) => {
    links.forEach((_, i) => setValue(`sale_links.${i}.is_default`, i === index, { shouldDirty: true }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[16px] font-semibold text-ink mb-1">
          {itemType === 'PURCHASE' ? 'Claves de venta' : 'Códigos de compra'}
        </h3>
        <p className="text-[14px] text-muted mb-6">
          {itemType === 'PURCHASE'
            ? 'Un código del almacén principal puede venderse con una o varias claves. Al traspasar se propone la clave predeterminada.'
            : 'Códigos del almacén principal que surten esta clave. Las ligas se editan desde el código de compra.'}
        </p>

        {itemType === 'PURCHASE' ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-gray-200/60 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200/60">
                <thead className="bg-canvas">
                  <tr>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-muted uppercase tracking-wider">Clave</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-muted uppercase tracking-wider">Descripción</th>
                    <th className="px-4 py-3 text-center text-[12px] font-semibold text-muted uppercase tracking-wider w-32">Predeterminada</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200/60">
                  {fields.map((field: any, index) => (
                    <tr key={field._local_id}>
                      <td className="px-4 py-3 text-[14px] font-medium text-accent whitespace-nowrap">{field.code}</td>
                      <td className="px-4 py-3 text-[13px] text-ink">{field.name}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="radio"
                          name="default-sale-link"
                          checked={Boolean(links[index]?.is_default)}
                          onChange={() => setDefault(index)}
                          aria-label={`Usar ${field.code} como clave predeterminada`}
                        />
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                          aria-label={`Quitar ${field.code}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {fields.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted text-[14px]">
                        Sin claves de venta. Este código no se podrá traspasar hasta ligar una.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="max-w-md">
              <AsyncSelect
                value={null}
                placeholder="Agregar clave de venta..."
                loadOptions={async (query) => {
                  const data = await catalogService.searchSaleProducts(query);
                  const taken = new Set(links.map((l) => l.sale_product_id));
                  return (data || [])
                    .filter((p: any) => !taken.has(p.id))
                    .map((p: any) => ({ value: p.id, label: p.code, description: p.name }));
                }}
                onChange={(value, option) => {
                  if (!value || !option) return;
                  append({ sale_product_id: value, code: option.label, name: option.description || '', is_default: links.length === 0 });
                }}
              />
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200/60 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200/60">
              <thead className="bg-canvas">
                <tr>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-muted uppercase tracking-wider">Código</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-muted uppercase tracking-wider">Descripción</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200/60">
                {purchaseCodes.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-[14px] font-medium text-accent whitespace-nowrap">{p.code}</td>
                    <td className="px-4 py-3 text-[13px] text-ink">{p.name}</td>
                  </tr>
                ))}
                {purchaseCodes.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-muted text-[14px]">Sin código de compra ligado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-ink mb-1">Costo</h3>
        <p className="text-[14px] text-muted mb-4">Costo promedio por almacén. Se ajusta desde Inventario.</p>
        <div className="flex flex-wrap gap-3">
          {costs.length === 0 && <span className="text-[14px] text-muted">Sin existencias registradas.</span>}
          {costs.map((c) => (
            <div key={c.warehouse_id} className="rounded-xl border border-gray-200/60 px-4 py-3 shadow-sm">
              <div className="text-[12px] text-muted">{c.warehouse_name}</div>
              <div className="text-[16px] font-semibold text-ink">{money(c.average_cost)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
