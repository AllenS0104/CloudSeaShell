import React from 'react';
import {StyleProp, StyleSheet, Text, View, ViewStyle} from 'react-native';

import {CloudSeaTokens, useTokens} from './tokens';

export type StatTileVariant = 'default' | 'stack';

export type StatTileProps = {
  icon?: string;
  label: string;
  value: string | number;
  variant?: StatTileVariant;
  strong?: boolean;
  style?: StyleProp<ViewStyle>;
  tokens?: CloudSeaTokens;
};

/**
 * RN equivalent of `.cs-stat-tile`; renders icon, label and value with optional stack layout.
 */
export function StatTile({
  icon,
  label,
  value,
  variant = 'default',
  strong = false,
  style,
  tokens,
}: StatTileProps) {
  const themeTokens = useTokens();
  const activeTokens = tokens ?? themeTokens;
  const styles = createStyles(activeTokens);
  const isStack = variant === 'stack';

  return (
    <View style={[styles.tile, isStack && styles.stack, style]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <View style={isStack && styles.stackBody}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, strong && styles.strongValue]}>{value}</Text>
      </View>
    </View>
  );
}

const createStyles = (tokens: CloudSeaTokens) => StyleSheet.create({
  tile: {
    alignItems: 'center',
    backgroundColor: tokens.color.bgDark,
    borderRadius: tokens.radius.lg,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minWidth: 100,
    padding: 10,
  },
  stack: {
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 70,
  },
  stackBody: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
  },
  label: {
    color: tokens.color.textSecondary,
    fontSize: 11,
  },
  value: {
    color: tokens.color.text,
    fontSize: tokens.font.md,
    fontWeight: '500',
  },
  strongValue: {
    color: tokens.color.textStrong,
    fontSize: tokens.font.xl,
    fontWeight: '700',
  },
});

export default StatTile;
