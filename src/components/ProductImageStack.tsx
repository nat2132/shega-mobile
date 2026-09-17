import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts } from '@/constants/theme';
import { Image } from 'expo-image';
import { Package } from 'lucide-react-native';

interface ProductImageStackProps {
  images?: (string | null | undefined)[];
  totalCount?: number;
  size?: number;
  max?: number;
  radius?: number;
  backgroundColor?: string;
  ringColor?: string;
  iconColor?: string;
  moreBadgeBg?: string;
  moreBadgeColor?: string;
  showMoreBadge?: boolean;
}

const normalize = (images: (string | null | undefined)[] | undefined): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const img of images || []) {
    if (typeof img === 'string' && img.trim().length > 0 && !seen.has(img)) {
      seen.add(img);
      out.push(img);
    }
  }
  return out;
};

export const ProductImageStack: React.FC<ProductImageStackProps> = ({
  images,
  totalCount,
  size = 46,
  max = 3,
  radius = 10,
  backgroundColor = 'rgba(128,128,128,0.14)',
  ringColor = '#FFFFFF',
  iconColor = '#9AA',
  moreBadgeBg = 'rgba(0,0,0,0.62)',
  moreBadgeColor = '#FFFFFF',
  showMoreBadge = true,
}) => {
  const clean = useMemo(() => normalize(images), [images]);

  if (clean.length === 0) {
    return (
      <View
        style={[
          styles.box,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor,
          },
        ]}
      >
        <Package size={Math.round(size * 0.45)} color={iconColor} />
      </View>
    );
  }

  if (clean.length === 1) {
    return (
      <View
        style={[
          styles.box,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: ringColor,
          },
        ]}
      >
        <Image
          source={{ uri: clean[0] }}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
          transition={150}
        />
      </View>
    );
  }

  const visible = clean.slice(0, max);
  const overflow = Math.max(0, (totalCount ?? clean.length) - visible.length);
  const inner = Math.round(size * 0.6);
  const off = Math.round(size * 0.22);
  const thumbRadius = Math.max(2, radius - 2);

  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: radius, overflow: 'hidden' },
      ]}
    >
      {visible.map((uri, i) => (
        <Image
          key={uri + i}
          source={{ uri }}
          contentFit="cover"
          transition={150}
          style={{
            position: 'absolute',
            left: i * off,
            top: i * off,
            width: inner,
            height: inner,
            borderRadius: thumbRadius,
            borderWidth: 1.5,
            borderColor: ringColor,
            zIndex: visible.length - i,
          }}
        />
      ))}
      {overflow > 0 && showMoreBadge ? (
        <View
          style={[
            styles.moreBadge,
            {
              backgroundColor: moreBadgeBg,
              minWidth: Math.round(size * 0.46),
              height: Math.round(size * 0.46),
              borderRadius: Math.round(size * 0.23),
            },
          ]}
        >
          <View
            style={[
              styles.moreBadgeInner,
              {
                borderRadius: radius - 2,
                backgroundColor: moreBadgeBg,
              },
            ]}
          >
            <Text style={[styles.moreBadgeText, { color: moreBadgeColor }]}>
              {'+' + overflow}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  moreBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  moreBadgeInner: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  moreBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
  },
});

export default ProductImageStack;