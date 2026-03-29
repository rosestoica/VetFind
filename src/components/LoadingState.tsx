/**
 * LoadingState - Skeleton loader component
 *
 * Features:
 * - Pulsing animation (1.5s loop)
 * - Warm neutral backgrounds (per Redesign.md)
 * - Multiple skeleton types: card, list, appointment, compact
 * - Responsive sizing
 *
 * Usage:
 * <LoadingState type="card" count={3} />
 * <LoadingState type="appointment" count={2} />
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface LoadingStateProps {
  type?: 'card' | 'list' | 'appointment' | 'compact';
  count?: number;
}

export const LoadingState = ({ type = 'card', count = 1 }: LoadingStateProps) => {
  const { colors, responsive } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Start pulse animation on mount
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Interpolate opacity for pulse effect
  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  /**
   * Render skeleton based on type
   */
  const renderSkeleton = () => {
    const skeletonStyle = {
      backgroundColor: colors.surface.segmentTrack,
      opacity,
    };

    switch (type) {
      case 'card':
        return (
          <View
            style={[
              styles.cardSkeleton,
              {
                marginHorizontal: responsive.padding,
                padding: responsive.getValue(16, 20, 24),
              },
            ]}
          >
            {/* Image placeholder */}
            <Animated.View
              style={[
                styles.imageSkeleton,
                skeletonStyle,
                { height: responsive.getValue(140, 160, 180) },
              ]}
            />
            {/* Title */}
            <Animated.View
              style={[
                styles.titleSkeleton,
                skeletonStyle,
                { width: '70%', marginTop: 16 },
              ]}
            />
            {/* Subtitle */}
            <Animated.View
              style={[
                styles.subtitleSkeleton,
                skeletonStyle,
                { width: '90%', marginTop: 8 },
              ]}
            />
            <Animated.View
              style={[
                styles.subtitleSkeleton,
                skeletonStyle,
                { width: '60%', marginTop: 6 },
              ]}
            />
          </View>
        );

      case 'list':
        return (
          <View
            style={[
              styles.listSkeleton,
              {
                marginHorizontal: responsive.padding,
                paddingVertical: responsive.getValue(12, 16, 20),
              },
            ]}
          >
            <View style={styles.listRow}>
              {/* Avatar */}
              <Animated.View
                style={[
                  styles.avatarSkeleton,
                  skeletonStyle,
                  { width: 48, height: 48 },
                ]}
              />
              {/* Content */}
              <View style={styles.listContent}>
                <Animated.View
                  style={[styles.titleSkeleton, skeletonStyle, { width: '80%' }]}
                />
                <Animated.View
                  style={[
                    styles.subtitleSkeleton,
                    skeletonStyle,
                    { width: '60%', marginTop: 6 },
                  ]}
                />
              </View>
            </View>
          </View>
        );

      case 'appointment':
        return (
          <View
            style={[
              styles.appointmentSkeleton,
              {
                marginHorizontal: responsive.padding,
                padding: responsive.getValue(16, 20, 24),
              },
            ]}
          >
            {/* Header */}
            <View style={styles.appointmentHeader}>
              <Animated.View
                style={[
                  styles.avatarSkeleton,
                  skeletonStyle,
                  { width: 56, height: 56 },
                ]}
              />
              <View style={styles.appointmentHeaderText}>
                <Animated.View
                  style={[styles.titleSkeleton, skeletonStyle, { width: '90%' }]}
                />
                <Animated.View
                  style={[
                    styles.subtitleSkeleton,
                    skeletonStyle,
                    { width: '70%', marginTop: 6 },
                  ]}
                />
              </View>
            </View>
            {/* Details */}
            <View style={styles.appointmentDetails}>
              <Animated.View
                style={[
                  styles.subtitleSkeleton,
                  skeletonStyle,
                  { width: '50%', marginTop: 12 },
                ]}
              />
              <Animated.View
                style={[
                  styles.subtitleSkeleton,
                  skeletonStyle,
                  { width: '40%', marginTop: 6 },
                ]}
              />
            </View>
          </View>
        );

      case 'compact':
        return (
          <View
            style={[
              styles.compactSkeleton,
              {
                marginHorizontal: responsive.padding,
                paddingVertical: responsive.getValue(8, 12, 16),
              },
            ]}
          >
            <Animated.View
              style={[styles.titleSkeleton, skeletonStyle, { width: '60%' }]}
            />
            <Animated.View
              style={[
                styles.subtitleSkeleton,
                skeletonStyle,
                { width: '40%', marginTop: 6 },
              ]}
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.skeletonItem}>
          {renderSkeleton()}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skeletonItem: {
    marginBottom: 16,
  },
  cardSkeleton: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  imageSkeleton: {
    width: '100%',
    borderRadius: 12,
  },
  titleSkeleton: {
    height: 20,
    borderRadius: 6,
  },
  subtitleSkeleton: {
    height: 14,
    borderRadius: 4,
  },
  listSkeleton: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarSkeleton: {
    borderRadius: 999,
  },
  listContent: {
    flex: 1,
  },
  appointmentSkeleton: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appointmentHeaderText: {
    flex: 1,
  },
  appointmentDetails: {
    marginTop: 16,
  },
  compactSkeleton: {
    paddingHorizontal: 0,
  },
});

export default LoadingState;
