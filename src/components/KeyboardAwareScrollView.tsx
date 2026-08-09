import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, ViewStyle } from 'react-native';

interface KeyboardAwareScrollViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  scrollViewProps?: any;
}

export const KeyboardAwareScrollView: React.FC<KeyboardAwareScrollViewProps> = ({
  children,
  style,
  contentContainerStyle,
  scrollViewProps = {},
}) => {
  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
});

export default KeyboardAwareScrollView;