'use strict';

const SEARCH_URL = 'https://duckduckgo.com/?q=';

function isAllowedNavigationUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

/**
 * Turns address-bar input into a safe HTTP(S) URL or a DuckDuckGo search.
 * Explicit unsupported schemes are rejected rather than searched.
 */
function resolveAddressInput(input) {
  const value = String(input ?? '').trim();
  if (!value) throw new Error('Digite um endereço ou termo para pesquisar.');

  // Explicit schemes must be HTTP(S). This rejects javascript:, file:, data:, etc.
  if (/^[a-z][a-z\d+.-]*:(?!\d)(?=\/\/|[^\s])/i.test(value)) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error('Endereço inválido.');
    }
    if (!isAllowedNavigationUrl(parsed.href)) {
      throw new Error('Por segurança, o VELA aceita somente endereços HTTP ou HTTPS.');
    }
    return parsed.href;
  }

  // Text with spaces is treated as a search query, not a hostname.
  if (/\s/.test(value)) {
    return `${SEARCH_URL}${encodeURIComponent(value)}`;
  }

  try {
    const candidate = new URL(`https://${value}`);
    const host = candidate.hostname;
    const looksLikeHost =
      host.includes('.') ||
      host === 'localhost' ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
      (host.startsWith('[') && host.endsWith(']'));

    if (looksLikeHost && isAllowedNavigationUrl(candidate.href)) {
      return candidate.href;
    }
  } catch {
    // Fall through to search for ordinary text such as "C++".
  }

  return `${SEARCH_URL}${encodeURIComponent(value)}`;
}

module.exports = {
  SEARCH_URL,
  isAllowedNavigationUrl,
  resolveAddressInput
};
