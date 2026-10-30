import test from 'node:test';
import assert from 'node:assert/strict';
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
test('CSV quoting handles delimiters, quotes and newlines', () => {
  assert.equal(csvCell('Grace, "NCBI"'), '"Grace, ""NCBI"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
});
test('CSV quoting neutralises spreadsheet formulas', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-2+3', '@cmd', '  =HYPERLINK("x")']) assert.ok(csvCell(value).startsWith('"\\''));
});
