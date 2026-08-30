// Hidden keyboard capture for hardware barcode scanners.
//
// Bluetooth/USB HID scanners present themselves as a keyboard and send the
// decoded barcode followed by Enter. This component keeps a tiny invisible
// TextInput focused (no soft keyboard shown) so those key events land here,
// assembles the barcode into a buffer and forwards it to the PeripheralManager.
//
// It suspends while a soft keyboard is visible so manual typing in search
// fields is never hijacked, and re-focuses as soon as the soft keyboard hides.

import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { getPeripheralManager } from '@/services/peripherals/peripheralManager';

interface Props {
  enabled?: boolean;
}

const styles = StyleSheet.create({
  capture: {
    position: 'absolute',
    width: 1,
    height: 1,
    left: -10,
    top: -10,
    opacity: 0,
  },
  input: {
    width: 1,
    height: 1,
    fontSize: 1,
  },
});

export const HidScannerCapture: React.FC<Props> = ({ enabled = true }) => {
  const inputRef = useRef<TextInput>(null);
  const buffer = useRef<string[]>([]);
  const lastKey = useRef<number>(0);
  const [softKeyboardVisible, setSoftKeyboardVisible] = useState(false);
  const active = enabled && !softKeyboardVisible;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setSoftKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setSoftKeyboardVisible(false);
      if (enabled) {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [enabled]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [active]);

  const flush = () => {
    const code = buffer.current.join('').trim();
    buffer.current = [];
    if (code) {
      getPeripheralManager().handleScan(code, 'keyboard_hid');
    }
  };

  const onKeyPress = (e: { nativeEvent?: { key?: string } }) => {
    const key = e?.nativeEvent?.key;
    if (key === 'Enter' || key === '\n') {
      flush();
      return;
    }
    if (key === 'Backspace') {
      buffer.current.pop();
      return;
    }
    if (!key || key.length !== 1) return;
    const code = key.charCodeAt(0);
    if (code < 32 || code > 126) return;
    buffer.current.push(key);
    if (buffer.current.length >= 64) {
      flush();
    } else if (
      buffer.current.length > 0 &&
      getPeripheralManager().getPrimaryDevice('scanner')?.scanSuffix === 'none' &&
      Date.now() - lastKey.current > 700
    ) {
      flush();
    }
    lastKey.current = Date.now();
  };

  if (!active) return null;

  return (
    <View style={styles.capture} pointerEvents="none">
      <TextInput
        ref={inputRef}
        style={styles.input}
        autoFocus
        showSoftInputOnFocus={false}
        caretHidden
        autoCorrect={false}
        autoCapitalize="none"
        autoComplete="off"
        importantForAutofill="no"
        blurOnSubmit={false}
        contextMenuHidden
        onKeyPress={onKeyPress}
      />
    </View>
  );
};