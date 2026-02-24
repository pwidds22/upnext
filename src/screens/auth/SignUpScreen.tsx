import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../contexts/AuthContext';
import { useUsernameCheck } from '../../hooks/useUsernameCheck';
import { COLORS } from '../../utils/constants';
import { validateUsername, cleanUsername, USERNAME_MIN_LENGTH } from '../../utils/validation';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
} from '../../services/supabase/auth';

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onNavigateToSignIn: () => void;
}

export default function SignUpScreen({ onNavigateToSignIn }: Props) {
  const { signUp, signInWithApple, signInWithGoogleToken } = useAuth();
  const { checkAvailability, checking: checkingUsername } = useUsernameCheck();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken'>('idle');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if Apple Sign-In is available (iOS only)
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable);
    }
  }, []);

  // Google OAuth configuration
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  // Handle Google OAuth response
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.params;
      if (id_token) {
        handleGoogleToken(id_token);
      }
    } else if (googleResponse?.type === 'error') {
      setError('Google Sign-Up failed');
      setGoogleLoading(false);
    }
  }, [googleResponse]);

  const handleGoogleToken = async (idToken: string) => {
    try {
      const { error: authError } = await signInWithGoogleToken(idToken);
      if (authError) {
        setError(authError);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      setError('Google Sign-Up failed. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setGoogleLoading(false);
  };

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setError(null);

    try {
      const { error: authError } = await signInWithApple();
      if (authError) {
        setError(authError);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      setError('Apple Sign-In failed. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setAppleLoading(false);
  };

  // Check username availability with debounce
  const checkUsername = useCallback(async (value: string) => {
    const validationError = validateUsername(value);
    if (validationError) {
      setUsernameStatus('idle');
      return;
    }

    const available = await checkAvailability(value);
    setUsernameStatus(available ? 'available' : 'taken');
  }, [checkAvailability]);

  const handleUsernameChange = useCallback(
    (value: string) => {
      // Only allow valid characters while typing
      const cleaned = cleanUsername(value);
      setUsername(cleaned);
      setUsernameStatus('idle');

      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce the availability check
      if (cleaned.length >= USERNAME_MIN_LENGTH) {
        debounceTimerRef.current = setTimeout(() => checkUsername(cleaned), 500);
      }
    },
    [checkUsername]
  );

  const handleSignUp = async () => {
    // Validate all fields
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check username availability one more time
      const available = await checkAvailability(username);
      if (!available) {
        setError('Username is already taken');
        setUsernameStatus('taken');
        setLoading(false);
        return;
      }

      // Create the account with username
      const { error: signUpError } = await signUp(email.trim(), password, username);

      if (signUpError) {
        setError(signUpError);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Auth state change will automatically navigate to main app
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setLoading(false);
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color={COLORS.primary} />
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successText}>
            We sent a confirmation link to {email}. Please verify your email to complete sign up.
          </Text>
          <Text style={styles.successUsername}>
            Your username: @{username.toLowerCase()}
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={onNavigateToSignIn}
          >
            <Text style={styles.buttonText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Ionicons name="tv" size={64} color={COLORS.primary} />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to sync your shows and connect with friends</Text>
        </View>

        {/* Social Sign-Up Buttons */}
        <View style={styles.socialButtons}>
          {isAppleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          )}

          {GOOGLE_WEB_CLIENT_ID ? (
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => { setGoogleLoading(true); setError(null); promptGoogleAsync(); }}
              disabled={!googleRequest || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#1f1f1f" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#1f1f1f" />
                  <Text style={styles.googleButtonText}>Sign up with Google</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {(isAppleAvailable || GOOGLE_WEB_CLIENT_ID) && (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with email</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        <View style={styles.form}>
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <View>
            <View
              style={[
                styles.inputContainer,
                usernameStatus === 'available' && styles.inputSuccess,
                usernameStatus === 'taken' && styles.inputError,
              ]}
            >
              <Ionicons name="at" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={COLORS.textSecondary}
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
              />
              {checkingUsername && (
                <ActivityIndicator size="small" color={COLORS.textSecondary} />
              )}
              {!checkingUsername && usernameStatus === 'available' && (
                <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              )}
              {!checkingUsername && usernameStatus === 'taken' && (
                <Ionicons name="close-circle" size={20} color={COLORS.error} />
              )}
            </View>
            <Text style={styles.inputHint}>
              3-20 characters, letters, numbers, and underscores only
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor={COLORS.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={onNavigateToSignIn}
          >
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkTextBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.error}20`,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputSuccess: {
    borderColor: COLORS.primary,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  inputHint: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 4,
    marginLeft: 4,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    marginTop: 8,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  linkTextBold: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  successText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  successUsername: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  socialButtons: {
    gap: 12,
    marginBottom: 8,
  },
  appleButton: {
    height: 50,
    width: '100%',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    height: 50,
    borderRadius: 12,
    gap: 10,
  },
  googleButtonText: {
    color: '#1f1f1f',
    fontSize: 17,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  dividerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
