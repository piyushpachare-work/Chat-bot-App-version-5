import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Text } from "@/components/fluent-ui/Text";
import { TextInput } from "@/components/fluent-ui/TextInput";
import { Button } from "@/components/fluent-ui/Button";
import { FluentColors, FluentSpacing } from "@/constants/fluent-ui-tokens";

import { interactiveLogin, ensureValidSession, authenticatedFetch } from "@/src/auth/api";
import {
  SessionTokens,
  clearConversation,
  clearSession,
  getConversationId,
  saveConversationId,
} from "@/src/auth/session";
import { getBackendBaseUrl } from "@/src/auth/config";
import { chatStyles as styles } from "../styles/chatStyles";
import { timeAgo } from "../utils/timeAgo";
import { SavedNotesSidebar } from "../components/SavedNotesSidebar";
import { SaveToNotesButton } from "../components/SaveToNotesButton";

const MAX_MESSAGE_LENGTH = 1500;
const CHAT_URL = `${getBackendBaseUrl()}/chat`;

// =============================
// Types aligned with backend
// =============================

// Minimal shape of an Adaptive Card attachment inside the Bot Framework activity
type AgentAttachment = {
  contentType: string;
  content: any; // AdaptiveCard JSON (we keep it flexible here)
};

// Minimal Bot Framework Activity representation from backend
type AgentActivity = {
  id: string;
  type: string;
  text?: string;
  attachments?: AgentAttachment[];
  [key: string]: any; // allow extra fields like serviceUrl, conversation, etc.
};

type LearningModule = {
  title: string;
  description: string;
  dailyPlan?: string[];
};

type LearningPlan = {
  topic: string;
  level: string;
  durationWeeks: number;
  modules: LearningModule[];
  youtubeLinks: string[];
  linkedinLinks: string[];
};

type MessageKind = "normal" | "weeklyPrompt" | "dailyPlan";

type Message = {
  id: string;
  from: "user" | "bot";
  text: string;
  timestamp: string;
  learningPlan?: LearningPlan;
  kind?: MessageKind;
  relatedToId?: string;
  // MS Agent SDK-style activity returned by backend
  agentActivity?: AgentActivity | null;
};

