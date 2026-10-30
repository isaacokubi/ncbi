export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formulas before quoting the CSV field.
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function csvDocument(rows) {
  return ['section,period,metric,dimension,value,currency', ...rows.map(row => row.map(csvCell).join(','))].join('\r\n') + '\r\n';
}
