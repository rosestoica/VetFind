import React, { useState, useEffect, useMemo, type CSSProperties } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  Modal,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text, Card, ActivityIndicator, Chip, IconButton, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import { Appointment } from '../../types/appointment.types';
import { theme } from '../../theme';
import { EditAppointmentModal } from './EditAppointmentModal';
import { getAppointmentClientPhone } from '../../utils/appointmentClientPhone';
import { useCompany } from '../../context/CompanyContext';
import type { OpeningHours } from '../../types/company.types';

const DEFAULT_HOUR_START = 8;
const DEFAULT_HOUR_END = 18;
const SLOT_HEIGHT = 44;
const SLOTS_PER_HOUR = 2;
/** Minute reprezentate de un rând din grilă (30 când sunt 2 sloturi/oră). */
const MINUTES_PER_GRID_ROW = 60 / SLOTS_PER_HOUR;
/** Minim chenar doar cât un rând text + padding discret (programări foarte scurte); duratele mai mari rămân proporționale. */
const MIN_APPOINTMENT_BLOCK_HEIGHT = 26;
/** De la această înălțime afișăm ora și numele pe rânduri separate (nume până la 2 rânduri). */
const BLOCK_HEIGHT_FOR_TWO_ROW_LABELS = 52;
const TIME_COLUMN_WIDTH = 52;
const DAY_LABELS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

/** Parse "HH:MM" to decimal hours (e.g. "09:30" -> 9.5). */
function parseTimeToHours(time: string | null): number | null {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h + m / 60;
}

/** Min open hour and max close hour across all days (for calendar range). */
function getOpeningHoursRange(hours?: OpeningHours | null): { hourStart: number; hourEnd: number } {
  if (!hours) return { hourStart: DEFAULT_HOUR_START, hourEnd: DEFAULT_HOUR_END };
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  let minOpen: number | null = null;
  let maxClose: number | null = null;
  for (const day of days) {
    const s = hours[day];
    if (!s || s.closed || !s.open || !s.close) continue;
    const openH = parseTimeToHours(s.open);
    const closeH = parseTimeToHours(s.close);
    if (openH != null && closeH != null) {
      if (minOpen == null || openH < minOpen) minOpen = openH;
      if (maxClose == null || closeH > maxClose) maxClose = closeH;
    }
  }
  if (minOpen == null || maxClose == null) return { hourStart: DEFAULT_HOUR_START, hourEnd: DEFAULT_HOUR_END };
  return {
    hourStart: Math.floor(minOpen),
    hourEnd: Math.ceil(maxClose),
  };
}

