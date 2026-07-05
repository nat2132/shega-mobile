import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const RECOVERY_HASH_KEY = 'settings_recovery_hash';
const RECOVERY_SALT_KEY = 'settings_recovery_salt';

async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function formatRecoveryCode(hex: string): string {
  const groups = hex.match(/.{1,4}/g) || [];
  return groups.slice(0, 3).join('-');
}

export async function generateRecoveryCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(6);
  const hex = bytesToHex(bytes);
  return formatRecoveryCode(hex);
}

async function hashRecoveryCode(code: string, salt: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + code
  );
}

export async function storeRecoveryCodeHash(code: string): Promise<void> {
  const salt = await generateSalt();
  const hash = await hashRecoveryCode(code, salt);
  await SecureStore.setItemAsync(RECOVERY_SALT_KEY, salt);
  await SecureStore.setItemAsync(RECOVERY_HASH_KEY, hash);
}

export async function verifyRecoveryCode(code: string): Promise<boolean> {
  try {
    const salt = await SecureStore.getItemAsync(RECOVERY_SALT_KEY);
    const storedHash = await SecureStore.getItemAsync(RECOVERY_HASH_KEY);
    if (!salt || !storedHash) return false;
    const normalized = code.replace(/-/g, '').toUpperCase();
    const formatted = formatRecoveryCode(normalized);
    const computedHash = await hashRecoveryCode(formatted, salt);
    return computedHash === storedHash;
  } catch {
    return false;
  }
}

export async function hasRecoveryCode(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(RECOVERY_HASH_KEY));
}

export async function removeRecoveryCode(): Promise<void> {
  await SecureStore.deleteItemAsync(RECOVERY_SALT_KEY);
  await SecureStore.deleteItemAsync(RECOVERY_HASH_KEY);
}
