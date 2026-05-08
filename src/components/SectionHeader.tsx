import React from 'react';
import {StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle} from 'react-native';

import {CloudSeaTokens, useTokens} from './tokens';

export type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  tokens?: CloudSeaTokens;
};

/**
 * RN equivalent of `.cs-section-header` with eyebrow and title semantics aligned to web.
 */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  style,
  titleStyle,
  tokens,
}: SectionHeaderProps) {
  const themeTokens = useTokens();
  const activeTokens = tokens ?? themeTokens;
  const styles = createStyles(activeTokens);

  return (
    <View style={[styles.container, style]}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={[styles.title, titleStyle]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const createStyles = (tokens: CloudSeaTokens) => StyleSheet.create({
  container: {
    marginBottom: 8,
    marginTop: 15,
  },
  eyebrow: {
    color: tokens.color.textSecondary,
    fontSize: tokens.font.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    color: tokens.color.textStrong,
    fontSize: tokens.font.lg,
    fontWeight: '600',
  },
  subtitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.font.sm,
    marginTop: tokens.spacing.xs,
  },
});

export default SectionHeader;
