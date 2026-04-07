import React from "react";
import { StyleSheet, View, StatusBar } from "react-native";
import TransitMap from "./components/TransitMap";
import RouteToggleOverlay from "./components/RouteToggleOverlay";

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <TransitMap />
      <RouteToggleOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