export default function Page() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [tick, setTick] = useState(0);
  const [hasLoadedIntro, setHasLoadedIntro] = useState(false);
  const [session, setSession] = useState<SessionTokens | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true); // Open by default
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

  // Re-render timeAgo() every 60 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const syncConversationId = useCallback(async () => {
    const stored = await getConversationId();
    if (stored) {
      setConversationId(stored);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await syncConversationId();
        const validSession = await ensureValidSession();
        if (validSession) {
          setSession(validSession);
          setAuthError(null);
        } else {
          // No valid session, redirect to login
          router.replace('/login');
        }
      } catch (error) {
        // On error, redirect to login
        router.replace('/login');
      }
    };

    bootstrap();
  }, [syncConversationId, router]);

  // Load intro message after authentication
  useEffect(() => {
    const loadIntroMessage = async () => {
      if (hasLoadedIntro || !session) return;

      try {
        const response = await sendChatRequest({ message: "" });
        const data = await response.json();

        if (data.conversation_id) {
          setConversationId(data.conversation_id);
          await saveConversationId(data.conversation_id);
        }

        if (data.reply) {
          const introMessage: Message = {
            id: "intro-" + Date.now(),
            from: "bot",
            text: data.reply,
            timestamp: new Date().toISOString(),
            kind: "normal",
          };
          setMessages([introMessage]);
        }
      } catch {
        setAuthError("Could not load intro message.");
      } finally {
        setHasLoadedIntro(true);
      }
    };

    loadIntroMessage();
  }, [hasLoadedIntro, session]);

  const ensureSession = useCallback(async (): Promise<SessionTokens> => {
    try {
      const valid = await ensureValidSession();
      if (valid) {
        setSession(valid);
        setAuthError(null);
        return valid;
      }

      // No valid session, redirect to login screen
      router.replace('/login');
      throw new Error("No valid session");
    } catch (error) {
      // If already redirecting, just throw
      if (error instanceof Error && error.message === "No valid session") {
        throw error;
      }
      // Otherwise redirect to login
      router.replace('/login');
      throw error;
    }
  }, [router]);

  const handleUnauthorized = useCallback(async () => {
    setSession(null);
    await clearSession();
    await clearConversation();
    setAuthError("Session expired. Please sign in again.");
  }, []);

  const sendChatRequest = useCallback(
    async (body: Record<string, unknown>) => {
      await ensureSession();
      
      const response = await authenticatedFetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...body,
          conversation_id: conversationId ?? undefined,
        }),
      });

      // Update session state if it was refreshed during the fetch
      const updatedSession = await ensureValidSession();
      if (updatedSession) {
        setSession(updatedSession);
      }

      // If still unauthorized after refresh attempt, clear session
      if (response.status === 401) {
        await handleUnauthorized();
        throw new Error("Session is not authorized.");
      }

      return response;
    },
    [conversationId, ensureSession, handleUnauthorized]
  );

  // =============================================
  // SEND MESSAGE TO BACKEND
  // =============================================
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const nowIso = new Date().toISOString();

    const userMessage: Message = {
      id: Date.now().toString(),
      from: "user",
      text: trimmed,
      timestamp: nowIso,
      kind: "normal",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await sendChatRequest({ message: trimmed });
      const data = await response.json();
      const baseId = Date.now().toString();

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
        await saveConversationId(data.conversation_id);
      }

      const botMessage: Message = {
        id: baseId + "-bot",
        from: "bot",
        text: data.reply || "(no reply)",
        timestamp: data.timestamp || new Date().toISOString(),
        learningPlan: data.learning_plan ?? undefined,
        // this now holds the full Bot Framework activity with Adaptive Card attachments
        agentActivity: data.agent_activity ?? null,
        kind: "normal",
      };

      const hasLearningPlan = !!botMessage.learningPlan;

      if (hasLearningPlan) {
        const promptMessage: Message = {
          id: baseId + "-weeklyPrompt",
          from: "bot",
          text:
            "If you want to know the detailed daily plan for this curriculum, click the View button.",
          timestamp: new Date().toISOString(),
          kind: "weeklyPrompt",
          relatedToId: botMessage.id,
        };

        setMessages((prev) => [...prev, botMessage, promptMessage]);
      } else {
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (err) {
      const errorMessage: Message = {
        id: Date.now().toString() + "-err",
        from: "bot",
        text: authError || "Server error. Check backend.",
        timestamp: new Date().toISOString(),
        kind: "normal",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  // =============================================
  // BUILD DAILY PLAN TABLE DATA
  // =============================================
  const buildDailyPlanRows = (source: Message) => {
    const rows: {
      key: string;
      day: string;
      focus: string;
      activity: string;
    }[] = [];

    if (source.learningPlan) {
      source.learningPlan.modules.forEach((mod, index) => {
        const week = index + 1;
        const daily = mod.dailyPlan ?? [];

        daily.forEach((activity, dayIndex) => {
          rows.push({
            key: `${week}-${dayIndex}`,
            day: `Week ${week} · Day ${dayIndex + 1}`,
            focus: mod.title,
            activity: activity,
          });
        });
      });
    }

    return rows;
  };

  // =============================================
  // HANDLE VIEW BUTTON
  // =============================================
  const handleViewWeeklyPlan = (relatedToId?: string) => {
    if (!relatedToId) return;

    setMessages((prev) => {
      const curriculumMsg = prev.find(
        (m) => m.id === relatedToId && m.learningPlan
      );
      if (!curriculumMsg) return prev;

      const dailyPlanMsg: Message = {
        id: Date.now().toString() + "-dailyPlan",
        from: "bot",
        text: "",
        timestamp: new Date().toISOString(),
        kind: "dailyPlan",
        relatedToId,
      };

      return [...prev, dailyPlanMsg];
    });
  };

  // =============================================
  // RENDER ITEM
  // =============================================
  const renderItem = ({ item }: { item: Message }) => {
    // ================= DAILY PLAN TABLE =================
    if (item.kind === "dailyPlan") {
      const curriculumMsg = messages.find((m) => m.id === item.relatedToId);
      if (!curriculumMsg) return null;

      const rows = buildDailyPlanRows(curriculumMsg);

      return (
        <View style={styles.messageGroup}>
          <Text variant="caption" color="secondary" style={[styles.timeAbove, styles.timeLeft]}>
            {timeAgo(item.timestamp)}
          </Text>

          <View style={[styles.bubble, styles.botBubble]}>
            <View style={styles.bubbleHeader}>
              <Text variant="caption" color="secondary" style={styles.label}>Bot</Text>
            </View>

            <Text variant="body" style={styles.msg}>
              Here is your detailed daily learning plan:
            </Text>

            <View style={styles.tableContainer}>
              {/* table header */}
              <View style={styles.tableHeaderRow}>
                <Text variant="caption" weight="bold" style={[styles.tableHeaderCell, styles.tableColDay]}>
                  Day
                </Text>
                <Text variant="caption" weight="bold" style={[styles.tableHeaderCell, styles.tableColFocus]}>
                  Focus
                </Text>
                <Text variant="caption" weight="bold" style={[styles.tableHeaderCell, styles.tableColActivity]}>
                  Activity
                </Text>
              </View>

              {rows.map((row) => (
                <View key={row.key} style={styles.tableRow}>
                  <Text variant="caption" style={[styles.tableCell, styles.tableColDay]}>
                    {row.day}
                  </Text>
                  <Text variant="caption" style={[styles.tableCell, styles.tableColFocus]}>
                    {row.focus}
                  </Text>
                  <Text variant="caption" style={[styles.tableCell, styles.tableColActivity]}>
                    {row.activity}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      );
    }

    // ================= WEEKLY PROMPT =================
    if (item.kind === "weeklyPrompt") {
      return (
        <View style={styles.messageGroup}>
          <Text variant="caption" color="secondary" style={[styles.timeAbove, styles.timeLeft]}>
            {timeAgo(item.timestamp)}
          </Text>

          <View style={[styles.bubble, styles.botBubble]}>
            <View style={styles.bubbleHeader}>
              <Text variant="caption" color="secondary" style={styles.label}>Bot</Text>
            </View>

            <Text variant="body" style={styles.msg}>{item.text}</Text>

            <Button
              appearance="outline"
              size="small"
              style={styles.inlineButton}
              onPress={() => handleViewWeeklyPlan(item.relatedToId)}
              accessibilityLabel="View daily plan"
            >
              View
            </Button>
          </View>
        </View>
      );
    }

    // ================= NORMAL MESSAGES =================
    return (
      <View style={styles.messageGroup}>
        <Text
          variant="caption"
          color="secondary"
          style={[
            styles.timeAbove,
            item.from === "user" ? styles.timeRight : styles.timeLeft,
          ]}
        >
          {timeAgo(item.timestamp)}
        </Text>

        <View
          style={[
            styles.bubble,
            item.from === "user" ? styles.userBubble : styles.botBubble,
          ]}
        >
          <View style={styles.bubbleHeader}>
            <Text variant="caption" color="secondary" style={styles.label}>
              {item.from === "user" ? "You" : "Bot"}
            </Text>
          </View>

          <Text variant="body" style={styles.msg}>{item.text}</Text>

          {/* Save to Notes button for bot messages */}
          {item.from === "bot" && (
            <SaveToNotesButton
              content={item.text}
              messageId={item.id}
              conversationId={conversationId || undefined}
              onSaved={() => {
                // Trigger sidebar refresh to show the newly saved note
                setSidebarRefreshTrigger((prev) => prev + 1);
              }}
            />
          )}

          {/* Learning plan UI */}
          {item.from === "bot" && item.learningPlan && (
            <View style={styles.learningContainer}>
              <Text variant="body" weight="bold" style={styles.learningTitle}>
                {item.learningPlan.topic} – {item.learningPlan.level}
              </Text>
              <Text variant="caption" color="secondary" style={styles.learningMeta}>
                Duration: {item.learningPlan.durationWeeks} weeks
              </Text>

              <Text variant="caption" weight="semibold" style={styles.learningSectionTitle}>Curriculum</Text>
              {item.learningPlan.modules.map((mod, index) => (
                <View key={index} style={styles.learningModule}>
                  <Text variant="caption" weight="semibold" style={styles.learningModuleTitle}>
                    {index + 1}. {mod.title}
                  </Text>
                  <Text variant="caption" color="secondary" style={styles.learningModuleDesc}>
                    {mod.description}
                  </Text>
                </View>
              ))}

              <Text variant="caption" weight="semibold" style={styles.learningSectionTitle}>YouTube videos</Text>
              {item.learningPlan.youtubeLinks.map((url, index) => (
                <Text
                  key={index}
                  variant="caption"
                  color="brand"
                  style={styles.linkText}
                  onPress={() => Linking.openURL(url)}
                >
                  {url}
                </Text>
              ))}

              <Text variant="caption" weight="semibold" style={styles.learningSectionTitle}>
                LinkedIn Learning videos
              </Text>
              {item.learningPlan.linkedinLinks.map((url, index) => (
                <Text
                  key={index}
                  variant="caption"
                  color="brand"
                  style={styles.linkText}
                  onPress={() => Linking.openURL(url)}
                >
                  {url}
                </Text>
              ))}
            </View>
          )}

          {/* Optional: show some info from the Agent SDK activity */}
          {item.from === "bot" && item.agentActivity && (
            <View style={{ marginTop: FluentSpacing.s }}>
              <Text variant="caption" weight="semibold" style={styles.learningSectionTitle}>
                Agent Activity (SDK)
              </Text>
              {item.agentActivity.text ? (
                <Text variant="caption" color="secondary" style={styles.learningModuleDesc}>
                  {item.agentActivity.text}
                </Text>
              ) : null}
              {/* 
                If you later integrate the real Microsoft Agent SDK client,
                you can pass `item.agentActivity` directly into it instead
                of just displaying this text.
              */}
            </View>
          )}
        </View>
      </View>
    );
  };

  // =============================================
  // MAIN VIEW
  // =============================================
  const inputTooLong = input.length > MAX_MESSAGE_LENGTH;

  // If no session, show loading while redirecting to login
  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.list, { flex: 1, justifyContent: "center" }]}>
          <ActivityIndicator color={FluentColors.brand.primary} />
          <Text variant="body" color="secondary" style={{ marginTop: FluentSpacing.m, textAlign: "center" }}>
            Redirecting to sign-in...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", flex: 1 }}>
        {/* Sidebar */}
        <SavedNotesSidebar
          isVisible={sidebarVisible}
          onToggle={() => setSidebarVisible(!sidebarVisible)}
          refreshTrigger={sidebarRefreshTrigger}
        />

        {/* Main Chat Area */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            extraData={tick}
          />

          <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              multiline
              editable={!!session}
              containerStyle={{ marginBottom: FluentSpacing.xs }}
              inputStyle={styles.input}
            />

            <Text
              variant="caption"
              color={inputTooLong ? "error" : "secondary"}
              style={styles.charCount}
            >
              {input.length}/{MAX_MESSAGE_LENGTH}
              {inputTooLong ? " – too long" : ""}
            </Text>
          </View>

          <Button
            appearance="primary"
            onPress={sendMessage}
            disabled={!input.trim() || isSending || inputTooLong || !session}
            loading={isSending}
            style={styles.sendButton}
            accessibilityLabel="Send message"
            accessibilityHint="Sends your message to the chatbot"
          >
            Send
          </Button>
        </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
