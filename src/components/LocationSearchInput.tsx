import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface LocationSuggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

interface LocationSearchInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (name: string, lat: number, lon: number, fullAddress: string) => void;
  placeholder?: string;
}

export function LocationSearchInput({
  label,
  value,
  onChangeText,
  onSelect,
  placeholder,
}: LocationSearchInputProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          trimmed
        )}&format=json&limit=6&addressdetails=1`,
        { headers: { 'User-Agent': 'InspectifyApp/1.0 (Logistics Platform)' } }
      );
      if (res.ok) {
        const data: LocationSuggestion[] = await res.json();
        setSuggestions(data || []);
        setShowDropdown((data || []).length > 0);
      }
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    onChangeText(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(text), 300);
  };

  const handleSelect = (item: LocationSuggestion) => {
    const parts = item.display_name.split(',');
    // Primary city or area name
    const mainTitle = parts[0]?.trim() || '';
    const subTitle = parts.slice(1, 3).join(', ').trim();
    const shortDisplay = subTitle ? `${mainTitle}, ${subTitle}` : mainTitle;

    onChangeText(shortDisplay);
    onSelect(shortDisplay, parseFloat(item.lat), parseFloat(item.lon), item.display_name);

    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleClear = () => {
    onChangeText('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputWrapper}>
        <Ionicons name="location-outline" size={16} color="#FF2D55" style={styles.leftIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder || 'Search city, terminal, or address…'}
          placeholderTextColor="#71717A"
          autoCorrect={false}
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color="#FF2D55" style={styles.rightIcon} />
        ) : value.length > 0 ? (
          <TouchableOpacity onPress={handleClear} style={styles.rightIcon}>
            <Ionicons name="close-circle" size={16} color="#71717A" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Google Maps style suggestions dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((item) => {
            const parts = item.display_name.split(',');
            const primaryTitle = parts[0]?.trim();
            const secondaryTitle = parts.slice(1, 4).join(', ').trim();

            return (
              <Pressable
                key={item.place_id}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  pressed && styles.suggestionRowPressed,
                ]}
                onPress={() => handleSelect(item)}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="location" size={14} color="#FF2D55" />
                </View>
                <View style={styles.suggestionTextContainer}>
                  <Text style={styles.primaryText} numberOfLines={1}>
                    {primaryTitle}
                  </Text>
                  {secondaryTitle ? (
                    <Text style={styles.secondaryText} numberOfLines={1}>
                      {secondaryTitle}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.coordsBadge}>
                  {parseFloat(item.lat).toFixed(2)}°, {parseFloat(item.lon).toFixed(2)}°
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    zIndex: 50,
  },
  label: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
  },
  leftIcon: {
    marginRight: 6,
  },
  rightIcon: {
    marginLeft: 6,
    padding: 2,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  dropdown: {
    position: 'absolute',
    top: 68,
    left: 0,
    right: 0,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 999,
    elevation: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  suggestionRowPressed: {
    backgroundColor: '#27272A',
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryText: {
    color: '#A1A1AA',
    fontSize: 10,
    marginTop: 2,
  },
  coordsBadge: {
    color: '#71717A',
    fontSize: 9,
    fontFamily: 'monospace',
    marginLeft: 6,
  },
});

