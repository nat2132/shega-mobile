import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PIN_HASH_KEY = 'settings_pin_hash';
const PIN_SALT_KEY = 'settings_pin_salt';
const PIN_FLAG_KEY = 'settings_pin';

async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + pin
  );
  return digest;
}

export async function storePinHash(pin: string): Promise<void> {
  const salt = await generateSalt();
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
}

export async function verifyPinHash(pin: string): Promise<boolean> {
  try {
    const salt = await SecureStore.getItemAsync(PIN_SALT_KEY);
    const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);

    if (salt && storedHash) {
      const computedHash = await hashPin(pin, salt);
      return computedHash === storedHash;
    }

    // Backward compatibility: pre-hash PIN stored as plain text
    const plainPin = await SecureStore.getItemAsync(PIN_FLAG_KEY);
    if (plainPin && plainPin.length >= 4 && plainPin.length <= 6 && /^\d{4,6}$/.test(plainPin) && plainPin === pin) {
      await storePinHash(pin);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/** True when a modern salted PIN hash (salt + hash) exists in SecureStore. */
export async function hasHashedPin(): Promise<boolean> {
  const [salt, hash] = await Promise.all([
    SecureStore.getItemAsync(PIN_SALT_KEY),
    SecureStore.getItemAsync(PIN_HASH_KEY),
  ]);
  return !!salt && !!hash;
}

export async function hasPinHash(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(PIN_FLAG_KEY);
  return flag === 'set';
}

export async function removePinHash(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_FLAG_KEY);
}
