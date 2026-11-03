export interface FacturamaCsvConfig {
  serie: string;
  expeditionZipCode: string;
  defaultClaveProdServ: string;
  defaultClaveUnidad: string;
  defaultUnidad: string;
  objetoImp: '01' | '02' | '03';
  extractIvaFromUnitPrice: boolean;
  multiConceptZeroSecondaryTotals: boolean;
  customHeaders?: string[] | null;
}

export interface FacturamaCsvRow {
  requestId: string;
  orderId: string;
  invoiceGroupId: string;
  rowNumberInInvoice: number;
  isMainRow: boolean;
  serie: string;
  folio: string;
  fecha: string;
  formaPago: string;
  metodoPago: 'PUE' | 'PPD';
  moneda: string;
  tipoCambio: string;
  tipoDeComprobante: string;
  exportacion: string;
  lugarExpedicion: string;
  rfcReceptor: string;
  nombreReceptor: string;
  domicilioFiscalReceptor: string;
  regimenFiscalReceptor: string;
  usoCfdi: string;
  emailReceptor: string;
  claveProdServ: string;
  noIdentificacion: string;
  cantidad: number;
  claveUnidad: string;
  unidad: string;
  descripcion: string;
  valorUnitario: number;
  importeConcepto: number;
  descuentoConcepto: number;
  objetoImp: string;
  baseIvaConcepto: number;
  tasaIva: string;
  importeIvaConcepto: number;
  totalConcepto: number;
  subtotalFactura: number;
  descuentoFactura: number;
  ivaFactura: number;
  totalFactura: number;
}

export const DEFAULT_FACTURAMA_CONFIG: FacturamaCsvConfig = {
  serie: 'A',
  expeditionZipCode: '42186',
  defaultClaveProdServ: '25172500', // Refacciones / autopartes por defecto en catálogo SAT
  defaultClaveUnidad: 'H87', // Pieza en catálogo SAT
  defaultUnidad: 'Pieza',
  objetoImp: '02', // 02 - Sí objeto de impuesto
  extractIvaFromUnitPrice: true, // En Mokada los precios incluyen IVA
  multiConceptZeroSecondaryTotals: true, // Renglón principal concentra totales globales de la factura
  customHeaders: null,
};

export const PAYMENT_FORM_SAT_MAP: Record<string, string> = {
  CASH: '01',
  TRANSFER: '03',
  CREDIT_CARD: '04',
  DEBIT_CARD: '28',
  UNDEFINED: '99',
  '01': '01',
  '03': '03',
  '04': '04',
  '28': '28',
  '99': '99',
};

export const resolveSatPaymentForm = (raw?: string | null): string => {
  if (!raw) return '99';
  return PAYMENT_FORM_SAT_MAP[raw.toUpperCase()] || '99';
};

export const resolveSatPaymentMethod = (satPaymentForm: string, orderPaymentType?: string | null): 'PUE' | 'PPD' => {
  if (satPaymentForm === '99' || orderPaymentType === 'CREDITO') {
    return 'PPD';
  }
  return 'PUE';
};

/**
 * Normaliza la razón social para CFDI 4.0 (en mayúsculas, sin espacios dobles).
 */
