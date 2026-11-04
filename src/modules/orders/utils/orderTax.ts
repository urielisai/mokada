export const IVA_RATE = 0.16;

const round2 = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

export interface OrderTaxBreakdown {
  subtotal: number;
  iva: number;
  total: number;
}

export interface OrderItemTaxBreakdown {
  quantity: number;
  unitPriceWithIva: number;
  unitPriceWithoutIva: number;
  unitIva: number;
  lineSubtotalWithoutIva: number;
  lineIva: number;
  lineTotalWithIva: number;
}

/**
 * Desglosa un monto total que ya incluye IVA (16%) en Subtotal (sin IVA), IVA (16%) y Total.
 * Garantiza que subtotal + iva === total al centavo.
 */
export const calculateOrderTaxBreakdown = (totalWithIva: number): OrderTaxBreakdown => {
  const total = round2(totalWithIva);
  const subtotal = round2(total / (1 + IVA_RATE));
  const iva = round2(total - subtotal);
  return { subtotal, iva, total };
};

/**
 * Desglosa un artículo cuyo precio unitario e importe ya incluyen IVA (16%):
 * - unitPriceWithoutIva + unitIva = unitPriceWithIva
 * - lineSubtotalWithoutIva + lineIva = lineTotalWithIva
 */
export const calculateItemTaxBreakdown = (
  quantity: number,
  unitPriceWithIva: number,
  lineTotalOverride?: number
): OrderItemTaxBreakdown => {
  const qty = Number(quantity) || 0;
  const unitWithIva = round2(unitPriceWithIva);
  const unitWithoutIva = round2(unitWithIva / (1 + IVA_RATE));
  const unitIva = round2(unitWithIva - unitWithoutIva);

  const lineTotalWithIva =
    lineTotalOverride != null ? round2(lineTotalOverride) : round2(qty * unitWithIva);
  const lineSubtotalWithoutIva = round2(lineTotalWithIva / (1 + IVA_RATE));
  const lineIva = round2(lineTotalWithIva - lineSubtotalWithoutIva);

  return {
    quantity: qty,
    unitPriceWithIva: unitWithIva,
    unitPriceWithoutIva: unitWithoutIva,
    unitIva,
    lineSubtotalWithoutIva,
    lineIva,
    lineTotalWithIva,
  };
};

/**
 * Calcula el desglose por partida y el resumen total del pedido (Subtotal sin IVA, IVA 16% y Monto Total)
 * garantizando que la suma de las filas cuadre al centavo con los totales del documento.
 */
export const calculateOrderItemsTaxSummary = (
  items: Array<{ quantity: number; unitPrice: number; subtotal?: number }>,
  orderTotalOverride?: number
): {
  items: OrderItemTaxBreakdown[];
  subtotal: number;
  iva: number;
  total: number;
} => {
  const brokenDownItems = items.map((item) =>
    calculateItemTaxBreakdown(item.quantity, item.unitPrice, item.subtotal)
  );

  const itemsSubtotal = round2(
    brokenDownItems.reduce((acc, item) => acc + item.lineSubtotalWithoutIva, 0)
  );
  const itemsIva = round2(brokenDownItems.reduce((acc, item) => acc + item.lineIva, 0));
  const itemsTotal = round2(
    brokenDownItems.reduce((acc, item) => acc + item.lineTotalWithIva, 0)
  );

  if (
    orderTotalOverride != null &&
    Math.abs(round2(orderTotalOverride) - itemsTotal) > 0.01
  ) {
    const fallback = calculateOrderTaxBreakdown(orderTotalOverride);
    return {
      items: brokenDownItems,
      ...fallback,
    };
  }

  return {
    items: brokenDownItems,
    subtotal: itemsSubtotal,
    iva: itemsIva,
    total: itemsTotal,
  };
};
