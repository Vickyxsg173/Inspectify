/**
 * LiquidGlassSlider
 *
 * Custom confidence slider with:
 *  - Liquid-glass frosted track background (dark semi-transparent fill + shimmer border)
 *  - Magnifying loupe bubble that pops up above the thumb while dragging, showing the value large
 *  - Spring-animated loupe & thumb scale via react-native-reanimated
 *  - Gradient-colored fill on the left-hand track, matching the accent colour per model
 *
 * Uses PanResponder (JS-thread) → assigns shared values via runOnUI for smooth UI-thread animation.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Text,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
  runOnUI,
} from 'react-native-reanimated';

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  accentColor?: string;
  label: string;
  sublabel?: string;
  defaultValue?: number;
  onChange: (val: number) => void;
}

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 30;

export default function LiquidGlassSlider({
  value,
  min = 0.05,
  max = 0.90,
  step = 0.01,
  accentColor = '#FF2D55',
  label,
  sublabel,
  defaultValue,
  onChange,
}: Props) {
  const trackWidth = useRef(0);
  // 0=idle, 1=dragging — drives loupe visibility & thumb ring
  const dragging = useSharedValue(0);
  // 0..1 fraction of track width
  const thumbFrac = useSharedValue((value - min) / (max - min));

  const [displayPct, setDisplayPct] = useState(Math.round(value * 100));
  const [trackReady, setTrackReady] = useState(false);

  const valueFraction = (val: number) => Math.min(1, Math.max(0, (val - min) / (max - min)));

  const fractionToValue = (f: number): number => {
    const raw = min + f * (max - min);
    const stepped = Math.round(raw / step) * step;
    return parseFloat(Math.min(max, Math.max(min, stepped)).toFixed(4));
  };

  // Sync thumb when value changes externally (e.g. reset to defaults)
  React.useEffect(() => {
    const f = valueFraction(value);
    runOnUI(() => { 'worklet'; thumbFrac.value = f; })();
    setDisplayPct(Math.round(value * 100));
  }, [value]);

  const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
    const f = valueFraction(value);
    runOnUI(() => { 'worklet'; thumbFrac.value = f; })();
    setTrackReady(true);
  }, [value]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const f = Math.min(1, Math.max(0, evt.nativeEvent.locationX / trackWidth.current));
        const val = fractionToValue(f);
        // Update UI-thread shared values
        runOnUI(() => {
          'worklet';
          thumbFrac.value = f;
          dragging.value = withSpring(1, { damping: 14, stiffness: 280 });
        })();
        setDisplayPct(Math.round(val * 100));
        onChange(val);
      },

      onPanResponderMove: (evt) => {
        const f = Math.min(1, Math.max(0, evt.nativeEvent.locationX / trackWidth.current));
        const val = fractionToValue(f);
        runOnUI(() => {
          'worklet';
          thumbFrac.value = f;
        })();
        setDisplayPct(Math.round(val * 100));
        onChange(val);
      },

      onPanResponderRelease: () => {
        runOnUI(() => {
          'worklet';
          dragging.value = withSpring(0, { damping: 20, stiffness: 380 });
        })();
      },

      onPanResponderTerminate: () => {
        runOnUI(() => {
          'worklet';
          dragging.value = withSpring(0, { damping: 20, stiffness: 380 });
        })();
      },
    })
  ).current;

  // ── Animated styles ──────────────────────────────────────────────────────

  const fillStyle = useAnimatedStyle(() => ({
    width: `${thumbFrac.value * 100}%`,
  }));

  const thumbContainerStyle = useAnimatedStyle(() => {
    const scale = interpolate(dragging.value, [0, 1], [1, 1.12], Extrapolation.CLAMP);
    return {
      left: `${thumbFrac.value * 100}%`,
      transform: [{ translateX: -THUMB_SIZE / 2 }, { scale }],
    };
  });

  // Loupe (magnifier pill) above the thumb — fades + slides in when dragging
  const loupeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(dragging.value, [0, 0.4, 1], [0, 0, 1], Extrapolation.CLAMP);
    const translateY = interpolate(dragging.value, [0, 1], [10, 0], Extrapolation.CLAMP);
    const scale = interpolate(dragging.value, [0, 1], [0.5, 1], Extrapolation.CLAMP);
    return { opacity, transform: [{ translateY }, { scale }] };
  });

  // Pulse ring around thumb while dragging
  const ringStyle = useAnimatedStyle(() => {
    const opacity = interpolate(dragging.value, [0, 1], [0, 0.30], Extrapolation.CLAMP);
    const scale = interpolate(dragging.value, [0, 1], [1, 1.9], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }] };
  });

  const isAtDefault =
    defaultValue !== undefined && Math.round(value * 100) === Math.round(defaultValue * 100);

  return (
    <View style={styles.wrapper}>
      {/* ── Label row ── */}
      <View style={styles.labelRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          {sublabel ? <Text style={styles.sublabel} numberOfLines={2}>{sublabel}</Text> : null}
        </View>
        {/* Live value pill */}
        <View style={[styles.valuePill, { borderColor: accentColor + '55', backgroundColor: accentColor + '1A' }]}>
          <Text style={[styles.valuePillText, { color: accentColor }]}>{displayPct}%</Text>
        </View>
      </View>

      {/* Default badge */}
      {defaultValue !== undefined && (
        <View style={{ marginBottom: 8 }}>
          <View style={[
            styles.defaultBadge,
            isAtDefault && { backgroundColor: accentColor + '1A', borderColor: accentColor + '44' },
          ]}>
            <Text style={[styles.defaultText, isAtDefault && { color: accentColor }]}>
              Default: {Math.round(defaultValue * 100)}%{isAtDefault ? '  ✓ at default' : ''}
            </Text>
          </View>
        </View>
      )}

      {/* ── Track + Thumb hit area ── */}
      <View
        style={styles.trackOuter}
        {...panResponder.panHandlers}
        onLayout={handleTrackLayout}
      >
        {/* Glass track background */}
        <View style={styles.trackBg}>
          {/* Filled portion */}
          <Animated.View style={[styles.trackFill, fillStyle, { backgroundColor: accentColor }]} />
          {/* Shimmer highlight on track top */}
          <View style={styles.trackShimmer} />
        </View>

        {/* Thumb anchor (absolute positioned) */}
        {trackReady && (
          <Animated.View
            style={[styles.thumbContainer, thumbContainerStyle]}
            pointerEvents="none"
          >
            {/* Pulse ring */}
            <Animated.View
              style={[styles.thumbRing, { borderColor: accentColor }, ringStyle]}
            />

            {/* ── Loupe magnifier bubble ── */}
            <Animated.View style={[styles.loupeWrapper, loupeStyle]} pointerEvents="none">
              <View style={[styles.loupeGlass, { borderColor: accentColor + '70' }]}>
                {/* Shimmer stripe inside loupe */}
                <View style={styles.loupeShimmer} />
                <View style={styles.loupeTextRow}>
                  <Text style={[styles.loupeNum, { color: accentColor }]}>{displayPct}</Text>
                  <Text style={[styles.loupeUnit, { color: accentColor + 'CC' }]}>%</Text>
                </View>
              </View>
              {/* Arrow stem pointing down */}
              <View style={[styles.loupeStem, { borderTopColor: accentColor + '55' }]} />
            </Animated.View>

            {/* ── Thumb circle ── */}
            <View style={[styles.thumb, {
              backgroundColor: accentColor,
              shadowColor: accentColor,
            }]}>
              <View style={styles.thumbHighlight} />
              <View style={styles.thumbDot} />
            </View>
          </Animated.View>
        )}
      </View>

      {/* Min / Max labels */}
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{Math.round(min * 100)}%</Text>
        <Text style={styles.rangeText}>{Math.round(max * 100)}%</Text>
      </View>
    </View>
  );
}

