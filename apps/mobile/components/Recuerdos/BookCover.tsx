import { View, StyleSheet, ViewStyle, TouchableOpacity, FlatList, Modal } from "react-native";
import { Image } from "expo-image";
import { Text } from "react-native-paper";
import { FONT, COLORS } from "@/styles/base";
import { useGetMemories } from "@elepad/api-client";
import { useMemo } from "react";

/** List of sticker images available as book covers. */
export const STICKER_IMAGES = [
  require("@/assets/images/styles/_ (11).jpeg"),
  require("@/assets/images/styles/_ (12).jpeg"),
  require("@/assets/images/styles/_ (13).jpeg"),
  require("@/assets/images/styles/_ (14).jpeg"),
  require("@/assets/images/styles/_ (17).jpeg"),
  require("@/assets/images/styles/_ (18).jpeg"),
  require("@/assets/images/styles/_ (19).jpeg"),
  require("@/assets/images/styles/stickers.jpeg"),
  require("@/assets/images/styles/png.jpeg"),
] as const;

/** Parse a color field value and return the sticker index (or null if not a sticker). */
export function parseStickerIndex(color: string | undefined | null): number | null {
  if (!color) return null;
  const match = /^sticker:(\d+)$/.exec(color);
  if (!match) return null;
  const idx = parseInt(match[1], 10);
  return idx >= 0 && idx < STICKER_IMAGES.length ? idx : null;
}

/** Encode a sticker index into the color field value. */
export function encodeStickerColor(index: number): string {
  return `sticker:${index}`;
}

interface BookCoverProps {
  bookId: string;
  groupId: string;
  color: string;
  title: string;
  compact?: boolean;
}

type StickerPosition = {
  top: `${number}%`;
  left?: `${number}%`;
  right?: `${number}%`;
  rotation: number;
  size: number;
};

const stickerPositions: StickerPosition[] = [
  { top: "35%", left: "9%", rotation: -10, size: 80 },
  { top: "38%", right: "12%", rotation: 8, size: 80 },
  { top: "57%", left: "18%", rotation: -12, size: 80 },
  { top: "57%", right: "9%", rotation: 9, size: 78 },
];

export default function BookCover({
  bookId,
  groupId,
  color,
  title,
  compact = false,
}: BookCoverProps) {
  const { data: memoriesResponse } = useGetMemories(
    {
      groupId,
      bookId,
      limit: 10,
    },
    {
      query: {
        enabled: !!groupId && !!bookId,
      },
    }
  );

  const memoriesPayload =
    memoriesResponse && "data" in memoriesResponse
      ? (memoriesResponse as unknown as { data: unknown }).data
      : undefined;

  const memoriesData = Array.isArray(memoriesPayload)
    ? memoriesPayload
    : memoriesPayload &&
      typeof memoriesPayload === "object" &&
      "data" in (memoriesPayload as Record<string, unknown>)
      ? (memoriesPayload as { data: unknown }).data
      : [];

  const memories = Array.isArray(memoriesData) ? memoriesData : [];

  const imageMemories = useMemo(
    () =>
      memories
        .filter(
          (m: { mimeType?: string; mediaUrl?: string }) =>
            m.mimeType?.startsWith("image/") && m.mediaUrl
        )
        .slice(0, 4),
    [memories]
  );

  const stickerIndex = parseStickerIndex(color);
  const coverImage = stickerIndex !== null ? STICKER_IMAGES[stickerIndex] : STICKER_IMAGES[0];

  return (
    <View style={styles.container}>
      {/* Sticker image as background cover */}
      <Image
        source={coverImage}
        style={styles.coverImage}
        contentFit="cover"
      />

      {/* Semi-transparent overlay for readability */}
      <View style={styles.overlay} />

      {/* Memory photo stickers scattered on top (only if not compact) */}
      {!compact &&
        imageMemories.map(
          (memory: { id: string; mediaUrl: string }, index: number) => {
            const position = stickerPositions[index];
            const stickerStyle: ViewStyle = {
              top: position.top,
              transform: [{ rotate: `${position.rotation}deg` }],
            };
            if (position.left) stickerStyle.left = position.left;
            if (position.right) stickerStyle.right = position.right;

            return (
              <View
                key={memory.id}
                style={[styles.photoSticker, stickerStyle]}
              >
                <Image
                  source={{ uri: memory.mediaUrl }}
                  style={[
                    styles.photoStickerImage,
                    { width: position.size, height: position.size },
                  ]}
                  contentFit="cover"
                />
              </View>
            );
          }
        )}

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text
          numberOfLines={compact ? 1 : 2}
          style={[styles.coverTitle, compact && { fontSize: 13 }]}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  coverImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  titleContainer: {
    position: "absolute",
    bottom: 10,
    left: 8,
    right: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6,
  },
  coverTitle: {
    fontSize: 16,
    fontFamily: FONT.bold,
    textAlign: "center",
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    overflow: "hidden",
  },
  photoSticker: {
    position: "absolute",
    zIndex: 5,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  photoStickerImage: {
    borderRadius: 6,
    borderWidth: 3,
    borderColor: "#fff",
  },
});

// ────────────────────────────────────────────────────────────────────────────
// StickerPicker — inline picker shown when creating / editing a book
// ────────────────────────────────────────────────────────────────────────────

interface StickerPickerProps {
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function StickerPicker({ selectedIndex, onSelect }: StickerPickerProps) {
  return (
    <View style={pickerStyles.container}>
      <Text style={pickerStyles.label}>Elige el sticker del baúl</Text>
      <FlatList
        data={STICKER_IMAGES as unknown as readonly unknown[]}
        horizontal
        keyExtractor={(_, i) => String(i)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
        renderItem={({ index }) => {
          const isSelected = selectedIndex === index;
          return (
            <TouchableOpacity
              onPress={() => onSelect(index)}
              style={[
                pickerStyles.stickerThumb,
                isSelected && pickerStyles.stickerThumbSelected,
              ]}
              activeOpacity={0.8}
            >
              <Image
                source={STICKER_IMAGES[index]}
                style={pickerStyles.stickerThumbImage}
                contentFit="cover"
              />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.text,
    marginBottom: 8,
  },
  stickerThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  stickerThumbSelected: {
    borderColor: COLORS.primary,
  },
  stickerThumbImage: {
    width: "100%",
    height: "100%",
  },
});

