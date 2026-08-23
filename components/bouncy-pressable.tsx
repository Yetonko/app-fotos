import { useRef } from 'react';
import { Animated, Pressable, PressableProps, ViewStyle, StyleProp, StyleSheet } from 'react-native';

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// Envoltorio de Pressable que añade un pequeño rebote (escala hacia dentro y
// hacia fuera) al tocar, usando Animated del núcleo de React Native — sin
// depender de react-native-reanimated, para no arriesgar la estabilidad en
// Expo Go que ya nos dio problemas antes con los gestos del zoom.
export function BouncyPressable({ style, children, onPressIn, onPressOut, ...resto }: Props) {
  const escala = useRef(new Animated.Value(1)).current;

  const manejarPressIn: Props['onPressIn'] = (evento) => {
    Animated.spring(escala, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
    onPressIn?.(evento);
  };

  const manejarPressOut: Props['onPressOut'] = (evento) => {
    Animated.spring(escala, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
    onPressOut?.(evento);
  };

  // El Pressable de fuera no tenía ningún estilo propio, así que en
  // contenedores con alignItems: 'center' se encogía a su contenido y un
  // width en porcentaje del Animated.View de dentro quedaba sin poder
  // resolverse (referencia circular: "100% de un padre que aún no tiene
  // ancho"). Solución: pasarle al Pressable solo las propiedades de tamaño
  // (no el resto del estilo visual, para no duplicar el padding y que el
  // botón no salga más alto de la cuenta).
  const { width, height, alignSelf, flex } = StyleSheet.flatten(style) ?? {};

  return (
    <Pressable
      style={{ width, height, alignSelf, flex }}
      onPressIn={manejarPressIn}
      onPressOut={manejarPressOut}
      {...resto}
    >
      <Animated.View style={[style, { transform: [{ scale: escala }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
