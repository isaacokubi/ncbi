import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, csvDocument } from '../src/domain/reportCsv.js';
test('CSV quoting handles delimiters, quotes and newlines', () => {
  assert.equal(csvCell('Grace, "NCBI"'), '"Grace, ""NCBI"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
});
test('CSV quoting neutralises spreadsheet formulas', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-2+3', '@cmd', '  =HYPERLINK("x")']) assert.ok(csvCell(value).includes("'"));
});
test('CSV document produces stable headings and CRLF records', () => {
  assert.equal(csvDocument([['trend','2026-10','new_members','',3,'']]),
    'section,period,metric,dimension,value,currency\r\n"trend","2026-10","new_members","","3",""\r\n');
});
