import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRecords } from '../src/workflows/classify-records';

test('the same workflow handles procurement, support and finance without sector branches', () => {
  for (const term of ['licitación', 'reclamo', 'factura']) {
    const result = classifyRecords({ records: [{ id: '1', text: `Revisar ${term}` }], rules: [{ label: 'revisar', contains: [term] }] });
    assert.equal(result.results[0].status, 'classified');
    assert.equal(result.savings, null);
  }
});
test('conflicting and missing rules remain visible rather than guessing a category', () => {
  const result = classifyRecords({ records: [{ id: '1', text: 'factura urgente' }, { id: '2', text: 'hola' }],
    rules: [{ label: 'finanzas', contains: ['factura'] }, { label: 'prioridad', contains: ['urgente'] }] });
  assert.equal(result.results[0].status, 'ambiguous');
  assert.equal(result.results[1].status, 'needs-review');
});
