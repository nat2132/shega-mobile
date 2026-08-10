import {
  File as ExpoFile,
  Paths,
} from 'expo-file-system';
import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import { assertInternetConnection } from './connectivity';

const LOG_TAG = '[UpdateService]';

export interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  prerelease: boolean;
  assets: GitHubAsset[];
}

export interface CachedRelease {
  release: GitHubRelease;
  fetchedAt: number;
}

export interface DownloadProgress {
  bytesWritten: number;
  totalBytes: number;
  percentage: number;
  speed: number;
  remainingMs: number;
}

const CACHE_KEY = 'update_cache';
const SKIPPED_KEY = 'update_skipped';
const REMIND_LATER_KEY = 'update_remind_later';
const LAST_CHECK_KEY = 'update_last_check';

function log(...args: unknown[]) {
  console.log(LOG_TAG, ...args);
}

function getExtra(): { githubOwner: string; githubRepo: string; includePrereleases: boolean; githubToken: string } {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const update = extra?.update as Record<string, unknown> | undefined;
  return {
    githubOwner: (update?.githubOwner as string) ?? 'nat2132',
    githubRepo: (update?.githubRepo as string) ?? 'shega-mobile',
    includePrereleases: (update?.includePrereleases as boolean) ?? false,
    githubToken: (update?.githubToken as string) ?? '',
  };
}

function parseVersion(tag: string): number[] {
  return tag.replace(/^v/i, '').split('.').map(Number);
}

export function compareVersions(current: string, latest: string): number {
  const a = parseVersion(current);
  const b = parseVersion(latest);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const an = a[i] ?? 0;
    const bn = b[i] ?? 0;
    if (an > bn) return 1;
    if (an < bn) return -1;
  }
  return 0;
}

export async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  const { githubOwner, githubRepo, githubToken } = getExtra();
  const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/latest`;
  log('Fetching latest release from', url);

  await assertInternetConnection();

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Shega-App',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      log('GitHub API responded with', response.status);
      if (response.status === 403) throw new Error('GitHub API rate limit exceeded. Try again later.');
      if (response.status === 404) throw new Error('No releases found for this repository.');
      throw new Error(`GitHub API error: ${response.status}`);
    }
    const data: GitHubRelease = await response.json();
    log('Release found:', data.tag_name, data.published_at);
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('Failed to fetch release:', msg);
    throw err;
  }
}

export function findApkAsset(release: GitHubRelease): GitHubAsset | null {
  const apk = release.assets.find(
    a => a.name.endsWith('.apk') && a.content_type === 'application/vnd.android.package-archive'
  );
  if (apk) return apk;
  const fallback = release.assets.find(a => a.name.endsWith('.apk'));
  return fallback ?? null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatRemaining(ms: number): string {
  if (ms < 0 || !isFinite(ms)) return '--';
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

export async function downloadApk(
  asset: GitHubAsset,
  onProgress: (progress: DownloadProgress) => void
): Promise<string> {
  const dest = new ExpoFile(Paths.cache, asset.name);
  log('Downloading to:', dest.uri);

  await assertInternetConnection();

  const headers: Record<string, string> = {};
  const { githubToken } = getExtra();
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const task = ExpoFile.createDownloadTask(
    asset.browser_download_url,
    dest,
    {
      headers,
      onProgress: (data: { bytesWritten: number; totalBytes: number }) => {
        const totalBytes = data.totalBytes;
        const bytesWritten = data.bytesWritten;
        const percentage = totalBytes > 0 ? (bytesWritten / totalBytes) * 100 : 0;
        onProgress({
          bytesWritten,
          totalBytes,
          percentage,
          speed: 0,
          remainingMs: 0,
        });
      },
    }
  );

  const file = await task.downloadAsync();
  if (!file) throw new Error('Download failed: no result returned');
  log('Download complete:', file.uri);
  return file.uri;
}

export async function verifyApk(uri: string): Promise<boolean> {
  try {
    const file = new ExpoFile(uri);
    if (!uri.endsWith('.apk')) {
      log('File is not an APK');
      return false;
    }
    log('APK verified:', uri);
    return true;
  } catch (err) {
    log('APK verification failed:', err);
    return false;
  }
}

export async function installApk(uri: string): Promise<void> {
  log('Requesting APK installation for', uri);
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, { mimeType: 'application/vnd.android.package-archive' });
  } else {
    throw new Error('Sharing is not available on this device. Cannot install APK.');
  }
}

async function storageGet(key: string): Promise<string | null> {
  try {
    const asyncStorage = require('@react-native-async-storage/async-storage');
    const s = asyncStorage.default ?? asyncStorage;
    return await s.getItem(key);
  } catch {
    return null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    const asyncStorage = require('@react-native-async-storage/async-storage');
    const s = asyncStorage.default ?? asyncStorage;
    await s.setItem(key, value);
  } catch {
    // silently fail
  }
}

async function storageRemove(key: string): Promise<void> {
  try {
    const asyncStorage = require('@react-native-async-storage/async-storage');
    const s = asyncStorage.default ?? asyncStorage;
    await s.removeItem(key);
  } catch {
    // silently fail
  }
}

export async function saveCachedRelease(release: GitHubRelease): Promise<void> {
  const data: CachedRelease = { release, fetchedAt: Date.now() };
  await storageSet(CACHE_KEY, JSON.stringify(data));
  log('Release cached');
}

export async function getCachedRelease(): Promise<CachedRelease | null> {
  try {
    const raw = await storageGet(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedRelease;
  } catch {
    return null;
  }
}

async function decodeSkipped(raw: string | null): Promise<string[]> {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function isSkippedVersion(version: string): Promise<boolean> {
  const raw = await storageGet(SKIPPED_KEY);
  const skipped = await decodeSkipped(raw);
  return skipped.includes(version);
}

export async function markVersionSkipped(version: string): Promise<void> {
  const raw = await storageGet(SKIPPED_KEY);
  const skipped = await decodeSkipped(raw);
  if (!skipped.includes(version)) {
    skipped.push(version);
    await storageSet(SKIPPED_KEY, JSON.stringify(skipped));
    log('Version skipped:', version);
  }
}

export async function getRemindLaterVersion(): Promise<string | null> {
  return await storageGet(REMIND_LATER_KEY);
}

export async function setRemindLaterVersion(version: string): Promise<void> {
  await storageSet(REMIND_LATER_KEY, version);
  log('Remind later set for:', version);
}

export async function getLastCheckTime(): Promise<number> {
  const raw = await storageGet(LAST_CHECK_KEY);
  return raw ? Number(raw) : 0;
}

export async function setLastCheckTime(): Promise<void> {
  await storageSet(LAST_CHECK_KEY, String(Date.now()));
}

export async function shouldAutoCheck(): Promise<boolean> {
  const last = await getLastCheckTime();
  const elapsed = Date.now() - last;
  return elapsed > 24 * 60 * 60 * 1000;
}

export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.2';
}
