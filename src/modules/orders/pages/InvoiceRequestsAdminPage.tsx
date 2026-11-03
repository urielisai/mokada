import { useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Printer,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersService } from '../services/orders.service';
import { Modal } from '../../../components/ui/Modal';
import { buildOrderInvoicePdf, invoicePaymentForms, invoiceRows } from '../utils/orderInvoice';
import {
  buildFacturamaRows,
  DEFAULT_FACTURAMA_CONFIG,
  downloadFacturamaCsv,
  FACTURAMA_STANDARD_COLUMNS,
  generateFacturamaCsvContent,
  resolveSatPaymentForm,
  resolveSatPaymentMethod,
  type FacturamaCsvConfig,
  type FacturamaCsvRow,
} from '../utils/facturamaCsv';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount || 0));

export const InvoiceRequestsAdminPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'INVOICED'>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingRequest, setViewingRequest] = useState<any | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Facturama CSV configuration & overrides for preview
  const [csvConfig, setCsvConfig] = useState<FacturamaCsvConfig>(DEFAULT_FACTURAMA_CONFIG);
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<FacturamaCsvRow>>>({});
  const [markAsInvoicedOnDownload, setMarkAsInvoicedOnDownload] = useState(false);
  const [showRawCsv, setShowRawCsv] = useState(false);
  const [templateFileName, setTemplateFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['all-invoice-requests'],
    queryFn: () => ordersService.getAllInvoiceRequests(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'PENDING' | 'INVOICED' }) =>
      ordersService.updateInvoiceRequestStatus(id, status),
    onSuccess: () => {
      toast.success('Estado de solicitud actualizado');
      queryClient.invalidateQueries({ queryKey: ['all-invoice-requests'] });
    },
    onError: (error: any) => toast.error(error.message || 'Error al actualizar el estado'),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: 'PENDING' | 'INVOICED' }) =>
      ordersService.updateMultipleInvoiceRequestsStatus(ids, status),
    onSuccess: (_, variables) => {
      toast.success(`${variables.ids.length} solicitud(es) actualizada(s)`);
      queryClient.invalidateQueries({ queryKey: ['all-invoice-requests'] });
    },
    onError: (error: any) => toast.error(error.message || 'Error al actualizar solicitudes'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ordersService.deleteInvoiceRequest(id),
    onSuccess: (_, deletedId) => {
      toast.success('Solicitud eliminada');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['all-invoice-requests'] });
    },
    onError: (error: any) => toast.error(error.message || 'Error al eliminar la solicitud'),
  });

  const enrichedRequests = useMemo(() => {
    return requests.map((req: any) => {
      const items = Array.isArray(req.items) ? req.items : [];
      const totalUnits = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
      const totalAmount = items.reduce(
        (sum: number, item: any) =>
          sum + Number(item.quantity || 0) * Number(item.order_item?.unit_price || 0),
        0
      );
      const satForm = resolveSatPaymentForm(req.invoice_payment_form || req.invoice_details?.payment_form);
      const satMethod = resolveSatPaymentMethod(satForm, req.order?.payment_type);
      return {
        ...req,
        totalUnits,
        totalAmount,
        satForm,
        satMethod,
      };
    });
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enrichedRequests.filter((req: any) => {
      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
      if (!matchesStatus) return false;
      if (!term) return true;
      const details = req.invoice_details || {};
      const orderId = String(req.order_id || req.order?.id || '');
      return [
        orderId,
        details.legal_name,
        details.rfc,
        details.customer_name,
        details.billing_email,
        req.order?.customers?.name,
      ].some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [enrichedRequests, search, statusFilter]);

  const counts = useMemo(() => {
    const pending = enrichedRequests.filter((r: any) => r.status === 'PENDING').length;
    const invoiced = enrichedRequests.filter((r: any) => r.status === 'INVOICED').length;
    const selectedList = enrichedRequests.filter((r: any) => selectedIds.has(r.id));
    const selectedTotal = selectedList.reduce((sum: number, r: any) => sum + r.totalAmount, 0);
    return {
      total: enrichedRequests.length,
      pending,
      invoiced,
      selectedCount: selectedList.length,
      selectedTotal,
    };
  }, [enrichedRequests, selectedIds]);

  const selectedRequests = useMemo(
    () => enrichedRequests.filter((r: any) => selectedIds.has(r.id)),
    [enrichedRequests, selectedIds]
  );

  const previewRows = useMemo(
    () => buildFacturamaRows(selectedRequests, csvConfig, rowOverrides),
    [selectedRequests, csvConfig, rowOverrides]
  );

  const rawCsvContent = useMemo(
    () => generateFacturamaCsvContent(previewRows, csvConfig.customHeaders),
    [previewRows, csvConfig.customHeaders]
  );

  const allFilteredSelected =
    filteredRequests.length > 0 && filteredRequests.every((r: any) => selectedIds.has(r.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredRequests.forEach((r: any) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredRequests.forEach((r: any) => next.add(r.id));
        return next;
      });
    }
  };

  const selectAllPending = () => {
    const pendingIds = enrichedRequests
      .filter((r: any) => r.status === 'PENDING')
      .map((r: any) => r.id);
    setSelectedIds(new Set(pendingIds));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRowOverride = (rowKey: string, field: keyof FacturamaCsvRow, value: any) => {
    setRowOverrides((prev) => ({
      ...prev,
      [rowKey]: {
        ...(prev[rowKey] || {}),
        [field]: value,
      },
    }));
  };

  const handleUploadTemplateCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '').replace(/^\uFEFF/, '');
      const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0);
      if (!firstLine) {
        toast.error('El archivo CSV está vacío');
        return;
      }
      const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
      const headers = firstLine
        .split(delimiter)
        .map((h) => h.replace(/^"|"$/g, '').trim())
        .filter(Boolean);

      if (headers.length < 3) {
        toast.error('No se detectaron suficientes columnas en la plantilla');
        return;
      }

      setCsvConfig((prev) => ({ ...prev, customHeaders: headers }));
      setTemplateFileName(file.name);
      toast.success(`Plantilla "${file.name}" cargada (${headers.length} columnas)`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleClearCustomTemplate = () => {
    setCsvConfig((prev) => ({ ...prev, customHeaders: null }));
    setTemplateFileName(null);
  };

  const handleDownloadCsv = async () => {
    if (previewRows.length === 0) {
      toast.error('No hay conceptos para exportar');
      return;
    }
    const dateStr = format(new Date(), 'yyyyMMdd_HHmm');
    downloadFacturamaCsv(rawCsvContent, `facturama_masiva_${dateStr}.csv`);
    toast.success(`Archivo CSV generado con ${selectedRequests.length} factura(s) y ${previewRows.length} concepto(s)`);

    if (markAsInvoicedOnDownload) {
      const pendingSelectedIds = selectedRequests
        .filter((r: any) => r.status !== 'INVOICED')
        .map((r: any) => r.id);
      if (pendingSelectedIds.length > 0) {
        await bulkStatusMutation.mutateAsync({ ids: pendingSelectedIds, status: 'INVOICED' });
      }
    }
    setIsPreviewModalOpen(false);
  };

  const handlePrintPdf = (request: any) => {
    const preview = window.open('', '_blank');
    if (!preview) {
      toast.error('Permite abrir ventanas emergentes para imprimir.');
      return;
    }
    try {
      const doc = buildOrderInvoicePdf(request.order_id, request.invoice_details);
      doc.autoPrint();
      const url = URL.createObjectURL(doc.output('blob'));
      preview.opener = null;
      preview.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch {
      preview.close();
      toast.error('No se pudo preparar la impresión.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-ink">Solicitudes de Facturación</h2>
          <p className="text-[15px] text-muted mt-1">
            Gestión de solicitudes fiscales y generación masiva de CSV para Facturama (CFDI 4.0)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {counts.pending > 0 && (
            <button
              type="button"
              onClick={selectAllPending}
              className="px-3.5 py-2 text-[13px] font-medium text-ink bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            >
              Seleccionar pendientes ({counts.pending})
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3.5 py-2 text-[13px] font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Limpiar selección
            </button>
          )}
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => setIsPreviewModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-medium bg-accent hover:bg-accent-hover text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Previsualizar y Generar CSV Facturama ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center mb-2.5">
            <FileText className="w-4 h-4" />
          </div>
          <p className="text-[12px] font-medium text-muted">Total Solicitudes</p>
          <p className="text-[22px] font-bold text-ink mt-0.5">{counts.total}</p>
        </div>

        <div className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-2.5">
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-[12px] font-medium text-muted">Pendientes por Facturar</p>
          <p className="text-[22px] font-bold text-ink mt-0.5">{counts.pending}</p>
        </div>

        <div className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-[12px] font-medium text-muted">Facturadas</p>
          <p className="text-[22px] font-bold text-ink mt-0.5">{counts.invoiced}</p>
        </div>

        <div className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-accent flex items-center justify-center mb-2.5">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <p className="text-[12px] font-medium text-muted">Seleccionadas ({counts.selectedCount})</p>
          <p className="text-[20px] font-bold text-accent mt-0.5 truncate">{formatCurrency(counts.selectedTotal)}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex w-full sm:w-fit gap-1 overflow-x-auto rounded-xl border border-gray-200/60 bg-white p-1 shadow-sm">
          {[
            { value: 'ALL', label: 'Todas', count: counts.total },
            { value: 'PENDING', label: 'Pendientes', count: counts.pending },
            { value: 'INVOICED', label: 'Facturadas', count: counts.invoiced },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value as 'ALL' | 'PENDING' | 'INVOICED')}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:bg-gray-50 hover:text-ink'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-sm">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por RFC, razón social, cliente o pedido..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200/60 rounded-xl focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[13px] shadow-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200/60 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="invoice-requests-table-caption"
            className="overflow-x-auto max-w-full"
          >
            <table className="w-full border-collapse">
              <caption id="invoice-requests-table-caption" className="sr-only">
                Listado de solicitudes de facturación
              </caption>
              <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3.5 text-left w-10">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas las solicitudes filtradas"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      className="w-4 h-4 rounded border-gray-300 accent-accent cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Pedido / Fecha
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Receptor (Razón Social / RFC)
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Datos CFDI 4.0
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Pago SAT
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Conceptos
                  </th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Importe Total
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRequests.map((req: any) => {
                  const details = req.invoice_details || {};
                  const isSelected = selectedIds.has(req.id);
                  const orderShort = String(req.order_id || '').split('-')[0].toUpperCase();

                  return (
                    <tr
                      key={req.id}
                      onClick={() => toggleOne(req.id)}
                      className={`transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/50 hover:bg-blue-50/80' : 'hover:bg-gray-50/70'
                      }`}
                    >
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar solicitud de ${details.legal_name || details.rfc}`}
                          checked={isSelected}
                          onChange={() => toggleOne(req.id)}
                          className="w-4 h-4 rounded border-gray-300 accent-accent cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Link
                          to={`/orders/${req.order_id}`}
                          className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline"
                        >
                          #{orderShort}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {format(new Date(req.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-[13px] font-semibold text-ink uppercase">
                          {details.legal_name || 'Sin razón social'}
                        </p>
                        <p className="text-[12px] font-mono text-gray-600">{details.rfc || 'S/RFC'}</p>
                        <p className="text-[11px] text-muted truncate max-w-[220px]">
                          Cliente: {details.customer_name || req.order?.customers?.name || 'Cliente'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="text-[12px] text-gray-700 space-y-0.5">
                          <p>
                            <span className="text-gray-500">Régimen:</span>{' '}
                            <span className="font-medium">{details.tax_regime || '601'}</span>
                          </p>
                          <p>
                            <span className="text-gray-500">Uso CFDI:</span>{' '}
                            <span className="font-medium">{details.cfdi_use || 'G03'}</span>
                          </p>
                          <p>
                            <span className="text-gray-500">C.P. Fiscal:</span>{' '}
                            <span className="font-medium">{details.fiscal_zip_code || '—'}</span>
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-800">
                          Forma: {req.satForm}
                        </span>
                        <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-800">
                          {req.satMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-[13px] font-medium text-ink">
                          {(req.items || []).length} código(s)
                        </p>
                        <p className="text-[11px] text-gray-500">{req.totalUnits} pieza(s)</p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <span className="text-[14px] font-bold text-ink">
                          {formatCurrency(req.totalAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                            req.status === 'INVOICED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {req.status === 'INVOICED' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Facturado
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              Pendiente
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {req.status === 'PENDING' ? (
                            <button
                              type="button"
                              onClick={() => statusMutation.mutate({ id: req.id, status: 'INVOICED' })}
                              disabled={statusMutation.isPending}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Marcar Facturado
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => statusMutation.mutate({ id: req.id, status: 'PENDING' })}
                              disabled={statusMutation.isPending}
                              className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Marcar Pendiente
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewingRequest(req)}
                            title="Ver detalles de facturación"
                            className="p-1.5 text-gray-500 hover:text-ink hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('¿Eliminar esta solicitud de facturación?')) {
                                deleteMutation.mutate(req.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            title="Eliminar solicitud"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-ink">No se encontraron solicitudes de facturación</p>
                      <p className="text-[13px] text-muted mt-1">
                        Las solicitudes creadas desde el detalle de los pedidos aparecerán aquí.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Detalle individual de una Solicitud */}
      {viewingRequest && (
        <Modal
          isOpen={!!viewingRequest}
          onClose={() => setViewingRequest(null)}
          title={`Solicitud de Factura · Pedido #${String(viewingRequest.order_id || '').split('-')[0].toUpperCase()}`}
          size="lg"
        >
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {invoiceRows(viewingRequest.invoice_details).map(([label, value]) => (
              <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                <dt className="text-[11px] text-muted mb-0.5">{label}</dt>
                <dd className="text-[13px] text-ink font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h4 className="text-[13px] font-semibold text-gray-700 mb-2">Conceptos incluidos en la solicitud:</h4>
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-56 overflow-y-auto">
              {(viewingRequest.items || []).map((item: any) => (
                <div key={item.id} className="p-3 text-[13px] flex justify-between items-center bg-white">
                  <div>
                    <p className="font-medium text-ink">
                      {item.quantity}x {item.order_item?.products?.name}
                    </p>
                    <p className="text-[11px] text-muted">
                      Código: {item.order_item?.products?.code} · Unitario:{' '}
                      {formatCurrency(item.order_item?.unit_price || 0)}
                    </p>
                  </div>
                  <span className="font-semibold text-ink">
                    {formatCurrency(Number(item.quantity || 0) * Number(item.order_item?.unit_price || 0))}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-3 mt-6 pt-4 border-t border-gray-100">
            <Link
              to={`/orders/${viewingRequest.order_id}`}
              className="text-[13px] font-medium text-accent hover:underline flex items-center gap-1"
            >
              Ir al pedido #{String(viewingRequest.order_id || '').split('-')[0].toUpperCase()}
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePrintPdf(viewingRequest)}
                className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3.5 py-2 text-[13px] font-medium hover:bg-gray-50"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button
                type="button"
                onClick={() =>
                  buildOrderInvoicePdf(viewingRequest.order_id, viewingRequest.invoice_details).save(
                    `facturacion-${String(viewingRequest.order_id || '').slice(0, 8)}.pdf`
                  )
                }
                className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-medium hover:bg-accent-hover"
              >
                <Download className="w-4 h-4" />
                Descargar PDF
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Previsualización y Generación de CSV para Facturama */}
      {isPreviewModalOpen && (
        <Modal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          title="Previsualización de CSV Masivo para Facturama (CFDI 4.0)"
          size="xl"
        >
          <div className="space-y-5">
            {/* Parámetros Globales para Facturama */}
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-accent" />
                  <h4 className="text-[13px] font-semibold text-ink">
                    Parámetros CFDI 4.0 para Carga Masiva en Facturama
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleUploadTemplateCsv}
                    className="hidden"
                  />
                  {templateFileName ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-accent text-[12px] font-medium border border-blue-200">
                      Plantilla activa: {templateFileName} ({csvConfig.customHeaders?.length} cols)
                      <button
                        type="button"
                        onClick={handleClearCustomTemplate}
                        className="hover:text-red-600"
                        title="Restaurar columnas estándar de Facturama"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-[12px] font-medium text-gray-700 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-accent" />
                      Adaptar a plantilla .CSV de Facturama (opcional)
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Serie</label>
                  <input
                    type="text"
                    value={csvConfig.serie}
                    onChange={(e) => setCsvConfig((prev) => ({ ...prev, serie: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[13px]"
                    placeholder="A"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    C.P. Expedición
                  </label>
                  <input
                    type="text"
                    value={csvConfig.expeditionZipCode}
                    onChange={(e) =>
                      setCsvConfig((prev) => ({ ...prev, expeditionZipCode: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[13px]"
                    placeholder="42186"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    ClaveProdServ SAT
                  </label>
                  <input
                    type="text"
                    value={csvConfig.defaultClaveProdServ}
                    onChange={(e) =>
                      setCsvConfig((prev) => ({ ...prev, defaultClaveProdServ: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[13px] font-mono"
                    placeholder="25172500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    ClaveUnidad SAT
                  </label>
                  <input
                    type="text"
                    value={csvConfig.defaultClaveUnidad}
                    onChange={(e) =>
                      setCsvConfig((prev) => ({ ...prev, defaultClaveUnidad: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[13px] font-mono"
                    placeholder="H87"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Unidad</label>
                  <input
                    type="text"
                    value={csvConfig.defaultUnidad}
                    onChange={(e) =>
                      setCsvConfig((prev) => ({ ...prev, defaultUnidad: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[13px]"
                    placeholder="Pieza"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    ObjetoImp SAT
                  </label>
                  <select
                    value={csvConfig.objetoImp}
                    onChange={(e) =>
                      setCsvConfig((prev) => ({
                        ...prev,
                        objetoImp: e.target.value as '01' | '02' | '03',
                      }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[13px]"
                  >
                    <option value="02">02 - Sí objeto de impuesto</option>
                    <option value="01">01 - No objeto de impuesto</option>
                    <option value="03">03 - Sí objeto y no obligado a desglose</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-2 border-t border-gray-200/70 text-[12px] text-gray-700">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={csvConfig.extractIvaFromUnitPrice}
                    onChange={(e) =>
                      setCsvConfig((prev) => ({
                        ...prev,
                        extractIvaFromUnitPrice: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-gray-300 accent-accent"
                  />
                  <span>
                    Desglosar IVA (16%) de los precios de venta para el Valor Unitario del CFDI
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={csvConfig.multiConceptZeroSecondaryTotals}
                    onChange={(e) =>
                      setCsvConfig((prev) => ({
                        ...prev,
                        multiConceptZeroSecondaryTotals: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-gray-300 accent-accent"
                  />
                  <span>
                    Concentrar Subtotal/IVA/Total de la factura en el renglón principal (regla multi-concepto Facturama)
                  </span>
                </label>
              </div>
            </div>

            {/* Preview Table Header & Raw Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-gray-600">
                Se exportarán{' '}
                <span className="font-semibold text-ink">{selectedRequests.length} factura(s)</span> con un
                total de <span className="font-semibold text-ink">{previewRows.length} renglón(es)</span> de
                conceptos. Puedes editar cualquier celda clave antes de descargar.
              </p>
              <button
                type="button"
                onClick={() => setShowRawCsv((prev) => !prev)}
                className="text-[12px] font-medium text-accent hover:underline"
              >
                {showRawCsv ? 'Ver tabla interactiva' : 'Ver contenido CSV crudo'}
              </button>
            </div>

            {showRawCsv ? (
              <div className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed">
                <pre>{rawCsvContent}</pre>
              </div>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-label="Previsualización de renglones del archivo CSV para Facturama"
                className="border border-gray-200 rounded-xl overflow-auto max-h-80"
              >
                <table className="w-full border-collapse text-[12px]">
                  <thead className="sticky top-0 z-10 bg-gray-100 text-gray-700 border-b border-gray-200">
                    <tr>
                      <th className="px-2.5 py-2 text-center font-semibold">Id</th>
                      <th className="px-2.5 py-2 text-left font-semibold">Folio</th>
                      <th className="px-2.5 py-2 text-left font-semibold">RFC Receptor</th>
                      <th className="px-2.5 py-2 text-left font-semibold min-w-[180px]">Nombre Receptor</th>
                      <th className="px-2.5 py-2 text-center font-semibold">C.P.</th>
                      <th className="px-2.5 py-2 text-center font-semibold">Régimen</th>
                      <th className="px-2.5 py-2 text-center font-semibold">Uso</th>
                      <th className="px-2.5 py-2 text-center font-semibold">Forma</th>
                      <th className="px-2.5 py-2 text-center font-semibold">Método</th>
                      <th className="px-2.5 py-2 text-left font-semibold">ClaveProdServ</th>
                      <th className="px-2.5 py-2 text-left font-semibold">SKU</th>
                      <th className="px-2.5 py-2 text-left font-semibold min-w-[180px]">Descripción</th>
                      <th className="px-2.5 py-2 text-center font-semibold">Cant.</th>
                      <th className="px-2.5 py-2 text-center font-semibold">ClaveUnidad</th>
                      <th className="px-2.5 py-2 text-right font-semibold">ValorUnitario</th>
                      <th className="px-2.5 py-2 text-right font-semibold">Importe</th>
                      <th className="px-2.5 py-2 text-right font-semibold">IVA (16%)</th>
                      <th className="px-2.5 py-2 text-right font-semibold">Total Factura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewRows.map((row, idx) => {
                      const reqObj = selectedRequests.find((r: any) => r.id === row.requestId);
                      const itemObj = reqObj?.items?.[row.rowNumberInInvoice - 1];
                      const rowKey = `${row.requestId}_${itemObj?.id || row.rowNumberInInvoice - 1}`;

                      return (
                        <tr
                          key={`${rowKey}_${idx}`}
                          className={row.isMainRow ? 'bg-white' : 'bg-gray-50/60'}
                        >
                          <td className="px-2.5 py-2 text-center font-bold text-ink">
                            {row.invoiceGroupId}
                          </td>
                          <td className="px-2.5 py-2 font-mono text-gray-700">{row.folio}</td>
                          <td className="px-2.5 py-2 font-mono text-ink">{row.rfcReceptor}</td>
                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              value={row.nombreReceptor}
                              onChange={(e) =>
                                handleRowOverride(rowKey, 'nombreReceptor', e.target.value.toUpperCase())
                              }
                              className="w-full px-1.5 py-1 border border-gray-200 rounded text-[11px] uppercase"
                            />
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono">
                            {row.domicilioFiscalReceptor}
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono">
                            {row.regimenFiscalReceptor}
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono">{row.usoCfdi}</td>
                          <td className="px-2.5 py-2 text-center">
                            <select
                              value={row.formaPago}
                              onChange={(e) => handleRowOverride(rowKey, 'formaPago', e.target.value)}
                              className="px-1.5 py-1 border border-gray-200 rounded text-[11px] bg-white"
                            >
                              {invoicePaymentForms.map((pf) => {
                                const code = pf.label.split(' - ')[0];
                                return (
                                  <option key={pf.value} value={code}>
                                    {code}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td className="px-2.5 py-2 text-center">
                            <select
                              value={row.metodoPago}
                              onChange={(e) =>
                                handleRowOverride(rowKey, 'metodoPago', e.target.value as 'PUE' | 'PPD')
                              }
                              className="px-1.5 py-1 border border-gray-200 rounded text-[11px] bg-white"
                            >
                              <option value="PUE">PUE</option>
                              <option value="PPD">PPD</option>
                            </select>
                          </td>
                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              value={row.claveProdServ}
                              onChange={(e) =>
                                handleRowOverride(rowKey, 'claveProdServ', e.target.value)
                              }
                              className="w-24 px-1.5 py-1 border border-gray-200 rounded text-[11px] font-mono"
                            />
                          </td>
                          <td className="px-2.5 py-2 font-mono text-gray-600">{row.noIdentificacion}</td>
                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              value={row.descripcion}
                              onChange={(e) => handleRowOverride(rowKey, 'descripcion', e.target.value)}
                              className="w-full px-1.5 py-1 border border-gray-200 rounded text-[11px]"
                            />
                          </td>
                          <td className="px-2.5 py-2 text-center font-semibold">{row.cantidad}</td>
                          <td className="px-2.5 py-2 text-center">
                            <input
                              type="text"
                              value={row.claveUnidad}
                              onChange={(e) => handleRowOverride(rowKey, 'claveUnidad', e.target.value)}
                              className="w-14 px-1.5 py-1 border border-gray-200 rounded text-[11px] font-mono text-center"
                            />
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono">
                            ${row.valorUnitario.toFixed(2)}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono">
                            ${row.importeConcepto.toFixed(2)}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono">
                            ${row.importeIvaConcepto.toFixed(2)}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-ink">
                            {row.totalFactura > 0 ? `$${row.totalFactura.toFixed(2)}` : '0.00'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Columns info */}
            <p className="text-[11px] text-gray-500">
              Columnas incluidas en el CSV:{' '}
              <span className="font-mono text-gray-600">
                {(csvConfig.customHeaders || FACTURAMA_STANDARD_COLUMNS.map((c) => c.header)).join(', ')}
              </span>
            </p>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-gray-100">
              <label className="inline-flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={markAsInvoicedOnDownload}
                  onChange={(e) => setMarkAsInvoicedOnDownload(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-accent"
                />
                <span>Marcar solicitudes seleccionadas como FACTURADAS al descargar el CSV</span>
              </label>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={bulkStatusMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 text-[13px] font-medium text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {bulkStatusMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Descargar CSV para Facturama
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

