import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cfdiUseOptions, fiscalRegimeOptions } from '../../../utils/fiscalCatalogs';

export const invoicePaymentForms = [
  { value: 'CASH', label: '01 - Efectivo' },
  { value: 'TRANSFER', label: '03 - Transferencia electrónica' },
  { value: 'CREDIT_CARD', label: '04 - Tarjeta de crédito' },
  { value: 'DEBIT_CARD', label: '28 - Tarjeta de débito' },
  { value: 'UNDEFINED', label: '99 - Por definir' },
] as const;

export interface OrderInvoiceDetails {
  customer_name: string; customer_email?: string | null;
  legal_name: string; rfc: string; cfdi_use: string; tax_regime: string;
  billing_email: string; fiscal_zip_code: string; issuer_zip_code: string; payment_form: string;
}

export const invoiceRows = (data: OrderInvoiceDetails): [string, string][] => [
  ['Nombre del cliente', data.customer_name],
  ['Nombre / razón social fiscal', data.legal_name],
  ['Forma de pago', invoicePaymentForms.find(p => p.value === data.payment_form)?.label || data.payment_form],
  ['Código postal del emisor', data.issuer_zip_code],
  ['RFC', data.rfc],
  ['Uso de la factura', cfdiUseOptions.find(p => p.value === data.cfdi_use)?.label || data.cfdi_use],
  ['Régimen fiscal', fiscalRegimeOptions.find(p => p.value === data.tax_regime)?.label || data.tax_regime],
  ['Correo de facturación', data.billing_email || 'No registrado'],
  ['Correo de contacto (opcional)', data.customer_email || 'No registrado'],
  ['Código postal fiscal del cliente', data.fiscal_zip_code],
];

export function buildOrderInvoicePdf(orderId: string, data: OrderInvoiceDetails) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setTextColor(29, 29, 31);
  doc.text('Datos para facturación', 18, 22);
  doc.setFontSize(10);
  doc.text(`Pedido: ${orderId}`, 18, 32);
  autoTable(doc, {
    startY: 40, margin: { left: 18, right: 18, bottom: 24 },
    head: [['Campo', 'Información seleccionada']], body: invoiceRows(data),
    styles: { fontSize: 10, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [0, 102, 204] },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 114 } },
  });
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    doc.text('Información para preparar la factura del pedido.', 18, 281);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, 192, 281, { align: 'right' });
  }
  return doc;
}
