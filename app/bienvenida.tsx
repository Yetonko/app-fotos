import { useRef, useState } from 'react';
import { StyleSheet, View, Text, Platform, PanResponder } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { CLAVE_ONBOARDING_VISTO } from '@/lib/onboarding';

// --- Sistema de diseño (mismos valores que el resto de pantallas) --------
const COLORES = {
  fondo: '#F5EFE3',
  superficie: '#FFFFFF',
  borde: '#EAE2D0',
  acento: '#D98C7A',
  acentoSuave: '#F4DCD3',
  acentoOscuro: '#3B2A28',
  texto: '#2B2420',
  textoSecundario: '#8C8171',
};
// -------------------------------------------------------------------------

// Nombre del dispositivo a mostrar en el texto: "iPhone" en iOS, "móvil" en
// cualquier otro caso (Android). Platform.OS ya viene con React Native, no
// hace falta ninguna librería nueva para detectarlo.
const DISPOSITIVO = Platform.OS === 'ios' ? 'iPhone' : 'móvil';

// Los dos pasos del onboarding: primero el beneficio (qué gana el usuario,
// tanto elegir la mejor foto como recuperar espacio), después la promesa de
// privacidad (dicha una sola vez, clara y directa, justo antes de pedir el
// permiso de acceso a las fotos).
const PASOS = [
  {
    emoji: '✨',
    titulo: 'Elige la foto\nque te representa',
    texto:
      'Encuentra el momento, compara tus fotos parecidas y quédate con la que de verdad va contigo. Ah, y de paso, haces sitio para el próximo momento.',
    boton: 'Siguiente',
  },
  {
    emoji: '🔒',
    titulo: 'Tus fotos son solo tuyas',
    texto: `Todo pasa aquí, en tu ${DISPOSITIVO}. Ninguna foto sale de aquí: no hay servidores, no hay copias en la nube, no hay nadie más mirando.`,
    boton: 'Empezar',
  },
];

export default function BienvenidaScreen() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  // Copia "plana" del paso actual, para poder comprobarlo de forma síncrona
  // dentro de siguiente() sin depender del valor capturado en el cierre de
  // la función, que puede quedar desactualizado si siguiente() se llega a
  // llamar dos veces casi a la vez — por ejemplo, si el toque del botón y
  // el gesto de swipe llegan a solaparse en el mismo movimiento.
  const pasoActual = useRef(0);

  const siguiente = async () => {
    if (pasoActual.current < PASOS.length - 1) {
      pasoActual.current += 1;
      setPaso(pasoActual.current);
      return;
    }
    try {
      await AsyncStorage.setItem(CLAVE_ONBOARDING_VISTO, 'true');
    } catch {
      // Si falla el guardado, seguimos igualmente: en el peor de los casos
      // el onboarding se volvería a mostrar la próxima vez, que no es grave.
    }
    router.replace('/');
  };

  // Permite avanzar de paso deslizando el dedo hacia la izquierda, además
  // del botón. onMoveShouldSetPanResponder exige que el movimiento sea
  // claramente horizontal (más ancho que alto) antes de "capturar" el
  // gesto, para no interferir con toques normales sobre el botón.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -60) {
          siguiente();
        }
      },
    })
  ).current;

  const actual = PASOS[paso];

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.contenido}>
        <Text style={styles.emoji}>{actual.emoji}</Text>
        <Text style={styles.titulo}>{actual.titulo}</Text>
        <Text style={styles.texto}>{actual.texto}</Text>
      </View>

      <View style={styles.pie}>
        <View style={styles.puntos}>
          {PASOS.map((_, i) => (
            <View key={i} style={[styles.punto, i === paso && styles.puntoActivo]} />
          ))}
        </View>
        <BouncyPressable style={styles.boton} onPress={siguiente}>
          <Text style={styles.textoBoton}>{actual.boton}</Text>
        </BouncyPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORES.fondo,
    paddingTop: 100,
    paddingBottom: 50,
    justifyContent: 'space-between',
  },
  contenido: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  titulo: {
    textAlign: 'center',
    color: COLORES.texto,
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 18,
  },
  texto: {
    textAlign: 'center',
    color: COLORES.textoSecundario,
    fontSize: 17,
    lineHeight: 25,
  },
  pie: {
    alignItems: 'center',
  },
  puntos: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORES.borde,
  },
  puntoActivo: {
    backgroundColor: COLORES.acento,
    width: 20,
  },
  boton: {
    backgroundColor: COLORES.acentoOscuro,
    paddingVertical: 20,
    width: '100%',
    alignItems: 'center',
  },
  textoBoton: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 18,
  },
});
