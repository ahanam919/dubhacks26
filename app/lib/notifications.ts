// "You're near a chain, try this local shop instead" alerts.
//
// Uses a real local notification when expo-notifications is available (a development
// build, or Expo Go on iPhone). Expo Go on Android doesn't include all of its native
// parts, so there it falls back to an in-app pop-up with a Directions button.
// Either way the demo works.
//
// Call setupNotifications() once when the app starts.

import { Alert, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type * as NotificationsTypes from "expo-notifications";
import { openWalkingDirections } from "./directions";

declare const require: (id: string) => unknown;

const CHANNEL_ID = "suggestions";

type NotificationsModule = typeof NotificationsTypes;

// Loaded on first use instead of imported at the top, so a missing native module
// can't crash the whole app on start.
let cached: NotificationsModule | null | undefined;
function loadNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;

  // Expo Go on Android is missing some of expo-notifications' native parts, and even
  // a caught failure shows a red error screen there. So don't load it at all.
  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (Platform.OS === "android" && inExpoGo) {
    cached = null;
    return cached;
  }

  try {
    cached = require("expo-notifications") as NotificationsModule;
  } catch (err) {
    console.warn("expo-notifications unavailable here; using in-app pop-ups instead", err);
    cached = null;
  }
  return cached;
}

let tapListener: { remove(): void } | null = null;

/** Returns true if real notifications are ready; false means in-app pop-ups are used. */
export async function setupNotifications(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;

  try {
    // Show the banner even when the app is open (the demo happens with the app open).
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Android needs a high-importance channel for the notification to pop up as a banner.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Local suggestions",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    // When someone taps the notification, open walking directions to that shop.
    if (!tapListener) {
      tapListener = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as
          | { lat?: number; lng?: number }
          | undefined;
        if (typeof data?.lat === "number" && typeof data?.lng === "number") {
          void openWalkingDirections(data.lat, data.lng);
        }
      });
    }

    // Android 13+ and iPhone ask the user for permission.
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") cached = null; // no permission → use in-app pop-ups
    return status === "granted";
  } catch (err) {
    console.warn("Notification setup failed; using in-app pop-ups instead", err);
    cached = null;
    return false;
  }
}

export async function showSuggestion(params: {
  title: string;
  message: string;
  shopId: string;
  lat: number;
  lng: number;
}): Promise<void> {
  const Notifications = loadNotifications();
  if (Notifications) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: params.title,
          body: params.message,
          data: { shopId: params.shopId, lat: params.lat, lng: params.lng },
        },
        trigger: Platform.OS === "android" ? { channelId: CHANNEL_ID } : null, // show now
      });
      return;
    } catch (err) {
      console.warn("Notification failed; showing in-app pop-up instead", err);
    }
  }

  // Fallback: an in-app pop-up with the same message and a Directions button.
  Alert.alert(params.title, params.message, [
    { text: "Not now", style: "cancel" },
    { text: "Directions", onPress: () => void openWalkingDirections(params.lat, params.lng) },
  ]);
}
