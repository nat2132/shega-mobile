import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { getContactById } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import ContactDetails from '@/screens/contacts/contact-details';

export default function ContactDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useSettings();
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const contactId = Number(id);
    if (!contactId || Number.isNaN(contactId)) {
      setLoading(false);
      return;
    }
    const found = getContactById(contactId);
    setContact(found);
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
      </View>
    );
  }

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/contacts' as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ContactDetails
        contact={contact}
        onClose={close}
        onEdit={() => router.push(`/contacts-form?id=${contact.id}` as any)}
        onDeleted={close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
