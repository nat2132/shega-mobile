import { AppText } from '@/components/AppText';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

interface Props {
  children: ReactNode;
  /** Called with the first caught error (for logging/telemetry). */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional custom fallback UI. */
  fallback?: (error: Error | null, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log loudly so Metro / LogCat surfaces the real cause instead of a
    // silent close.
    console.error(
      '[SHEGA-ERROR-BOUNDARY] caught:',
      error,
      errorInfo?.componentStack ?? '',
    );
    try {
      this.props.onError?.(error, errorInfo);
    } catch {}
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <View style={styles.container}>
          <AppText variant="title" style={styles.title}>
            Something went wrong
          </AppText>
          <AppText variant="body" style={styles.message} numberOfLines={10}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </AppText>
          <Pressable style={styles.retryBtn} onPress={this.reset}>
            <AppText variant="label" weight="bold" style={styles.retryText}>
              Tap to retry
            </AppText>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  retryText: {
    opacity: 0.7,
  },
});
