import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { inicializarCompras } from '@/lib/compras';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Se inicializa una sola vez al cargar el modulo, no dentro del componente:
// asi no se repite en cada render ni en cada remount de RootLayout.
inicializarCompras();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="bienvenida"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="seleccion"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="periodo"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="album"
            options={{ headerShown: false, animation: 'fade' }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
