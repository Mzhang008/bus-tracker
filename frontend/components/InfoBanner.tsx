import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from "react-native";

// ---------------------------------------------------------------------------
// Top-right collapsible info banner
//   • Title
//   • Live Chicago local time (ticks every second, DST-safe via Intl)
//   • Current Chicago weather (Open-Meteo, no API key)
// ---------------------------------------------------------------------------

const CHICAGO_LAT = 41.8781;
const CHICAGO_LON = -87.6298;
const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${CHICAGO_LAT}` +
  `&longitude=${CHICAGO_LON}&current=temperature_2m,weather_code` +
  `&temperature_unit=fahrenheit&timezone=America/Chicago`;
const WEATHER_REFRESH_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Time formatters (memoised once — Intl objects are expensive)
// ---------------------------------------------------------------------------

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "short",
  month: "short",
  day: "numeric",
});

// ---------------------------------------------------------------------------
// Weather code → emoji + label (subset of WMO codes used by Open-Meteo)
// ---------------------------------------------------------------------------

interface WeatherDesc {
  emoji: string;
  label: string;
}

function describeWeather(code: number): WeatherDesc {
  if (code === 0) return { emoji: "☀", label: "Clear" };
  if (code === 1) return { emoji: "🌤", label: "Mostly clear" };
  if (code === 2) return { emoji: "⛅", label: "Partly cloudy" };
  if (code === 3) return { emoji: "☁", label: "Overcast" };
  if (code === 45 || code === 48) return { emoji: "🌫", label: "Fog" };
  if (code >= 51 && code <= 57) return { emoji: "🌦", label: "Drizzle" };
  if (code >= 61 && code <= 67) return { emoji: "🌧", label: "Rain" };
  if (code >= 71 && code <= 77) return { emoji: "❄", label: "Snow" };
  if (code >= 80 && code <= 82) return { emoji: "🌧", label: "Showers" };
  if (code >= 85 && code <= 86) return { emoji: "❄", label: "Snow showers" };
  if (code >= 95) return { emoji: "⛈", label: "Thunderstorm" };
  return { emoji: "•", label: "—" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WeatherState {
  tempF: number;
  desc: WeatherDesc;
}

export default function InfoBanner() {
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [weatherFailed, setWeatherFailed] = useState(false);

  // ---- live clock --------------------------------------------------------
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ---- weather fetch (initial + every 10 min) ----------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(WEATHER_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const tempF = data?.current?.temperature_2m;
        const code = data?.current?.weather_code;
        if (cancelled) return;
        if (typeof tempF !== "number" || typeof code !== "number") {
          throw new Error("malformed weather response");
        }
        setWeather({ tempF, desc: describeWeather(code) });
        setWeatherFailed(false);
      } catch (err) {
        if (cancelled) return;
        console.warn("[InfoBanner] weather fetch failed:", err);
        setWeatherFailed(true);
      }
    }

    load();
    const id = setInterval(load, WEATHER_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const timeStr = useMemo(() => `${TIME_FMT.format(now)} CT`, [now]);
  const dateStr = useMemo(() => DATE_FMT.format(now), [now]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.panel}>
        <TouchableOpacity
          style={styles.header}
          onPress={() => setCollapsed((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.title}>Chicago CTA Tracker</Text>
          <Text style={styles.chevron}>{collapsed ? "\u25BC" : "\u25B2"}</Text>
        </TouchableOpacity>

        {!collapsed && (
          <>
            <Text style={styles.row}>
              {timeStr} · {dateStr}
            </Text>
            {weather && !weatherFailed && (
              <Text style={styles.row}>
                {weather.desc.emoji} {Math.round(weather.tempF)}°F ·{" "}
                {weather.desc.label}
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 30,
  },
  panel: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    minWidth: 220,
    maxWidth: 280,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#212121",
  },
  chevron: {
    fontSize: 12,
    color: "#757575",
    marginLeft: 8,
  },
  row: {
    fontSize: 12,
    color: "#424242",
    marginTop: 4,
  },
});
