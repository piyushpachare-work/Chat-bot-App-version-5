import React, { useState } from "react";
import { View, Alert, StyleSheet } from "react-native";
import { FluentIcon } from "./FluentIcon";
import { Button } from "@/components/fluent-ui/Button";
import { Text } from "@/components/fluent-ui/Text";
import { authenticatedFetch } from "@/src/auth/api";
import { getBackendBaseUrl } from "@/src/auth/config";
import { FluentColors, FluentSpacing } from "@/constants/fluent-ui-tokens";

const NOTES_URL = `${getBackendBaseUrl()}/notes`;

type SaveToNotesButtonProps = {
  content: string;
  messageId?: string;
  conversationId?: string;
  onSaved?: () => void;
};

export function SaveToNotesButton({
  content,
  messageId,
  conversationId,
  onSaved,
}: SaveToNotesButtonProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async () => {
    if (isSaved || isSaving) return;

    setIsSaving(true);
    try {
      const response = await authenticatedFetch(NOTES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content,
          message_id: messageId,
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save note");
      }

      setIsSaved(true);
      onSaved?.();

      // Show brief confirmation
      setTimeout(() => {
        // Keep saved state visible
      }, 2000);
    } catch (error) {
      console.error("Error saving note:", error);
      Alert.alert("Error", "Couldn't save. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button
      appearance={isSaved ? "primary" : "subtle"}
      size="small"
      onPress={handleSave}
      disabled={isSaving || isSaved}
      loading={isSaving}
      style={[
        saveButtonStyles.button,
        isSaved && saveButtonStyles.buttonSaved,
      ]}
      accessibilityLabel={isSaved ? "Note saved" : "Save to notes"}
      accessibilityHint="Saves this message to your notes for later reference"
    >
      <View style={saveButtonStyles.buttonContent}>
        <FluentIcon
          name={isSaved ? "Bookmark24Filled" : "Bookmark24Regular"}
          size={14}
          color={isSaved ? FluentColors.text.inverse : FluentColors.brand.primary}
        />
        <Text
          variant="caption"
          weight="semibold"
          color={isSaved ? "inverse" : "brand"}
          style={saveButtonStyles.buttonText}
        >
          {isSaved ? "Saved" : "Save to Notes"}
        </Text>
      </View>
    </Button>
  );
}

const saveButtonStyles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    marginTop: FluentSpacing.s,
  },
  buttonSaved: {
    // Already handled by appearance="primary"
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: FluentSpacing.xs,
  },
  buttonText: {
    marginLeft: FluentSpacing.xs,
  },
});