export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekEnd(monday: Date): Date {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Start of local calendar day (00:00:00.000). */
export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Pe web, `@react-native-community/datetimepicker` nu randează nimic (returnează null).
 * Folosim input HTML nativ ca selector de zi.
 */
function WebDatePickerInput({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const str = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const webStyle: CSSProperties = {
    width: '100%',
    maxWidth: 320,
    padding: 14,
    fontSize: 16,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.neutral[300]}`,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    boxSizing: 'border-box',
  };
  return React.createElement('input', {
    type: 'date',
    value: str,
    onChange: (e: { target: { value: string } }) => {
      const v = e.target.value;
      if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [yy, mm, dd] = v.split('-').map(Number);
        onChange(startOfLocalDay(new Date(yy, mm - 1, dd, 12, 0, 0, 0)));
      }
    },
    style: webStyle,
  });
}

/** End of local calendar day (23:59:59.999). */
function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatWeekRange(monday: Date): string {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  return `${monday.getDate()} - ${end.getDate()} ${end.toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' })}`;
}

/** Total duration (sum of all services) for positioning and end-time. */
function getAppointmentTotalDuration(app: Appointment): number {
  const a = app as any;
  if (typeof a.total_duration_minutes === 'number' && a.total_duration_minutes > 0) {
    return a.total_duration_minutes;
  }
  let list: Array<{ duration_minutes?: number }> = [];
  if (Array.isArray(a.services) && a.services.length) list = a.services;
  else if (Array.isArray(a.selected_services) && a.selected_services.length) list = a.selected_services;
  else if (Array.isArray(a.service) && a.service.length) list = a.service;
  else if (a.service_name || a.service) list = [{ duration_minutes: a.service?.duration_minutes ?? 30 }];
  const total = list.reduce((sum, s) => sum + Number(s?.duration_minutes ?? 0), 0);
  return total || 30;
}

function isAppointmentPastEndTime(app: Appointment): boolean {
  const startDate = new Date(app.appointment_date);
  if (Number.isNaN(startDate.getTime())) return false;
  const start = startDate.getTime();
  const durationMin = getAppointmentTotalDuration(app);
  const durationMs = durationMin * 60 * 1000;
  const endTime = start + durationMs;
  return Date.now() >= endTime;
}

function getAppointmentServiceLabels(app: Appointment): string[] {
  const a = app as any;
  const label = (x: any) => String(x?.service_name || x?.name || '').trim();
  if (Array.isArray(a.services) && a.services.length) {
    return a.services.map(label).filter(Boolean);
  }
  if (Array.isArray(a.selected_services) && a.selected_services.length) {
    return a.selected_services.map(label).filter(Boolean);
  }
  if (app.service_name) return [String(app.service_name).trim()].filter(Boolean);
  if (app.service?.service_name) return [String(app.service.service_name).trim()].filter(Boolean);
  return [];
}

/** Estimează câte rânduri ocupă textul servicii separate prin „ · ” la lățime dată. */
function estimateServiceLines(servicesJoined: string, innerWidthPx: number, avgCharPx = 5.7): number {
  if (!servicesJoined.trim()) return 0;
  const cpl = Math.max(5, Math.floor(innerWidthPx / avgCharPx));
  let lines = 1;
  let curLen = 0;
  const parts = servicesJoined.split(' · ');
  for (let i = 0; i < parts.length; i++) {
    const piece = i === 0 ? parts[i] : ` · ${parts[i]}`;
    if (curLen + piece.length <= cpl) {
      curLen += piece.length;
    } else {
      lines++;
      curLen = parts[i].length;
    }
  }
  return lines;
}

function estimateDayAppointmentCardHeight(innerWidthPx: number, servicesJoined: string): number {
  const padV = 8;
  const nameLine = 16;
  const rowLine = 14;
  const serviceLine = 13;
  let h = padV + nameLine + 2 + rowLine;
  if (servicesJoined) {
    h += estimateServiceLines(servicesJoined, innerWidthPx) * serviceLine;
  }
  return Math.ceil(h) + 6;
}

type DayPlacedBlock = {
  app: Appointment;
  startMin: number;
  endMin: number;
  durationMin: number;
  top: number;
  height: number;
  timeStr: string;
  clientName: string;
  servicesJoined: string;
  color: string;
};

function yAtMinuteOnHourHeights(
  minuteFromGrid: number,
  hourHeights: number[],
  gridMinutes: number
): number {
  if (minuteFromGrid <= 0) return 0;
  const total = hourHeights.reduce((a, b) => a + b, 0);
  if (minuteFromGrid >= gridMinutes) return total;
  const hourSpan = hourHeights.length;
  const hi = Math.min(Math.floor(minuteFromGrid / 60), hourSpan - 1);
  const u = minuteFromGrid - hi * 60;
  let y = 0;
  for (let k = 0; k < hi; k++) y += hourHeights[k];
  y += (u / 60) * hourHeights[hi];
  return y;
}

function hourIndicesForInterval(
  startMin: number,
  endMin: number,
  hourSpan: number,
  gridMinutes: number
): number[] {
  const s = Math.max(0, startMin);
  const e = Math.min(endMin, gridMinutes);
  if (e <= s) return [];
  const h0 = Math.floor(s / 60);
  const h1 = Math.min(hourSpan - 1, Math.floor((e - 1e-6) / 60));
  const out: number[] = [];
  for (let h = Math.max(0, h0); h <= h1; h++) out.push(h);
  return out;
}

/** Mărește înălțimea orelor de la `fromHour` în coloană, astfel încât pozițiile de timp de la acea oră în jos coboară cu ~extraPx. */
function expandHourSuffix(fromHour: number, extraPx: number, hourHeights: number[]): void {
  if (extraPx <= 0) return;
  const span = hourHeights.length;
  let suffix = 0;
  for (let k = Math.max(0, fromHour); k < span; k++) suffix += hourHeights[k];
  if (suffix < 1) suffix = 1;
  const factor = (suffix + extraPx) / suffix;
  for (let k = Math.max(0, fromHour); k < span; k++) hourHeights[k] *= factor;
}

function computeDayDynamicLayout(
  appointments: Appointment[],
  hourStart: number,
  hourEnd: number,
  innerColumnWidth: number,
  getStatusColor: (status: string) => string,
  getBlockColor?: (app: Appointment) => string
): { totalHeight: number; hourHeights: number[]; blocks: DayPlacedBlock[] } {
  const gridMinutes = (hourEnd - hourStart) * 60;
  const hourSpan = hourEnd - hourStart;
  if (gridMinutes <= 0 || hourSpan <= 0) {
    return { totalHeight: 0, hourHeights: [], blocks: [] };
  }

  const H0 = SLOTS_PER_HOUR * SLOT_HEIGHT;
  const hourHeights = Array.from({ length: hourSpan }, () => H0);

  type Parsed = {
    app: Appointment;
    startMin: number;
    durationMin: number;
    endMinFull: number;
    endMinClip: number;
    contentHeight: number;
    timeStr: string;
    clientName: string;
    servicesJoined: string;
    color: string;
  };

  const parsed: Parsed[] = [];
  for (const app of appointments) {
    const d = new Date(app.appointment_date);
    const hdec = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    if (hdec < hourStart || hdec >= hourEnd) continue;
    const startMin = (hdec - hourStart) * 60;
    const durationMin = getAppointmentTotalDuration(app);
    const endMinFull = startMin + durationMin;
    const endMinClip = Math.min(endMinFull, gridMinutes);
    const timeStr = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    const clientName = String((app as any).user_name || 'Client');
    const servicesJoined = getAppointmentServiceLabels(app).join(' · ');
    const contentHeight = estimateDayAppointmentCardHeight(innerColumnWidth, servicesJoined);
    const color = getBlockColor ? getBlockColor(app) : getStatusColor(app.status);
    parsed.push({
      app,
      startMin,
      durationMin,
      endMinFull,
      endMinClip,
      contentHeight,
      timeStr,
      clientName,
      servicesJoined,
      color,
    });
  }
  parsed.sort((a, b) => a.startMin - b.startMin);

  const EPS = 0.75;

  // Faza 1: text mai înalt decât banda proporțională duratei → mărim întreaga/întregile ore atinse
  for (let pass = 0; pass < 28; pass++) {
    let changed = false;
    for (const p of parsed) {
      const y0 = yAtMinuteOnHourHeights(p.startMin, hourHeights, gridMinutes);
      const y1 = yAtMinuteOnHourHeights(Math.min(p.endMinFull, gridMinutes), hourHeights, gridMinutes);
      const span = Math.max(EPS, y1 - y0);
      if (p.contentHeight > span + EPS) {
        const f = p.contentHeight / span;
        for (const h of hourIndicesForInterval(p.startMin, p.endMinFull, hourSpan, gridMinutes)) {
          hourHeights[h] *= f;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // Faza 2: fără suprapunere — dacă două intervale se calculează în același spațiu, lărgim orele de la ora început în jos
  let blocks: DayPlacedBlock[] = [];

  for (let outer = 0; outer < 36; outer++) {
    let expanded = false;
    blocks = [];

    for (const p of parsed) {
      const y0 = yAtMinuteOnHourHeights(p.startMin, hourHeights, gridMinutes);
      const y1 = yAtMinuteOnHourHeights(Math.min(p.endMinFull, gridMinutes), hourHeights, gridMinutes);
      const spanDur = Math.max(EPS, y1 - y0);
      const height = Math.max(spanDur, p.contentHeight, MIN_APPOINTMENT_BLOCK_HEIGHT);
      let top = y0;
      for (const q of blocks) {
        if (top < q.top + q.height - EPS && top + height > q.top + EPS) {
          top = Math.max(top, q.top + q.height);
        }
      }
      if (top > y0 + EPS) {
        const gap = top - y0;
        const hi = Math.min(Math.floor(p.startMin / 60), hourSpan - 1);
        expandHourSuffix(hi, gap, hourHeights);
        expanded = true;
        break;
      }
      blocks.push({
        app: p.app,
        startMin: p.startMin,
        endMin: p.endMinClip,
        durationMin: p.durationMin,
        top,
        height,
        timeStr: p.timeStr,
        clientName: p.clientName,
        servicesJoined: p.servicesJoined,
        color: p.color,
      });
    }

    if (!expanded) break;
  }

  const totalHeight = hourHeights.reduce((a, b) => a + b, 0);
  return { totalHeight, hourHeights, blocks };
}

function DayAppointmentCardContent({
  clientName,
  timeStr,
  servicesJoined,
}: {
  clientName: string;
  timeStr: string;
  servicesJoined: string;
}) {
  return (
    <View style={styles.dayCardInner}>
      <Text variant="bodyMedium" style={styles.dayCardName} numberOfLines={2}>
        {clientName}
      </Text>
      <Text style={styles.dayCardTime}>{timeStr}</Text>
      {servicesJoined ? <Text style={styles.dayCardServices}>{servicesJoined}</Text> : null}
    </View>
  );
}

interface ScheduleCalendarViewProps {
  mode: 'day' | 'week';
  /** Zi (00:00) sau luni săptămânii (00:00), în funcție de mod. */
  periodStart: Date;
  onPrev: () => void;
  onNext: () => void;
  appointments: Appointment[];
  onAppointmentPress: (a: Appointment) => void;
  getStatusColor: (status: string) => string;
  getBlockColor?: (app: Appointment) => string;
  hourStart: number;
  hourEnd: number;
  screenWidth: number;
  contentPadding: number;
  /** Mod zi: deschide selectorul de dată din antet (emoji + calendar). */
  onSelectDayDate?: (date: Date) => void;
}

function formatDayTitle(day: Date): string {
  return day.toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function CalendarAppointmentBlockLabels({
  timeStr,
  clientName,
  compact,
}: {
  timeStr: string;
  clientName: string;
  compact: boolean;
}) {
  if (compact) {
    return (
      <Text style={styles.blockCompactLine} numberOfLines={1} ellipsizeMode="tail">
        <Text style={styles.blockTimeInline}>{timeStr}</Text>
        <Text style={styles.blockNameInline}> · {clientName}</Text>
      </Text>
    );
  }
  return (
    <>
      <Text variant="labelSmall" style={styles.blockTime} numberOfLines={1} ellipsizeMode="tail">
        {timeStr}
      </Text>
      <Text variant="bodySmall" style={styles.blockName} numberOfLines={2} ellipsizeMode="tail">
        {clientName}
      </Text>
    </>
  );
}

function ScheduleCalendarView({
  mode,
  periodStart,
  onPrev,
  onNext,
  appointments,
  onAppointmentPress,
  getStatusColor,
  getBlockColor,
  hourStart,
  hourEnd,
  screenWidth,
  contentPadding,
  onSelectDayDate,
}: ScheduleCalendarViewProps) {
  const [calendarLayoutWidth, setCalendarLayoutWidth] = useState<number | null>(null);
  const [showDayDatePicker, setShowDayDatePicker] = useState(false);
  const [iosPickerDate, setIosPickerDate] = useState(() => startOfLocalDay(new Date()));

  const onCalendarContainerLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w <= 0) return;
    setCalendarLayoutWidth((prev) => (prev != null && Math.abs(prev - w) < 0.5 ? prev : w));
  };

  const numCols = mode === 'week' ? 7 : 1;
  const periodEnd = useMemo(
    () => (mode === 'week' ? getWeekEnd(periodStart) : endOfLocalDay(periodStart)),
    [mode, periodStart]
  );

  const { dayWidth, gridTotalWidth } = useMemo(() => {
    const fallback = Math.max(260, screenWidth - contentPadding);
    const usableBase =
      calendarLayoutWidth != null && calendarLayoutWidth > 0 ? calendarLayoutWidth : fallback;
    const usable = Math.max(260, usableBase);
    if (mode === 'week') {
      const dw = (usable - TIME_COLUMN_WIDTH) / 7;
      return { dayWidth: dw, gridTotalWidth: TIME_COLUMN_WIDTH + 7 * dw };
    }
    const targetTotal = Math.round(Math.min(Math.max(usable * 0.8, 320), 492));
    const dw = Math.max(188, targetTotal - TIME_COLUMN_WIDTH);
    return { dayWidth: dw, gridTotalWidth: TIME_COLUMN_WIDTH + dw };
  }, [mode, screenWidth, contentPadding, calendarLayoutWidth]);

  const totalSlots = (hourEnd - hourStart) * SLOTS_PER_HOUR;
  const gridHeight = totalSlots * SLOT_HEIGHT;

  const appointmentsInRange = useMemo(() => {
    const start = periodStart.getTime();
    const end = periodEnd.getTime();
    return appointments.filter((a) => {
      const t = new Date(a.appointment_date).getTime();
      return t >= start && t <= end;
    });
  }, [appointments, periodStart, periodEnd]);

  const dayCardInnerEstimateWidth = Math.max(72, dayWidth - 28);

  const dayDynamicLayout = useMemo(() => {
    if (mode !== 'day') return null;
    return computeDayDynamicLayout(
      appointmentsInRange,
      hourStart,
      hourEnd,
      dayCardInnerEstimateWidth,
      getStatusColor,
      getBlockColor
    );
  }, [mode, appointmentsInRange, hourStart, hourEnd, dayCardInnerEstimateWidth, getStatusColor, getBlockColor]);

  const headerDays = useMemo(() => {
    if (mode === 'week') {
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(periodStart);
        d.setDate(d.getDate() + i);
        days.push(d);
      }
      return days;
    }
    return [startOfLocalDay(periodStart)];
  }, [mode, periodStart]);

  const appointmentBlocks = useMemo(() => {
    if (mode === 'day') {
      return [];
    }
    return appointmentsInRange.map((app) => {
      const d = new Date(app.appointment_date);
      const dayIndex = Math.floor((d.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));
      if (dayIndex < 0 || dayIndex > 6) return null;
      const hours = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
      if (hours < hourStart || hours >= hourEnd) return null;
      const durationMin = getAppointmentTotalDuration(app);
      const top = (hours - hourStart) * SLOT_HEIGHT * SLOTS_PER_HOUR;
      const heightRaw = (durationMin / MINUTES_PER_GRID_ROW) * SLOT_HEIGHT;
      const height = Math.max(MIN_APPOINTMENT_BLOCK_HEIGHT, heightRaw);
      const left = TIME_COLUMN_WIDTH + dayIndex * dayWidth + 2;
      const width = dayWidth - 4;
      const timeStr = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
      const color = getBlockColor ? getBlockColor(app) : getStatusColor(app.status);
      const clientName = String((app as any).user_name || 'Client');
      const compact = height < BLOCK_HEIGHT_FOR_TWO_ROW_LABELS;
      return {
        app,
        left,
        top,
        width,
        height,
        timeStr,
        clientName,
        compact,
        color,
      };
    }).filter(Boolean) as Array<{
      app: Appointment;
      left: number;
      top: number;
      width: number;
      height: number;
      timeStr: string;
      clientName: string;
      compact: boolean;
      color: string;
    }>;
  }, [appointmentsInRange, mode, periodStart, getStatusColor, getBlockColor, hourStart, hourEnd, dayWidth]);

  const rangeTitle =
    mode === 'week' ? formatWeekRange(periodStart) : formatDayTitle(headerDays[0]);

  return (
    <View style={styles.calendarContainer} onLayout={onCalendarContainerLayout}>
      <View style={styles.weekNav}>
        <TouchableOpacity
          onPress={onPrev}
          style={styles.weekNavButton}
          accessibilityLabel={mode === 'week' ? 'Săptămâna precedentă' : 'Ziua anterioară'}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary.main} />
          <Text variant="bodyMedium" style={styles.weekNavLabel}>
            {mode === 'week' ? 'Săpt. precedentă' : 'Ziua anterioară'}
          </Text>
        </TouchableOpacity>
        <View style={styles.weekNavTitleBlock}>
          <Text variant="titleSmall" style={[styles.weekNavTitle, mode === 'day' && styles.weekNavTitleDay]} numberOfLines={2}>
            {rangeTitle}
          </Text>
          {mode === 'day' && onSelectDayDate ? (
            <Pressable
              onPress={() => {
                setIosPickerDate(startOfLocalDay(periodStart));
                setShowDayDatePicker(true);
              }}
              style={styles.weekNavCalendarIconHit}
              accessibilityRole="button"
              accessibilityLabel="Alege ziua în calendar"
            >
              <Ionicons name="calendar-outline" size={22} color={theme.colors.neutral[800]} />
            </Pressable>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={onNext}
          style={styles.weekNavButton}
          accessibilityLabel={mode === 'week' ? 'Săptămâna următoare' : 'Ziua următoare'}
        >
          <Text variant="bodyMedium" style={styles.weekNavLabel}>
            {mode === 'week' ? 'Săpt. următoare' : 'Ziua următoare'}
          </Text>
          <Ionicons name="chevron-forward" size={24} color={theme.colors.primary.main} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.calendarScroll} showsVerticalScrollIndicator={true}>
        {mode === 'day' ? (
          dayDynamicLayout ? (
            <View style={styles.dayCalendarCenterWrap}>
              <View style={styles.dayModeOuterFrame}>
                <View style={[styles.calendarGrid, styles.calendarGridDayMode, { width: gridTotalWidth }]}>
                  <View style={[styles.calendarRow, styles.headerRow, { height: 36 }]}>
                    <View style={[styles.timeCell, { width: TIME_COLUMN_WIDTH }]} />
                    {headerDays.map((day, i) => {
                      const labelIdx = (day.getDay() + 6) % 7;
                      return (
                        <View key={i} style={[styles.dayCell, { width: dayWidth }]}>
                          <Text variant="labelSmall" style={styles.dayLabel}>{DAY_LABELS[labelIdx]}</Text>
                          <Text variant="bodySmall" style={styles.dayNum}>{day.getDate()}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={[styles.gridBody, { height: dayDynamicLayout.totalHeight }]}>
                    {Array.from({ length: hourEnd - hourStart }, (_, hi) => {
                      const rowH = dayDynamicLayout.hourHeights[hi] ?? SLOTS_PER_HOUR * SLOT_HEIGHT;
                      const hour = hourStart + hi;
                      return (
                        <View
                          key={hi}
                          style={[
                            styles.calendarRowDayDynamic,
                            { height: rowH },
                            hi > 0 && styles.calendarRowHourLine,
                          ]}
                        >
                          <View style={[styles.timeCell, styles.timeCellGrid, { width: TIME_COLUMN_WIDTH }]}>
                            <Text variant="bodySmall" style={styles.timeLabel}>
                              {`${hour.toString().padStart(2, '0')}:00`}
                            </Text>
                          </View>
                          {headerDays.map((_, j) => (
                            <View key={j} style={[styles.daySlot, { width: dayWidth }]} />
                          ))}
                        </View>
                      );
                    })}
                  </View>
                  <View
                    style={[
                      styles.blocksOverlay,
                      { width: gridTotalWidth, height: dayDynamicLayout.totalHeight + 36 },
                    ]}
                    pointerEvents="box-none"
                  >
                    {dayDynamicLayout.blocks.map((b) => (
                      <TouchableOpacity
                        key={b.app.id}
                        style={[
                          styles.appointmentBlock,
                          styles.appointmentBlockDayRich,
                          {
                            left: TIME_COLUMN_WIDTH + 2,
                            top: 36 + b.top,
                            width: dayWidth - 4,
                            height: b.height,
                          },
                        ]}
                        onPress={() => onAppointmentPress(b.app)}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.appointmentBlockAccent, { backgroundColor: b.color }]} />
                        <View style={styles.appointmentBlockInnerDayRich}>
                          <DayAppointmentCardContent
                            clientName={b.clientName}
                            timeStr={b.timeStr}
                            servicesJoined={b.servicesJoined}
                          />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          ) : null
        ) : (
          <View style={styles.weekCalendarFill}>
            <View style={[styles.calendarGrid, { width: gridTotalWidth }]}>
              <View style={[styles.calendarRow, styles.headerRow, { height: 36 }]}>
                <View style={[styles.timeCell, { width: TIME_COLUMN_WIDTH }]} />
                {headerDays.map((day, i) => {
                  const labelIdx = mode === 'week' ? i : (day.getDay() + 6) % 7;
                  return (
                    <View key={i} style={[styles.dayCell, { width: dayWidth }]}>
                      <Text variant="labelSmall" style={styles.dayLabel}>{DAY_LABELS[labelIdx]}</Text>
                      <Text variant="bodySmall" style={styles.dayNum}>{day.getDate()}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={[styles.gridBody, { height: gridHeight }]}>
                {Array.from({ length: totalSlots }, (_, i) => {
                  const hour = hourStart + Math.floor(i / SLOTS_PER_HOUR);
                  const label = i % SLOTS_PER_HOUR === 0 ? `${hour.toString().padStart(2, '0')}:00` : '';
                  const isHourStart = i % SLOTS_PER_HOUR === 0;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.calendarRow,
                        { height: SLOT_HEIGHT },
                        isHourStart && styles.calendarRowHourLine,
                      ]}
                    >
                      <View style={[styles.timeCell, styles.timeCellGrid, { width: TIME_COLUMN_WIDTH }]}>
                        {label ? <Text variant="bodySmall" style={styles.timeLabel}>{label}</Text> : null}
                      </View>
                      {headerDays.map((_, j) => (
                        <View key={j} style={[styles.daySlot, { width: dayWidth }]} />
                      ))}
                    </View>
                  );
                })}
              </View>
              <View style={[styles.blocksOverlay, { width: gridTotalWidth, height: gridHeight + 36 }]} pointerEvents="box-none">
                {appointmentBlocks.map(({ app, left, top, width, height, timeStr, clientName, compact, color }) => (
                  <TouchableOpacity
                    key={app.id}
                    style={[
                      styles.appointmentBlock,
                      {
                        left,
                        top: 36 + top,
                        width,
                        height,
                      },
                    ]}
                    onPress={() => onAppointmentPress(app)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.appointmentBlockAccent, { backgroundColor: color }]} />
                    <View style={[styles.appointmentBlockInner, compact && styles.appointmentBlockInnerCompact]}>
                      <CalendarAppointmentBlockLabels timeStr={timeStr} clientName={clientName} compact={compact} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {appointmentsInRange.length === 0 && (
        <View style={styles.calendarEmpty}>
          <Text variant="bodyMedium" style={styles.calendarEmptyText}>
            {mode === 'day' ? 'Nicio programare în această zi' : 'Nicio programare în această săptămână'}
          </Text>
        </View>
      )}

      {mode === 'day' && onSelectDayDate && showDayDatePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={periodStart}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDayDatePicker(false);
            if (event.type === 'set' && date) {
              onSelectDayDate(startOfLocalDay(date));
            }
          }}
        />
      ) : null}

      {mode === 'day' && onSelectDayDate ? (
        <Modal
          visible={showDayDatePicker && Platform.OS !== 'android'}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDayDatePicker(false)}
        >
          <View style={styles.dayPickerModalRoot}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, styles.dayPickerBackdrop]}
              onPress={() => setShowDayDatePicker(false)}
              accessibilityLabel="Închide"
            />
            <View style={styles.dayPickerModalCard}>
              <Text variant="titleSmall" style={styles.dayPickerModalTitle}>
                Alege ziua
              </Text>
              {Platform.OS === 'web' ? (
                <WebDatePickerInput value={iosPickerDate} onChange={setIosPickerDate} />
              ) : (
                <View style={styles.dayPickerNativeWrap}>
                  <DateTimePicker
                    value={iosPickerDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(_, date) => {
                      if (date) setIosPickerDate(date);
                    }}
                    style={styles.dayPickerIos}
                  />
                </View>
              )}
              <View style={styles.dayPickerModalActions}>
                <Button mode="text" onPress={() => setShowDayDatePicker(false)} textColor={theme.colors.neutral[600]}>
                  Anulează
                </Button>
                <Button
                  mode="contained"
                  onPress={() => {
                    onSelectDayDate(startOfLocalDay(iosPickerDate));
                    setShowDayDatePicker(false);
                  }}
                  buttonColor={theme.colors.primary.main}
                >
                  OK
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

export interface ManageAppointmentsSectionProps {
  onRefresh?: () => void;
  calendarMode: 'day' | 'week';
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  dayCalendarDate: Date;
  setDayCalendarDate: React.Dispatch<React.SetStateAction<Date>>;
}

export const ManageAppointmentsSection = ({
  onRefresh,
  calendarMode,
  weekStart,
  setWeekStart,
  dayCalendarDate,
  setDayCalendarDate,
}: ManageAppointmentsSectionProps) => {
  const { company } = useCompany();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { width: screenWidth } = useWindowDimensions();

  const { hourStart, hourEnd } = useMemo(
    () => getOpeningHoursRange(company?.opening_hours),
    [company?.opening_hours]
  );

  useEffect(() => {
    loadAppointments();
  }, [statusFilter]);

  const loadAppointments = async () => {
    try {
      setIsLoading(true);
      const data = await ApiService.getCompanyAppointments(undefined, statusFilter);
      setAppointments(data);
    } catch (error) {
      console.error('Error loading appointments:', error);
      Alert.alert('Eroare', 'Nu s-au putut încărca programările.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsEditModalVisible(true);
  };

  const handleSaveAppointment = async (updatedData: Partial<Appointment>) => {
    if (!selectedAppointment) return;

    try {
      await ApiService.updateAppointment(selectedAppointment.id!, updatedData);
      Alert.alert('Succes', 'Programarea a fost actualizată.');
      setIsEditModalVisible(false);
      setSelectedAppointment(null);
      loadAppointments();
      onRefresh?.();
    } catch (error: any) {
      Alert.alert('Eroare', error.message || 'Nu s-a putut actualiza programarea.');
    }
  };

  const handleCancelModal = () => {
    setIsEditModalVisible(false);
    setSelectedAppointment(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return theme.colors.success.main;
      case 'pending':
        return theme.colors.warning.main;
      case 'cancelled':
        return theme.colors.error.main;
      case 'completed':
        return theme.colors.neutral[500];
      default:
        return theme.colors.neutral[400];
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'cancelled':
        return 'close-circle';
      case 'completed':
        return 'checkmark-done-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading appointments...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filtre + total programări (titlul e pe ecranul părinte) */}
      <View style={styles.filterBar}>
        <View style={styles.filterChipsGroup}>
          <Chip
            mode={statusFilter === undefined ? 'flat' : 'outlined'}
            selected={statusFilter === undefined}
            onPress={() => setStatusFilter(undefined)}
            style={styles.filterChip}
            textStyle={statusFilter === undefined ? styles.filterChipTextActive : styles.filterChipText}
            compact
          >
            All
          </Chip>
          <Chip
            mode={statusFilter === 'confirmed' ? 'flat' : 'outlined'}
            selected={statusFilter === 'confirmed'}
            onPress={() => setStatusFilter('confirmed')}
            style={styles.filterChip}
            textStyle={statusFilter === 'confirmed' ? styles.filterChipTextActive : styles.filterChipText}
            compact
          >
            Confirmat
          </Chip>
          <Chip
            mode={statusFilter === 'completed' ? 'flat' : 'outlined'}
            selected={statusFilter === 'completed'}
            onPress={() => setStatusFilter('completed')}
            style={styles.filterChip}
            textStyle={statusFilter === 'completed' ? styles.filterChipTextActive : styles.filterChipText}
            compact
          >
            Finalizat
          </Chip>
          <Chip
            mode={statusFilter === 'cancelled' ? 'flat' : 'outlined'}
            selected={statusFilter === 'cancelled'}
            onPress={() => setStatusFilter('cancelled')}
            style={styles.filterChip}
            textStyle={statusFilter === 'cancelled' ? styles.filterChipTextActive : styles.filterChipText}
            compact
          >
            Anulate
          </Chip>
        </View>
        <Chip
          style={[styles.filterChip, styles.countChip]}
          textStyle={styles.countChipText}
          compact
        >
          {appointments.length}
        </Chip>
      </View>

      {/* All = calendar view; other filters = list */}
      {statusFilter === undefined ? (
        <ScheduleCalendarView
            mode={calendarMode}
            periodStart={calendarMode === 'week' ? weekStart : dayCalendarDate}
            onPrev={() => {
              if (calendarMode === 'week') {
                setWeekStart((prev) => {
                  const m = new Date(prev);
                  m.setDate(m.getDate() - 7);
                  return m;
                });
              } else {
                setDayCalendarDate((prev) => {
                  const m = new Date(prev);
                  m.setDate(m.getDate() - 1);
                  return startOfLocalDay(m);
                });
              }
            }}
            onNext={() => {
              if (calendarMode === 'week') {
                setWeekStart((prev) => {
                  const m = new Date(prev);
                  m.setDate(m.getDate() + 7);
                  return m;
                });
              } else {
                setDayCalendarDate((prev) => {
                  const m = new Date(prev);
                  m.setDate(m.getDate() + 1);
                  return startOfLocalDay(m);
                });
              }
            }}
            appointments={appointments.filter((a) => a.status !== 'cancelled')}
            onAppointmentPress={handleEditAppointment}
            getStatusColor={getStatusColor}
            getBlockColor={(app) => {
              if (String(app.status).toLowerCase() === 'completed') return theme.colors.primary.main;
              if ((app.status === 'pending' || app.status === 'confirmed') && isAppointmentPastEndTime(app)) {
                return theme.colors.info.main;
              }
              return getStatusColor(app.status);
            }}
            hourStart={hourStart}
            hourEnd={hourEnd}
            screenWidth={screenWidth}
            contentPadding={theme.spacing.lg * 2}
            onSelectDayDate={
              calendarMode === 'day' ? (d) => setDayCalendarDate(startOfLocalDay(d)) : undefined
            }
          />
      ) : appointments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color={theme.colors.neutral[300]} />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            Nu s-au găsit programări
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {`Nicio programare ${({ confirmed: 'confirmată', completed: 'finalizată', cancelled: 'anulată' } as Record<string, string>)[statusFilter] || statusFilter} în acest moment`}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.appointmentsList} showsVerticalScrollIndicator={false}>
          {appointments.map((appointment) => {
            const clientPhone = getAppointmentClientPhone(appointment);
            return (
            <Card key={appointment.id} style={styles.appointmentCard}>
              <Card.Content style={styles.cardContent}>
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.dateTimeContainer}>
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={16} color={theme.colors.neutral[600]} />
                      <Text variant="bodyMedium" style={styles.dateText}>
                        {formatDate(appointment.appointment_date)}
                      </Text>
                    </View>
                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={16} color={theme.colors.neutral[600]} />
                      <Text variant="bodyMedium" style={styles.timeText}>
                        {formatTime(appointment.appointment_date)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusContainer}>
                    <Ionicons
                      name={getStatusIcon(appointment.status) as any}
                      size={20}
                      color={getStatusColor(appointment.status)}
                    />
                    <Text
                      variant="bodySmall"
                      style={[styles.statusText, { color: getStatusColor(appointment.status) }]}
                    >
                      {({ pending: 'În așteptare', confirmed: 'Confirmat', completed: 'Finalizat', cancelled: 'Anulat' } as Record<string, string>)[appointment.status] || appointment.status}
                    </Text>
                  </View>
                </View>

                {/* Client Info */}
                <View style={styles.clientInfo}>
                  <Ionicons name="person" size={16} color={theme.colors.neutral[600]} />
                  <Text variant="bodyMedium" style={styles.clientName}>
                    {(appointment as any).user_name || 'Client necunoscut'}
                  </Text>
                </View>
                {clientPhone ? (
                  <View style={styles.clientInfo}>
                    <Ionicons name="call-outline" size={16} color={theme.colors.neutral[600]} />
                    <Text variant="bodySmall" style={styles.clientEmail}>
                      {clientPhone}
                    </Text>
                  </View>
                ) : null}
                {(appointment as any).user_email && (
                  <View style={styles.clientInfo}>
                    <Ionicons name="mail" size={16} color={theme.colors.neutral[600]} />
                    <Text variant="bodySmall" style={styles.clientEmail}>
                      {(appointment as any).user_email}
                    </Text>
                  </View>
                )}

                {/* Service Info */}
                {(appointment as any).service_name && (
                  <View style={styles.serviceInfo}>
                    <Ionicons name="medical" size={16} color={theme.colors.primary.main} />
                    <Text variant="bodyMedium" style={styles.serviceName}>
                      {(appointment as any).service_name}
                    </Text>
                  </View>
                )}

                {/* Notes */}
                {appointment.notes && (
                  <View style={styles.notesContainer}>
                    <Text variant="bodySmall" style={styles.notesLabel}>
                      Note:
                    </Text>
                    <Text variant="bodySmall" style={styles.notesText}>
                      {appointment.notes}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionsContainer}>
                  <Button
                    mode="outlined"
                    onPress={() => handleEditAppointment(appointment)}
                    icon="pencil"
                    style={styles.editButton}
                    labelStyle={styles.editButtonLabel}
                    compact
                  >
                    Editează
                  </Button>
                </View>
              </Card.Content>
            </Card>
          );
          })}
        </ScrollView>
      )}

      {/* Edit Appointment Modal */}
      {selectedAppointment && (
        <EditAppointmentModal
          visible={isEditModalVisible}
          appointment={selectedAppointment}
          onSave={handleSaveAppointment}
          onCancel={handleCancelModal}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calendarContainer: {
    flex: 1,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  weekNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  weekNavLabel: {
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  weekNavTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xs,
    gap: 8,
  },
  weekNavTitle: {
    color: theme.colors.neutral[800],
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  weekNavCalendarIconHit: {
    padding: 4,
    marginLeft: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekNavTitleDay: {
    fontSize: 13,
    lineHeight: 18,
  },
  calendarScroll: {
    flex: 1,
  },
  weekCalendarFill: {
    width: '100%',
    alignSelf: 'stretch',
  },
  dayCalendarCenterWrap: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  dayModeOuterFrame: {
    borderWidth: 1,
    borderColor: theme.colors.surface.border,
    borderRadius: theme.borderRadius.lg,
    padding: 4,
    backgroundColor: theme.colors.primary[50],
    overflow: 'hidden',
  },
  calendarGridDayMode: {
    borderWidth: 0,
    ...theme.shadows.none,
  },
  calendarGrid: {
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary[100],
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary[50],
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  calendarRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
  },
  calendarRowHourLine: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.primary[100],
  },
  timeCell: {
    justifyContent: 'flex-start',
    paddingTop: 2,
    paddingRight: theme.spacing.xs,
    alignItems: 'flex-end',
  },
  timeLabel: {
    color: theme.colors.neutral[500],
    fontSize: 11,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.primary[100],
  },
  dayLabel: {
    color: theme.colors.neutral[600],
    fontWeight: '600',
  },
  dayNum: {
    color: theme.colors.neutral[700],
  },
  dayPickerModalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  dayPickerBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dayPickerModalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    zIndex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.lg,
  },
  dayPickerModalTitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    color: theme.colors.neutral[800],
    fontWeight: '700',
  },
  dayPickerNativeWrap: {
    minHeight: 300,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dayPickerIos: {
    alignSelf: 'center',
    width: '100%',
  },
  dayPickerModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  gridBody: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary[100],
    backgroundColor: theme.colors.white,
    borderBottomLeftRadius: theme.borderRadius.lg,
    borderBottomRightRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  timeCellGrid: {
    backgroundColor: theme.colors.primary[50],
  },
  daySlot: {
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.primary[100],
    backgroundColor: theme.colors.white,
  },
  blocksOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  calendarRowDayDynamic: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
  },
  appointmentBlock: {
    position: 'absolute',
    flexDirection: 'row',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.surface.border,
    backgroundColor: theme.colors.primary[50],
    overflow: 'hidden',
  },
  appointmentBlockDayRich: {
    minHeight: 0,
  },
  appointmentBlockInnerDayRich: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  dayCardInner: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  dayCardName: {
    color: theme.colors.neutral[900],
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 17,
  },
  dayCardTime: {
    color: theme.colors.neutral[800],
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  dayCardServices: {
    color: theme.colors.neutral[600],
    fontWeight: '500',
    fontSize: 10,
    lineHeight: 13,
    marginTop: 3,
  },
  appointmentBlockAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  appointmentBlockInner: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  appointmentBlockInnerCompact: {
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  blockTime: {
    color: theme.colors.neutral[800],
    fontWeight: '700',
    fontSize: 11,
  },
  blockName: {
    color: theme.colors.neutral[700],
    fontWeight: '600',
    marginTop: 2,
    fontSize: 12,
  },
  blockCompactLine: {
    fontSize: 11,
    lineHeight: 14,
    minWidth: 0,
  },
  blockTimeInline: {
    color: theme.colors.neutral[800],
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 14,
  },
  blockNameInline: {
    color: theme.colors.neutral[700],
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 14,
  },
  calendarEmpty: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  calendarEmptyText: {
    color: theme.colors.neutral[500],
  },
  loadingContainer: {
    padding: theme.spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.neutral[600],
  },
  countChip: {
    backgroundColor: theme.colors.primary[100],
    alignSelf: 'flex-start',
  },
  countChipText: {
    color: theme.colors.primary[700],
    fontWeight: '600',
  },
  filterBar: {
    marginBottom: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  filterChipsGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: theme.spacing.xs,
  },
  filterChip: {
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: 2,
  },
  filterChipText: {
    color: theme.colors.neutral[600],
    fontSize: 12,
  },
  filterChipTextActive: {
    color: theme.colors.primary.main,
    fontWeight: '600',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
  },
  emptyTitle: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    color: theme.colors.neutral[700],
    fontWeight: '600',
  },
  emptyText: {
    color: theme.colors.neutral[500],
    textAlign: 'center',
  },
  appointmentsList: {
    flex: 1,
  },
  appointmentCard: {
    marginBottom: theme.spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    padding: theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  dateTimeContainer: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dateText: {
    color: theme.colors.neutral[700],
    fontWeight: '600',
  },
  timeText: {
    color: theme.colors.neutral[600],
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface.cream,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 11,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  clientName: {
    color: theme.colors.neutral[800],
    fontWeight: '600',
  },
  clientEmail: {
    color: theme.colors.neutral[600],
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.primary[50],
    borderRadius: 8,
  },
  serviceName: {
    color: theme.colors.primary[700],
    fontWeight: '600',
  },
  notesContainer: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface.cream,
    borderRadius: 8,
  },
  notesLabel: {
    color: theme.colors.neutral[600],
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  notesText: {
    color: theme.colors.neutral[700],
  },
  actionsContainer: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    borderColor: theme.colors.primary.main,
  },
  editButtonLabel: {
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
});
