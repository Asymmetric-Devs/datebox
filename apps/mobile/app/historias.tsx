import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StatusBar,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Text,
  IconButton,
  TextInput,
  Chip,
} from "react-native-paper";
import { COLORS, FONT, SHADOWS, STYLES as baseStyles } from "@/styles/base";
import { BackButton } from "@/components/shared/BackButton";
import { useToast } from "@/components/shared/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useGroup } from "@/context/GroupContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ZoomOut,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  isTyping?: boolean;
};

type AgentInvokeResponse = {
  conversation_id: string;
  message: string;
  timestamp: string;
  metadata?: {
    execution_time_ms?: number;
  };
};

type SuggestionGroup = {
  id: string;
  title: string;
  badge: string;
  prompts: string[];
};

const DATEBOT_WELCOME_KEY = "datebot_welcome_seen_v1";

const SUGGESTION_GROUPS: SuggestionGroup[] = [
  {
    id: "dates",
    title: "Date ideas",
    badge: "01",
    prompts: [
      "Agéndame una cita romántica para esta semana",
      "Dame 3 ideas para este viernes con poco presupuesto",
      "Sugerime algo lindo para sorprender hoy",
    ],
  },
  {
    id: "stories",
    title: "Historias",
    badge: "02",
    prompts: [
      "Contame una historia corta y emotiva para un álbum familiar",
      "Escribí una narrativa de aventura para fotos del finde",
      "Creá un texto de apertura para nuestro álbum de recuerdos",
    ],
  },
  {
    id: "quick",
    title: "Ideas rápidas",
    badge: "03",
    prompts: [
      "Dame 5 preguntas para una cita divertida",
      "Ayudame con una frase linda para acompañar una foto",
      "Sugerime algo en casa para conectar más en pareja",
    ],
  },
];

function getAgentBaseUrl() {
  const direct = process.env.EXPO_PUBLIC_AGENT_URL;
  if (direct) return direct;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) return "http://localhost:3001";

  try {
    const parsed = new URL(apiUrl);
    parsed.port = "3001";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:3001";
  }
}

