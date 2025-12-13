/**
 * Fluent UI TextInput Component
 * Implements Microsoft Fluent UI TextInput design standards
 */
import React, { useState } from 'react';
import {
  TextInput as RNTextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps as RNTextInputProps,
  ViewStyle,
} from 'react-native';
import { FluentColors, FluentSpacing, FluentTypography, FluentBorderRadius } from '@/constants/fluent-ui-tokens';

export interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
}

export function TextInput({
  label,
  error,
  helperText,
  required,
  containerStyle,
  inputStyle,
  ...textInputProps
}: TextInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const inputStyles = [
    styles.input,
    isFocused && styles.inputFocused,
    error && styles.inputError,
    textInputProps.editable === false && styles.inputDisabled,
    inputStyle,
  ];

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <RNTextInput
        {...textInputProps}
        style={inputStyles}
        placeholderTextColor={FluentColors.text.secondary}
        onFocus={(e) => {
          setIsFocused(true);
          textInputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          textInputProps.onBlur?.(e);
        }}
      />
      {(error || helperText) && (
        <Text style={[styles.helperText, error && styles.helperTextError]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: FluentSpacing.m,
  },
  label: {
    fontSize: FluentTypography.fontSize.small,
    fontWeight: FluentTypography.fontWeight.semibold,
    color: FluentColors.text.primary,
    marginBottom: FluentSpacing.xs,
  },
  required: {
    color: FluentColors.semantic.error,
  },
  input: {
    minHeight: 32,
    paddingHorizontal: FluentSpacing.m,
    paddingVertical: FluentSpacing.s,
    borderRadius: FluentBorderRadius.medium,
    fontSize: FluentTypography.fontSize.medium,
    color: FluentColors.text.primary,
    backgroundColor: FluentColors.background.default,
    borderWidth: 1,
    borderColor: FluentColors.border.default,
  },
  inputFocused: {
    borderColor: FluentColors.border.focus,
    borderWidth: 2,
  },
  inputError: {
    borderColor: FluentColors.semantic.error,
  },
  inputDisabled: {
    backgroundColor: FluentColors.background.disabled,
    color: FluentColors.text.disabled,
  },
  helperText: {
    fontSize: FluentTypography.fontSize.small,
    color: FluentColors.text.secondary,
    marginTop: FluentSpacing.xs,
  },
  helperTextError: {
    color: FluentColors.semantic.error,
  },
});
