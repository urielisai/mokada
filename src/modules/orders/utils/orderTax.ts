export const IVA_RATE = 0.16;

export interface OrderTaxBreakdown {
  subtotal: number;
  iva: number;
  total: number;
}

/**
 * Desglosa un monto total que ya incluye IVA (16%) en Subtotal (sin IVA), IVA (16%) y Total.
 * Garantiza que subtotal + iva === total sin diferencias de centavos por redondeo.
 */
export const calculateOrderTaxBreakdown = (totalWithIva: number): OrderTaxBreakdown => {
  const total = Math.round(Number(totalWithIva || 0) * 100) / 100;
  const subtotal = Math.round((total / (1 + IVA_RATE)) * 100) / 100;
  const iva = Math.round((total - subtotal) * 100) / 100;
  return { subtotal, iva, total };
};

