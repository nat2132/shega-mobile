import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Camera, Image as ImageIcon, Star, Trash2, Plus } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { requestImagePermission, openAppSettings } from '@/services/imagePermission';

interface ProductImageGalleryProps {
  images: string[];
  primaryIndex: number;
  isEditing?: boolean;
  onImagesChange?: (images: string[], primaryIndex: number) => void;
  onSelectPrimary?: (index: number) => void;
  colors: any;
}

export const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({
  images,
  primaryIndex,
  isEditing = true,
  onImagesChange,
  onSelectPrimary,
  colors,
}) => {
  const { t } = useSettings();

  const handlePickPhoto = async (mode: 'camera' | 'library'): Promise<void> => {
    if (images.length >= 5) {
      Alert.alert('Image Limit Reached', 'Maximum 5 product images allowed per product.');
      return;
    }
    try {
      // Denied permissions are recoverable: ask again, or (when the OS will no
      // longer prompt) send the user straight to the app's settings.
      const { granted, canAskAgain } = await requestImagePermission(mode);
      if (!granted) {
        const message = mode === 'camera' ? t('permission.camera_message') : t('permission.library_message');
        if (canAskAgain) {
          Alert.alert(t('permission.required'), message, [
            { text: t('common.try_again'), onPress: () => { void handlePickPhoto(mode); } },
            { text: t('common.cancel'), style: 'cancel' },
          ]);
        } else {
          Alert.alert(t('permission.required'), message, [
            { text: t('common.open_settings'), onPress: () => openAppSettings() },
            { text: t('common.cancel'), style: 'cancel' },
          ]);
        }
        return;
      }

      const options = {
        mediaTypes: ['images'] as const,
        allowsEditing: true,
        aspect: [4, 3] as [number, number],
        quality: 0.6,
        base64: true,
      };

      const result = mode === 'camera'
        ? await ImagePicker.launchCameraAsync(options as any)
        : await ImagePicker.launchImageLibraryAsync(options as any);

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        const next = [...images.slice(0, 4), uri];
        onImagesChange?.(next, primaryIndex < next.length ? primaryIndex : 0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Could not access photo.');
    }
  };

  const handleRemove = (index: number) => {
    const next = images.filter((_, i) => i !== index);
    let nextPrimary = primaryIndex;
    if (index === primaryIndex) nextPrimary = 0;
    else if (index < primaryIndex) nextPrimary = Math.max(0, primaryIndex - 1);
    onImagesChange?.(next, nextPrimary);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSetPrimary = (index: number) => {
    onSelectPrimary?.(index);
    onImagesChange?.(images, index);
    Haptics.selectionAsync();
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary }}>
          Product Images ({images.length}/5)
        </AppText>
        {images.length >= 5 && isEditing && (
          <AppText variant="micro" weight="bold" style={{ color: colors.warning || '#f59e0b' }}>
            Limit reached (max 5)
          </AppText>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {images.map((img, idx) => {
          const isCover = idx === primaryIndex;
          return (
            <View key={idx} style={[styles.thumbWrap, { borderColor: isCover ? colors.primary : colors.border }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => isEditing && handleSetPrimary(idx)}
                style={styles.thumbTouch}
              >
                <Image source={{ uri: img }} style={styles.thumbImage} contentFit="cover" />
                {isCover && (
                  <View style={[styles.coverBadge, { backgroundColor: colors.primary }]}>
                    <Star size={10} color="#FFFFFF" fill="#FFFFFF" />
                    <AppText variant="micro" weight="bold" style={{ color: '#FFFFFF', marginLeft: 3 }}>
                      Cover
                    </AppText>
                  </View>
                )}
              </TouchableOpacity>

              {isEditing && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(idx)}
                  activeOpacity={0.8}
                >
                  <Trash2 size={12} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {isEditing && images.length < 5 && (
          <View style={[styles.addTile, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => handlePickPhoto('camera')}
              activeOpacity={0.7}
            >
              <Camera size={18} color={colors.primary} />
              <AppText variant="micro" weight="bold" style={{ color: colors.primary, marginTop: 2 }}>
                Camera
              </AppText>
            </TouchableOpacity>
            <View style={[styles.tileDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => handlePickPhoto('library')}
              activeOpacity={0.7}
            >
              <ImageIcon size={18} color={colors.text} />
              <AppText variant="micro" weight="bold" style={{ color: colors.text, marginTop: 2 }}>
                Gallery
              </AppText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  scroll: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  thumbWrap: { width: 84, height: 84, borderRadius: 14, borderWidth: 2, overflow: 'hidden', position: 'relative' },
  thumbTouch: { width: '100%', height: '100%' },
  thumbImage: { width: '100%', height: '100%' },
  coverBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: 90,
    height: 84,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  addBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileDivider: { height: 1, width: '100%' },
});
