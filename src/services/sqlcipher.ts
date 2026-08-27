import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

const MASTER_KEY_KEY = 'shega_master_key';
const DB_NAME = 'shegabe.db';
const DEMO_DB_NAME = 'shega_demo.db';

let masterKey: Uint8Array | null = null;
let keyDerived = false;
let db: SQLite.SQLiteDatabase | null = null;
let demoDb: SQLite.SQLiteDatabase | null = null;
let currentDb: SQLite.SQLiteDatabase | null = null;
let dbReady = false;
let isDemoMode = false;

const IV_SIZE = 12;
const KEY_SIZE = 32;
const AUTH_TAG_SIZE = 16;

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
  const keyBytes = new Uint8Array(32);
  Crypto.getRandomValues(keyBytes);
  masterKey = keyBytes;
  keyDerived = true;

  // Store in SecureStore
  await storeMasterKey(masterKey);

  return masterKey;
}

async function storeMasterKey(key: Uint8Array): Promise<void> {
  try {
    const base64 = btoa(String.fromCharCode(...key));
    await SecureStore.setItemAsync(MASTER_KEY_KEY, base64);
  } catch (e) {
    console.error('[Crypto] Failed to store master key:', e);
  }
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
// Application-Level Field Encryption
// ============================================

const IV_SIZE = 12;
const TAG_SIZE = 16;

async function encryptAesGcm(plaintext: string, key: Uint8Array): Promise<{ encrypted: string; iv: string; tag: string }> {
  const iv = new Uint8Array(12);
  Crypto.getRandomValues(iv);
  
  // Use Web Crypto API style encryption
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Use expo-crypto for encryption
  // Note: expo-crypto doesn't have direct AES-GCM, so we use a workaround
  // In production, you'd use a native module like react-native-aes-gcm
  
  // For now, use a simple XOR-based encryption as placeholder
  // TODO: Replace with proper AES-GCM via native module
  const keyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    Array.from(masterKey || new Uint8Array(32)).map(b => String.fromCharCode(b)).join('')
  );
  
  const encoder2 = new TextEncoder();
  const data = encoder2.encode(plaintext);
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(keyHash.slice(i * 2, i * 2 + 2), 16);
  }
  
  // Simple XOR encryption (NOT secure - replace with proper AES-GCM)
  const iv = new Uint8Array(12);
  Crypto.getRandomValues(iv);
  const encrypted = new Uint8Array(plaintext.length);
  for (let i = 0; i < plaintext.length; i++) {
    encrypted[i] = plaintext.charCodeAt(i) ^ keyBytes[i % 32] ^ iv[i % 12];
  }
  
  return {
    encrypted: btoa(String.fromCharCode(...encrypted)),
    iv: btoa(String.fromCharCode(...iv)),
    tag: '', // Placeholder
  };
}

export function encryptField(plaintext: string): { encrypted: string; iv: string; tag: string } {
  // Synchronous wrapper - in practice use async version
  const iv = new Uint8Array(12);
  Crypto.getRandomValues(iv);
  
  // Placeholder implementation - replace with proper crypto
  const encrypted = btoa(plaintext); // Placeholder
  return {
    encrypted,
    iv: btoa(String.fromCharCode(...Array.from({ length: 12 }, () => Math.floor(Math.random() * 256)))),
    tag: '',
  };
}

export function decryptField(encrypted: string, iv: string): string {
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
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pinWithSalt
  );
  
  return `${salt}:${hash}`;
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const [salt, expectedHash] = hash.split(':');
  const pinWithSalt = pin + salt;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pinWithSalt
  );
  return hash === expectedHash;
}

export async function changePin(oldPin: string, newPin: string): Promise<{ hash: string; encrypted: any }> {
  // This would verify old PIN against stored hash
  // For now, just return new hash
  const hash = await hashPin(newPin);
  const encrypted = encryptField(newPin);
  return { hash, encrypted };
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