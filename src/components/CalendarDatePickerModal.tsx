import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CalendarDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  minDate?: string;
  maxDate?: string;
  title?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parseLocalDate(dateStr: string): Date {
  if (!dateStr || !dateStr.includes('-')) {
    return new Date();
  }
  const parts = dateStr.split('-').map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function CalendarDatePickerModal({
  visible,
  onClose,
  selectedDate,
  onSelectDate,
  minDate,
  maxDate,
  title = 'Select Planned Dispatch Date',
}: CalendarDatePickerModalProps) {
  const initialDate = parseLocalDate(selectedDate);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const todayStr = formatLocalDate(new Date());
  const minDateStr = minDate || todayStr;

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Generate calendar days
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const days: Array<{ dayNumber: number | null; dateStr: string | null; disabled: boolean }> = [];

  // Blank slots for days before 1st of month
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push({ dayNumber: null, dateStr: null, disabled: true });
  }

  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const dObj = new Date(viewYear, viewMonth, d);
    const dStr = formatLocalDate(dObj);
    const disabled =
      (minDateStr && dStr < minDateStr) || (maxDate && dStr > maxDate) ? true : false;
    days.push({ dayNumber: d, dateStr: dStr, disabled });
  }

  const handleQuickPreset = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dStr = formatLocalDate(d);
    onSelectDate(dStr);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.title}>{title}</Text>
              <Text style={s.sub}>Choose your planned departure window</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          {/* Month / Year Navigator */}
          <View style={s.monthBar}>
            <TouchableOpacity onPress={handlePrevMonth} style={s.navBtn}>
              <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={s.monthText}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Weekday Row */}
          <View style={s.weekdaysRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={s.weekdayText}>
                {w}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={s.daysGrid}>
            {days.map((item, idx) => {
              if (item.dayNumber === null) {
                return <View key={`blank-${idx}`} style={s.dayCell} />;
              }

              const isSelected = item.dateStr === selectedDate;
              const isToday = item.dateStr === todayStr;

              return (
                <TouchableOpacity
                  key={`day-${item.dateStr}`}
                  disabled={item.disabled}
                  onPress={() => {
                    if (item.dateStr) {
                      onSelectDate(item.dateStr);
                      onClose();
                    }
                  }}
                  style={[
                    s.dayCell,
                    isSelected && s.dayCellSelected,
                    isToday && !isSelected && s.dayCellToday,
                    item.disabled && s.dayCellDisabled,
                  ]}
                >
                  <Text
                    style={[
                      s.dayText,
                      isSelected && s.dayTextSelected,
                      isToday && !isSelected && s.dayTextToday,
                      item.disabled && s.dayTextDisabled,
                    ]}
                  >
                    {item.dayNumber}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick Selection Shortcuts */}
          <View style={s.quickSection}>
            <Text style={s.quickLabel}>QUICK SHORTCUTS</Text>
            <View style={s.quickRow}>
              {[
                { label: 'Today', offset: 0 },
                { label: 'Tomorrow', offset: 1 },
                { label: '+2 Days', offset: 2 },
                { label: '+3 Days', offset: 3 },
                { label: '+5 Days', offset: 5 },
                { label: '+7 Days', offset: 7 },
              ].map((q) => (
                <TouchableOpacity
                  key={q.label}
                  onPress={() => handleQuickPreset(q.offset)}
                  style={s.quickChip}
                >
                  <Text style={s.quickChipText}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#121216',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sub: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C1C22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181C',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#26262E',
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#202028',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayText: {
    width: 42,
    textAlign: 'center',
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dayCellSelected: {
    backgroundColor: '#FF2D55',
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: '#FF2D55',
  },
  dayCellDisabled: {
    opacity: 0.2,
  },
  dayText: {
    color: '#E4E4E7',
    fontSize: 14,
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextToday: {
    color: '#FF2D55',
    fontWeight: '800',
  },
  dayTextDisabled: {
    color: '#52525B',
  },
  quickSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#202028',
  },
  quickLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChip: {
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickChipText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '600',
  },
});

