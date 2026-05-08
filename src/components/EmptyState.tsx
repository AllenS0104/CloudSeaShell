import React from 'react';
import {GestureResponderEvent, StyleProp, StyleSheet, Text, View, ViewStyle} from 'react-native';

import {CloudSeaTokens, useTokens} from './tokens';
import {PillButton} from './PillButton';

export type EmptyStateProps = {
  icon?: string;
  title: string;
  hint?: string;
  subtitle?: string;
  buttonText?: string;
  onAction?: (event: GestureResponderEvent) => void;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  tokens?: CloudSeaTokens;
};

/**
 * RN equivalent of `.cs-empty-state`; title, hint/subtitle and optional action button match web semantics.
 */
export function EmptyState({
  icon,
  title,
  hint,
  subtitle,
  buttonText,
  onAction,
  onPress,
  style,
  tokens,
}: EmptyStateProps) {
  const themeTokens = useTokens();
  const activeTokens = tokens ?? themeTokens;
  const styles = createStyles(activeTokens);
  const message = hint ?? subtitle;

  return (
    <View style={[styles.container, style]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.hint}>{message}</Text> : null}
      {buttonText ? (
        <PillButton label={buttonText} onPress={onAction ?? onPress} tokens={activeTokens} />
      ) : null}
    </View>
  );
}

const createStyles = (tokens: CloudSeaTokens) => StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  icon: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    color: tokens.color.textStrong,
    fontSize: tokens.font.lg,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  hint: {
    color: tokens.color.textSecondary,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default EmptyState;
