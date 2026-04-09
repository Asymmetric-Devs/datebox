import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import {
  Text,
  ActivityIndicator,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useGetTags, usePostUsersIdInterests } from "@elepad/api-client";
import { useAuth } from "@/hooks/useAuth";
import { COLORS, SPACING, SHADOWS, FONT } from "@/styles/base";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { 
  FadeInDown, 
  FadeIn,
  FadeOut,
  ZoomOut,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function AnimatedChip({ tag, isSelected, onPress }: { tag: any, isSelected: boolean, onPress: () => void }) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      scale: withSpring(isSelected ? 1.05 : 1),
      backgroundColor: withTiming(isSelected ? COLORS.primary : COLORS.backgroundSecondary),
      borderColor: withTiming(isSelected ? COLORS.primary : COLORS.border),
    };
  });

  const textStyle = useAnimatedStyle(() => {
    return {
      color: withTiming(isSelected ? "#FFFFFF" : COLORS.text),
    };
  });

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.chip, animatedStyle]}
    >
      <Animated.Text style={[styles.chipText, textStyle]}>
        {tag.name}
      </Animated.Text>
    </AnimatedTouchableOpacity>
  );
}

export default function InterestsOnboarding() {
  const router = useRouter();
  const { user, refreshUserElepad } = useAuth();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFinishing, setIsFinishing] = useState(false);
  const [hasFinishedSelection, setHasFinishedSelection] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const { data: tags, isLoading: loadingTags } = useGetTags();
  const { mutate: saveInterests } = usePostUsersIdInterests();

  useEffect(() => {
    if (!loadingTags && tags) {
      setTimeout(() => setShowContent(true), 300);
    }
  }, [loadingTags, tags]);

  const handleToggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleFinish = () => {
    if (!user?.id) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setHasFinishedSelection(true); // Oculta los tags para siempre
    setIsFinishing(true); // Muestra la capa blanca

    saveInterests({
      id: user.id,
      data: { tagIds: selectedTags },
    }, {
      onSuccess: async () => {
        await refreshUserElepad();
        
        // Fase de salida
        setTimeout(() => {
          setIsFinishing(false); // Disparar FadeOut de la capa blanca
          
          // Navegar justo cuando el desvanecimiento ha terminado
          setTimeout(() => {
            router.replace("/(tabs)/home");
          }, 850);
        }, 1200);
      },
      onError: () => {
        setHasFinishedSelection(false);
        setIsFinishing(false);
      }
    });
  };

  const groupedTags = useMemo(() => {
    return tags?.reduce((acc: Record<string, any[]>, tag) => {
      const category = tag.category || "Otros";
      if (!acc[category]) acc[category] = [];
      acc[category].push(tag);
      return acc;
    }, {}) || {};
  }, [tags]);

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: withSpring(`${Math.min((selectedTags.length / 3) * 100, 100)}%`),
    };
  });

  return (
    <View style={styles.container}>
      {/* INITIAL LOADING */}
      {!showContent && (
        <Animated.View exiting={FadeOut.duration(800)} style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Conectando con tus gustos...</Text>
        </Animated.View>
      )}

      {/* TRANSITION OVERLAY */}
      {isFinishing && (
        <Animated.View 
          entering={FadeIn.duration(500)}
          exiting={FadeOut.duration(800)}
          style={styles.transitionOverlay}
        >
          <Animated.View 
            entering={FadeInDown.springify()}
            exiting={ZoomOut.duration(600)}
            style={styles.overlayContent}
          >
            <Text style={styles.transitionBrand}>DateBox</Text>
            <Text style={styles.transitionText}>Preparando tu mundo...</Text>
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
          </Animated.View>
        </Animated.View>
      )}

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.progressBarContainer}>
          <Animated.View style={[styles.progressBar, progressStyle]} />
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {showContent && !hasFinishedSelection && (
            <Animated.View 
              entering={FadeInDown.duration(800)}
              exiting={FadeOut.duration(400)}
            >
              <View style={styles.header}>
                <Text style={styles.brandText}>DateBox</Text>
                <Text style={styles.title}>Personaliza tu experiencia</Text>
                <Text style={styles.subtitle}>Selecciona al menos 3 intereses.</Text>
              </View>

              {Object.entries(groupedTags).map(([category, categoryTags]) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  <View style={styles.chipContainer}>
                    {categoryTags.map((tag) => (
                      <AnimatedChip
                        key={tag.id}
                        tag={tag}
                        isSelected={selectedTags.includes(tag.id)}
                        onPress={() => handleToggleTag(tag.id)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </Animated.View>
          )}
          <View style={{ height: 180 }} />
        </ScrollView>

        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.7)", "#FFFFFF"]}
          style={styles.footerGradient}
          pointerEvents="none"
        />

        {!hasFinishedSelection && (
          <Animated.View 
            exiting={FadeOut.duration(400)}
            style={styles.footerActionContainer}
          >
            <View style={styles.footerContent}>
              <View>
                <Text style={styles.statsCount}>{selectedTags.length}</Text>
                <Text style={styles.statsLabel}>elegidos</Text>
              </View>

              <TouchableOpacity
                disabled={selectedTags.length < 3}
                onPress={handleFinish}
                style={[
                  styles.actionButton,
                  selectedTags.length < 3 && styles.actionButtonDisabled
                ]}
              >
                <Text style={styles.actionButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    zIndex: 2000,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 20,
    color: COLORS.textSecondary,
    fontFamily: FONT.medium,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: "#F0F0F0",
    width: "100%",
  },
  progressBar: {
    height: "100%",
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  header: {
    paddingVertical: SPACING.xl,
  },
  brandText: {
    fontFamily: FONT.lobster,
    fontSize: 42,
    color: COLORS.primary,
    marginBottom: -10,
  },
  title: {
    fontSize: 28,
    fontFamily: FONT.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  categorySection: {
    marginBottom: SPACING.xl,
  },
  categoryTitle: {
    fontSize: 12,
    fontFamily: FONT.bold,
    color: "#999",
    marginBottom: SPACING.m,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontFamily: FONT.regular,
  },
  footerGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  footerActionContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  footerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsCount: {
    fontSize: 28,
    fontFamily: FONT.bold,
    color: COLORS.primary,
  },
  statsLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -5,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    ...SHADOWS.medium,
  },
  actionButtonDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.6,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONT.bold,
  },
  transitionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  transitionBrand: {
    fontFamily: FONT.lobster,
    fontSize: 60,
    color: COLORS.primary,
    textAlign: "center",
  },
  transitionText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: -10,
  },
});
