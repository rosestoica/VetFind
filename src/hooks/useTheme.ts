/**
 * useTheme Hook
 *
 * Custom hook for accessing theme and responsive utilities in functional components.
 * Provides easy access to colors, spacing, typography, shadows, and responsive helpers.
 *
 * Usage:
 * ```typescript
 * import { useTheme } from '@/hooks/useTheme';
 *
 * const MyComponent = () => {
 *   const { colors, spacing, responsive, typography } = useTheme();
 *
 *   return (
 *     <View style={{
 *       backgroundColor: colors.surface.background,
 *       padding: responsive.padding(),
 *       ...typography.h1
 *     }}>
 *       ...
 *     </View>
 *   );
 * };
 * ```
 */

import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { theme, styleHelpers } from '../theme';
import { responsive } from '../theme/responsive';

/**
 * useTheme Hook
 * Returns theme tokens and responsive utilities with reactive dimension updates
 */
export const useTheme = () => {
  // Track dimensions for reactive updates
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    // Subscribe to dimension changes
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    // Cleanup subscription on unmount
    return () => {
      subscription?.remove();
    };
  }, []);

  return {
    // Core theme tokens
    colors: theme.colors,
    spacing: theme.spacing,
    typography: theme.typography,
    borderRadius: theme.borderRadius,
    shadows: theme.shadows,
    zIndex: theme.zIndex,

    // Responsive utilities
    responsive: {
      // Dimensions
      width: dimensions.width,
      height: dimensions.height,

      // Device detection
      isPhone: responsive.isPhone(),
      isTablet: responsive.isTablet(),
      isDesktop: responsive.isDesktop(),
      isSmallPhone: responsive.isSmallPhone(),
      isLargeTablet: responsive.isLargeTablet(),
      deviceType: responsive.getDeviceType(),

      // Orientation
      isLandscape: responsive.isLandscape(),
      isPortrait: responsive.isPortrait(),

      // Layout utilities
      cardColumns: responsive.cardColumns(),
      padding: responsive.padding(),
      margin: responsive.margin(),
      gap: responsive.gap(),
      cardWidth: responsive.cardWidth(),

      // Component-specific
      timeSlotColumns: responsive.timeSlotColumns(),
      dateCardWidth: responsive.dateCardWidth(),
      formInputWidth: responsive.formInputWidth(),
      checkboxGridColumns: responsive.checkboxGridColumns(),
      modalMaxWidth: responsive.modalMaxWidth(),

      // Typography
      fontSizeMultiplier: responsive.fontSizeMultiplier(),
      responsiveTypography: responsive.responsiveTypography(),

      // Safe area
      safePadding: responsive.safePadding(),

      // Border radius
      adaptiveBorderRadius: responsive.adaptiveBorderRadius,

      // Utilities
      getValue: responsive.getValue,
      matchesBreakpoint: responsive.matchesBreakpoint,
      shouldUseSideBySideInputs: responsive.shouldUseSideBySideInputs(),
    },

    // Style helpers
    styleHelpers: {
      card: styleHelpers.card,
      button: styleHelpers.button,
      input: styleHelpers.input,
      badge: styleHelpers.badge,
      chip: styleHelpers.chip,
      divider: styleHelpers.divider,
      centerContent: styleHelpers.centerContent,
      flexContainer: styleHelpers.flexContainer,
    },
  };
};

/**
 * Type export for useTheme return value
 */
export type UseThemeReturn = ReturnType<typeof useTheme>;
