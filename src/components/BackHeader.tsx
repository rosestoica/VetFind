/**
 * BackHeader - Reusable header with back button (top-left)
 * Used on all non-dashboard screens for Pet Owner and Vet Company flows.
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';

export interface BackHeaderProps {
  title?: string;
  onBack?: () => void;
  backgroundColor?: string;
  iconColor?: string;
  titleColor?: string;
  style?: ViewStyle;
}

export const BackHeader: React.FC<BackHeaderProps> = ({
  title,
  onBack,
  backgroundColor = theme.colors.white,
  iconColor = theme.colors.neutral[800],
  titleColor = theme.colors.neutral[900],
  style,
}) => {
  const navigation = useNavigation();
  const handleBack = onBack ?? (() => navigation.goBack());

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <TouchableOpacity
        onPress={handleBack}
        style={styles.backButton}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Înapoi"
      >
        <Ionicons name="arrow-back" size={24} color={iconColor} />
      </TouchableOpacity>
      {title != null && title !== '' && (
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 48,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
});
