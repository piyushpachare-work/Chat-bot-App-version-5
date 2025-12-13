import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { interactiveLogin, ensureValidSession } from '@/src/auth/api';
import { SessionTokens } from '@/src/auth/session';
import { Button } from '@/components/fluent-ui/Button';
import { Text } from '@/components/fluent-ui/Text';
import { Card } from '@/components/fluent-ui/Card';
import { FluentColors, FluentSpacing } from '@/constants/fluent-ui-tokens';

export default function LoginScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const validSession = await ensureValidSession();
        if (validSession) {
          // User already logged in, navigate to chat
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const session: SessionTokens = await interactiveLogin();
      
      if (session) {
        // Navigate to chat screen on success
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError('Sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking existing auth
  if (isChecking) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <ActivityIndicator size="large" color={FluentColors.brand.primary} />
          <Text variant="body" color="secondary" style={styles.loadingText}>
            Checking authentication...
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card} elevated>
        <Text variant="headline" weight="bold" style={styles.title}>
          Mobile Chatbot Agent
        </Text>
        <Text variant="title" color="secondary" style={styles.subtitle}>
          Sign-in
        </Text>
        
        <Button
          appearance="outline"
          size="large"
          onPress={handleSignIn}
          disabled={isLoading}
          loading={isLoading}
          style={styles.signInButton}
          accessibilityLabel="Sign in with Microsoft"
          accessibilityHint="Signs in using your Microsoft organization account"
        >
          <View style={styles.buttonContent}>
            {!isLoading && (
              <View style={styles.microsoftLogo}>
                <View style={[styles.logoSquare, { backgroundColor: '#F25022' }]} />
                <View style={[styles.logoSquare, { backgroundColor: '#7FBA00' }]} />
                <View style={[styles.logoSquare, { backgroundColor: '#00A4EF' }]} />
                <View style={[styles.logoSquare, { backgroundColor: '#FFB900' }]} />
              </View>
            )}
            <Text variant="body" weight="semibold" style={styles.signInButtonText}>
              Sign in with Microsoft
            </Text>
          </View>
        </Button>

        {error && (
          <Text variant="caption" color="error" style={styles.errorText}>
            {error}
          </Text>
        )}

        <Text variant="body" color="secondary" style={styles.infoText}>
          Use your organization account to access the chatbot
        </Text>
        
        <Text variant="caption" color="secondary" style={styles.privacyText}>
          Protected by Microsoft Entra ID
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FluentColors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: FluentSpacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    padding: FluentSpacing.xxxxl,
  },
  title: {
    marginBottom: FluentSpacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: FluentSpacing.xxxxl,
    textAlign: 'center',
  },
  signInButton: {
    width: '100%',
    marginBottom: FluentSpacing.xl,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  microsoftLogo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 21,
    height: 21,
    marginRight: FluentSpacing.s,
  },
  logoSquare: {
    width: 9,
    height: 9,
    margin: 0.5,
  },
  signInButtonText: {
    color: FluentColors.brand.primary,
  },
  errorText: {
    marginBottom: FluentSpacing.m,
    textAlign: 'center',
  },
  infoText: {
    textAlign: 'center',
    marginTop: FluentSpacing.xs,
    paddingHorizontal: FluentSpacing.s,
  },
  privacyText: {
    textAlign: 'center',
    marginTop: FluentSpacing.l,
  },
  loadingText: {
    marginTop: FluentSpacing.l,
    textAlign: 'center',
  },
});

