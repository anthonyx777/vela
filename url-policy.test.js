'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isAllowedNavigationUrl,
  resolveAddressInput
} = require('../src/main/url-policy');

test('accepts secure and ordinary web URLs', () => {
  assert.equal(isAllowedNavigationUrl('https://example.com/'), true);
  assert.equal(isAllowedNavigationUrl('http://localhost:3000/'), true);
});

test('rejects dangerous schemes and credentials', () => {
  assert.equal(isAllowedNavigationUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedNavigationUrl('file:///etc/passwd'), false);
  assert.equal(isAllowedNavigationUrl('data:text/html,hello'), false);
  assert.equal(isAllowedNavigationUrl('https://user:pass@example.com'), false);
});

test('adds HTTPS to a hostname and supports local development ports', () => {
  assert.equal(resolveAddressInput('example.com'), 'https://example.com/');
  assert.equal(resolveAddressInput('localhost:3000'), 'https://localhost:3000/');
});

test('converts words into a DuckDuckGo search', () => {
  assert.equal(
    resolveAddressInput('navegador seguro'),
    'https://duckduckgo.com/?q=navegador%20seguro'
  );
});

test('rejects an explicitly dangerous scheme', () => {
  assert.throws(() => resolveAddressInput('javascript:alert(1)'), /somente endereços HTTP ou HTTPS/);
  assert.throws(() => resolveAddressInput('file:///C:/Windows/win.ini'), /somente endereços HTTP ou HTTPS/);
});

test('rejects an empty address', () => {
  assert.throws(() => resolveAddressInput('   '), /Digite um endereço/);
});
