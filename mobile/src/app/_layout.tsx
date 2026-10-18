import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text } from 'react-native';
import { colors } from '../lib/theme';

// Close control for modal screens. Falls back to home if the modal was opened directly.
function CloseButton() {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>Close</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="results" options={{ title: 'Results' }} />
        <Stack.Screen
          name="shop/[id]"
          options={{ presentation: 'modal', title: 'Shop', headerRight: () => <CloseButton /> }}
        />
        <Stack.Screen name="compare/[id]" options={{ title: 'Compare' }} />
        <Stack.Screen
          name="order/confirm"
          options={{
            presentation: 'modal',
            title: 'Confirm swap',
            headerRight: () => <CloseButton />,
          }}
        />
        <Stack.Screen name="order/status" options={{ title: 'Your order' }} />
        <Stack.Screen name="dev/simulate" options={{ title: 'Simulate location' }} />
      </Stack>
    </>
  );
}
