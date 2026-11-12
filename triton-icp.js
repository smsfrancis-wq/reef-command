/* Reef Command extension: native Triton CSV import, 45-element support and streamlined flow metrics.
   Applies to Reef Command v2.2/v2.3; retains old readings and all non-Triton import behaviour. */
'use strict';
(function () {
  if (typeof TYPES === 'undefined' || typeof ICP_ALIASES === 'undefined' ||
      typeof parseLabCsv !== 'function' || typeof normalizeIcp !== 'function' ||
      typeof previewIcp !== 'function') {
    console.error('Triton ICP extension: Reef Command has not finished loading.');
    return;
  }

  // Retire only the redundant, generic Flow field. Existing records are NOT deleted.
  delete TYPES.flow;
  if (typeof CHART_AXES !== 'undefined') delete CHART_AXES.flow;

  // Triton includes these five elements, which were previously absent from the app.
  const extraElements = {
    caesium: ['Caesium', 'cs'],
    gallium: ['Gallium', 'ga'],
    indium: ['Indium', 'in'],
    scandium: ['Scandium', 'sc'],
    tellurium: ['Tellurium', 'te']
  };
  for (const [type, [label, symbol]] of Object.entries(extraElements)) {
    TYPES[type] = { label, unit: 'µg/L', min: null, max: null, step: '.001' };
    ICP_ALIASES[symbol] = type;
  }

  const oldParseLabCsv = parseLabCsv;
  const oldNormalizeIcp = normalizeIcp;
  const oldPreviewIcp = previewIcp;
  const oldShowIcpImport = showIcpImport;
  let autoReportReference = '';
  let autoProvider = '';

  function normHeader(str) {
    return String(str || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  // CSV parser supports commas/semicolons/tabs, quoted cells, UTF-8 BOM and CRLF.
  // The raw line data is never passed into innerHTML.
  function csvRows(text) {
    const input = String(text).replace(/^\uFEFF/, '');
    const first = input.split(/\r?\n/, 1)[0];
    const delimiter = first.includes('\t') ? '\t' : first.includes(';') ? ';' : ',';
    const records = [];
    let record = [], field = '', quoted = false;
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (c === '"') {
        if (quoted && input[i + 1] === '"') { field += '"'; i++; }
        else if (!quoted && field) throw Error('Unexpected quote in CSV.');
        else quoted = !quoted;
      } else if (!quoted && (c === delimiter || c === '\n' || c === '\r')) {
        record.push(field); field = '';
        if (c !== delimiter) {
          if (record.some(x => x.trim())) records.push(record);
          record = [];
          if (c === '\r' && input[i + 1] === '\n') i++;
        }
      } else field += c;
    }
    if (quoted) throw Error('Unclosed quoted field in CSV.');
    if (field || record.length) { record.push(field); if (record.some(x => x.trim())) records.push(record); }
    return records;
  }

  function findTritonHeader(records) {
    return records.findIndex(row => {
      const fields = row.map(normHeader);
      return ['element', 'name', 'analysis', 'setpoint', 'unit', 'warning_level', 'group']
        .every(name => fields.includes(name));
    });
  }

  function reportReferenceFromRows(records, headerIndex) {
    const found = [];
    const label = /^(?:report_?(?:reference|ref|id|code)|icp_?(?:reference|ref|id|code)|sample_?(?:reference|ref|id))$/;
    for (const row of records.slice(0, headerIndex)) {
      if (label.test(normHeader(row[0])) && row[1]?.trim()) found.push(row[1].trim());
    }
    const headers = records[headerIndex]?.map(normHeader) || [];
    const colIndex = headers.findIndex(h => label.test(h));
    if (colIndex >= 0) for (const row of records.slice(headerIndex + 1)) {
      if (row[colIndex]?.trim()) found.push(row[colIndex].trim());
    }
    const references = [...new Set(found)];
    if (references.length > 1) throw Error('CSV contains conflicting report reference codes.');
    return references[0] || '';
  }

  function refFromFileName(name) {
    const match = String(name || '').match(/\(([A-Za-z0-9][A-Za-z0-9._-]{2,119})\)\s*\.csv$/i);
    return match ? match[1] : '';
  }

  function inspectTriton(text, filename = '') {
    const rows = csvRows(text);
    const header = findTritonHeader(rows);
    if (header === -1) return null;
    const headers = rows[header].map(normHeader);
    const index = name => headers.indexOf(name);
    const reference = reportReferenceFromRows(rows, header) || refFromFileName(filename);
    const mapped = rows.slice(header + 1).map((row, i) => {
      if (row.length !== headers.length) throw Error('Triton CSV row ' + (header + i + 2) + ': unexpected number of columns.');
      const get = name => (row[index(name)] || '').trim();
      const code = get('element');
      if (!code) throw Error('Triton CSV row ' + (header + i + 2) + ': missing element.');
      const setpoint = get('setpoint');
      const range = setpoint.match(/^(\d+(?:\.\d+)?|\.\d+)\s*-\s*(\d+(?:\.\d+)?|\.\d+)$/);
      const unit = get('unit');
      const warning = get('warning_level');
      const group = get('group');
      const derivedPhosphate = code.toUpperCase() === 'PO4';
      const details = [
        group ? 'Triton group: ' + group : '',
        !range && setpoint ? 'Triton target: ' + setpoint + (setpoint.toUpperCase().includes('PSU') ? '' : ' ' + unit) : '',
        warning ? 'Triton warning: ' + warning : '',
        derivedPhosphate ? 'Phosphorus-derived phosphate equivalent; not an independent orthophosphate measurement' : '',
        get('analysis') === '.00' ? 'Lab reported zero; detection limit not specified' : ''
      ].filter(Boolean);
      return {
        parameter: derivedPhosphate ? 'total_phosphate' : code,
        value: get('analysis'), unit,
        reference_min: range ? range[1] : '',
        reference_max: range ? range[2] : '',
        warning_level: warning.toLowerCase(),
        notes: details.join(' | ')
      };
    });
    return { mapped, reference };
  }

  parseLabCsv = function (text) {
    const triton = inspectTriton(text);
    if (!triton) return oldParseLabCsv(text);
    // Do not silently misclassify an export as a different laboratory.
    const name = document.getElementById('icpProvider')?.value || '';
    if (!/^triton(?:\s|$)/i.test(name.trim())) throw Error('Native Triton export: select Triton as laboratory.');
    return triton.mapped;
  };

  normalizeIcp = function (rows, meta, existing) {
    const result = oldNormalizeIcp(rows, meta, existing);
    const warnings = new Map(rows.map(row => {
      const key = normHeader(row.parameter);
      const type = ICP_ALIASES[key] || key;
      return [type, row.warning_level];
    }));
    for (const record of result.additions) {
      const value = warnings.get(record.type);
      if (value === 'red' || value === 'yellow') record.labWarning = value;
    }
    return result;
  };

  async function fillTritonFields(file) {
    if (!file || !file.name.toLowerCase().endsWith('.csv') || file.size > 2 * 1024 * 1024) return;
    const text = await file.text();
    if (document.getElementById('icpFile')?.files?.[0] !== file) return;
    const triton = inspectTriton(text, file.name);
    if (!triton) return;
    const providerField = document.getElementById('icpProvider');
    const reportField = document.getElementById('icpReport');
    if (providerField && (!providerField.value.trim() || providerField.value === autoProvider)) {
      providerField.value = 'Triton';
      autoProvider = 'Triton';
    }
    if (reportField && triton.reference && (!reportField.value.trim() || reportField.value === autoReportReference)) {
      reportField.value = triton.reference;
      autoReportReference = triton.reference;
    }
    let hint = document.getElementById('tritonIcpHint');
    if (!hint && reportField) {
      hint = document.createElement('p');
      hint.id = 'tritonIcpHint'; hint.className = 'help';
      reportField.closest('.field')?.appendChild(hint);
    }
    if (hint) hint.textContent = triton.reference
      ? 'Report reference detected automatically: ' + triton.reference
      : 'No report reference found in CSV data or filename; enter it manually.';
  }

  showIcpImport = function () {
    oldShowIcpImport();
    const helper = document.querySelector('#modalHost .labModal .help');
    if (helper) helper.textContent = 'Import the original Triton CSV or the Reef Command template. All 45 Triton elements are supported. Sample collection date/time must be entered separately; the report date is not the sampling date. Phosphorus and its derived phosphate equivalent remain separate.';
  };

  previewIcp = async function () {
    const file = document.getElementById('icpFile')?.files?.[0];
    try { await fillTritonFields(file); }
    catch (err) {
      const out = document.getElementById('icpPreview');
      if (out) { out.textContent = 'Could not read Triton CSV: ' + err.message; }
      return;
    }
    await oldPreviewIcp();
    if (icpPreview?.reportId) {
      const p = document.getElementById('icpPreview')?.querySelector('p');
      if (p) p.textContent += ' · Report ' + icpPreview.reportId;
    }
  };

  document.addEventListener('change', event => {
    if (event.target?.id === 'icpFile') {
      const file = event.target.files?.[0];
      // Errors are surfaced on Preview, not by an unhandled promise rejection.
      fillTritonFields(file).catch(() => {});
    }
  });

  // App.js renders once before extensions run; rebuild parameter dropdowns now.
  if (typeof render === 'function') render();
})();