export const sanitizeReceptorName = (name?: string | null): string => {
  if (!name) return 'PUBLICO EN GENERAL';
  return name.trim().toUpperCase().replace(/\s+/g, ' ');
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const round4 = (n: number) => Math.round((Number(n) || 0) * 10000) / 10000;

/**
 * Construye las filas listas para previsualización y exportación CSV de Facturama CFDI 4.0
 * a partir de las solicitudes de facturación seleccionadas.
 */
export const buildFacturamaRows = (
  requests: any[],
  config: FacturamaCsvConfig,
  rowOverrides: Record<string, Partial<FacturamaCsvRow>> = {}
): FacturamaCsvRow[] => {
  const rows: FacturamaCsvRow[] = [];

  requests.forEach((req, reqIdx) => {
    const details = req.invoice_details || {};
    const order = req.order || {};
    const groupNumber = String(reqIdx + 1);
    const shortFolio = (req.order_id || order.id || req.id || '').split('-')[0].toUpperCase();

    const rawPaymentForm = req.invoice_payment_form || details.payment_form || 'UNDEFINED';
    const formaPago = resolveSatPaymentForm(rawPaymentForm);
    const metodoPago = resolveSatPaymentMethod(formaPago, order.payment_type);
    const formaPagoFinal = metodoPago === 'PPD' ? '99' : formaPago;

    const rfcReceptor = (details.rfc || 'XAXX010101000').trim().toUpperCase();
    const nombreReceptor = sanitizeReceptorName(details.legal_name || details.customer_name);
    const domicilioFiscalReceptor = (details.fiscal_zip_code || '42186').trim();
    const regimenFiscalReceptor = (details.tax_regime || '601').trim();
    const usoCfdi = (details.cfdi_use || 'G03').trim();
    const emailReceptor = (details.billing_email || details.customer_email || '').trim();
    const lugarExpedicion = (config.expeditionZipCode || details.issuer_zip_code || '42186').trim();

    const items = Array.isArray(req.items) ? req.items : [];

    // Pre-calculate item amounts so the main row has the exact accumulated invoice totals
    const computedItems = items.map((item: any, itemIdx: number) => {
      const rowKey = `${req.id}_${item.id || itemIdx}`;
      const override = rowOverrides[rowKey] || {};

      const quantity = Number(override.cantidad ?? item.quantity ?? 1);
      const grossUnitPrice = Number(item.order_item?.unit_price ?? 0);
      const product = item.order_item?.products || {};

      const totalConcepto = round2(quantity * grossUnitPrice);
      let valorUnitario: number;
      let importeConcepto: number;
      let importeIvaConcepto: number;

      if (config.objetoImp === '02' && config.extractIvaFromUnitPrice) {
        // Desglosar IVA 16% a partir del precio con IVA incluido
        importeConcepto = round2(totalConcepto / 1.16);
        importeIvaConcepto = round2(totalConcepto - importeConcepto);
        valorUnitario = quantity > 0 ? round4(importeConcepto / quantity) : 0;
      } else if (config.objetoImp === '02' && !config.extractIvaFromUnitPrice) {
        valorUnitario = round4(grossUnitPrice);
        importeConcepto = round2(quantity * valorUnitario);
        importeIvaConcepto = round2(importeConcepto * 0.16);
      } else {
        valorUnitario = round4(grossUnitPrice);
        importeConcepto = round2(quantity * valorUnitario);
        importeIvaConcepto = 0;
      }

      const finalTotalConcepto = round2(importeConcepto + importeIvaConcepto);

      return {
        rowKey,
        override,
        itemIdx,
        quantity,
        product,
        valorUnitario,
        importeConcepto,
        importeIvaConcepto,
        finalTotalConcepto,
      };
    });

    const invoiceSubtotal = round2(
      computedItems.reduce((acc: number, it: any) => acc + it.importeConcepto, 0)
    );
    const invoiceIva = round2(
      computedItems.reduce((acc: number, it: any) => acc + it.importeIvaConcepto, 0)
    );
    const invoiceTotal = round2(invoiceSubtotal + invoiceIva);

    computedItems.forEach((calc: any) => {
      const isMainRow = calc.itemIdx === 0;
      const ov = calc.override;

      const showInvoiceTotals = !config.multiConceptZeroSecondaryTotals || isMainRow;

      rows.push({
        requestId: req.id,
        orderId: req.order_id || order.id || '',
        invoiceGroupId: groupNumber,
        rowNumberInInvoice: calc.itemIdx + 1,
        isMainRow,
        serie: ov.serie ?? config.serie,
        folio: ov.folio ?? shortFolio,
        fecha: new Date().toISOString().slice(0, 19),
        formaPago: ov.formaPago ?? formaPagoFinal,
        metodoPago: (ov.metodoPago as 'PUE' | 'PPD') ?? metodoPago,
        moneda: 'MXN',
        tipoCambio: '1',
        tipoDeComprobante: 'I',
        exportacion: '01',
        lugarExpedicion,
        rfcReceptor: ov.rfcReceptor ?? rfcReceptor,
        nombreReceptor: ov.nombreReceptor ?? nombreReceptor,
        domicilioFiscalReceptor: ov.domicilioFiscalReceptor ?? domicilioFiscalReceptor,
        regimenFiscalReceptor: ov.regimenFiscalReceptor ?? regimenFiscalReceptor,
        usoCfdi: ov.usoCfdi ?? usoCfdi,
        emailReceptor: ov.emailReceptor ?? emailReceptor,
        claveProdServ: ov.claveProdServ ?? config.defaultClaveProdServ,
        noIdentificacion: ov.noIdentificacion ?? (calc.product.code || 'S/C'),
        cantidad: calc.quantity,
        claveUnidad: ov.claveUnidad ?? config.defaultClaveUnidad,
        unidad: ov.unidad ?? config.defaultUnidad,
        descripcion: ov.descripcion ?? (calc.product.name || 'Producto'),
        valorUnitario: calc.valorUnitario,
        importeConcepto: calc.importeConcepto,
        descuentoConcepto: 0,
        objetoImp: ov.objetoImp ?? config.objetoImp,
        baseIvaConcepto: calc.importeConcepto,
        tasaIva: config.objetoImp === '02' ? '0.160000' : '0.000000',
        importeIvaConcepto: calc.importeIvaConcepto,
        totalConcepto: calc.finalTotalConcepto,
        subtotalFactura: showInvoiceTotals ? invoiceSubtotal : 0,
        descuentoFactura: 0,
        ivaFactura: showInvoiceTotals ? invoiceIva : 0,
        totalFactura: showInvoiceTotals ? invoiceTotal : 0,
      });
    });
  });

  return rows;
};

/**
 * Columnas oficiales del layout CSV de Facturación Masiva CFDI 4.0 para Facturama.
 */
export const FACTURAMA_STANDARD_COLUMNS: {
  header: string;
  getValue: (row: FacturamaCsvRow) => string | number;
}[] = [
  { header: 'Id', getValue: (r) => r.invoiceGroupId },
  { header: 'Serie', getValue: (r) => r.serie },
  { header: 'Folio', getValue: (r) => r.folio },
  { header: 'FormaPago', getValue: (r) => r.formaPago },
  { header: 'MetodoPago', getValue: (r) => r.metodoPago },
  { header: 'Moneda', getValue: (r) => r.moneda },
  { header: 'TipoCambio', getValue: (r) => r.tipoCambio },
  { header: 'TipoDeComprobante', getValue: (r) => r.tipoDeComprobante },
  { header: 'Exportacion', getValue: (r) => r.exportacion },
  { header: 'LugarExpedicion', getValue: (r) => r.lugarExpedicion },
  { header: 'RfcReceptor', getValue: (r) => r.rfcReceptor },
  { header: 'NombreReceptor', getValue: (r) => r.nombreReceptor },
  { header: 'DomicilioFiscalReceptor', getValue: (r) => r.domicilioFiscalReceptor },
  { header: 'RegimenFiscalReceptor', getValue: (r) => r.regimenFiscalReceptor },
  { header: 'UsoCfdi', getValue: (r) => r.usoCfdi },
  { header: 'Email', getValue: (r) => r.emailReceptor },
  { header: 'ClaveProdServ', getValue: (r) => r.claveProdServ },
  { header: 'NoIdentificacion', getValue: (r) => r.noIdentificacion },
  { header: 'Cantidad', getValue: (r) => r.cantidad },
  { header: 'ClaveUnidad', getValue: (r) => r.claveUnidad },
  { header: 'Unidad', getValue: (r) => r.unidad },
  { header: 'Descripcion', getValue: (r) => r.descripcion },
  { header: 'ValorUnitario', getValue: (r) => r.valorUnitario.toFixed(4) },
  { header: 'Importe', getValue: (r) => r.importeConcepto.toFixed(2) },
  { header: 'Descuento', getValue: (r) => r.descuentoConcepto.toFixed(2) },
  { header: 'ObjetoImp', getValue: (r) => r.objetoImp },
  { header: 'BaseIva', getValue: (r) => r.baseIvaConcepto.toFixed(2) },
  { header: 'TasaIva', getValue: (r) => r.tasaIva },
  { header: 'ImporteIva', getValue: (r) => r.importeIvaConcepto.toFixed(2) },
  { header: 'Subtotal', getValue: (r) => r.subtotalFactura.toFixed(2) },
  { header: 'IVA', getValue: (r) => r.ivaFactura.toFixed(2) },
  { header: 'Total', getValue: (r) => r.totalFactura.toFixed(2) },
];

/**
 * Si el usuario carga una plantilla CSV descargada directamente de su cuenta de Facturama,
 * mapea inteligentemente cada columna de su plantilla al campo correspondiente del CFDI 4.0.
 */
const resolveCustomHeaderValue = (headerName: string, r: FacturamaCsvRow): string | number => {
  const norm = headerName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (norm === 'id' || norm === 'nofactura' || norm === 'factura' || norm === 'identificador') return r.invoiceGroupId;
  if (norm === 'renglon' || norm === 'partida' || norm === 'linea') return r.rowNumberInInvoice;
  if (norm === 'serie') return r.serie;
  if (norm === 'folio') return r.folio;
  if (norm === 'fecha' || norm === 'fechaemision') return r.fecha;
  if (norm.includes('formapago') || norm.includes('formadepago') || norm === 'paymentform') return r.formaPago;
  if (norm.includes('metodopago') || norm.includes('metododepago') || norm === 'paymentmethod') return r.metodoPago;
  if (norm === 'moneda' || norm === 'currency') return r.moneda;
  if (norm.includes('tipocambio') || norm === 'exchangerate') return r.tipoCambio;
  if (norm.includes('tipocomprobante') || norm.includes('tipodecomprobante') || norm === 'cfditype') return r.tipoDeComprobante;
  if (norm.includes('exportacion')) return r.exportacion;
  if (norm.includes('lugarexpedicion') || norm.includes('expeditionplace')) return r.lugarExpedicion;
  if (norm === 'rfc' || norm.includes('rfcreceptor') || norm.includes('receptorrfc')) return r.rfcReceptor;
  if (norm === 'nombre' || norm.includes('nombrereceptor') || norm.includes('receptornombre') || norm.includes('razonsocial')) return r.nombreReceptor;
  if (norm.includes('domiciliofiscal') || norm.includes('codigopostal') || norm === 'cp' || norm.includes('taxzipcode')) return r.domicilioFiscalReceptor;
  if (norm.includes('regimenfiscal') || norm.includes('fiscalregime')) return r.regimenFiscalReceptor;
  if (norm.includes('usocfdi') || norm.includes('cfdiuse')) return r.usoCfdi;
  if (norm.includes('email') || norm.includes('correo')) return r.emailReceptor;
  if (norm.includes('claveprodserv') || norm.includes('claveproducto') || norm.includes('productcode')) return r.claveProdServ;
  if (norm.includes('noidentificacion') || norm === 'sku' || norm === 'codigo' || norm.includes('identificationnumber')) return r.noIdentificacion;
  if (norm === 'cantidad' || norm === 'quantity') return r.cantidad;
  if (norm.includes('claveunidad') || norm.includes('unitcode')) return r.claveUnidad;
  if (norm === 'unidad' || norm === 'unit') return r.unidad;
  if (norm.includes('descripcion') || norm === 'concepto' || norm === 'description') return r.descripcion;
  if (norm.includes('valorunitario') || norm.includes('preciounitario') || norm.includes('unitprice')) return r.valorUnitario.toFixed(4);
  if (norm === 'importe' || norm === 'importeconcepto') return r.importeConcepto.toFixed(2);
  if (norm.includes('descuento')) return r.descuentoConcepto.toFixed(2);
  if (norm.includes('objetoimp') || norm.includes('taxobject')) return r.objetoImp;
  if (norm.includes('baseiva') || norm === 'base') return r.baseIvaConcepto.toFixed(2);
  if (norm.includes('tasaiva') || norm.includes('trasladoivatasa') || norm === 'tasaocuota') return r.tasaIva;
  if (norm === 'importeiva' || norm === 'ivatraslado') return r.importeIvaConcepto.toFixed(2);
  if (norm === 'subtotal') return r.subtotalFactura.toFixed(2);
  if (norm === 'iva' || norm === 'ivatotal') return r.ivaFactura.toFixed(2);
  if (norm === 'total' || norm === 'totalfactura') return r.totalFactura.toFixed(2);

  return '';
};

const escapeCsvCell = (value: string | number | null | undefined): string => {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const generateFacturamaCsvContent = (
  rows: FacturamaCsvRow[],
  customHeaders?: string[] | null
): string => {
  const headers =
    customHeaders && customHeaders.length > 0
      ? customHeaders
      : FACTURAMA_STANDARD_COLUMNS.map((c) => c.header);

  const headerLine = headers.map(escapeCsvCell).join(',');
  const bodyLines = rows.map((row) => {
    if (customHeaders && customHeaders.length > 0) {
      return customHeaders.map((h) => escapeCsvCell(resolveCustomHeaderValue(h, row))).join(',');
    }
    return FACTURAMA_STANDARD_COLUMNS.map((col) => escapeCsvCell(col.getValue(row))).join(',');
  });

  // Incluir BOM UTF-8 para que Excel y Facturama reconozcan acentos y eñes correctamente
  return '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
};

export const downloadFacturamaCsv = (csvContent: string, filename?: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', filename || `facturama_cfdi40_${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

