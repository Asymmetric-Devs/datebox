import { useMemo, useRef, useState } from "react";
import {
  View,
  StatusBar,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Text,
  Button,
  Surface,
  TextInput,
  Chip,
  ActivityIndicator,
} from "react-native-paper";
import { COLORS, STYLES as baseStyles } from "@/styles/base";
import { BackButton } from "@/components/shared/BackButton";
import { useToast } from "@/components/shared/Toast";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

type AgentInvokeResponse = {
  conversation_id: string;
  message: string;
  timestamp: string;
  metadata?: {
    execution_time_ms?: number;
  };
};

const SUGGESTED_PROMPTS = [
  "Agéndame una cita romántica para esta semana",
  "Contame una historia corta y emotiva para mi álbum familiar",
  "Dame 3 ideas creativas para una salida en pareja sin gastar mucho",
  "Ayudame a escribir una narrativa de aventura para fotos del finde",
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

async function invokeAgent(message: string, conversationId?: string) {
  const baseUrl = getAgentBaseUrl();
  const response = await fetch(`${baseUrl}/agent/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      user_id: "mobile-user",
      context: {
        source: "mobile-historias",
      },
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
  const { showToast } = useToast();
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const hasMessages = messages.length > 0;

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading,
    [input, loading],
  );

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    appendMessage({
      id: `${Date.now()}-user`,
      role: "user",
      text: content,
    });

    if (!text) setInput("");
    setLoading(true);

    try {
      const result = await invokeAgent(content, conversationId);
      if (!conversationId) setConversationId(result.conversation_id);

      appendMessage({
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: result.message,
      });
    } catch (error) {
      showToast({
        type: "error",
        message: "No pude conectar con HistorIAs. Reintentá en unos segundos.",
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

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";

    return (
      <View
        style={{
          width: "100%",
          marginBottom: 10,
          alignItems: isUser ? "flex-end" : "flex-start",
        }}
      >
        <Surface
          style={{
            maxWidth: "88%",
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: isUser ? COLORS.secondary : COLORS.backgroundSecondary,
          }}
          elevation={1}
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
        </Surface>
      </View>
    );
  };

  return (
    <SafeAreaView style={baseStyles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 18,
            paddingBottom: 12,
            borderBottomWidth: 0,
            borderBottomColor: COLORS.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <BackButton size={28} onPress={() => router.back()} />
            <Text style={baseStyles.superHeading}>HistorIAs</Text>
            <View style={{ width: 28 }} />
          </View>

          <Text style={{ ...baseStyles.subheading, marginTop: 0 }}>
            Pedí ideas, planes o historias y obtené texto listo para usar.
          </Text>
        </View>

        {!hasMessages ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
            <Text style={{ ...baseStyles.sectionTitle, marginBottom: 10 }}>
              Sugerencias
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <Chip
                  key={prompt}
                  mode="outlined"
                  style={{ backgroundColor: COLORS.backgroundSecondary }}
                  textStyle={{ color: COLORS.textSecondary }}
                  onPress={() => handleSend(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 18,
            flexGrow: 1,
          }}
        />

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 16,
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            backgroundColor: COLORS.background,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextInput
                mode="outlined"
                value={input}
                onChangeText={setInput}
                placeholder="Escribí tu idea..."
                multiline
                outlineStyle={{ borderRadius: 12 }}
                style={{ backgroundColor: COLORS.white }}
                disabled={loading}
              />
            </View>
            <Button
              mode="contained"
              onPress={() => handleSend()}
              disabled={!canSend}
              style={{ borderRadius: 12 }}
              buttonColor={COLORS.primary}
              textColor={COLORS.white}
              contentStyle={{ height: 50 }}
            >
              Enviar
            </Button>
          </View>

          {loading ? (
            <View
              style={{
                marginTop: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ActivityIndicator size={16} color={COLORS.textSecondary} />
              <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                HistorIAs está escribiendo...
              </Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
