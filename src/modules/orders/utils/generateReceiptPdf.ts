import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateOrderItemsTaxSummary } from './orderTax';
import { getMokadaLogoDataUrl } from './pdfLogo';

export interface ReceiptItem {
  code?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ReceiptData {
  orderId: string;
  customerName: string;
  branchName?: string;
  routeName?: string;
  agentName: string;
  paymentMethod: string;
  amountPaidNow: number;
  totalOrderAmount: number;
  totalPreviouslyPaid: number;
  remainingBalance: number;
  date: string;
  items: ReceiptItem[];
}

export interface ConsolidatedReceiptPayment {
  date: string;
  method: string;
  status: string;
  amount: number;
}

export interface ConsolidatedReceiptData {
  orderId: string;
  customerName: string;
  branchName?: string;
  routeName?: string;
  agentName: string;
  date: string;
  totalOrderAmount: number;
  totalPaid: number;
  remainingBalance: number;
  items: ReceiptItem[];
  payments: ConsolidatedReceiptPayment[];
}

export const generateReceiptPdf = async (data: ReceiptData) => {
  const logoDataUrl = await getMokadaLogoDataUrl();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  if (logoDataUrl) {
    const logoWidth = 38;
    const logoHeight = 12.7;
    doc.addImage(logoDataUrl, 'PNG', (pageWidth - logoWidth) / 2, 10, logoWidth, logoHeight);
  } else {
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('MOKADA', pageWidth / 2, 20, { align: 'center' });
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Recibo de Pago', pageWidth / 2, 28, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.line(14, 32, pageWidth - 14, 32);

  // Info
  let infoY = 40;
  doc.setFontSize(10);

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', 14, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.date, 42, infoY);
  infoY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Pedido #:', 14, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.orderId.substring(0, 8).toUpperCase(), 42, infoY);
  infoY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 14, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(
    data.branchName ? `${data.customerName} (${data.branchName})` : data.customerName,
    42,
    infoY
  );
  infoY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Ruta:', 14, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.routeName || 'Sin ruta asignada', 42, infoY);
  infoY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Agente:', 14, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.agentName, 42, infoY);
  infoY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Método:', 14, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.paymentMethod, 42, infoY);

  // Items Table
  const taxSummary = calculateOrderItemsTaxSummary(data.items, data.totalOrderAmount);

  autoTable(doc, {
    startY: infoY + 6,
    head: [
      [
        'Clave',
        'Producto',
        'Cant.',
        'P. Unit. (s/IVA)',
        'IVA Unit.',
        'Subtotal (s/IVA)',
        'IVA (16%)',
        'Total',
      ],
    ],
    body: data.items.map((item, idx) => {
      const itemTax = taxSummary.items[idx];
      return [
        item.code || 'S/C',
        item.name,
        item.quantity.toString(),
        `$${itemTax.unitPriceWithoutIva.toFixed(2)}`,
        `$${itemTax.unitIva.toFixed(2)}`,
        `$${itemTax.lineSubtotalWithoutIva.toFixed(2)}`,
        `$${itemTax.lineIva.toFixed(2)}`,
        `$${itemTax.lineTotalWithIva.toFixed(2)}`,
      ];
    }),
    foot: [
      [
        `Claves: ${data.items.length}`,
        'Totales del Pedido',
        '',
        '',
        '',
        `$${taxSummary.subtotal.toFixed(2)}`,
        `$${taxSummary.iva.toFixed(2)}`,
        `$${taxSummary.total.toFixed(2)}`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [0, 102, 204], fontSize: 8 },
    footStyles: {
      fillColor: [240, 242, 245],
      textColor: [20, 20, 22],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Financial Summary
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen del Pedido', 14, finalY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const labelX = 120;
  const valueX = 195;
  let currentY = finalY + 8;

  doc.text('Subtotal (sin IVA):', labelX, currentY);
  doc.text(`$${taxSummary.subtotal.toFixed(2)}`, valueX, currentY, { align: 'right' });
  currentY += 6;

  doc.text('IVA (16%):', labelX, currentY);
  doc.text(`$${taxSummary.iva.toFixed(2)}`, valueX, currentY, { align: 'right' });
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Monto Total del Pedido:', labelX, currentY);
  doc.text(`$${taxSummary.total.toFixed(2)}`, valueX, currentY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  currentY += 6;

  doc.text('Total Pagado Anteriormente:', labelX, currentY);
  doc.text(`$${data.totalPreviouslyPaid.toFixed(2)}`, valueX, currentY, { align: 'right' });
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Pago Actual:', labelX, currentY);
  doc.text(`$${data.amountPaidNow.toFixed(2)}`, valueX, currentY, { align: 'right' });
  currentY += 6;

  doc.setFont('helvetica', 'normal');
  doc.text('Saldo Pendiente:', labelX, currentY);
  doc.text(`$${data.remainingBalance.toFixed(2)}`, valueX, currentY, { align: 'right' });

  // Contact Section
  const contactBoxY = currentY + 8;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(14, contactBoxY, pageWidth - 28, 16, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Contacto y Aclaraciones', 18, contactBoxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(
    'Para cualquier duda o aclaración sobre su pedido o pago, llámenos al teléfono: ',
    18,
    contactBoxY + 12
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 102, 204);
  doc.text('7711599491', 136, contactBoxY + 12);

  // Footer
  doc.setTextColor(80, 80, 85);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Este documento es un comprobante de pago. Gracias por su preferencia. • Aclaraciones: 7711599491',
    pageWidth / 2,
    Math.max(contactBoxY + 26, 280),
    { align: 'center' }
  );

  // Open PDF in new tab
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
};

export const generateConsolidatedReceiptPdf = async (data: ConsolidatedReceiptData) => {
  const logoDataUrl = await getMokadaLogoDataUrl();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  if (logoDataUrl) {
    const logoWidth = 38;
    const logoHeight = 12.7;
    doc.addImage(logoDataUrl, 'PNG', (pageWidth - logoWidth) / 2, 10, logoWidth, logoHeight);
  } else {
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('MOKADA', pageWidth / 2, 20, { align: 'center' });
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Recibo General de Pagos', pageWidth / 2, 28, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.line(14, 32, pageWidth - 14, 32);

  // Info
  let infoY = 40;
  doc.setFontSize(10);

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de emisión:', 14, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.date, 50, infoY);
  infoY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Pedido #:', 14, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.orderId.substring(0, 8).toUpperCase(), 50, infoY);
  infoY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 14, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(
    data.branchName ? `${data.customerName} (${data.branchName})` : data.customerName,
    50,
    infoY
  );
  infoY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Ruta:', 14, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.routeName || 'Sin ruta asignada', 50, infoY);
  infoY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Agente:', 14, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.agentName, 50, infoY);

  // Items Table
  const itemsTitleY = infoY + 9;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Artículos del Pedido', 14, itemsTitleY);

  const taxSummary = calculateOrderItemsTaxSummary(data.items, data.totalOrderAmount);

  autoTable(doc, {
    startY: itemsTitleY + 3,
    head: [
      [
        'Clave',
        'Producto',
        'Cant.',
        'P. Unit. (s/IVA)',
        'IVA Unit.',
        'Subtotal (s/IVA)',
        'IVA (16%)',
        'Total',
      ],
    ],
    body: data.items.map((item, idx) => {
      const itemTax = taxSummary.items[idx];
      return [
        item.code || 'S/C',
        item.name,
        item.quantity.toString(),
        `$${itemTax.unitPriceWithoutIva.toFixed(2)}`,
        `$${itemTax.unitIva.toFixed(2)}`,
        `$${itemTax.lineSubtotalWithoutIva.toFixed(2)}`,
        `$${itemTax.lineIva.toFixed(2)}`,
        `$${itemTax.lineTotalWithIva.toFixed(2)}`,
      ];
    }),
    foot: [
      [
        `Claves: ${data.items.length}`,
        'Totales del Pedido',
        '',
        '',
        '',
        `$${taxSummary.subtotal.toFixed(2)}`,
        `$${taxSummary.iva.toFixed(2)}`,
        `$${taxSummary.total.toFixed(2)}`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [0, 102, 204], fontSize: 8 },
    footStyles: {
      fillColor: [240, 242, 245],
      textColor: [20, 20, 22],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const afterItemsY = (doc as any).lastAutoTable.finalY + 10;

  // Payments Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Historial de Pagos Registrados', 14, afterItemsY);

  autoTable(doc, {
    startY: afterItemsY + 3,
    head: [['#', 'Fecha', 'Método de Pago', 'Estado', 'Monto']],
    body: data.payments.map((payment, index) => [
      (index + 1).toString(),
      payment.date,
      payment.method,
      payment.status,
      `$${payment.amount.toFixed(2)}`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [0, 102, 204] },
    styles: { fontSize: 9 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Financial Summary
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen de Cuenta', 14, finalY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const labelX = 120;
  const valueX = 195;
  let currentY = finalY + 8;

  doc.text('Subtotal (sin IVA):', labelX, currentY);
  doc.text(`$${taxSummary.subtotal.toFixed(2)}`, valueX, currentY, { align: 'right' });
  currentY += 6;

  doc.text('IVA (16%):', labelX, currentY);
  doc.text(`$${taxSummary.iva.toFixed(2)}`, valueX, currentY, { align: 'right' });
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Monto Total del Pedido:', labelX, currentY);
  doc.text(`$${taxSummary.total.toFixed(2)}`, valueX, currentY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Total Pagado (Aprobado):', labelX, currentY);
  doc.text(`$${data.totalPaid.toFixed(2)}`, valueX, currentY, { align: 'right' });
  currentY += 6;

  doc.setFont('helvetica', 'normal');
  doc.text('Saldo Pendiente:', labelX, currentY);
  doc.text(`$${data.remainingBalance.toFixed(2)}`, valueX, currentY, { align: 'right' });

  // Contact Section
  const contactBoxY = currentY + 8;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(14, contactBoxY, pageWidth - 28, 16, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Contacto y Aclaraciones', 18, contactBoxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(
    'Para cualquier duda o aclaración sobre su pedido o pagos, llámenos al teléfono: ',
    18,
    contactBoxY + 12
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 102, 204);
  doc.text('7711599491', 138, contactBoxY + 12);

  // Footer
  doc.setTextColor(80, 80, 85);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Este documento es un comprobante de los pagos registrados del pedido. • Aclaraciones: 7711599491',
    pageWidth / 2,
    Math.max(contactBoxY + 26, 280),
    { align: 'center' }
  );

  // Open PDF in new tab
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
};
