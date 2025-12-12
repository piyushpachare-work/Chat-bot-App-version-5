import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [tick, setTick] = useState(0);
  const [hasLoadedIntro, setHasLoadedIntro] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [session, setSession] = useState<SessionTokens | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

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
        }
      } catch (error) {
        setAuthError("Sign-in required to start chatting.");
      }
    };

    bootstrap();
  }, [syncConversationId]);

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

      setAuthenticating(true);
      const fresh = await interactiveLogin();
      setSession(fresh);
      setAuthError(null);
      return fresh;
    } catch (error) {
      setAuthError("Sign-in was cancelled or failed.");
      throw error;
    } finally {
      setAuthenticating(false);
    }
  }, []);

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
          <Text style={[styles.timeAbove, styles.timeLeft]}>
            {timeAgo(item.timestamp)}
          </Text>

          <View style={[styles.bubble, styles.botBubble]}>
            <View style={styles.bubbleHeader}>
              <Text style={styles.label}>Bot</Text>
            </View>

            <Text style={styles.msg}>
              Here is your detailed daily learning plan:
            </Text>

            <View style={styles.tableContainer}>
              {/* table header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.tableColDay]}>
                  Day
                </Text>
                <Text style={[styles.tableHeaderCell, styles.tableColFocus]}>
                  Focus
                </Text>
                <Text
                  style={[styles.tableHeaderCell, styles.tableColActivity]}
                >
                  Activity
                </Text>
              </View>

              {rows.map((row) => (
                <View key={row.key} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.tableColDay]}>
                    {row.day}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableColFocus]}>
                    {row.focus}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableColActivity]}>
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
          <Text style={[styles.timeAbove, styles.timeLeft]}>
            {timeAgo(item.timestamp)}
          </Text>

          <View style={[styles.bubble, styles.botBubble]}>
            <View style={styles.bubbleHeader}>
              <Text style={styles.label}>Bot</Text>
            </View>

            <Text style={styles.msg}>{item.text}</Text>

            <TouchableOpacity
              style={styles.inlineButton}
              onPress={() => handleViewWeeklyPlan(item.relatedToId)}
            >
              <Text style={styles.inlineButtonText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ================= NORMAL MESSAGES =================
    return (
      <View style={styles.messageGroup}>
        <Text
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
            <Text style={styles.label}>
              {item.from === "user" ? "You" : "Bot"}
            </Text>
          </View>

          <Text style={styles.msg}>{item.text}</Text>

          {/* Learning plan UI */}
          {item.from === "bot" && item.learningPlan && (
            <View style={styles.learningContainer}>
              <Text style={styles.learningTitle}>
                {item.learningPlan.topic} – {item.learningPlan.level}
              </Text>
              <Text style={styles.learningMeta}>
                Duration: {item.learningPlan.durationWeeks} weeks
              </Text>

              <Text style={styles.learningSectionTitle}>Curriculum</Text>
              {item.learningPlan.modules.map((mod, index) => (
                <View key={index} style={styles.learningModule}>
                  <Text style={styles.learningModuleTitle}>
                    {index + 1}. {mod.title}
                  </Text>
                  <Text style={styles.learningModuleDesc}>
                    {mod.description}
                  </Text>
                </View>
              ))}

              <Text style={styles.learningSectionTitle}>YouTube videos</Text>
              {item.learningPlan.youtubeLinks.map((url, index) => (
                <Text
                  key={index}
                  style={styles.linkText}
                  onPress={() => Linking.openURL(url)}
                >
                  {url}
                </Text>
              ))}

              <Text style={styles.learningSectionTitle}>
                LinkedIn Learning videos
              </Text>
              {item.learningPlan.linkedinLinks.map((url, index) => (
                <Text
                  key={index}
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
            <View style={{ marginTop: 8 }}>
              <Text style={styles.learningSectionTitle}>
                Agent Activity (SDK)
              </Text>
              {item.agentActivity.text ? (
                <Text style={styles.learningModuleDesc}>
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

  const renderAuthState = () => {
    if (authenticating) {
      return (
        <View style={[styles.list, { flex: 1, justifyContent: "center" }]}>
          <ActivityIndicator />
          <Text style={{ marginTop: 12 }}>Signing in with Microsoft Entra…</Text>
        </View>
      );
    }

    if (!session) {
      return (
        <View style={[styles.list, { flex: 1, justifyContent: "center" }]}>
          <Text style={{ marginBottom: 12, fontWeight: "600" }}>
            Sign in with Microsoft Entra to start chatting.
          </Text>
          {authError ? (
            <Text style={{ color: "#dc2626", marginBottom: 8 }}>{authError}</Text>
          ) : null}
          <TouchableOpacity
            onPress={() => ensureSession().catch(() => null)}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Sign in with Microsoft</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {renderAuthState() ?? (
          <>
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
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Type a message..."
                  multiline
                  editable={!!session}
                />

                <Text
                  style={[
                    styles.charCount,
                    inputTooLong && styles.charCountExceeded,
                  ]}
                >
                  {input.length}/{MAX_MESSAGE_LENGTH}
                  {inputTooLong ? " – too long" : ""}
                </Text>
              </View>

              <TouchableOpacity
                onPress={sendMessage}
                disabled={!input.trim() || isSending || inputTooLong || !session}
                style={[
                  styles.button,
                  (!input.trim() || isSending || inputTooLong || !session) &&
                    styles.buttonDisabled,
                ]}
              >
                <Text style={styles.buttonText}>{isSending ? "..." : "Send"}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
