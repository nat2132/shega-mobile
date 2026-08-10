// Save generated files (CSV exports, templates, DB backups) directly to the
// device's Downloads folder on Android instead of opening the share sheet.
// iOS has no public Downloads directory accessible from the app sandbox, so it
// falls back to the system share/"Save to Files" flow.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const { StorageAccessFramework } = FileSystem;

export interface SaveFileOptions {
  fileName: string;
  mimeType: string;
  contents?: string;
  /** Copy an existing file (e.g. the SQLite backup) instead of text contents. */
  copyFromUri?: string;
}

/**
 * Writes `contents` (or copies `copyFromUri`) to a download location.
 * On Android this prompts for a directory (defaulting to Downloads) via SAF and
 * creates the file there — a real download. On iOS/web it falls back to the
 * share sheet ("Save to Files"), which is the only user-visible save path.
 */
export async function saveFileToDownloads(options: SaveFileOptions): Promise<boolean> {
  const { fileName, mimeType, contents, copyFromUri } = options;

  if (Platform.OS === 'android') {
    try {
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) return false;
      const fileUri = await StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, mimeType);
      if (copyFromUri) {
        const base64 = await FileSystem.readAsStringAsync(copyFromUri, { encoding: FileSystem.EncodingType.Base64 });
        await StorageAccessFramework.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      } else if (contents != null) {
        await StorageAccessFramework.writeAsStringAsync(fileUri, contents, { encoding: FileSystem.EncodingType.UTF8 });
      }
      return true;
    } catch (e) {
      console.error('[SaveFile] Android SAF download failed:', e);
      return false;
    }
  }

  // iOS / web fallback: stage the file then open the share sheet.
  try {
    const tmp = `${FileSystem.cacheDirectory}${fileName}`;
    if (copyFromUri) {
      await FileSystem.copyAsync({ from: copyFromUri, to: tmp });
    } else if (contents != null) {
      await FileSystem.writeAsStringAsync(tmp, contents, { encoding: FileSystem.EncodingType.UTF8 });
    }
    await Sharing.shareAsync(tmp, { mimeType, dialogTitle: fileName });
    return true;
  } catch (e) {
    console.error('[SaveFile] iOS/web save failed:', e);
    return false;
  }
}