import React from "react";
import { StyleSheet, View, StatusBar } from "react-native";
import TransitMap from "./components/TransitMap";
import FilterMenu from "./components/FilterMenu";
import InfoBanner from "./components/InfoBanner";

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <TransitMap />
      <FilterMenu />
      <InfoBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
