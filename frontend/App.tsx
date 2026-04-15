import React from "react";
import { StyleSheet, View, StatusBar } from "react-native";
import TransitMap from "./components/TransitMap";
import FilterMenu from "./components/FilterMenu";

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <TransitMap />
      <FilterMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
