/**
 * Fluent UI Text Component
 * Implements Microsoft Fluent UI Typography standards
 */
import React from 'react';
import { Text as RNText, StyleSheet, TextProps as RNTextProps, TextStyle } from 'react-native';
import { FluentColors, FluentTypography } from '@/constants/fluent-ui-tokens';

export type TextVariant = 'body' | 'caption' | 'subtitle' | 'title' | 'headline' | 'display';
export type TextWeight = 'regular' | 'semibold' | 'bold';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  weight?: TextWeight;
  color?: 'primary' | 'secondary' | 'disabled' | 'brand' | 'error' | 'success' | 'inverse';
  style?: TextStyle;
}

export function Text({
  variant = 'body',
  weight = 'regular',
  color = 'primary',
  style,
  ...textProps
}: TextProps) {
  const textStyles = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`weight_${weight}`],
    styles[`color_${color}`],
    style,
  ];

  return <RNText style={textStyles} {...textProps} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: FluentTypography.fontFamily.base,
  },
  
  // Variant styles
  variant_body: {
    fontSize: FluentTypography.fontSize.medium,
    lineHeight: FluentTypography.lineHeight.medium,
  },
  variant_caption: {
    fontSize: FluentTypography.fontSize.small,
    lineHeight: FluentTypography.lineHeight.small,
  },
  variant_subtitle: {
    fontSize: FluentTypography.fontSize.large,
    lineHeight: FluentTypography.lineHeight.large,
  },
  variant_title: {
    fontSize: FluentTypography.fontSize.xlarge,
    lineHeight: FluentTypography.lineHeight.xlarge,
    fontWeight: FluentTypography.fontWeight.semibold,
  },
  variant_headline: {
    fontSize: FluentTypography.fontSize.xxlarge,
    lineHeight: FluentTypography.lineHeight.xxlarge,
    fontWeight: FluentTypography.fontWeight.bold,
  },
  variant_display: {
    fontSize: FluentTypography.fontSize.xxxxlarge,
    lineHeight: FluentTypography.lineHeight.xxlarge,
    fontWeight: FluentTypography.fontWeight.bold,
  },
  
  // Weight styles
  weight_regular: {
    fontWeight: FluentTypography.fontWeight.regular,
  },
  weight_semibold: {
    fontWeight: FluentTypography.fontWeight.semibold,
  },
  weight_bold: {
    fontWeight: FluentTypography.fontWeight.bold,
  },
  
  // Color styles
  color_primary: {
    color: FluentColors.text.primary,
  },
  color_secondary: {
    color: FluentColors.text.secondary,
  },
  color_disabled: {
    color: FluentColors.text.disabled,
  },
  color_brand: {
    color: FluentColors.text.brand,
  },
  color_error: {
    color: FluentColors.semantic.error,
  },
  color_success: {
    color: FluentColors.semantic.success,
  },
  color_inverse: {
    color: FluentColors.text.inverse,
  },
});