async function invokeAgent(
  message: string,
  options?: {
    conversationId?: string;
    userId?: string;
    groupId?: string;
    apiToken?: string;
  },
) {
  const baseUrl = getAgentBaseUrl();
  const contextPayload: Record<string, string> = {
    source: "mobile-historias",
  };

  if (options?.userId) {
    contextPayload.userId = options.userId;
    contextPayload.createdBy = options.userId;
  }

  if (options?.groupId) {
    contextPayload.groupId = options.groupId;
  }

  if (options?.apiToken) {
    contextPayload.api_token = options.apiToken;
  }

  const response = await fetch(`${baseUrl}/agent/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      conversation_id: options?.conversationId,
      user_id: options?.userId,
      context: contextPayload,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "No se pudo contactar al agente");
  }

  return (await response.json()) as AgentInvokeResponse;
}

export default function HistoriasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { user, session } = useAuth();
  const { selectedGroupId } = useGroup();
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const [closingWelcome, setClosingWelcome] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string>(
    SUGGESTION_GROUPS[0]?.id ?? "",
  );
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const hasMessages = messages.length > 0;

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading,
    [input, loading],
  );

  const expandedGroup = useMemo(
    () => SUGGESTION_GROUPS.find((group) => group.id === expandedCategoryId),
    [expandedCategoryId],
  );

  const displayMessages = useMemo(() => {
    if (!loading) return messages;

    return [
      ...messages,
      {
        id: "typing-indicator",
        role: "assistant" as const,
        text: "",
        isTyping: true,
      },
    ];
  }, [messages, loading]);

  const [typingStep, setTypingStep] = useState(0);

  useEffect(() => {
    let mounted = true;

    const checkWelcome = async () => {
      try {
        const seen = await AsyncStorage.getItem(DATEBOT_WELCOME_KEY);
        if (mounted) setShowWelcome(!seen);
      } catch (error) {
        console.error("Error reading dateBot welcome state:", error);
      } finally {
        if (mounted) setWelcomeChecked(true);
      }
    };

    checkWelcome();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates?.height ?? 0;
      setKeyboardHeight(height);
      setIsKeyboardOpen(true);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setIsKeyboardOpen(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setTypingStep(0);
      return;
    }

    const interval = setInterval(() => {
      setTypingStep((prev) => (prev + 1) % 3);
    }, 320);

    return () => clearInterval(interval);
  }, [loading]);

  const closeWelcome = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await AsyncStorage.setItem(DATEBOT_WELCOME_KEY, "1");
      setClosingWelcome(true);
      setTimeout(() => {
        setShowWelcome(false);
        setClosingWelcome(false);
      }, 650);
    } catch (error) {
      console.error("Error storing dateBot welcome state:", error);
      setShowWelcome(false);
    }
  };

  const sendButtonScale = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(canSend ? 1 : 0.94, {
          damping: 30,
          stiffness: 280,
          overshootClamping: true,
        }),
      },
    ],
    opacity: withSpring(canSend ? 1 : 0.6, {
      damping: 30,
      stiffness: 280,
      overshootClamping: true,
    }),
  }));

  const composerShellStyle = useAnimatedStyle(() => {
    const compact = !(isKeyboardOpen || isInputFocused);
    const inset = compact ? 22 : 12;
    const defaultBottom = Math.max(insets.bottom - 8, 8);
    const keyboardBottom = keyboardHeight + 8;

    return {
      left: withSpring(inset, {
        damping: 28,
        stiffness: 260,
        overshootClamping: true,
      }),
      right: withSpring(inset, {
        damping: 28,
        stiffness: 260,
        overshootClamping: true,
      }),
      bottom: withSpring(isKeyboardOpen ? keyboardBottom : defaultBottom, {
        damping: 28,
        stiffness: 260,
        overshootClamping: true,
      }),
    };
  });

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    appendMessage({
      id: `${Date.now()}-user`,
      role: "user",
      text: content,
    });

    if (!text) setInput("");
    setLoading(true);

    try {
      const result = await invokeAgent(content, {
        conversationId,
        userId: user?.id,
        groupId: selectedGroupId ?? undefined,
        apiToken: session?.access_token,
      });
      if (!conversationId) setConversationId(result.conversation_id);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      appendMessage({
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: result.message,
      });
    } catch (error) {
      showToast({
        type: "error",
        message: "No pude conectar con DateBot. Reintentá en unos segundos.",
      });
      appendMessage({
        id: `${Date.now()}-assistant-error`,
        role: "assistant",
        text: "No pude responder en este momento. Reintentá en unos segundos.",
      });
      console.error("Error invoking agent:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCategoryId((prev) => (prev === id ? "" : id));
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";

    if (item.isTyping) {
      return (
        <View
          style={{
            width: "100%",
            marginBottom: 10,
            alignItems: "flex-start",
          }}
        >
          <View
            style={{
              maxWidth: "88%",
              paddingHorizontal: 15,
              paddingVertical: 12,
              borderRadius: 16,
              backgroundColor: COLORS.backgroundSecondary,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <View style={styles.typingDotsRow}>
              {[0, 1, 2].map((index) => (
                <View
                  key={`dot-${index}`}
                  style={[
                    styles.typingDot,
                    {
                      opacity: typingStep === index ? 1 : 0.35,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      );
    }

    return (
      <View
        style={{
          width: "100%",
          marginBottom: 10,
          alignItems: isUser ? "flex-end" : "flex-start",
        }}
      >
        <View
          style={{
            maxWidth: "88%",
            paddingHorizontal: 15,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: isUser ? COLORS.secondary : COLORS.backgroundSecondary,
            borderWidth: 1,
            borderColor: isUser ? "rgba(255,255,255,0.35)" : COLORS.border,
          }}
        >
          <Text
            style={{
              color: isUser ? COLORS.white : COLORS.text,
              fontSize: 14,
              lineHeight: 21,
            }}
          >
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={baseStyles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={{ flex: 1 }}>
        <View style={styles.headerWrap}>
          <View style={styles.headerRow}>
            <BackButton size={28} onPress={() => router.back()} />
            <Text style={baseStyles.superHeading}>DateBot</Text>
            <View style={{ width: 28 }} />
          </View>
        </View>

        {!hasMessages && welcomeChecked ? (
          <View style={styles.suggestionsWrapper}>
            <View style={styles.spheresRow}>
              {SUGGESTION_GROUPS.map((group) => {
                const active = expandedCategoryId === group.id;
                return (
                  <TouchableOpacity
                    key={group.id}
                    activeOpacity={0.9}
                    onPress={() => {
                      void toggleCategory(group.id);
                    }}
                    style={[
                      styles.sphereButton,
                      active ? styles.sphereButtonActive : undefined,
                    ]}
                  >
                    <Text style={styles.sphereBadge}>{group.badge}</Text>
                    <Text style={styles.sphereTitle}>{group.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {expandedGroup ? (
              <Animated.View
                key={expandedGroup.id}
                entering={FadeInDown.duration(220)}
                style={styles.suggestionPanel}
              >
                <View style={styles.chipsWrap}>
                  {expandedGroup.prompts.map((prompt) => (
                    <Chip
                      key={prompt}
                      mode="flat"
                      style={styles.suggestionChip}
                      textStyle={styles.suggestionChipText}
                      onPress={() => {
                        void handleSend(prompt);
                      }}
                      disabled={loading}
                    >
                      {prompt}
                    </Chip>
                  ))}
                </View>
              </Animated.View>
            ) : null}
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: isKeyboardOpen ? keyboardHeight + 140 : 170,
            flexGrow: 1,
          }}
        />

        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.84)", "#FFFFFF"]}
          style={styles.composerGradient}
          pointerEvents="none"
        />

        <Animated.View style={[styles.composerContainer, composerShellStyle]}>
          <View style={styles.composerRow}>
            <TextInput
              mode="outlined"
              value={input}
              onChangeText={setInput}
              placeholder="Escribí tu idea..."
              multiline
              dense
              outlineStyle={styles.inputOutline}
              contentStyle={styles.inputContent}
              style={styles.input}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              disabled={loading}
            />

            <Animated.View style={sendButtonScale}>
              <TouchableOpacity
                onPress={() => {
                  void handleSend();
                }}
                disabled={!canSend}
                activeOpacity={0.85}
                style={styles.sendButton}
              >
                <IconButton
                  icon="send"
                  size={20}
                  iconColor={COLORS.white}
                  style={{ margin: 0 }}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

        </Animated.View>

        {showWelcome ? (
          <Animated.View
            entering={FadeIn.duration(250)}
            exiting={FadeOut.duration(650)}
            style={styles.welcomeOverlay}
          >
            <LinearGradient
              colors={["#FFFFFF", "#F7F7F7", "#EFEFEF"]}
              style={StyleSheet.absoluteFillObject}
            />
            <Animated.View
              entering={FadeInDown.springify()}
              exiting={ZoomOut.duration(420)}
              style={styles.welcomeCard}
            >
              <Text style={styles.welcomeBrand}>DateBot</Text>
              <Text style={styles.welcomeTitle}>Tu asistente creativo de Datebox</Text>
              <Text style={styles.welcomeBody}>
                Te ayudo a crear historias para recuerdos, ideas para citas, textos
                para fotos y propuestas para momentos especiales, todo listo para usar.
              </Text>
              <TouchableOpacity
                onPress={closeWelcome}
                style={styles.welcomeButton}
                activeOpacity={0.9}
              >
                <Text style={styles.welcomeButtonText}>
                  {closingWelcome ? "Iniciando..." : "Vamos con eso"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  suggestionsWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  spheresRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  sphereButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    ...SHADOWS.light,
  },
  sphereButtonActive: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  sphereBadge: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  sphereTitle: {
    fontFamily: FONT.semiBold,
    fontSize: 13,
    color: COLORS.text,
    textAlign: "center",
  },
  suggestionPanel: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 16,
    padding: 12,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
  },
  suggestionChipText: {
    color: COLORS.text,
    fontSize: 12,
  },
  composerGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
  },
  composerContainer: {
    position: "absolute",
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    ...SHADOWS.card,
  },
  inputOutline: {
    borderRadius: 14,
    borderWidth: 0,
    borderColor: "transparent",
  },
  inputContent: {
    minHeight: 44,
    textAlignVertical: "center",
    paddingTop: Platform.OS === "ios" ? 12 : 8,
    paddingBottom: Platform.OS === "ios" ? 12 : 8,
    color: COLORS.text,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  typingDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 10,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.textSecondary,
  },
  welcomeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.white,
  },
  welcomeCard: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 42,
    gap: 14,
  },
  welcomeBrand: {
    fontFamily: FONT.extraBold,
    fontSize: 34,
    color: COLORS.text,
    textAlign: "center",
  },
  welcomeTitle: {
    fontFamily: FONT.bold,
    fontSize: 22,
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  welcomeBody: {
    fontFamily: FONT.regular,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  welcomeButton: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    ...SHADOWS.medium,
  },
  welcomeButtonText: {
    fontFamily: FONT.semiBold,
    color: COLORS.white,
    fontSize: 15,
  },
});
