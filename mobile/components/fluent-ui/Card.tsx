/**
 * Fluent UI Card Component
 * Implements Microsoft Fluent UI Card design standards
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { FluentColors, FluentSpacing, FluentBorderRadius, FluentShadows } from '@/constants/fluent-ui-tokens';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export function Card({ children, style, elevated = false }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && FluentShadows.medium,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: FluentColors.background.default,
    borderRadius: FluentBorderRadius.large,
    padding: FluentSpacing.l,
    borderWidth: 1,
    borderColor: FluentColors.border.default,
  },
});

