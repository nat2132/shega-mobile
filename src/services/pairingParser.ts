/**
 * pairingParser — robust parser for Shega pairing QR codes, URIs, and manual codes.
 *
 * Supports Desktop & Mobile pairing formats:
 * - Desktop QR: shega://pair?host=http%3A%2F%2F192.168.1.100%3A5757&token=TOKEN
 * - Mobile QR:  shega://pair?url=http%3A%2F%2F192.168.1.100%3A5759&token=TOKEN
 * - Cloud QR:   shega://join?b=BIZ&c=CODE
 * - JSON:       {"host":"...", "token":"..."} or {"url":"...", "pairingToken":"..."}
 * - Raw URL:    http://192.168.1.100:5757
 * - Raw Code:   ABCDEF or ABCDEF-GHIJ-KLMN
 */

export interface ParsedPairingResult {
  valid: boolean;
  type: 'hub' | 'invite' | 'code';
  url?: string;
  token?: string;
  code?: string;
  businessId?: string;
  raw: string;
}

export function parsePairingData(input: string): ParsedPairingResult {
  const raw = (input || '').trim();
  if (!raw) {
    return { valid: false, type: 'code', raw };
  }

  // 1. Check for JSON format
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      const url = parsed.url || parsed.host || parsed.lanUrl || parsed.ip;
      const token = parsed.token || parsed.pairingToken || parsed.code || parsed.t;
      if (url || token) {
        let normalizedUrl = url ? String(url).trim() : undefined;
        if (normalizedUrl && !/^https?:\/\//i.test(normalizedUrl)) {
          normalizedUrl = `http://${normalizedUrl}`;
        }
        return {
          valid: true,
          type: normalizedUrl ? 'hub' : 'code',
          url: normalizedUrl,
          token: token ? String(token).trim().toUpperCase() : undefined,
          code: token ? String(token).trim().toUpperCase() : undefined,
          raw,
        };
      }
    } catch {
      /* ignore JSON parse error */
    }
  }

  // 2. Check for URL / URI Scheme format
  if (/^(shega|shega-pos):\/\//i.test(raw) || /^https?:\/\//i.test(raw)) {
    try {
      const queryString = raw.includes('?') ? raw.split('?')[1] : '';
      const params = new URLSearchParams(queryString);

      const hostParam = params.get('host') || params.get('url') || params.get('lanUrl') || params.get('ip') || params.get('h');
      const tokenParam = params.get('token') || params.get('pairingToken') || params.get('t') || params.get('code') || params.get('c');
      const bizParam = params.get('b') || params.get('businessId');

      let url: string | undefined = hostParam ? decodeURIComponent(hostParam).trim() : undefined;
      let token: string | undefined = tokenParam ? decodeURIComponent(tokenParam).trim() : undefined;

      if (url && !/^https?:\/\//i.test(url)) {
        url = `http://${url}`;
      }

      if (url || token) {
        return {
          valid: true,
          type: url ? 'hub' : 'code',
          url,
          token: token ? token.toUpperCase() : undefined,
          code: token ? token.toUpperCase() : undefined,
          businessId: bizParam ? decodeURIComponent(bizParam) : undefined,
          raw,
        };
      }
    } catch {
      /* ignore URL parse error */
    }
  }

  // 3. Regex fallback for non-standard URI strings like shega://pair?host=...&token=...
  const hostMatch = /(?:host|url|lanUrl|ip)=([^&]+)/i.exec(raw);
  const tokenMatch = /(?:token|pairingToken|code|t|c)=([^&]+)/i.exec(raw);
  const bizMatch = /(?:b|businessId)=([^&]+)/i.exec(raw);

  if (hostMatch || tokenMatch) {
    let url = hostMatch ? decodeURIComponent(hostMatch[1]).trim() : undefined;
    let token = tokenMatch ? decodeURIComponent(tokenMatch[1]).trim() : undefined;

    if (url && !/^https?:\/\//i.test(url)) {
      url = `http://${url}`;
    }

    return {
      valid: true,
      type: url ? 'hub' : 'code',
      url,
      token: token ? token.toUpperCase() : undefined,
      code: token ? token.toUpperCase() : undefined,
      businessId: bizMatch ? decodeURIComponent(bizMatch[1]) : undefined,
      raw,
    };
  }

  // 4. Raw HTTP URL check
  if (/^(http:\/\/|https:\/\/)[^\s]+$/i.test(raw)) {
    return {
      valid: true,
      type: 'hub',
      url: raw,
      raw,
    };
  }

  // 5. Raw Pairing Code / Token check
  const cleanCode = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (cleanCode.length >= 4) {
    return {
      valid: true,
      type: 'code',
      code: cleanCode,
      token: cleanCode,
      raw,
    };
  }

  return { valid: false, type: 'code', raw };
}
