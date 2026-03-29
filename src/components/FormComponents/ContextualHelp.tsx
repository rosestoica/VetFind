/**
 * ContextualHelp Component
 *
 * Help icon with tooltip/modal for providing contextual help on form fields.
 * Part of Phase 3 redesign for improved form UX.
 *
 * Features:
 * - Question mark icon in circle
 * - Modal with help text and examples
 * - Professional styling with warm colors
 * - Optional custom icon
 *
 * Usage:
 * ```typescript
 * <ContextualHelp
 *   title="CUI Format"
 *   content="Enter your company's unique identifier (CUI). Format: RO12345678 or 12345678"
 *   examples={["RO12345678", "12345678"]}
 * />
 * ```
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

export interface ContextualHelpProps {
  /** Help modal title */
  title: string;

  /** Help content/description */
  content: string;

  /** Optional array of examples */
  examples?: string[];

  /** Optional custom icon name */
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * ContextualHelp Component
 * Provides contextual help for form fields via modal
 */
export const ContextualHelp = ({
  title,
  content,
  examples = [],
  icon = 'help-circle-outline',
}: ContextualHelpProps) => {
  const { colors, spacing, typography, styleHelpers, borderRadius } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const openHelp = () => setModalVisible(true);
  const closeHelp = () => setModalVisible(false);

  return (
    <>
      {/* Help Icon Button */}
      <TouchableOpacity
        onPress={openHelp}
        style={[
          styles.helpButton,
          {
            backgroundColor: colors.info[100],
            padding: spacing.xs,
            borderRadius: borderRadius.full,
          },
        ]}
        activeOpacity={0.7}
      >
        <Ionicons name={icon} size={20} color={colors.info.main} />
      </TouchableOpacity>

      {/* Help Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeHelp}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              styleHelpers.card('elevated'),
              {
                backgroundColor: colors.surface.card,
                padding: spacing.xl,
                margin: spacing.xl,
                borderRadius: borderRadius.lg,
                maxWidth: 400,
                width: '90%',
              },
            ]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.iconContainer, { backgroundColor: colors.info[100] }]}>
                <Ionicons name="information-circle" size={28} color={colors.info.main} />
              </View>

              <TouchableOpacity
                onPress={closeHelp}
                style={[
                  styles.closeButton,
                  {
                    backgroundColor: colors.surface.cream,
                    borderRadius: borderRadius.full,
                    padding: spacing.xs,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={colors.neutral[700]} />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text
              style={[
                typography.h3,
                {
                  color: colors.neutral[900],
                  marginTop: spacing.md,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              {title}
            </Text>

            {/* Content */}
            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={[
                  typography.body,
                  {
                    color: colors.neutral[700],
                    marginBottom: examples.length > 0 ? spacing.lg : 0,
                  },
                ]}
              >
                {content}
              </Text>

              {/* Examples */}
              {examples.length > 0 && (
                <View>
                  <Text
                    style={[
                      typography.label,
                      {
                        color: colors.neutral[900],
                        marginBottom: spacing.sm,
                      },
                    ]}
                  >
                    Examples:
                  </Text>

                  {examples.map((example, index) => (
                    <View
                      key={index}
                      style={[
                        styles.exampleItem,
                        {
                          backgroundColor: colors.surface.cream,
                          padding: spacing.md,
                          borderRadius: borderRadius.sm,
                          marginBottom: spacing.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.bodyMedium,
                          {
                            color: colors.primary.main,
                            fontWeight: '500',
                          },
                        ]}
                      >
                        {example}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              onPress={closeHelp}
              style={[
                styleHelpers.button('accent'),
                {
                  marginTop: spacing.lg,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  typography.body,
                  {
                    color: colors.white,
                    fontWeight: '600',
                  },
                ]}
              >
                Got it
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  helpButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalContent: {
    maxHeight: '80%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    maxHeight: 300,
  },

  exampleItem: {
    width: '100%',
  },
});
