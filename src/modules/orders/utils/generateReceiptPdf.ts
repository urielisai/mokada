import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReceiptData {
  orderId: string;
  customerName: string;
  agentName: string;
  paymentMethod: string;
  amountPaidNow: number;
  totalOrderAmount: number;
  totalPreviouslyPaid: number;
  remainingBalance: number;
  date: string;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
}

export const generateReceiptPdf = (data: ReceiptData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('MOKADA', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Recibo de Pago', pageWidth / 2, 28, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.line(14, 32, pageWidth - 14, 32);

  // Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', 14, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(data.date, 40, 40);

  doc.setFont('helvetica', 'bold');
  doc.text('Pedido #:', 14, 46);
  doc.setFont('helvetica', 'normal');
  doc.text(data.orderId.substring(0, 8).toUpperCase(), 40, 46);

  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 14, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(data.customerName, 40, 52);

  doc.setFont('helvetica', 'bold');
  doc.text('Agente:', 14, 58);
  doc.setFont('helvetica', 'normal');
  doc.text(data.agentName, 40, 58);

  // Items Table
  autoTable(doc, {
    startY: 65,
    head: [['Producto', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body: data.items.map(item => [
      item.name,
      item.quantity.toString(),
      `$${item.unitPrice.toFixed(2)}`,
      `$${item.subtotal.toFixed(2)}`
    ]),
    theme: 'grid',
    headStyles: { fillColor: [0, 102, 204] },
    styles: { fontSize: 9 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Financial Summary
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen del Pedido', 14, finalY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const labelX = 130;
  const valueX = 190;
  let currentY = finalY + 8;

  doc.text('Total del Pedido:', labelX, currentY);
  doc.text(`$${data.totalOrderAmount.toFixed(2)}`, valueX, currentY, { align: 'right' });
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

  // Footer
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Este documento es un comprobante de pago. Gracias por su preferencia.', pageWidth / 2, 280, { align: 'center' });

  // Download
  doc.save(`Recibo_Pago_Mokada_${data.orderId.substring(0, 8)}.pdf`);
};
