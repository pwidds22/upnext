import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PurchasesPackage, PurchasesOffering, PurchasesIntroPrice } from 'react-native-purchases';
import { COLORS } from '../utils/constants';
import { RootStackParamList } from '../types';
import { useSubscription } from '../contexts/SubscriptionContext';
import { subscriptionService } from '../services/subscription';
import { onboardingService } from '../services/onboarding';

type PaywallNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Paywall'>;
type PaywallRouteProp = RouteProp<RootStackParamList, 'Paywall'>;

type PlanKey = 'monthly' | 'annual' | 'lifetime';

const FEATURES = [
  { icon: 'stats-chart', label: 'Detailed viewing stats & trends' },
  { icon: 'calendar', label: 'Activity calendar heatmap' },
  { icon: 'trophy', label: 'Most watched shows leaderboard' },
  { icon: 'bulb', label: 'Fun facts about your viewing habits' },
  { icon: 'download-outline', label: 'Data export' },
  { icon: 'heart', label: 'Support indie development' },
];

function formatTrialText(introPrice: PurchasesIntroPrice): string {
  const { periodNumberOfUnits, periodUnit } = introPrice;
  const unit = periodUnit.toLowerCase();
  return `${periodNumberOfUnits}-${unit} free trial`;
}

function getSelectedPackage(
  offering: PurchasesOffering,
  plan: PlanKey,
): PurchasesPackage | null {
  if (plan === 'monthly') return offering.monthly;
  if (plan === 'annual') return offering.annual;
  return offering.lifetime;
}

