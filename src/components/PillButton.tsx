import React from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';

import {CloudSeaTokens, useTokens} from './tokens';

export type PillButtonVariant = 'primary' | 'ghost' | 'success';

export type PillButtonProps = {
  icon?: string;
  label: string;
  variant?: PillButtonVariant;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  tokens?: CloudSeaTokens;
};

/**
 * RN equivalent of `.cs-pill-button`; keeps label, icon, variant and onPress prop names stable.
 */
export function PillButton({
  icon,
  label,
  variant = 'primary',
  disabled = false,
  onPress,
  style,
  textStyle,
  tokens,
}: PillButtonProps) {
  const themeTokens = useTokens();
  const activeTokens = tokens ?? themeTokens;
  const styles = createStyles(activeTokens);
  const isGhost = variant === 'ghost';
  const isSuccess = variant === 'success';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        isGhost && styles.ghost,
        isSuccess && styles.success,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {icon ? <Text style={[styles.text, isGhost && styles.ghostText, textStyle]}>{icon}</Text> : null}
      <Text style={[styles.text, isGhost && styles.ghostText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (tokens: CloudSeaTokens) => StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: tokens.color.primary,
    borderColor: 'transparent',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
  },
  ghost: {
    backgroundColor: tokens.color.primarySoft,
    borderColor: tokens.color.primaryBorder,
  },
  success: {
    backgroundColor: tokens.color.success,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    color: tokens.color.white,
    fontSize: tokens.font.md,
    fontWeight: '500',
  },
  ghostText: {
    color: tokens.color.primary,
  },
});

export default PillButton;
