import { useFieldArray, useFormContext } from 'react-hook-form';
import { formatCurrency } from '../../../utils/formatters';

interface Props {
  priceLists: any[];
}

export const ProductPricesTab = ({ priceLists }: Props) => {
  const { control, register, watch, formState: { errors } } = useFormContext();
  const { fields } = useFieldArray({
    control,
    name: 'prices',
    keyName: '_local_id' // avoid conflict with id
  });
  const enteredPrices = watch('prices') || [];
  const publicList = priceLists.find(pl => pl.code === 'PUBLIC');
  const publicPrice = enteredPrices.find((price: {price_list_id: string}) => price.price_list_id === publicList?.id)?.amount;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[16px] font-semibold text-[#1D1D1F] mb-1">Precios de venta</h3>
        <p className="text-[14px] text-[#86868B] mb-6">Captura el precio público y el de mayoreo. Los descuentos se calculan desde el público. El costo de compra se registra al recibir inventario y el precio interno al traspasar.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200/60 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200/60">
          <thead className="bg-[#F5F5F7]">
            <tr>
              <th className="px-6 py-3 text-left text-[12px] font-semibold text-[#86868B] uppercase tracking-wider">Lista de Precio</th>
              <th className="px-6 py-3 text-left text-[12px] font-semibold text-[#86868B] uppercase tracking-wider w-48">Monto ($)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200/60">
            {fields.map((field: any, index) => {
              const list = priceLists.find(pl => pl.id === field.price_list_id);
              const listName = list?.name || 'Lista';
              const derived = list?.pricing_mode === 'PUBLIC_DISCOUNT';
              const discountAmount = publicPrice > 0 ? Math.round(Number(publicPrice) * (1 - Number(list?.discount_percentage || 0) / 100) * 100) / 100 : null;
              return (
                <tr key={field._local_id} className="hover:bg-[#F5F5F7]/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-[14px] font-medium text-[#1D1D1F]">
                    {listName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="hidden" {...register(`prices.${index}.price_list_id`)} />
                    {derived ? <div className="text-[14px] text-[#1D1D1F]">
                      {discountAmount == null ? 'Captura el precio público' : formatCurrency(discountAmount)}
                      <span className="block text-[11px] text-[#86868B]">Automático: −{list?.discount_percentage}%</span>
                    </div> : <input
                      type="number" 
                      step="0.01"
                      min="0.01"
                      {...register(`prices.${index}.amount`, {
                        setValueAs: value => value === '' ? null : Number(value),
                        validate: value => value == null || (Number.isFinite(value) && value > 0) || 'Captura un precio mayor que cero'
                      })}
                      className="w-full px-3 py-1.5 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all"
                      placeholder="Sin precio"
                    />}
                    {(errors.prices as any)?.[index]?.amount && <p className="text-xs text-red-600 mt-1">El precio debe ser mayor que cero.</p>}
                  </td>
                </tr>
              );
            })}
            {fields.length === 0 && (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center text-[#86868B] text-[14px]">
                  No hay listas de precio configuradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
