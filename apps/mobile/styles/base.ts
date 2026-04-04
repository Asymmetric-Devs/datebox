import { StyleSheet, Platform } from "react-native";

/** The exact names of available font families. */
export const FONT = {
  thin: "Montserrat_100Thin",
  extraLight: "Montserrat_200ExtraLight",
  light: "Montserrat_300Light",
  regular: "Montserrat_400Regular",
  medium: "Montserrat_500Medium",
  semiBold: "Montserrat_600SemiBold",
  bold: "Montserrat_700Bold",
  extraBold: "Montserrat_800ExtraBold",
  black: "Montserrat_900Black",
  lobster: "Lobster_400Regular",
} as const;

/** Layout constants for consistent spacing. */
export const LAYOUT = {
  /** Height reserved for floating bottom navigation bar + margins */
  bottomNavHeight: 110,
} as const;

/** Centralized color palette for the app - Datebox y2k/8-bit minimalist design.
 * Core palette: black (#000000), white (#FFFFFF), light gray tones
 */
export const COLORS = {
  // Primary colors — black & white minimal
  primary: "#000000", // Pure black
  secondary: "#222222", // Near-black for secondary elements
  border: "#E0E0E0", // Light gray border

  // Backgrounds
  background: "#FFFFFF",
  backgroundSecondary: "#F5F5F5", // Off-white
  backgroundTertiary: "#EBEBEB", // Light gray
  card: "#F5F5F5", // Light gray for cards
  white: "#FFFFFF",
  success: "#2D2D2D", // Dark gray for success states

  // Text hierarchy - High contrast
  text: "#000000", // Black
  textSecondary: "#555555", // Medium gray
  textLight: "#888888", // Light gray
  textPlaceholder: "#AAAAAA", // Placeholder gray

  // Danger/Error colors
  red: "#1A1A1A", // Near-black
  error: "#1A1A1A", // Near-black for errors

  // States
  accent: "#333333", // Dark accent

  // Borders and separators
  separator: "#E0E0E0", // Light gray

  // Custom shades for specific UI elements
  purple: {
    light: "#F0F0F0",
    dark: "#111111",
  },
  gray: {
    medium: "#CCCCCC",
    light: "#F5F5F5",
  },
} as const;

/** Apple-style subtle shadows. */
export const SHADOWS = {
  light: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
} as const;

// Apple-style minimalist base styles
export const STYLES = StyleSheet.create({
  // Layout basics
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeAreaLogin: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    alignItems: "center",
  },
  contentContainer: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 20,
    justifyContent: "flex-start",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Cards - Apple-style with subtle shadows
  card: {
    width: "100%",
    marginTop: 16,
    padding: 20,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 20,
    alignItems: "center",
    ...SHADOWS.card,
  },

  miniButton: {
    width: "35%",
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },

  // Buttons - consistent 12px border radius
  buttonPrimary: {
    marginTop: 20,
    width: "85%",
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  buttonSecondary: {
    marginTop: 14,
    width: "100%",
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    ...SHADOWS.light,
  },
  buttonContent: {
    height: 50,
  },
  buttonGoogle: {
    marginTop: 14,
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.light,
  },

  // Inputs - Clean style
  input: {
    width: "100%",
    marginTop: 16,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    borderBottomWidth: 0,
    borderBottomColor: "transparent",
    borderColor: "transparent",
    borderWidth: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    outlineWidth: 0,
  },
  inputOutline: {
    borderRadius: 12,
    borderColor: "transparent",
    borderWidth: 0,
  },

  // Typography - Clear hierarchy
  superHeading: {
    fontSize: 28,
    fontFamily: FONT.bold,
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: -0.5,
  },

  heading: {
    fontSize: 22,
    marginTop: 6,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: -0.3,
  },

  subheading: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 22,
  },
  footerText: {
    marginTop: 18,
    color: COLORS.textLight,
    fontSize: 13,
    fontFamily: FONT.medium,
  },

  // Logo
  logoWrap: {
    alignItems: "center",
  },
  logoWrapWithMargin: {
    alignItems: "center",
    marginTop: 95,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 10,
  },
  brand: {
    marginTop: -15,
    fontSize: 65,
    fontFamily: FONT.lobster,
    color: COLORS.text,
    paddingBottom: 8,
  },

  // Separators
  separatorWrap: {
    width: "100%",
    alignItems: "center",
    marginTop: 8,
  },
  separator: {
    width: "60%",
    height: 1,
    backgroundColor: COLORS.separator,
    opacity: 0.6,
  },
  orRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.separator,
  },
  orText: {
    marginHorizontal: 16,
    color: COLORS.textLight,
  },

  // Google Button
  googleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  googleIcon: {
    fontFamily: FONT.bold,
  },
  googleText: {
    fontSize: 15,
    color: COLORS.text,
    fontFamily: FONT.semiBold,
  },

  // Avatars
  memberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  memberInitials: {
    fontSize: 16,
    fontFamily: FONT.bold,
    color: COLORS.white,
  },

  // Menu card - Apple-style
  menuCard: {
    marginVertical: 12,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 16,
    ...SHADOWS.card,
  },

  // Title cards - Clean style
  titleCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    marginBottom: 16,
    ...SHADOWS.card,
  },

  memberInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  paragraphText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textSecondary,
    marginBottom: 4,
    lineHeight: 24,
  },

  inviteCodeCard: {
    backgroundColor: COLORS.primary,
    padding: 20,
    borderRadius: 16,
    marginTop: 16,
    alignItems: "center",
    ...SHADOWS.medium,
  },
  inviteCodeTitle: {
    fontSize: 16,
    fontFamily: FONT.medium,
    color: COLORS.white,
    textAlign: "center",
    marginBottom: 8,
  },
  inviteCodeText: {
    fontSize: 20,
    fontFamily: FONT.bold,
    color: COLORS.white,
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: 8,
  },
  inviteCodeExpiry: {
    fontSize: 13,
    fontFamily: FONT.regular,
    color: COLORS.white,
    textAlign: "center",
    opacity: 0.8,
  },
} as const);
