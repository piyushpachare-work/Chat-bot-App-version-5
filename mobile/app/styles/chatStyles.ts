import { StyleSheet } from "react-native";
import { FluentColors, FluentSpacing, FluentBorderRadius, FluentTypography } from "@/constants/fluent-ui-tokens";

export const chatStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FluentColors.background.secondary },
  list: { padding: FluentSpacing.l },

  bubble: {
    maxWidth: "80%",
    padding: FluentSpacing.m,
    borderRadius: FluentBorderRadius.large,
    marginBottom: FluentSpacing.s,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: FluentColors.brand.primaryDisabled,
  },
  botBubble: {
    alignSelf: "flex-start",
    backgroundColor: FluentColors.background.default,
    borderWidth: 1,
    borderColor: FluentColors.border.default,
  },

  bubbleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: FluentSpacing.xxs,
  },
  label: { 
    fontSize: FluentTypography.fontSize.small, 
    color: FluentColors.text.secondary 
  },
  msg: { 
    fontSize: FluentTypography.fontSize.medium, 
    color: FluentColors.text.primary 
  },

  inputRow: {
    flexDirection: "row",
    paddingHorizontal: FluentSpacing.s,
    paddingTop: FluentSpacing.s,
    paddingBottom: FluentSpacing.m,
    borderTopWidth: 1,
    borderColor: FluentColors.border.default,
    backgroundColor: FluentColors.background.default,
    alignItems: "flex-end",
    gap: FluentSpacing.s,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    marginRight: FluentSpacing.s,
  },

  charCount: {
    textAlign: "right",
    marginTop: FluentSpacing.xxs,
  },
  charCountExceeded: {
    // Handled by Text component color prop
  },

  sendButton: {
    alignSelf: "flex-end",
  },

  // learning plan card
  learningContainer: {
    marginTop: FluentSpacing.s,
    padding: FluentSpacing.m,
    borderRadius: FluentBorderRadius.large,
    backgroundColor: FluentColors.semantic.infoBackground,
    borderWidth: 1,
    borderColor: FluentColors.brand.primaryDisabled,
  },
  learningTitle: {
    fontSize: FluentTypography.fontSize.medium,
    fontWeight: FluentTypography.fontWeight.bold,
    color: FluentColors.text.primary,
  },
  learningMeta: {
    fontSize: FluentTypography.fontSize.small,
    color: FluentColors.text.secondary,
    marginBottom: FluentSpacing.xs,
  },
  learningSectionTitle: {
    marginTop: FluentSpacing.xs,
    fontSize: FluentTypography.fontSize.small,
    fontWeight: FluentTypography.fontWeight.semibold,
    color: FluentColors.text.primary,
  },
  learningModule: { marginTop: FluentSpacing.xs },
  learningModuleTitle: {
    fontSize: FluentTypography.fontSize.small,
    fontWeight: FluentTypography.fontWeight.semibold,
    color: FluentColors.text.primary,
  },
  learningModuleDesc: { 
    fontSize: FluentTypography.fontSize.small, 
    color: FluentColors.text.secondary 
  },
  linkText: {
    fontSize: FluentTypography.fontSize.small,
    color: FluentColors.brand.primary,
    textDecorationLine: "underline",
    marginTop: FluentSpacing.xxs,
  },

  // agent UI stress test
  agentContainer: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  agentTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
    color: "#111827",
  },
  agentSummary: { fontSize: 11, color: "#4b5563" },
  agentSectionTitle: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#1f2937",
  },
  agentModule: { marginTop: 4 },
  agentModuleTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#111827",
  },
  agentModuleDesc: { fontSize: 11, color: "#4b5563" },
  agentLink: {
    fontSize: 11,
    color: "#2563eb",
    textDecorationLine: "underline",
    marginTop: 2,
  },

  // (legacy) timestamp under bubble — no longer used, safe to keep or remove
  timeUnder: {
    fontSize: 10,
    color: "#777",
    marginTop: 4,
  },

  // message group + timestamp above bubble
  messageGroup: {
    marginBottom: FluentSpacing.s,
  },
  timeAbove: {
    fontSize: FluentTypography.fontSize.small,
    color: FluentColors.text.secondary,
    marginBottom: FluentSpacing.xxs,
  },
  timeRight: {
    alignSelf: "flex-end",
  },
  timeLeft: {
    alignSelf: "flex-start",
  },

  // "View" inline button
  inlineButton: {
    marginTop: FluentSpacing.s,
    alignSelf: "flex-start",
  },
  inlineButtonText: {
    // Handled by Button component
  },

  // ===== Daily plan table styles =====
  tableContainer: {
    marginTop: FluentSpacing.s,
    borderWidth: 1,
    borderColor: FluentColors.border.default,
    borderRadius: FluentBorderRadius.large,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: FluentColors.background.tertiary,
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: FluentColors.border.default,
  },
  tableHeaderCell: {
    paddingHorizontal: FluentSpacing.xs,
    paddingVertical: FluentSpacing.xs,
    fontSize: FluentTypography.fontSize.small,
    fontWeight: FluentTypography.fontWeight.bold,
    color: FluentColors.text.primary,
  },
  tableCell: {
    paddingHorizontal: FluentSpacing.xs,
    paddingVertical: FluentSpacing.xs,
    fontSize: FluentTypography.fontSize.small,
    color: FluentColors.text.secondary,
  },
  tableColDay: {
    flex: 1.4,
  },
  tableColFocus: {
    flex: 1.2,
  },
  tableColActivity: {
    flex: 1.6,
  },

  // Sidebar toggle button
  sidebarToggle: {
    position: "absolute" as const,
    top: 16,
    left: 16,
    zIndex: 10,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
