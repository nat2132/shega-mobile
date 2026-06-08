import { AppText } from '@/components/AppText';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
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
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <AppText variant="title" style={styles.title}>Something went wrong</AppText>
          <AppText variant="body" style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </AppText>
          <AppText variant="caption" style={styles.dismiss} onPress={() => this.setState({ hasError: false, error: null })}>
            Tap to dismiss
          </AppText>
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
  },
  message: {
    textAlign: 'center',
    marginBottom: 24,
  },
  dismiss: {
    opacity: 0.6,
  },
});
