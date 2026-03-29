/**
 * EnhancedProgressIndicator Component
 *
 * Improved progress tracker for multi-step forms with:
 * - Visual step completion with checkmarks (✓)
 * - Current step highlighted with terracotta accent (#ea580c)
 * - Progress percentage (e.g., "75% Complete")
 * - Step validation status (complete/incomplete/error)
 * - Tap to navigate to previous completed steps
 *
 * Part of Phase 3 redesign for enhanced form experience.
 *
 * Usage:
 * ```typescript
 * <EnhancedProgressIndicator
 *   currentStep={2}
 *   totalSteps={4}
 *   stepLabels={["Basic Info", "Location", "Services", "Pricing"]}
 *   completedSteps={[0, 1]}
 *   onStepPress={(stepIndex) => navigateToStep(stepIndex)}
 * />
 * ```
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

export interface EnhancedProgressIndicatorProps {
  /** Current active step (0-indexed) */
  currentStep: number;

  /** Total number of steps */
  totalSteps: number;

  /** Labels for each step */
  stepLabels: string[];

  /** Array of completed step indices */
  completedSteps: number[];

  /** Optional array of step indices with errors */
  errorSteps?: number[];

  /** Callback when a step is pressed (only for completed steps) */
  onStepPress?: (stepIndex: number) => void;
}

/**
 * EnhancedProgressIndicator Component
 * Professional multi-step form progress tracker
 */
export const EnhancedProgressIndicator = ({
  currentStep,
  totalSteps,
  stepLabels,
  completedSteps,
  errorSteps = [],
  onStepPress,
}: EnhancedProgressIndicatorProps) => {
  const { colors, spacing, typography } = useTheme();

  // Calculate progress percentage
  const progressPercentage = Math.round((completedSteps.length / totalSteps) * 100);

  // Determine step status
  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'error' | 'incomplete' => {
    if (errorSteps.includes(stepIndex)) return 'error';
    if (completedSteps.includes(stepIndex)) return 'completed';
    if (stepIndex === currentStep) return 'current';
    return 'incomplete';
  };

  // Get step colors based on status
  const getStepColors = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          bg: colors.success.main,
          border: colors.success.main,
          text: colors.white,
          icon: 'checkmark',
        };
      case 'current':
        return {
          bg: colors.accent.main, // Terracotta for current step
          border: colors.accent.main,
          text: colors.white,
          icon: null,
        };
      case 'error':
        return {
          bg: colors.error.main,
          border: colors.error.main,
          text: colors.white,
          icon: 'alert-circle',
        };
      default:
        return {
          bg: colors.surface.cream,
          border: colors.surface.border,
          text: colors.neutral[500],
          icon: null,
        };
    }
  };

  return (
    <View style={[styles.container, { padding: spacing.lg }]}>
      {/* Progress Percentage */}
      <View
        style={[
          styles.percentageContainer,
          {
            backgroundColor: colors.primary[100],
            padding: spacing.sm,
            marginBottom: spacing.md,
            borderRadius: 8,
          },
        ]}
      >
        <Text
          style={[
            typography.label,
            {
              color: colors.primary[700],
              fontWeight: '700',
            },
          ]}
        >
          {progressPercentage}% Completat
        </Text>
      </View>

      {/* Progress Bar */}
      <View
        style={[
          styles.progressBarBackground,
          {
            backgroundColor: colors.surface.segmentTrack,
            height: 4,
            borderRadius: 2,
            marginBottom: spacing.lg,
          },
        ]}
      >
        <View
          style={[
            styles.progressBarFill,
            {
              backgroundColor: colors.accent.main, // Terracotta progress bar
              width: `${progressPercentage}%`,
              height: '100%',
              borderRadius: 2,
            },
          ]}
        />
      </View>

      {/* Step Indicators */}
      <View style={styles.stepsContainer}>
        {stepLabels.map((label, index) => {
          const status = getStepStatus(index);
          const stepColors = getStepColors(status);
          const isClickable = completedSteps.includes(index) && index !== currentStep;

          return (
            <View key={index} style={styles.stepWrapper}>
              {/* Step Circle */}
              <TouchableOpacity
                onPress={() => isClickable && onStepPress?.(index)}
                disabled={!isClickable}
                activeOpacity={isClickable ? 0.6 : 1}
                style={[
                  styles.stepCircle,
                  {
                    backgroundColor: stepColors.bg,
                    borderColor: stepColors.border,
                    borderWidth: 2,
                  },
                ]}
              >
                {stepColors.icon ? (
                  <Ionicons name={stepColors.icon as any} size={16} color={stepColors.text} />
                ) : (
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: stepColors.text,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Step Label */}
              <Text
                style={[
                  typography.caption,
                  {
                    color:
                      status === 'current' ? colors.accent.main : colors.neutral[600],
                    textAlign: 'center',
                    marginTop: spacing.xs,
                    fontWeight: status === 'current' ? '700' : '400',
                  },
                ]}
                numberOfLines={2}
              >
                {label}
              </Text>

              {/* Connector Line (not for last step) */}
              {index < totalSteps - 1 && (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor: completedSteps.includes(index)
                        ? colors.success.main
                        : colors.neutral[300],
                    },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  percentageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },

  progressBarBackground: {
    width: '100%',
    overflow: 'hidden',
  },

  progressBarFill: {
    transition: 'width 0.3s ease-in-out',
  },

  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    position: 'relative',
  },

  stepWrapper: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },

  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  connector: {
    position: 'absolute',
    top: 16,
    left: '50%',
    width: '100%',
    height: 2,
    zIndex: -1,
  },
});
