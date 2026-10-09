const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const source = fs.readFileSync('lib/server/stripeConnectState.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exportsObject = {};
new Function('exports', compiled)(exportsObject);
const { stripeConnectState } = exportsObject;
const bank = { object: 'bank_account', currency: 'mxn', bank_name: 'Banco', last4: '1234' };
const legacy = { details_submitted: true, payouts_enabled: true, charges_enabled: false, capabilities: { transfers: 'active' }, external_accounts: { data: [bank] } };
const recipient = (transfers = 'active', payouts = 'active') => ({ configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: transfers }, payouts: { status: payouts } } } } }, requirements: { entries: [] } });
test('recipient can withdraw without seller card charges', () => {
  const state = stripeConnectState(legacy, recipient());
  assert.equal(state.onboarding_status, 'complete');
  assert.equal(state.payouts_enabled, true);
  assert.equal(state.charges_enabled, false);
  assert.equal(state.bank_last4, '1234');
});
test('pending or restricted transfers block withdrawals', () => {
  for (const status of ['pending', 'restricted', 'unsupported', 'rejected']) assert.equal(stripeConnectState(legacy, recipient(status)).payouts_enabled, false);
});
test('restricted payouts and closed accounts block withdrawals', () => {
  assert.equal(stripeConnectState(legacy, recipient('active', 'restricted')).payouts_enabled, false);
  assert.equal(stripeConnectState(legacy, { ...recipient(), closed: true }).payouts_enabled, false);
});
test('missing bank or unfinished details do not complete onboarding', () => {
  assert.equal(stripeConnectState({ ...legacy, external_accounts: { data: [] } }, recipient()).payouts_enabled, false);
  assert.equal(stripeConnectState({ ...legacy, details_submitted: false }, recipient()).onboarding_status, 'pending');
});
test('v1 accounts remain supported and refreshed bank removal blocks withdrawal', () => {
  assert.equal(stripeConnectState(legacy).onboarding_status, 'complete');
  assert.equal(stripeConnectState({ ...legacy, external_accounts: { data: [] } }).bank_account_linked, false);
});
test('only due requirements requiring user action are displayed', () => {
  const account = recipient();
  account.requirements.entries = [
    { description: 'identity', awaiting_action_from: 'user', minimum_deadline: { status: 'currently_due' } },
    { description: 'verification', awaiting_action_from: 'stripe', minimum_deadline: { status: 'past_due' } },
    { description: 'future', awaiting_action_from: 'user', minimum_deadline: { status: 'eventually_due' } },
  ];
  assert.deepEqual(stripeConnectState(legacy, account).requirements_due, ['identity']);
});
test('missing v2 includes fail instead of overwriting account state', () => {
  assert.throws(() => stripeConnectState(legacy, { configuration: null }), /capacidades/);
});
