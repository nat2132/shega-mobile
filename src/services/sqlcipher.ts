import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const MASTER_KEY_KEY = 'shega_master_key';

let masterKey: Uint8Array | null = null;
let keyDerived = false;

const IV_SIZE = 12;
const KEY_SIZE = 32;

export async function initializeCrypto(pin?: string): Promise<Uint8Array> {
  if (masterKey && keyDerived) return masterKey;

  // Try to load existing master key from SecureStore
  try {
    const storedKey = await SecureStore.getItemAsync(MASTER_KEY_KEY);
    if (storedKey) {
      masterKey = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
      keyDerived = true;
      return masterKey;
    }
  } catch (e) {
    console.warn('[Crypto] Failed to load master key:', e);
  }

  // Generate new master key
  const keyBytes = new Uint8Array(KEY_SIZE);
  Crypto.getRandomValues(keyBytes);
  masterKey = keyBytes;
  keyDerived = true;

  // Store in SecureStore
  try {
    await SecureStore.setItemAsync(MASTER_KEY_KEY, btoa(String.fromCharCode(...keyBytes)));
  } catch (e) {
    console.warn('[Crypto] Failed to store master key:', e);
  }

  return masterKey;
}

export function getMasterKey(): Uint8Array | null {
  return masterKey;
}

export function isKeyDerived(): boolean {
  return keyDerived;
}

export function clearMasterKey(): void {
  masterKey = null;
  keyDerived = false;
  SecureStore.deleteItemAsync(MASTER_KEY_KEY);
}

// ============================================
// Application-Level Field Encryption (Placeholder)
// ============================================

export function encryptField(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const iv = new Uint8Array(IV_SIZE);
  Crypto.getRandomValues(iv);
  
  // Placeholder XOR encryption - replace with proper AES-GCM via native module
  const encrypted = btoa(plaintext);
  return {
    encrypted,
    iv: btoa(String.fromCharCode(...Array.from(iv))),
    tag: '',
  };
}

export function decryptField(encrypted: string, _iv: string): string {
  // Placeholder implementation
  return atob(encrypted);
}

// Higher-level helpers for common sensitive fields
export const sensitiveFields = {
  pin: {
    encrypt: (pin: string) => encryptField(pin),
    decrypt: (data: { encrypted: string; iv: string; tag: string }) => decryptField(data.encrypted, data.iv),
  },
  pinHash: {
    encrypt: (hash: string) => encryptField(hash),
    decrypt: (data: { encrypted: string; iv: string; tag: string }) => decryptField(data.encrypted, data.iv),
  },
  recoveryKey: {
    encrypt: (key: string) => encryptField(key),
    decrypt: (data: { encrypted: string; iv: string; tag: string }) => decryptField(data.encrypted, data.iv),
  },
  apiKey: {
    encrypt: (key: string) => encryptField(key),
    decrypt: (data: { encrypted: string; iv: string; tag: string }) => decryptField(data.encrypted, data.iv),
  },
  token: {
    encrypt: (token: string) => encryptField(token),
    decrypt: (data: { encrypted: string; iv: string; tag: string }) => decryptField(data.encrypted, data.iv),
  },
};

// PIN hashing using SHA-256 + salt
export async function hashPin(pin: string): Promise<string> {
  const saltArray = new Uint8Array(16);
  Crypto.getRandomValues(saltArray);
  const salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const pinWithSalt = pin + salt;
  const pinHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pinWithSalt
  );
  
  return `${salt}:${pinHash}`;
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const [salt, expectedHash] = storedHash.split(':');
  const pinWithSalt = pin + salt;
  const computedHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pinWithSalt
  );
  return computedHash === expectedHash;
}

export async function changePin(oldPin: string, newPin: string): Promise<{ hash: string; encrypted: any }> {
  const newHash = await hashPin(newPin);
  const encrypted = encryptField(newPin);
  return { hash: newHash, encrypted };
}

export default {
  initializeCrypto,
  getMasterKey,
  isKeyDerived,
  clearMasterKey,
  encryptField,
  decryptField,
  sensitiveFields,
  hashPin,
  verifyPin,
  changePin,
};
