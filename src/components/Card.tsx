import React, {ReactNode} from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';

import {CloudSeaTokens, useTokens} from './tokens';

export type CardVariant = 'default' | 'compact' | 'flush';

export type CardProps = {
  children?: ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  tokens?: CloudSeaTokens;
};

/**
 * RN equivalent of `.cs-card`; supports compact and flush variants from the web class API.
 */
export function Card({children, variant = 'default', style, tokens, ...viewProps}: CardProps) {
  const themeTokens = useTokens();
  const activeTokens = tokens ?? themeTokens;
  const styles = createStyles(activeTokens);

  return (
    <View
      {...viewProps}
      style={[
        styles.card,
        variant === 'compact' && styles.compact,
        variant === 'flush' && styles.flush,
        style,
      ]}>
      {children}
    </View>
  );
}

const createStyles = (tokens: CloudSeaTokens) => StyleSheet.create({
  card: {
    backgroundColor: tokens.color.bgCard,
    borderColor: tokens.color.borderDefault,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    marginBottom: 10,
    padding: 15,
  },
  compact: {
    padding: 10,
  },
  flush: {
    marginBottom: 0,
  },
});

export default Card;
