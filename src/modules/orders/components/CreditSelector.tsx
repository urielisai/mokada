import { CreditCard, CalendarCheck, ShieldAlert, ShieldCheck } from 'lucide-react';

export type PaymentTypeOption = 'CONTADO' | 'CREDITO';
export type CreditTermOption = 8 | 15 | 21;

interface CreditSelectorProps {
  paymentType: PaymentTypeOption;
  onPaymentTypeChange: (type: PaymentTypeOption) => void;
  creditTerm: CreditTermOption;
  onCreditTermChange: (term: CreditTermOption) => void;
  isStaff: boolean;
}

export const CreditSelector = ({
  paymentType,
  onPaymentTypeChange,
  creditTerm,
  onCreditTermChange,
  isStaff,
}: CreditSelectorProps) => {
  return (
    <div className="space-y-4 pt-2">
      <div>
        <label className="block text-[13px] font-medium text-ink mb-1.5">
          Modalidad de Pago
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onPaymentTypeChange('CONTADO')}
            className={`flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${
              paymentType === 'CONTADO'
                ? 'border-accent bg-accent/5 font-semibold text-accent ring-2 ring-accent/15'
                : 'border-gray-300 bg-white text-ink hover:bg-gray-50'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Contado
          </button>

          <button
            type="button"
            onClick={() => onPaymentTypeChange('CREDITO')}
            className={`flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${
              paymentType === 'CREDITO'
                ? 'border-accent bg-accent/5 font-semibold text-accent ring-2 ring-accent/15'
                : 'border-gray-300 bg-white text-ink hover:bg-gray-50'
            }`}
          >
            <CalendarCheck className="h-4 w-4" />
            Solicitud de Crédito
          </button>
        </div>
      </div>

      {paymentType === 'CREDITO' && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/70 p-4 transition">
          <label className="block text-[13px] font-semibold text-ink">
            Plazo de Crédito
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([8, 15, 21] as CreditTermOption[]).map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onCreditTermChange(term)}
                className={`flex h-10 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                  creditTerm === term
                    ? 'border-accent bg-accent text-white shadow-sm'
                    : 'border-gray-300 bg-white text-ink hover:bg-gray-100'
                }`}
              >
                {term} Días
              </button>
            ))}
          </div>

          <div className="pt-1 text-[12px] leading-relaxed">
            {isStaff ? (
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Crédito autorizado automáticamente por el sistema.</span>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 text-amber-700 font-medium">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>La solicitud estará sujeta a autorización por el administrador.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
