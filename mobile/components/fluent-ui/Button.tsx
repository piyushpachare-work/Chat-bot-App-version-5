/**
 * Fluent UI Button Component
 * Implements Microsoft Fluent UI Button design standards
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { FluentColors, FluentSpacing, FluentTypography, FluentBorderRadius } from '@/constants/fluent-ui-tokens';

export type ButtonAppearance = 'primary' | 'secondary' | 'outline' | 'subtle' | 'transparent';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  appearance?: ButtonAppearance;
  size?: ButtonSize;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  children,
  onPress,
  disabled = false,
  loading = false,
  appearance = 'primary',
  size = 'medium',
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const buttonStyles = [
    styles.button,
    styles[`button_${appearance}`],
    styles[`button_${size}`],
    isDisabled && styles.buttonDisabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${appearance}`],
    styles[`text_${size}`],
    isDisabled && styles.textDisabled,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={appearance === 'primary' ? FluentColors.text.inverse : FluentColors.brand.primary}
        />
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: FluentBorderRadius.medium,
    minHeight: 32,
  },
  
  // Appearance styles
  button_primary: {
    backgroundColor: FluentColors.brand.primary,
  },
  button_secondary: {
    backgroundColor: FluentColors.neutral.gray20,
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: FluentColors.brand.primary,
  },
  button_subtle: {
    backgroundColor: FluentColors.background.hover,
  },
  button_transparent: {
    backgroundColor: 'transparent',
  },
  
  // Size styles
  button_small: {
    paddingHorizontal: FluentSpacing.m,
    paddingVertical: FluentSpacing.xs,
    minHeight: 24,
  },
  button_medium: {
    paddingHorizontal: FluentSpacing.l,
    paddingVertical: FluentSpacing.s,
    minHeight: 32,
  },
  button_large: {
    paddingHorizontal: FluentSpacing.xl,
    paddingVertical: FluentSpacing.m,
    minHeight: 40,
  },
  
  buttonDisabled: {
    opacity: 0.4,
  },
  
  // Text styles
  text: {
    fontSize: FluentTypography.fontSize.medium,
    fontWeight: FluentTypography.fontWeight.semibold,
    textAlign: 'center',
  },
  
  text_primary: {
    color: FluentColors.text.inverse,
  },
  text_secondary: {
    color: FluentColors.text.inverse,
  },
  text_outline: {
    color: FluentColors.brand.primary,
  },
  text_subtle: {
    color: FluentColors.text.primary,
  },
  text_transparent: {
    color: FluentColors.brand.primary,
  },
  
  text_small: {
    fontSize: FluentTypography.fontSize.small,
  },
  text_medium: {
    fontSize: FluentTypography.fontSize.medium,
  },
  text_large: {
    fontSize: FluentTypography.fontSize.large,
  },
  
  textDisabled: {
    opacity: 0.6,
  },
});

