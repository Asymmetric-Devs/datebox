import React from "react";
import { View, StyleSheet, Image } from "react-native";
import dateboxLogo from "@/assets/images/logo/datebox-sinfondo.png";

/**
 * Componente de loading para el perfil del usuario
 * Muestra el logo de Datebox sin fondo mientras se cargan los datos del usuario
 */
export const LoadingProfile: React.FC = () => {
  return (
    <View style={styles.container}>
      <Image source={dateboxLogo} style={styles.logo} resizeMode="contain" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    minHeight: 200, // Altura mínima para evitar saltos abruptos
  },
  logo: {
    width: 175,
    height: 175,
  },
});