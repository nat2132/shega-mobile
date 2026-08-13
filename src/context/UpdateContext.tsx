import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { useSettings } from '@/context/SettingsContext';

import * as UpdateService from '@/services/updateService';

export interface UpdateState {
  checking: boolean;
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  releaseNotes: string;
  fileSize: string;
  downloadProgress: UpdateService.DownloadProgress | null;
  downloading: boolean;
  downloadedUri: string | null;
  error: string | null;
}

interface UpdateContextType {
  checkForUpdates: () => Promise<void>;
  state: UpdateState;
}

const initialState: UpdateState = {
  checking: false,
  available: false,
  currentVersion: UpdateService.getCurrentAppVersion(),
  latestVersion: '',
  releaseDate: '',
  releaseNotes: '',
  fileSize: '',
  downloadProgress: null,
  downloading: false,
  downloadedUri: null,
  error: null,
};

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const UpdateProvider = ({ children }: { children: React.ReactNode }) => {
  const { colors, t } = useSettings();
  const [state, setState] = useState<UpdateState>(initialState);
  const [showModal, setShowModal] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const latestReleaseRef = useRef<UpdateService.GitHubRelease | null>(null);

  const setPartial = useCallback((partial: Partial<UpdateState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  const checkForUpdates = useCallback(async (manual = true) => {
    if (state.checking) return;

    setPartial({
      checking: true,
      available: false,
      error: null,
      latestVersion: '',
      releaseDate: '',
      releaseNotes: '',
      fileSize: '',
      downloadProgress: null,
      downloading: false,
      downloadedUri: null,
    });

    try {
      const cached = await UpdateService.getCachedRelease();
      const cachedFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
      let release = (manual || !cachedFresh) ? null : cached ? cached.release : null;

      if (!release || manual) {
        release = await UpdateService.fetchLatestRelease();
        if (!release) {
          setPartial({ checking: false, error: t('update.no_releases') });
          return;
        }
        await UpdateService.saveCachedRelease(release);
      }

      await UpdateService.setLastCheckTime();
      latestReleaseRef.current = release;

      const currentVer = UpdateService.getCurrentAppVersion();
      const latestVer = UpdateService.normalizeVersionString(release.tag_name);
      const comparison = UpdateService.compareVersions(currentVer, latestVer);

      if (comparison >= 0) {
        setPartial({ checking: false, available: false, latestVersion: latestVer });
        if (manual) {
          setState(prev => ({ ...prev, checking: false, latestVersion: latestVer }));
          setShowModal(true);
        }
        return;
      }

      const skipped = await UpdateService.isSkippedVersion(release.tag_name);
      if (skipped) {
        setPartial({ checking: false, available: false, latestVersion: latestVer });
        return;
      }

      const remindLaterVer = await UpdateService.getRemindLaterVersion();
      if (remindLaterVer === release.tag_name) {
        setPartial({ checking: false, available: false, latestVersion: latestVer });
        return;
      }

      const apkAsset = UpdateService.findApkAsset(release);
      const fileSize = apkAsset ? UpdateService.formatBytes(apkAsset.size) : t('update.unknown');

      setPartial({
        checking: false,
        available: true,
        currentVersion: currentVer,
        latestVersion: latestVer,
        releaseDate: new Date(release.published_at).toLocaleDateString(),
        releaseNotes: release.body || t('update.no_notes'),
        fileSize,
      });

      setShowModal(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('update.check_error');
      setPartial({ checking: false, error: msg });
      if (manual) setShowModal(true);
    }
  }, [state.checking, setPartial, t]);

  useEffect(() => {
    UpdateService.shouldAutoCheck().then(should => {
      if (should) {
        checkForUpdates(false);
      }
    });
  }, []);

  const handleDownload = useCallback(async () => {
    const release = latestReleaseRef.current;
    if (!release) return;

    const apkAsset = UpdateService.findApkAsset(release);
    if (!apkAsset) {
      setPartial({ error: t('update.no_apk') });
      return;
    }

    setShowModal(false);
    setShowDownload(true);
    setPartial({ downloading: true, downloadProgress: null, error: null });

    try {
      const uri = await UpdateService.downloadApk(apkAsset, (progress) => {
        setPartial({ downloadProgress: progress });
      });

      const verified = await UpdateService.verifyApk(uri);
      if (!verified) {
        setPartial({ downloading: false, error: t('update.verify_failed') });
        return;
      }

      setPartial({ downloading: false, downloadedUri: uri, downloadProgress: null });

      await UpdateService.installApk(uri);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('update.download_failed');
      setPartial({ downloading: false, error: msg });
    }
  }, [setPartial, t]);

  const handleRemindLater = useCallback(async () => {
    const release = latestReleaseRef.current;
    if (release) {
      await UpdateService.setRemindLaterVersion(release.tag_name);
    }
    setShowModal(false);
  }, []);

  const handleSkip = useCallback(async () => {
    const release = latestReleaseRef.current;
    if (release) {
      await UpdateService.markVersionSkipped(release.tag_name);
    }
    setShowModal(false);
  }, []);

  const handleClose = useCallback(() => {
    setShowModal(false);
    setShowDownload(false);
  }, []);

  const G = {
    bg: colors.background,
    bgCard: colors.card,
    border: colors.border,
    fg: colors.text,
    muted: colors.textSecondary,
    primary: colors.primary,
    error: colors.error,
    success: colors.success,
    warning: colors.warning,
  };

  return (
    <UpdateContext.Provider value={{ checkForUpdates: () => checkForUpdates(true), state }}>
      {children}

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable onPress={() => {}} style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            {state.checking ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={G.primary} />
                <AppText variant="body" weight="medium" style={[styles.loadingText, { color: G.muted }]}>
                  {t('update.checking')}
                </AppText>
              </View>
            ) : state.error && !state.available ? (
              <View style={styles.errorContainer}>
                <AppText variant="title" weight="bold" style={[styles.errorTitle, { color: G.error }]}>
                  {t('update.error_title')}
                </AppText>
                <AppText variant="body" weight="medium" style={[styles.errorMessage, { color: G.muted }]}>
                  {state.error}
                </AppText>
                <Pressable onPress={handleClose} style={[styles.primaryBtn, { backgroundColor: G.primary }]}>
                  <AppText variant="label" weight="bold" color={colors.background}>{t('common.ok')}</AppText>
                </Pressable>
              </View>
            ) : state.available ? (
              <View style={styles.content}>
                <View style={[styles.iconCircle, { backgroundColor: G.success + '1F' }]}>
                  <AppText variant="title" weight="bold" style={{ color: G.success, fontSize: 28 }}>!</AppText>
                </View>
                <AppText variant="title" weight="bold" style={[styles.title, { color: G.fg }]}>
                  {t('update.available_title')}
                </AppText>

                <View style={styles.versionRow}>
                  <View style={[styles.versionBadge, { backgroundColor: colors.background }]}>
                    <AppText variant="caption" weight="medium" style={{ color: G.muted }}>{t('update.current')}</AppText>
                    <AppText variant="body" weight="bold" style={{ color: G.fg }}>v{state.currentVersion}</AppText>
                  </View>
                  <AppText variant="title" weight="bold" style={{ color: G.muted }}>→</AppText>
                  <View style={[styles.versionBadge, { backgroundColor: G.success + '1F' }]}>
                    <AppText variant="caption" weight="medium" style={{ color: G.success }}>{t('update.latest')}</AppText>
                    <AppText variant="body" weight="bold" style={{ color: G.success }}>v{state.latestVersion}</AppText>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                    {t('update.released')} {state.releaseDate}
                  </AppText>
                  <View style={[styles.metaDot, { backgroundColor: G.muted + '40' }]} />
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                    {state.fileSize}
                  </AppText>
                </View>

                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.notesHeading, { color: G.muted }]}>
                  {t('update.whats_new')}
                </AppText>
                <ScrollView style={styles.notesScroll} showsVerticalScrollIndicator={false}>
                  <AppText variant="body" weight="medium" style={[styles.notesText, { color: G.muted }]}>
                    {state.releaseNotes}
                  </AppText>
                </ScrollView>

                <View style={styles.actions}>
                  <Pressable onPress={handleDownload} style={[styles.primaryBtn, { backgroundColor: G.primary }]}>
                    <AppText variant="label" weight="bold" color={colors.background}>{t('update.download')}</AppText>
                  </Pressable>
                  <Pressable onPress={handleRemindLater} style={[styles.secondaryBtn, { borderColor: G.border }]}>
                    <AppText variant="label" weight="bold" style={{ color: G.fg }}>{t('update.remind_later')}</AppText>
                  </Pressable>
                  <Pressable onPress={handleSkip} style={styles.skipBtn}>
                    <AppText variant="caption" weight="medium" style={{ color: G.muted }}>{t('update.skip')}</AppText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.upToDateContainer}>
                <View style={[styles.iconCircle, { backgroundColor: G.success + '1F' }]}>
                  <AppText variant="title" weight="bold" style={{ color: G.success, fontSize: 24 }}>✓</AppText>
                </View>
                <AppText variant="title" weight="bold" style={[styles.title, { color: G.fg }]}>
                  {t('update.up_to_date')}
                </AppText>
                <AppText variant="body" weight="medium" style={[styles.subtitle, { color: G.muted }]}>
                  {t('update.up_to_date_desc', { version: state.latestVersion || state.currentVersion })}
                </AppText>
                <Pressable onPress={handleClose} style={[styles.primaryBtn, { backgroundColor: G.primary, marginTop: Spacing.md }]}>
                  <AppText variant="label" weight="bold" color={colors.background}>{t('common.ok')}</AppText>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showDownload} transparent animationType="fade" onRequestClose={() => {}}>
        <Pressable style={styles.backdrop}>
          <Pressable onPress={() => {}} style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            {state.downloading && state.downloadProgress ? (
              <View style={styles.downloadContent}>
                <AppText variant="title" weight="bold" style={[styles.title, { color: G.fg }]}>
                  {t('update.downloading')}
                </AppText>

                <View style={[styles.progressBarTrack, { backgroundColor: colors.background }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { backgroundColor: G.primary, width: `${Math.min(state.downloadProgress.percentage, 100)}%` },
                    ]}
                  />
                </View>

                <AppText variant="display" weight="bold" style={[styles.percentage, { color: G.fg }]}>
                  {state.downloadProgress.percentage.toFixed(1)}%
                </AppText>

                <View style={styles.downloadStats}>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                    {UpdateService.formatBytes(state.downloadProgress.bytesWritten)} / {UpdateService.formatBytes(state.downloadProgress.totalBytes)}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                    {UpdateService.formatSpeed(state.downloadProgress.speed)}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                    {t('update.remaining')} {UpdateService.formatRemaining(state.downloadProgress.remainingMs)}
                  </AppText>
                </View>
              </View>
            ) : state.error ? (
              <View style={styles.errorContainer}>
                <AppText variant="title" weight="bold" style={[styles.errorTitle, { color: G.error }]}>
                  {t('update.download_failed_title')}
                </AppText>
                <AppText variant="body" weight="medium" style={[styles.errorMessage, { color: G.muted }]}>
                  {state.error}
                </AppText>
                <Pressable onPress={handleClose} style={[styles.primaryBtn, { backgroundColor: G.primary }]}>
                  <AppText variant="label" weight="bold" color={colors.background}>{t('common.close')}</AppText>
                </Pressable>
              </View>
            ) : state.downloadedUri ? (
              <View style={styles.errorContainer}>
                <View style={[styles.iconCircle, { backgroundColor: G.success + '1F' }]}>
                  <AppText variant="title" weight="bold" style={{ color: G.success, fontSize: 24 }}>✓</AppText>
                </View>
                <AppText variant="title" weight="bold" style={[styles.title, { color: G.fg }]}>
                  {t('update.download_complete')}
                </AppText>
                <AppText variant="body" weight="medium" style={[styles.subtitle, { color: G.muted }]}>
                  {t('update.download_complete_desc')}
                </AppText>
                <Pressable onPress={handleClose} style={[styles.primaryBtn, { backgroundColor: G.primary, marginTop: Spacing.md }]}>
                  <AppText variant="label" weight="bold" color={colors.background}>{t('common.ok')}</AppText>
                </Pressable>
              </View>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={G.primary} />
                <AppText variant="body" weight="medium" style={[styles.loadingText, { color: G.muted }]}>
                  {t('update.preparing')}
                </AppText>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </UpdateContext.Provider>
  );
};

export const useUpdate = () => {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error('useUpdate must be used within UpdateProvider');
  return ctx;
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    alignItems: 'center',
    maxHeight: '85%',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  errorTitle: {
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
    lineHeight: 22,
  },
  upToDateContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  versionBadge: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 90,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  notesHeading: {
    width: '100%',
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  notesScroll: {
    width: '100%',
    maxHeight: 180,
    marginBottom: Spacing.md,
    backgroundColor: 'transparent',
  },
  notesText: {
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    gap: Spacing.sm,
  },
  primaryBtn: {
    width: '100%',
    minHeight: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  secondaryBtn: {
    width: '100%',
    minHeight: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  downloadContent: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentage: {
    marginBottom: Spacing.md,
  },
  downloadStats: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
});