const LOUPE_HEIGHT = 50;

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#D4D4D8',
    letterSpacing: 0.1,
  },
  sublabel: {
    fontSize: 10.5,
    color: '#71717A',
    marginTop: 1.5,
    fontWeight: '500',
    lineHeight: 14,
  },
  valuePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePillText: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#3F3F46',
    backgroundColor: 'rgba(39,39,42,0.6)',
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#71717A',
    fontVariant: ['tabular-nums'],
  },
  // ── Track ──
  trackOuter: {
    height: 48,
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  trackBg: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  trackFill: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
  },
  trackShimmer: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  // ── Thumb ──
  thumbContainer: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    top: (48 - THUMB_SIZE) / 2,
  },
  thumbRing: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 7,
    elevation: 7,
  },
  thumbHighlight: {
    position: 'absolute',
    top: 2, left: 4, right: 4,
    height: '45%',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  thumbDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  // ── Loupe ──
  loupeWrapper: {
    position: 'absolute',
    bottom: THUMB_SIZE + 4,
    alignItems: 'center',
    // Prevent clipping
    zIndex: 100,
  },
  loupeGlass: {
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'rgba(14,14,18,0.90)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 68,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 12 },
    }),
  },
  loupeShimmer: {
    position: 'absolute',
    top: 0, left: 8, right: 8,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  loupeTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  loupeNum: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  loupeUnit: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 1,
    marginBottom: 2,
  },
  loupeStem: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  // ── Range labels ──
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingHorizontal: 2,
  },
  rangeText: {
    fontSize: 10,
    color: '#52525B',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
