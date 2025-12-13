import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ensureValidSession } from '@/src/auth/api';

/**
 * Root index route that handles initial authentication routing.
 * Redirects to login if not authenticated, otherwise to tabs.
 */
export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const validSession = await ensureValidSession();
        if (validSession) {
          // User is authenticated, redirect to main app
          router.replace('/(tabs)');
        } else {
          // User is not authenticated, redirect to login
          router.replace('/login');
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        // On error, redirect to login
        router.replace('/login');
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  // Return null while checking (or a loading indicator if preferred)
  return null;
}

