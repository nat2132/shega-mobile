import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRICS_ENABLED_KEY = 'settings_biometrics_enabled';

export async function isBiometricsAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function getBiometricType(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris';
  }
  return 'Biometrics';
}

export async function authenticateWithBiometrics(
  promptMessage?: string
): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || 'Authenticate to access your account',
      fallbackLabel: 'Use PIN instead',
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function isBiometricsEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY);
  return val === 'true';
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, 'true');
  } else {
    await SecureStore.deleteItemAsync(BIOMETRICS_ENABLED_KEY);
  }
}
