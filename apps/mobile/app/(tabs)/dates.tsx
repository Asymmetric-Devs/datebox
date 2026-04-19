import { useState, useCallback } from "react";
import {
  StatusBar,
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { ActivityIndicator, Text, Icon } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { rnFetch } from "@elepad/api-client/src/mutator";
import { COLORS, STYLES, SHADOWS, LAYOUT, FONT, SPACING } from "@/styles/base";
import HistoriasScreen from "../historias";

// ── Types ────────────────────────────────────────────────────────────
interface Tag {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
}

interface EventWithTags {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

interface PaginatedEvents {
  data: EventWithTags[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ── API fetch ────────────────────────────────────────────────────────
function fetchDatesExplore(page: number, pageSize: number) {
  return rnFetch<PaginatedEvents>(
    `/events?page=${page}&pageSize=${pageSize}`,
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── DateCard ─────────────────────────────────────────────────────────
function DateCard({
  date,
  expanded,
  onToggle,
}: {
  date: EventWithTags;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.dateCard}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.iconCircle}>
            <Icon
              source="calendar-clock"
              size={22}
              color={COLORS.primary}
            />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle} numberOfLines={expanded ? undefined : 1}>
              {date.title}
            </Text>
            <Text style={styles.cardDate}>
              {formatDate(date.startsAt)} · {formatTime(date.startsAt)}
            </Text>
          </View>
        </View>
        <Icon
          source={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={COLORS.textSecondary}
        />
      </View>

      {/* Tags row — pill chips matching onboarding style */}
      {date.tags.length > 0 && (
        <View style={styles.chipContainer}>
          {date.tags.map((tag) => (
            <View key={tag.id} style={styles.chip}>
              <Text style={styles.chipText}>{tag.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Expanded details */}
      {expanded && (
        <View style={styles.expandedSection}>
          {/* Description */}
          {date.description && (
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>{date.description}</Text>
            </View>
          )}

          {/* Tag details grouped by category */}
          {date.tags.length > 0 && (
            <View style={styles.tagDetailsSection}>
              <Text style={styles.sectionLabel}>ETIQUETAS</Text>
              {date.tags.map((tag) => (
                <View key={tag.id} style={styles.tagDetailRow}>
                  <View style={styles.tagDetailHeader}>
                    <View style={styles.tagDetailChip}>
                      <Text style={styles.tagDetailChipText}>{tag.name}</Text>
                    </View>
                    {tag.category && (
                      <Text style={styles.tagCategory}>{tag.category}</Text>
                    )}
                  </View>
                  {tag.description && (
                    <Text style={styles.tagDescription}>{tag.description}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* End time if exists */}
          {date.endsAt && (
            <View style={styles.endTimeRow}>
              <Icon source="clock-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.endTimeText}>
                Finaliza: {formatDate(date.endsAt)} · {formatTime(date.endsAt)}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────
export default function DatesScreen() {
  const [viewMode, setViewMode] = useState<"explore" | "chat">("explore");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["dates-explore"],
    queryFn: () => fetchDatesExplore(1, 50),
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (isLoading) {
    return (
      <View style={STYLES.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const dates = data?.data ?? [];

  return (
    <SafeAreaView style={STYLES.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.screenContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dates</Text>
          {viewMode === "explore" && (data?.total ?? 0) > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{data?.total}</Text>
            </View>
          )}
        </View>

        <View style={styles.modeSelectorWrap}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setViewMode("explore")}
            style={[
              styles.modeButton,
              viewMode === "explore" ? styles.modeButtonActive : undefined,
            ]}
          >
            <Icon
              source="calendar-search"
              size={16}
              color={viewMode === "explore" ? COLORS.white : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.modeButtonText,
                viewMode === "explore" ? styles.modeButtonTextActive : undefined,
              ]}
            >
              Explorar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setViewMode("chat")}
            style={[
              styles.modeButton,
              viewMode === "chat" ? styles.modeButtonActive : undefined,
            ]}
          >
            <Icon
              source="robot"
              size={16}
              color={viewMode === "chat" ? COLORS.white : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.modeButtonText,
                viewMode === "chat" ? styles.modeButtonTextActive : undefined,
              ]}
            >
              DateBot
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === "chat" ? (
          <View style={styles.chatContainer}>
            <HistoriasScreen
              embedded
              embeddedBottomInset={LAYOUT.bottomNavHeight - 24}
            />
          </View>
        ) : dates.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Icon source="heart-outline" size={40} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>Sin citas aún</Text>
            <Text style={styles.emptySubtitle}>
              Las citas de tus grupos aparecerán aquí con sus etiquetas
            </Text>
          </View>
        ) : (
          <FlatList
            data={dates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <DateCard
                date={item}
                expanded={expandedId === item.id}
                onToggle={() => toggleExpand(item.id)}
              />
            )}
            contentContainerStyle={{
              paddingHorizontal: SPACING.lg,
              paddingBottom: LAYOUT.bottomNavHeight + 20,
              gap: 12,
            }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles — matches app's B&W minimalist aesthetic ─────────────────
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.m,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FONT.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: "center",
  },
  countText: {
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  modeSelectorWrap: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.m,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    padding: 6,
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  modeButtonText: {
    fontFamily: FONT.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  modeButtonTextActive: {
    color: COLORS.white,
  },
  chatContainer: {
    flex: 1,
  },

  // ── Card ─────────────────────────────────────────────────────────
  dateCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 20,
    padding: SPACING.m,
    ...SHADOWS.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: SPACING.s,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.light,
  },
  cardTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  cardDate: {
    fontSize: 13,
    fontFamily: FONT.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // ── Tag chips (same pill style as onboarding interests) ──────────
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipText: {
    fontSize: 13,
    fontFamily: FONT.regular,
    color: COLORS.text,
  },

  // ── Expanded section ─────────────────────────────────────────────
  expandedSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
  },
  descriptionBox: {
    marginBottom: 14,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // ── Tag details ──────────────────────────────────────────────────
  tagDetailsSection: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: FONT.bold,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  tagDetailRow: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
  },
  tagDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tagDetailChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
  },
  tagDetailChipText: {
    fontSize: 13,
    fontFamily: FONT.regular,
    color: COLORS.white,
  },
  tagCategory: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tagDescription: {
    fontSize: 13,
    fontFamily: FONT.regular,
    color: COLORS.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },

  // ── End time ─────────────────────────────────────────────────────
  endTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  endTimeText: {
    fontSize: 13,
    fontFamily: FONT.regular,
    color: COLORS.textSecondary,
  },

  // ── Empty state ──────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    ...SHADOWS.light,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
