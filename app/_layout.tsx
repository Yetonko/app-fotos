import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { COLORES } from '@/constants/estilo';
import { inicializarCompras } from '@/lib/compras';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Se inicializa una sola vez al cargar el modulo, no dentro del componente:
// asi no se repite en cada render ni en cada remount de RootLayout.
inicializarCompras();

// Tema claro propio de Fondly: la app siempre se ve en modo claro.
const TEMA_FONDLY = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORES.fondo,
    card: COLORES.fondo,
    primary: COLORES.acentoTexto,
    text: COLORES.texto,
    border: COLORES.borde,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={TEMA_FONDLY}>
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
            name="videos"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="album"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen name="paywall" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="dark" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
