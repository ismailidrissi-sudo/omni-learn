import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import {
  GoogleSignin,
  statusCodes,
  GoogleSigninButton,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../config';
import { useAuth } from '../context/AuthContext';

const BRAND = {
  green: '#059669',
  beige: '#D4B896',
  beigeDark: '#1a1212',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function SignInScreen({ navigation, route }: { navigation: any; route?: any }) {
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const returnTo = route?.params?.returnTo as string | undefined;
  const returnParams = route?.params?.params as Record<string, unknown> | undefined;

  useEffect(() => {
    if (GOOGLE_WEB_CLIENT_ID) {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        offlineAccess: true,
      });
    }
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken;
      if (!idToken) {
        Alert.alert('Sign-in cancelled', 'You closed the account picker.');
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: idToken }),
      });
      if (!res.ok) throw new Error('Auth failed');
      const { accessToken, user } = await res.json();
      await signIn(user, accessToken);
      // Defer navigation so auth state propagates before the next screen renders
      requestAnimationFrame(() => {
        if (returnTo === 'Home') {
          navigation.replace('Home');
        } else if (returnTo === 'CourseDetail' && returnParams?.courseId) {
          navigation.replace('CourseDetail', { courseId: returnParams.courseId });
        } else if (returnTo === 'Microlearnings' && returnParams?.initialIndex != null) {
          navigation.replace('Microlearnings', { initialIndex: returnParams.initialIndex });
        } else {
          navigation.replace('Dashboard');
        }
      });
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Operation in progress
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available.');
      } else {
        console.error('Google Sign-In error:', error);
        Alert.alert('Sign-in failed', error?.message ?? 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Omnilearn</Text>
      <Text style={styles.tagline}>Sign in to continue learning</Text>

      {loading ? (
        <ActivityIndicator size="large" color={BRAND.green} style={styles.loader} />
      ) : (
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Dark}
          onPress={signInWithGoogle}
          disabled={loading}
          style={styles.googleButton}
        />
      )}

      <TouchableOpacity
        style={styles.skipBtn}
        onPress={() => navigation.replace('Dashboard')}
      >
        <Text style={styles.skipBtnText}>Continue without signing in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: BRAND.green,
  },
  tagline: {
    fontSize: 16,
    color: BRAND.beigeDark,
    marginTop: 8,
    marginBottom: 48,
  },
  googleButton: {
    width: 240,
    height: 48,
    marginBottom: 24,
  },
  loader: {
    marginVertical: 24,
  },
  skipBtn: {
    paddingVertical: 12,
  },
  skipBtnText: {
    color: BRAND.beige,
    fontSize: 14,
  },
});
