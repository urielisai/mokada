import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateOrderTaxBreakdown } from './orderTax';

export interface WarehouseOrderItem {
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface WarehouseOrderPdfData {
  orderId: string;
  orderDate: string;
  printedAt: string;
  statusLabel: string;
  paymentTypeLabel?: string;
  warehouseName?: string;
  estimatedDeliveryDate?: string;
  customerName: string;
  customerPhone?: string;
  branchName?: string;
  shippingAddress?: string;
  comments?: string;
  isWarrantyReplacement?: boolean;
  totalAmount: number;
  items: WarehouseOrderItem[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount || 0));

export const generateWarehouseOrderPdf = (data: WarehouseOrderPdfData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const folio = data.orderId.split('-')[0].toUpperCase();
  const totalSkus = data.items.length;
  const totalUnits = data.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const computedTotal =
    data.totalAmount != null
      ? Number(data.totalAmount)
      : data.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const tax = calculateOrderTaxBreakdown(computedTotal);

  // Header Left: Brand & Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 22);
  doc.text('MOKADA', margin, 18);

  doc.setFontSize(12);
  doc.setTextColor(60, 60, 67);
  doc.text('ORDEN DE SURTIDO — ALMACÉN', margin, 25);

  if (data.isWarrantyReplacement) {
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9);
    doc.text('REPOSICIÓN POR GARANTÍA', margin, 30.5);
  }

