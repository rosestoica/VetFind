/**
 * FormSection Component
 *
 * Card-based wrapper for form sections with title, subtitle, and icon.
 * Part of Phase 3 redesign for card-based form layouts.
 *
 * Features:
 * - Card backgrounds (typically white / surface.card)
 * - Optional icon and subtitle
 * - Consistent padding and spacing
 * - Responsive behavior
 *
 * Usage:
 * ```typescript
 * <FormSection
 *   title="Basic Information"
 *   subtitle="Company name, contact details"
 *   icon="business-outline"
 * >
 *   {/* Form fields here *\/}
 * </FormSection>
 * ```
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

export interface FormSectionProps {
  /** Section title */
  title: string;

  /** Optional subtitle for additional context */
  subtitle?: string;

  /** Optional Ionicons icon name */
  icon?: keyof typeof Ionicons.glyphMap;

  /** Child form elements */
  children: React.ReactNode;

  /** Optional custom styles */
  style?: ViewStyle;

  /** Optional custom background color */
  backgroundColor?: string;
}

/**
 * FormSection Component
 * Card wrapper for form sections with professional styling
 */
export const FormSection = ({
  title,
  subtitle,
  icon,
  children,
  style,
  backgroundColor,
}: FormSectionProps) => {
  const { colors, spacing, typography, styleHelpers } = useTheme();

  return (
    <View
      style={[
        styles.container,
        styleHelpers.card('elevated'),
        {
          backgroundColor: backgroundColor || colors.surface.card,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        },
        style,
      ]}
    >
      {/* Section Header */}
      <View style={styles.header}>
        {icon && (
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: colors.primary[100],
                marginRight: spacing.md,
              },
            ]}
          >
            <Ionicons name={icon} size={24} color={colors.primary.main} />
          </View>
        )}

        <View style={styles.headerText}>
          <Text
            style={[
              typography.h3,
              {
                color: colors.neutral[900],
                marginBottom: subtitle ? spacing.xs : 0,
              },
            ]}
          >
            {title}
          </Text>

          {subtitle && (
            <Text
              style={[
                typography.bodySmall,
                {
                  color: colors.neutral[600],
                },
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {/* Divider */}
      <View
        style={[
          styleHelpers.divider('horizontal'),
          {
            marginVertical: spacing.lg,
          },
        ]}
      />

      {/* Form Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    flex: 1,
    justifyContent: 'center',
  },

  content: {
    width: '100%',
  },
});
