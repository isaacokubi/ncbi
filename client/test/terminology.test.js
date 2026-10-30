import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_TERMS, DEFAULT_SITE_CONTENT, EMPTY_STATES, MODULE_PRESENTATION, NAVIGATION_TERMS, ROLE_LABELS, ROLE_PRESENTATION, SUCCESS_MESSAGES } from '../src/content/terminology.js';

test('all governance roles have distinct professional dashboard copy', () => {
  const expectedRoles = ['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','treasurer','department_leader'];
  for (const role of expectedRoles) {
    assert.ok(ROLE_PRESENTATION[role]?.title, `Missing title for ${role}`);
    assert.ok(ROLE_PRESENTATION[role]?.heading, `Missing heading for ${role}`);
    assert.ok(ROLE_PRESENTATION[role]?.description, `Missing description for ${role}`);
    assert.ok(ROLE_LABELS[role], `Missing display label for ${role}`);
  }
});

test('priority workspaces expose purpose-specific labels, descriptions and empty states', () => {
  for (const key of ['members','visitors','attendance','departments','events','pastoral','finance','payments','accounts','journals','budgets','reconciliation','reports','documents','memberPortal']) {
    assert.ok(NAVIGATION_TERMS[key], `Missing navigation label for ${key}`);
    assert.ok(MODULE_PRESENTATION[key]?.title, `Missing page title for ${key}`);
  }
  for (const key of ['members','visitors','attendance','events','finance','budgets','documents']) assert.ok(EMPTY_STATES[key]);
  assert.ok(ACTION_TERMS.create.members.includes('Register'));
  assert.ok(ACTION_TERMS.save.finance.includes('Submit'));
  assert.match(SUCCESS_MESSAGES.payments, /only after provider verification/);
  assert.match(SUCCESS_MESSAGES.finance, /awaiting independent authorisation/);
});

test('public defaults cover each functioning public navigation destination without unsupported claims', () => {
  for (const page of ['home','about','mission','ministries','branches','programmes','news','contact']) {
    assert.ok(DEFAULT_SITE_CONTENT.pages[page], `Missing public page ${page}`);
  }
  assert.match(DEFAULT_SITE_CONTENT.pages.about.body, /local contexts/);
  assert.match(DEFAULT_SITE_CONTENT.pages.branches.empty, /directory is being updated/);
  assert.equal(DEFAULT_SITE_CONTENT.navigation.branches, 'Find a branch');
});
