import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface RouteSettlementPdfData {
  routeCode: string;
  routeName: string;
  agentName: string;
  vehicleInfo: string;
  weekStartDate: string;
  weekEndDate: string;
  budgetAmount: number;
  totalExpenses: number;
  totalCashCollected: number;
  totalTransferCollected: number;
  totalCollected: number;
  netCashToDeliver: number;
  payments: {
    date: string;
    orderId: string;
    customerName: string;
    branchName: string;
    method: string;
    amount: number;
    status: string;
  }[];
  expenses: {
    date: string;
    category: string;
    place: string;
    description: string;
    amount: number;
    status: string;
  }[];
}

export const generateRouteSettlementPdf = (data: RouteSettlementPdfData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('MOKADA', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte de Cierre de Ruta y Liquidación de Agente', pageWidth / 2, 25, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.line(14, 29, pageWidth - 14, 29);

  // Agent & Route Info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Ruta:', 14, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.routeCode} — ${data.routeName}`, 35, 36);

  doc.setFont('helvetica', 'bold');
  doc.text('Agente:', 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(data.agentName, 35, 42);

  doc.setFont('helvetica', 'bold');
  doc.text('Vehículo:', 14, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(data.vehicleInfo || 'N/D', 35, 48);

  doc.setFont('helvetica', 'bold');
  doc.text('Período:', 110, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.weekStartDate} al ${data.weekEndDate}`, 130, 36);

  doc.setFont('helvetica', 'bold');
  doc.text('Emisión:', 110, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }), 130, 42);

  // Financial Balance Box
  doc.setFillColor(245, 245, 247);
  doc.roundedRect(14, 53, pageWidth - 28, 38, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN DE LIQUIDACIÓN Y EFECTIVO EN MANO', 18, 60);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Presupuesto Asignado: $${data.budgetAmount.toFixed(2)}`, 18, 67);
  doc.text(`Cobrado en Efectivo: $${data.totalCashCollected.toFixed(2)}`, 18, 73);
  doc.text(`Cobrado por Transferencia: $${data.totalTransferCollected.toFixed(2)}`, 18, 79);

  doc.text(`Total Cobrado General: $${data.totalCollected.toFixed(2)}`, 110, 67);
  doc.text(`Total Gastado en Ruta: $${data.totalExpenses.toFixed(2)}`, 110, 73);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 102, 204);
  doc.text(`EFECTIVO A ENTREGAR EN CAJA: $${data.netCashToDeliver.toFixed(2)}`, 110, 81);
  doc.setTextColor(0, 0, 0);

  let currentY = 98;

  // Payments Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Detalle de Cobros Realizados (Pagos)', 14, currentY);

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Fecha', 'Pedido', 'Cliente / Sucursal', 'Método', 'Monto', 'Estado']],
    body: data.payments.map((p) => [
      p.date,
      `#${p.orderId.slice(0, 8)}`,
      `${p.customerName} (${p.branchName})`,
      p.method === 'CASH' ? 'Efectivo' : 'Transferencia',
      `$${p.amount.toFixed(2)}`,
      p.status === 'APPROVED' ? 'Aprobado' : p.status === 'REJECTED' ? 'Rechazado' : 'Pendiente',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [0, 102, 204] },
    styles: { fontSize: 8 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Expenses Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Detalle de Gastos de Ruta', 14, currentY);

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Fecha', 'Categoría', 'Lugar / Proveedor', 'Descripción', 'Monto', 'Estado']],
    body: data.expenses.map((e) => [
      e.date,
      e.category,
      e.place,
      e.description,
      `$${e.amount.toFixed(2)}`,
      e.status === 'APPROVED' ? 'Aprobado' : e.status === 'REJECTED' ? 'Rechazado' : 'Pendiente',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [100, 116, 139] },
    styles: { fontSize: 8 },
  });

  // Footer
  const finalY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('Reporte oficial de cierre de semana de agente en ruta. Mokada Autopartes.', pageWidth / 2, finalY, { align: 'center' });

  // Open PDF in new tab
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
};
