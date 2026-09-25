import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';

/**
 * Shared photo/camera permission helper for the inventory image flows.
 *
 * `request*PermissionsAsync()` resolves immediately with `granted: false` when a
 * previous prompt was dismissed, so a single call would treat "dismissed by
 * accident" as a permanent refusal. This helper asks once more, and reports
 * whether the OS is still willing to show its dialog so callers can either
 * re-ask the user or send them to the app's Settings.
 */
export type ImagePermissionKind = 'camera' | 'library';

export interface ImagePermissionResult {
  granted: boolean;
  /** False when the OS will no longer show its prompt — the user must use Settings. */
  canAskAgain: boolean;
}

export async function requestImagePermission(kind: ImagePermissionKind): Promise<ImagePermissionResult> {
  const request =
    kind === 'camera'
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;

  let perm = await request();
  if (!perm.granted && perm.canAskAgain) {
    // Retry once before treating it as a refusal.
    perm = await request();
  }
  return { granted: perm.granted, canAskAgain: perm.canAskAgain };
}

/** Send the user to the OS settings page so they can re-enable the permission. */
export function openAppSettings(): void {
  Linking.openSettings().catch(() => {});
}
