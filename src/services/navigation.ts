import { router } from 'expo-router';

// safeGoBack pops the previous screen when one exists. Onboarding and the
// login/register -> subscription flow navigate with router.replace(), which
// leaves no history entry, so a raw router.back() would throw. When there is
// nothing to pop we fall back to the app root and let index re-decide the
// destination (language select / welcome / verify-pin / dashboard).
export function safeGoBack(fallback: string = '/'): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    try {
      router.dismissAll();
    } catch {
      /* dismissAll not available on all navigator types */
    }
    router.replace(fallback as never);
  }
}

export function safeBackOrFallback(fallback: string): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as never);
  }
}