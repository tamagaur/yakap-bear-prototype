import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { colors, radii, spacing } from '@/constants/theme';

export function BrandMark() {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Yakap Bear">
      <View style={styles.logo}>
        <Icon name="paw" size={22} color={colors.textOnPrimary} />
      </View>
      <AppText variant="h3">Yakap Bear</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  logo: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
