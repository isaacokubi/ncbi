import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_TERMS, DEFAULT_SITE_CONTENT, mergeSiteContent, EMPTY_STATES, MODULE_PRESENTATION, NAVIGATION_TERMS, ROLE_LABELS, ROLE_PRESENTATION, SUCCESS_MESSAGES } from '../src/content/terminology.js';

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
  assert.match(DEFAULT_SITE_CONTENT.pages.about.body, /commitment to faith in Jesus Christ/);
  assert.match(DEFAULT_SITE_CONTENT.pages.branches.empty, /public branch directory is currently being updated/);
  assert.equal(DEFAULT_SITE_CONTENT.navigation.branches, 'Our branches');
  assert.ok(DEFAULT_SITE_CONTENT.pages.mission.cards.length >= 4);
  assert.match(DEFAULT_SITE_CONTENT.pages.programmes.subtitle, /conferences/);
  assert.match(DEFAULT_SITE_CONTENT.pages.news.subtitle, /official church announcements/);
});


test('legacy public starter copy is upgraded while editor customisations are preserved', () => {
  const migrated = mergeSiteContent({
    navigation: { branches: 'Find a branch' },
    pages: {
      about: { body: 'New Church Believers International is a Christian church community with congregations serving in their local contexts. NCBI brings people together for worship, fellowship, biblical learning and practical service. Our shared identity is expressed in the call to serve God and care for our neighbours.' },
      contact: { body: 'A custom contact message approved by NCBI.' }
    }
  });
  assert.match(migrated.pages.about.body, /commitment to faith in Jesus Christ/);
  assert.equal(migrated.pages.contact.body, 'A custom contact message approved by NCBI.');
  assert.equal(migrated.navigation.branches, 'Our branches');
});
