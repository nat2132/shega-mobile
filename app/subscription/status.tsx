import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import PaymentStatusScreen from '../../src/screens/subscription/payment-status';
import { getStoredUser, AccountUser } from '../../src/services/api';
import { resolvePostAuthRoute } from '../../src/services/postAuthRouter';

export default function PaymentStatusRoute() {
  const [user, setUser] = useState<AccountUser | null>(null);

  useEffect(() => {
    (async () => {
      const u = await getStoredUser<AccountUser>();
      setUser(u);
    })();
  }, []);

  const handleContinue = async () => {
    const target = await resolvePostAuthRoute();
    router.replace(target as never);
  };

  const handleRenew = () => {
    router.replace('/subscription/plans');
  };

  return (
    <PaymentStatusScreen
      user={user}
      onContinue={handleContinue}
      onRenew={handleRenew}
    />
  );
}