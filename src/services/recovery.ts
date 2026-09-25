import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getDB } from '../database/db';
import { notifyLocalDataChanged } from './syncService';

const RECOVERY_HASH_KEY = 'settings_recovery_hash';
const RECOVERY_SALT_KEY = 'settings_recovery_salt';

async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

export function formatRecoveryCode(raw: string): string {
  const norm = normalizeRecoveryCode(raw);
  const groups = norm.match(/.{1,4}/g) || [];
  return groups.slice(0, 3).join('-');
}

export async function generateRecoveryCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(6);
  const hex = bytesToHex(bytes);
  return formatRecoveryCode(hex);
}

export async function hashRecoveryCode(code: string, salt: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code);
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + normalized
  );
}

export async function storeRecoveryCodeHash(code: string, userId?: string): Promise<void> {
  const salt = await generateSalt();
  const hash = await hashRecoveryCode(code, salt);
  if (userId) {
    try {
      const db = getDB();
      db.runSync(
        'UPDATE users SET recovery_hash = ?, recovery_salt = ?, updated_at = ? WHERE id = ?',
        [hash, salt, new Date().toISOString(), userId]
      );
      notifyLocalDataChanged();
    } catch {}
    await SecureStore.setItemAsync(`${RECOVERY_SALT_KEY}_${userId}`, salt).catch(() => {});
    await SecureStore.setItemAsync(`${RECOVERY_HASH_KEY}_${userId}`, hash).catch(() => {});
  }
  await SecureStore.setItemAsync(RECOVERY_SALT_KEY, salt).catch(() => {});
  await SecureStore.setItemAsync(RECOVERY_HASH_KEY, hash).catch(() => {});
}

export async function verifyRecoveryCode(code: string, userId?: string): Promise<boolean> {
  try {
    const norm = normalizeRecoveryCode(code);
    if (!norm) return false;

    if (userId) {
      try {
        const db = getDB();
        const row = db.getFirstSync(
          'SELECT recovery_hash, recovery_salt FROM users WHERE id = ?',
          [userId]
        ) as any;
        if (row?.recovery_hash && row?.recovery_salt) {
          const computedHash = await hashRecoveryCode(norm, row.recovery_salt);
          if (computedHash === row.recovery_hash) return true;
        }
      } catch {}

      const saltUser = await SecureStore.getItemAsync(`${RECOVERY_SALT_KEY}_${userId}`);
      const storedHashUser = await SecureStore.getItemAsync(`${RECOVERY_HASH_KEY}_${userId}`);
      if (saltUser && storedHashUser) {
        const computedHash = await hashRecoveryCode(norm, saltUser);
        if (computedHash === storedHashUser) return true;
      }
    }

    const salt = await SecureStore.getItemAsync(RECOVERY_SALT_KEY);
    const storedHash = await SecureStore.getItemAsync(RECOVERY_HASH_KEY);
    if (!salt || !storedHash) return false;
    const computedHash = await hashRecoveryCode(norm, salt);
    return computedHash === storedHash;
  } catch {
    return false;
  }
}

export async function hasRecoveryCode(userId?: string): Promise<boolean> {
  try {
    if (userId) {
      const db = getDB();
      const row = db.getFirstSync(
        'SELECT recovery_hash FROM users WHERE id = ?',
        [userId]
      ) as any;
      if (row?.recovery_hash) return true;
      const userStoreHash = await SecureStore.getItemAsync(`${RECOVERY_HASH_KEY}_${userId}`);
      if (userStoreHash) return true;
    }
    return !!(await SecureStore.getItemAsync(RECOVERY_HASH_KEY));
  } catch {
    return false;
  }
}

export async function removeRecoveryCode(userId?: string): Promise<void> {
  if (userId) {
    try {
      const db = getDB();
      db.runSync(
        'UPDATE users SET recovery_hash = NULL, recovery_salt = NULL, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), userId]
      );
      notifyLocalDataChanged();
    } catch {}
    await SecureStore.deleteItemAsync(`${RECOVERY_SALT_KEY}_${userId}`).catch(() => {});
    await SecureStore.deleteItemAsync(`${RECOVERY_HASH_KEY}_${userId}`).catch(() => {});
  }
  await SecureStore.deleteItemAsync(RECOVERY_SALT_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(RECOVERY_HASH_KEY).catch(() => {});
}
