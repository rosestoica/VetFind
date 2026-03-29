import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text as PaperText, IconButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation.types';

import {
  ManageAppointmentsSection,
  getMonday,
  startOfLocalDay,
} from '../components/Dashboard/ManageAppointmentsSection';
import { theme } from '../theme';

/**
 * CompanyManageAppointmentsScreen
 *
 * Dedicated screen for managing a clinic's appointments.
 * Extracted from CompanyDashboardScreen to keep the dashboard lightweight.
 */
export const CompanyManageAppointmentsScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'CompanyManageAppointments'>>();
  const [calendarMode, setCalendarMode] = useState<'day' | 'week'>('week');
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [dayCalendarDate, setDayCalendarDate] = useState(() => startOfLocalDay(new Date()));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerBack}>
            <IconButton
              icon="arrow-left"
              iconColor={theme.colors.primary.main}
              size={24}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Înapoi"
            />
          </View>
          <View style={styles.headerTitleCenter} pointerEvents="none">
            <Ionicons name="calendar" size={24} color={theme.colors.primary.main} />
            <PaperText variant="titleLarge" style={styles.headerTitle} numberOfLines={1}>
              Gestionează programările tale
            </PaperText>
          </View>
          <View style={styles.headerRight}>
            <Button
              mode="contained"
              compact
              icon="plus"
              onPress={() => navigation.navigate('CompanyAddAppointment')}
              style={styles.addButton}
              contentStyle={styles.addButtonContent}
              labelStyle={styles.addButtonLabel}
            >
              Adaugă programare
            </Button>
          </View>
        </View>

        <View style={styles.calendarViewBar}>
          <View style={styles.calendarSegmentTrack}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: calendarMode === 'day' }}
              accessibilityLabel="Vizualizare zi"
              onPress={() => {
                setCalendarMode('day');
                setDayCalendarDate(startOfLocalDay(new Date()));
              }}
              style={({ pressed }) => [
                styles.calendarSegmentSide,
                calendarMode === 'day' && styles.calendarSegmentSideActive,
                pressed && styles.calendarSegmentPressed,
              ]}
            >
              <Text style={[styles.calendarSegmentText, calendarMode === 'day' && styles.calendarSegmentTextActive]}>
                Zi
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: calendarMode === 'week' }}
              accessibilityLabel="Vizualizare săptămână"
              onPress={() => {
                setCalendarMode('week');
                setWeekStart(getMonday(dayCalendarDate));
              }}
              style={({ pressed }) => [
                styles.calendarSegmentSide,
                calendarMode === 'week' && styles.calendarSegmentSideActive,
                pressed && styles.calendarSegmentPressed,
              ]}
            >
              <Text style={[styles.calendarSegmentText, calendarMode === 'week' && styles.calendarSegmentTextActive]}>
                Săptămână
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.content}>
          <ManageAppointmentsSection
            calendarMode={calendarMode}
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            dayCalendarDate={dayCalendarDate}
            setDayCalendarDate={setDayCalendarDate}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.surface.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surface.border,
    backgroundColor: theme.colors.surface.background,
    minHeight: 52,
  },
  headerBack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  headerTitleCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: 112,
    maxWidth: '100%',
  },
  headerTitle: {
    color: theme.colors.neutral[900],
    fontWeight: '700',
    flexShrink: 1,
  },
  headerRight: {
    position: 'absolute',
    right: theme.spacing.xs,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  addButton: {
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent.main,
  },
  addButtonContent: {
    flexDirection: 'row-reverse',
    paddingHorizontal: theme.spacing.sm,
    height: 36,
  },
  addButtonLabel: {
    color: theme.colors.white,
    fontWeight: '700',
  },
  calendarViewBar: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface.cream,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surface.border,
  },
  calendarSegmentTrack: {
    flexDirection: 'row',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface.segmentTrack,
    padding: 2,
    maxWidth: 260,
    width: '100%',
  },
  calendarSegmentSide: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    minHeight: 32,
  },
  calendarSegmentSideActive: {
    backgroundColor: theme.colors.white,
    ...theme.shadows.sm,
  },
  calendarSegmentPressed: {
    opacity: 0.9,
  },
  calendarSegmentText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: theme.colors.neutral[600],
    ...(Platform.OS === 'android'
      ? { fontFamily: 'sans-serif' as const, includeFontPadding: false }
      : {}),
  },
  calendarSegmentTextActive: {
    color: theme.colors.primary.main,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
});
