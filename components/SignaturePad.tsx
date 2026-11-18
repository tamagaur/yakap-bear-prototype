import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { colors, radii, spacing } from '@/constants/theme';

const HEIGHT = 130;

export function SignaturePad({
  value,
  onChange,
  onDrawingChange,
}: {
  value: string;
  onChange: (path: string) => void;
  onDrawingChange?: (drawing: boolean) => void;
}) {
  const [draft, setDraft] = useState('');
  const pathRef = useRef('');
  const committedRef = useRef(value);
  committedRef.current = value;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          onDrawingChange?.(true);
          const { locationX, locationY } = event.nativeEvent;
          pathRef.current = `M${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setDraft(pathRef.current);
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          pathRef.current += ` L${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setDraft(pathRef.current);
        },
        onPanResponderRelease: () => {
          onDrawingChange?.(false);
          onChange(`${committedRef.current} ${pathRef.current}`.trim());
          pathRef.current = '';
          setDraft('');
        },
        onPanResponderTerminate: () => {
          onDrawingChange?.(false);
          pathRef.current = '';
          setDraft('');
        },
      }),
    [onChange, onDrawingChange],
  );

  const combined = `${value} ${draft}`.trim();

  return (
    <View style={styles.wrap}>
      <View
        {...responder.panHandlers}
        accessible
        accessibilityLabel="Signature area. Draw your signature with your finger."
        style={styles.pad}
      >
        <Svg width="100%" height={HEIGHT} pointerEvents="none">
          {combined ? <Path d={combined} stroke={colors.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        </Svg>
        {!combined ? (
          <View pointerEvents="none" style={styles.placeholder}>
            <AppText variant="small" color={colors.textMuted}>
              Sign here with your finger
            </AppText>
          </View>
        ) : null}
      </View>
      {value ? <Button compact variant="ghost" label="Clear signature" onPress={() => onChange('')} containerStyle={styles.clear} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs },
  pad: {
    height: HEIGHT,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  placeholder: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  clear: { alignSelf: 'flex-end' },
});