export default function PaywallScreen() {
  const navigation = useNavigation<PaywallNavigationProp>();
  const route = useRoute<PaywallRouteProp>();
  const mode = route.params?.mode ?? 'upgrade';
  const isOnboarding = mode === 'onboarding';

  const { isPremium, restorePurchases } = useSubscription();

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('annual');
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [offeringsError, setOfferingsError] = useState(false);

  const completeOnboarding = useCallback(async () => {
    await onboardingService.markComplete();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      }),
    );
  }, [navigation]);

  const dismiss = useCallback(() => {
    if (isOnboarding) {
      completeOnboarding();
    } else {
      navigation.goBack();
    }
  }, [isOnboarding, completeOnboarding, navigation]);

  const fetchOfferings = useCallback(async () => {
    setLoadingOfferings(true);
    setOfferingsError(false);
    try {
      const offerings = await subscriptionService.getOfferings();
      setOffering(offerings?.current ?? null);
    } catch {
      setOfferingsError(true);
    } finally {
      setLoadingOfferings(false);
    }
  }, []);

  useEffect(() => {
    fetchOfferings();
  }, [fetchOfferings]);

  // If already premium during onboarding, skip straight to main
  useEffect(() => {
    if (isPremium && isOnboarding) {
      completeOnboarding();
    }
  }, [isPremium, isOnboarding, completeOnboarding]);

  const handlePurchase = async () => {
    if (!offering) return;
    const pkg = getSelectedPackage(offering, selectedPlan);
    if (!pkg) return;

    setPurchasing(true);
    try {
      await subscriptionService.purchasePackage(pkg);
      // SubscriptionContext listener auto-updates isPremium
      dismiss();
    } catch (e: any) {
      // Import error code lazily to avoid top-level native module access
      try {
        const { PURCHASES_ERROR_CODE } = await import('react-native-purchases');
        if (e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return;
      } catch {
        // If import fails, check the raw code value
        if (e?.code === '1') return;
      }
      Alert.alert('Purchase Failed', e?.message || 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    const { success, error } = await restorePurchases();
    if (success) {
      Alert.alert('Restored', 'Your purchases have been restored.', [
        { text: 'OK', onPress: dismiss },
      ]);
    } else {
      Alert.alert('Restore Failed', error || 'Could not restore purchases. Please try again.');
    }
  };

  // Already premium (upgrade mode only — onboarding mode auto-completes above)
  if (isPremium && !isOnboarding) {
    return (
      <View style={styles.centeredContainer}>
        <Ionicons name="star" size={64} color={COLORS.primary} />
        <Text style={styles.title}>You're Premium!</Text>
        <Text style={styles.subtitle}>You have access to all premium features.</Text>
        <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.goBack()}>
          <Text style={styles.ctaText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading offerings
  if (loadingOfferings) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading plans...</Text>
      </View>
    );
  }

  // Calculate savings if both monthly and annual are available
  const savingsPercent =
    offering?.monthly && offering?.annual
      ? Math.round(
          (1 - offering.annual.product.price / (offering.monthly.product.price * 12)) * 100,
        )
      : null;

  // Determine CTA text
  const selectedPkg = offering ? getSelectedPackage(offering, selectedPlan) : null;
  const hasTrial = selectedPkg?.product.introPrice && selectedPkg.product.introPrice.price === 0;
  const ctaLabel = hasTrial
    ? `Start Free Trial`
    : selectedPlan === 'lifetime'
      ? 'Purchase'
      : 'Subscribe';

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      bounces={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Ionicons name="star" size={64} color={COLORS.warning} />
        <Text style={styles.title}>UpNext Premium</Text>
        <Text style={styles.subtitle}>
          {isOnboarding
            ? 'Your 14-day free trial includes:'
            : 'Unlock your full viewing experience'}
        </Text>
      </View>

      {/* Features */}
      <View style={styles.featureList}>
        {FEATURES.map((feature) => (
          <View key={feature.label} style={styles.featureRow}>
            <Ionicons name={feature.icon as any} size={20} color={COLORS.primary} />
            <Text style={styles.featureText}>{feature.label}</Text>
          </View>
        ))}
      </View>

      {/* Plan Cards */}
      {offering ? (
        <View style={styles.planCards}>
          {offering.monthly && (
            <PlanCard
              label="Monthly"
              priceText={`${offering.monthly.product.priceString}/month`}
              introPrice={offering.monthly.product.introPrice}
              selected={selectedPlan === 'monthly'}
              onSelect={() => setSelectedPlan('monthly')}
            />
          )}
          {offering.annual && (
            <PlanCard
              label="Annual"
              priceText={`${offering.annual.product.priceString}/year`}
              introPrice={offering.annual.product.introPrice}
              selected={selectedPlan === 'annual'}
              onSelect={() => setSelectedPlan('annual')}
              badge="BEST VALUE"
              subtitleParts={[
                offering.annual.product.pricePerMonthString
                  ? `${offering.annual.product.pricePerMonthString}/month`
                  : null,
                savingsPercent ? `Save ${savingsPercent}%` : null,
              ]}
            />
          )}
          {offering.lifetime && (
            <PlanCard
              label="Lifetime"
              priceText={offering.lifetime.product.priceString}
              selected={selectedPlan === 'lifetime'}
              onSelect={() => setSelectedPlan('lifetime')}
              subtitleParts={['Pay once, yours forever']}
            />
          )}
        </View>
      ) : (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Unable to load plans</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchOfferings}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CTA */}
      {offering && (
        <TouchableOpacity
          style={[styles.ctaButton, purchasing && styles.ctaDisabled]}
          onPress={handlePurchase}
          disabled={purchasing}
          activeOpacity={0.7}
        >
          {purchasing ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Maybe Later — onboarding mode only */}
      {isOnboarding && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={completeOnboarding}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Maybe Later</Text>
        </TouchableOpacity>
      )}

      {/* Restore */}
      <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
        <Text style={styles.restoreText}>Restore Purchases</Text>
      </TouchableOpacity>

      {/* Legal */}
      <View style={styles.legalRow}>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL('https://pwidd.notion.site/UpNext-Terms-of-Service')
          }
        >
          <Text style={styles.legalText}>Terms of Service</Text>
        </TouchableOpacity>
        <Text style={styles.legalDot}> · </Text>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL('https://pwidd.notion.site/UpNext-Privacy-Policy')
          }
        >
          <Text style={styles.legalText}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      {hasTrial && (
        <Text style={styles.trialDisclaimer}>
          Payment will be charged to your Apple ID account at the end of the free trial period.
          Subscription automatically renews unless it is canceled at least 24 hours before the end
          of the current period.
        </Text>
      )}
    </ScrollView>
  );
}

// --- Plan Card Component ---

interface PlanCardProps {
  label: string;
  priceText: string;
  introPrice?: PurchasesIntroPrice | null;
  selected: boolean;
  onSelect: () => void;
  badge?: string;
  subtitleParts?: (string | null)[];
}

function PlanCard({
  label,
  priceText,
  introPrice,
  selected,
  onSelect,
  badge,
  subtitleParts,
}: PlanCardProps) {
  const filteredSubtitle = subtitleParts?.filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      style={[
        styles.planCard,
        selected && styles.planCardSelected,
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <View style={styles.planCardHeader}>
        <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>{label}</Text>
        <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{priceText}</Text>
      </View>
      {filteredSubtitle && (
        <Text style={styles.planSubtitle}>{filteredSubtitle}</Text>
      )}
      {introPrice && introPrice.price === 0 && (
        <Text style={styles.trialText}>{formatTrialText(introPrice)}</Text>
      )}
    </TouchableOpacity>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  featureList: {
    gap: 14,
    alignSelf: 'stretch',
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: COLORS.text,
  },
  planCards: {
    alignSelf: 'stretch',
    gap: 12,
    marginBottom: 24,
  },
  planCard: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    backgroundColor: COLORS.surface,
  },
  planCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  planLabelSelected: {
    color: COLORS.primary,
  },
  planPrice: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  planPriceSelected: {
    color: COLORS.primary,
  },
  planSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  trialText: {
    fontSize: 13,
    color: COLORS.warning,
    fontWeight: '500',
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  ctaButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  skipText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  restoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  restoreText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '500',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  legalText: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
  legalDot: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
  trialDisclaimer: {
    fontSize: 11,
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  errorBox: {
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  errorText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  retryButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '500',
  },
});
