import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlatformWideOrganisationRole } from './organisationScopePolicy.js';

test('only platform administrators receive platform-wide organisation scope', () => {
  assert.equal(isPlatformWideOrganisationRole('super_admin'), true);
  assert.equal(isPlatformWideOrganisationRole('international_executive'), false);
  assert.equal(isPlatformWideOrganisationRole('national_admin'), false);
  assert.equal(isPlatformWideOrganisationRole('regional_overseer'), false);
  assert.equal(isPlatformWideOrganisationRole('district_pastor'), false);
  assert.equal(isPlatformWideOrganisationRole('branch_pastor'), false);
});