  // Header Right: Folio & Dates
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 22);
  doc.text(`PEDIDO #${folio}`, pageWidth - margin, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 85);
  doc.text(`Fecha de pedido: ${data.orderDate}`, pageWidth - margin, 24, { align: 'right' });
  doc.text(
    `Estado: ${data.statusLabel}${data.paymentTypeLabel ? `  •  Pago: ${data.paymentTypeLabel}` : ''}`,
    pageWidth - margin,
    29,
    { align: 'right' }
  );

  // Divider line
  doc.setDrawColor(210, 210, 215);
  doc.setLineWidth(0.5);
  doc.line(margin, 34, pageWidth - margin, 34);

  // Info Box (Customer / Shipping on Left, Warehouse / Logistics on Right)
  const infoStartY = 38;
  const colLeftX = margin + 4;
  const colRightX = pageWidth / 2 + 4;
  const colMaxWidth = pageWidth / 2 - margin - 8;

  const addressText = data.shippingAddress || 'No especificada';
  const addressLines = doc.splitTextToSize(addressText, colMaxWidth);
  const infoBoxHeight = Math.max(36, 25 + addressLines.length * 4.5);

  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(225, 227, 230);
  doc.roundedRect(margin, infoStartY, pageWidth - margin * 2, infoBoxHeight, 2.5, 2.5, 'FD');

  // Left Column: Customer & Destination
  let leftY = infoStartY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 115);
  doc.text('CLIENTE Y DESTINO', colLeftX, leftY);

  leftY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 22);
  doc.text(doc.splitTextToSize(data.customerName || 'Cliente', colMaxWidth)[0] || 'Cliente', colLeftX, leftY);

  if (data.customerPhone || data.branchName) {
    leftY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 75);
    const subInfo = [
      data.branchName ? `Sucursal: ${data.branchName}` : '',
      data.customerPhone ? `Tel: ${data.customerPhone}` : '',
    ]
      .filter(Boolean)
      .join('  •  ');
    doc.text(doc.splitTextToSize(subInfo, colMaxWidth)[0] || '', colLeftX, leftY);
  }

  leftY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 55);
  doc.text('Dirección de envío:', colLeftX, leftY);

  leftY += 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 65);
  doc.text(addressLines, colLeftX, leftY);

  // Right Column: Warehouse & Picking Summary
  let rightY = infoStartY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 115);
  doc.text('DATOS DE SURTIDO Y RESUMEN', colRightX, rightY);

  rightY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 22);
  doc.text('Almacén de salida:', colRightX, rightY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.warehouseName || 'Por asignar', colRightX + 33, rightY);

  rightY += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Entrega estimada:', colRightX, rightY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.estimatedDeliveryDate || 'Por definir', colRightX + 33, rightY);

  rightY += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Impreso el:', colRightX, rightY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.printedAt, colRightX + 33, rightY);

  rightY += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 102, 204);
  doc.text(
    `A surtir: ${totalSkus} código(s)  |  ${totalUnits} pieza(s)  |  Total: ${formatCurrency(tax.total)}`,
    colRightX,
    rightY
  );

  let currentY = infoStartY + infoBoxHeight + 5;

  // Comments / Special Instructions (if any)
  if (data.comments && data.comments.trim()) {
    const commentLines = doc.splitTextToSize(data.comments.trim(), pageWidth - margin * 2 - 8);
    const commentBoxHeight = 10 + commentLines.length * 4.2;

    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(252, 211, 77);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, commentBoxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14);
    doc.text('NOTAS / ACLARACIONES DEL PEDIDO:', margin + 4, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 53, 15);
    doc.text(commentLines, margin + 4, currentY + 9.5);

    currentY += commentBoxHeight + 5;
  }

  // Products Section Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 22);
  doc.text('Productos a Surtir', margin, currentY + 2);

  // Items Table
  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin, bottom: 45 },
    head: [['#', 'Código / SKU', 'Descripción del Producto', 'Cant.', 'Precio Unit.', 'Importe', 'Surtido', 'Observaciones']],
    body: data.items.map((item, idx) => [
      (idx + 1).toString(),
      item.code || 'S/C',
      item.name || 'Producto sin nombre',
      item.quantity.toString(),
      formatCurrency(item.unitPrice),
      formatCurrency(item.subtotal),
      '[     ]',
      '',
    ]),
    foot: [
      [
        '',
        `Códigos: ${totalSkus}`,
        'Subtotal (sin IVA)',
        `${totalUnits} pzas`,
        '',
        formatCurrency(tax.subtotal),
        '',
        '',
      ],
      [
        '',
        '',
        'IVA (16%)',
        '',
        '',
        formatCurrency(tax.iva),
        '',
        '',
      ],
      [
        '',
        '',
        'TOTAL GENERAL',
        '',
        '',
        formatCurrency(tax.total),
        '',
        '',
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [29, 29, 31],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    footStyles: {
      fillColor: [248, 249, 250],
      textColor: [50, 50, 55],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.8,
      valign: 'middle',
      textColor: [25, 25, 28],
      lineColor: [210, 212, 216],
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 28, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 15, halign: 'center', fontStyle: 'bold', fontSize: 10 },
      4: { cellWidth: 23, halign: 'right' },
      5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 26 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'head') {
        if ([0, 3, 6].includes(hookData.column.index)) {
          hookData.cell.styles.halign = 'center';
        }
        if ([4, 5].includes(hookData.column.index)) {
          hookData.cell.styles.halign = 'right';
        }
      }
      if (hookData.section === 'foot') {
        if (hookData.column.index === 2) {
          hookData.cell.styles.halign = 'right';
        }
        if (hookData.column.index === 3) {
          hookData.cell.styles.halign = 'center';
          hookData.cell.styles.fontSize = 9;
        }
        if (hookData.column.index === 5) {
          hookData.cell.styles.halign = 'right';
        }
        if (hookData.row.index === 2) {
          hookData.cell.styles.fillColor = [238, 242, 246];
          hookData.cell.styles.textColor = [20, 20, 22];
          hookData.cell.styles.fontSize = 9.5;
          if (hookData.column.index === 5) {
            hookData.cell.styles.fontSize = 10;
            hookData.cell.styles.textColor = [0, 102, 204];
          }
        }
      }
    },
  });

  const tableEndY = (doc as any).lastAutoTable.finalY || currentY + 30;
  let signY = tableEndY + 22;

  // If signatures don't fit on current page, add a new page
  if (signY + 18 > pageHeight - 15) {
    doc.addPage();
    signY = 35;
  }

  // Signature Lines for Warehouse Control
  const sigWidth = 52;
  const sig1X = margin;
  const sig2X = pageWidth / 2 - sigWidth / 2;
  const sig3X = pageWidth - margin - sigWidth;

  doc.setDrawColor(160, 160, 165);
  doc.setLineWidth(0.4);
  doc.line(sig1X, signY, sig1X + sigWidth, signY);
  doc.line(sig2X, signY, sig2X + sigWidth, signY);
  doc.line(sig3X, signY, sig3X + sigWidth, signY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 65);
  doc.text('Surtido por (Almacén)', sig1X + sigWidth / 2, signY + 5, { align: 'center' });
  doc.text('Revisado / Empacado por', sig2X + sigWidth / 2, signY + 5, { align: 'center' });
  doc.text('Entregado a Ruta / Chofer', sig3X + sigWidth / 2, signY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 125);
  doc.text('Nombre y firma', sig1X + sigWidth / 2, signY + 9, { align: 'center' });
  doc.text('Nombre y firma', sig2X + sigWidth / 2, signY + 9, { align: 'center' });
  doc.text('Nombre, fecha y firma', sig3X + sigWidth / 2, signY + 9, { align: 'center' });

  // Page Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 135);
    doc.text(
      `Orden de surtido interna para almacén • Pedido #${folio}`,
      margin,
      pageHeight - 10
    );
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
};
