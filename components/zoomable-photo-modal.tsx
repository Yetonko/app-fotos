import { useEffect, useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  Animated,
  PanResponder,
  Dimensions,
  GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';

type Props = {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
};

const { width: ANCHO_PANTALLA, height: ALTO_PANTALLA } = Dimensions.get('window');
const ESCALA_MINIMA = 1;
const ESCALA_MAXIMA = 4;
const ESCALA_DOBLE_TOQUE = 2.5;
const TIEMPO_MAX_DOBLE_TOQUE = 280; // ms
const UMBRAL_CIERRE = 120; // px arrastrados hacia abajo para cerrar el modal

// Visor con zoom implementado a mano con PanResponder + Animated (ambos ya
// incluidos en React Native, sin librerías extra). Antes se probó con
// react-native-reanimated + react-native-gesture-handler para el pellizco,
// pero esa combinación daba cuelgues nativos dentro de modales en Expo Go.
// Esta versión evita el problema porque no depende de esos módulos nativos.
function distanciaEntreToques(toques: GestureResponderEvent['nativeEvent']['touches']) {
  const [a, b] = toques;
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function ZoomablePhotoModal({ uri, visible, onClose }: Props) {
  const escala = useRef(new Animated.Value(1)).current;
  const traslacionX = useRef(new Animated.Value(0)).current;
  const traslacionY = useRef(new Animated.Value(0)).current;
  const traslacionCierre = useRef(new Animated.Value(0)).current;

  // Copias "planas" (números normales, no Animated.Value) para poder hacer
  // cálculos síncronos durante el gesto sin depender de leer Animated.Value.
  const escalaActual = useRef(1);
  const traslacionActual = useRef({ x: 0, y: 0 });
  const traslacionCierreActual = useRef(0);
  const distanciaInicialPellizco = useRef<number | null>(null);
  const escalaAlIniciarGesto = useRef(1);
  const ultimoNumeroDeToques = useRef(0);
  const ultimaPosicionToqueUnico = useRef<{ x: number; y: number } | null>(null);
  const ultimoTiempoToque = useRef(0);

  const resetearZoom = (animado: boolean) => {
    escalaActual.current = 1;
    traslacionActual.current = { x: 0, y: 0 };
    traslacionCierreActual.current = 0;
    if (animado) {
      Animated.parallel([
        Animated.spring(escala, { toValue: 1, useNativeDriver: true }),
        Animated.spring(traslacionX, { toValue: 0, useNativeDriver: true }),
        Animated.spring(traslacionY, { toValue: 0, useNativeDriver: true }),
        Animated.spring(traslacionCierre, { toValue: 0, useNativeDriver: true }),
      ]).start();
    } else {
      escala.setValue(1);
      traslacionX.setValue(0);
      traslacionY.setValue(0);
      traslacionCierre.setValue(0);
    }
  };

  // Cada vez que se abre una foto nueva (o se cierra el visor), empezamos sin zoom.
  useEffect(() => {
    resetearZoom(false);
  }, [uri, visible]);

  const limitarTraslacion = (valor: number, escalaValor: number, dimension: number) => {
    const maximo = ((escalaValor - 1) * dimension) / 2;
    if (maximo <= 0) return 0;
    return Math.max(-maximo, Math.min(maximo, valor));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const toques = evt.nativeEvent.touches;
        // Forzamos a que el primer movimiento recalibre el punto de partida,
        // en vez de asumir que el número de dedos ya es el definitivo aquí:
        // el segundo dedo de un pellizco casi nunca toca en el mismo instante
        // que el primero, así que normalmente esto empieza con 1 dedo.
        ultimoNumeroDeToques.current = 0;

        if (toques.length === 1) {
          // Detección de doble toque para alternar zoom rápidamente.
          const ahora = Date.now();
          if (ahora - ultimoTiempoToque.current < TIEMPO_MAX_DOBLE_TOQUE) {
            const nuevaEscala = escalaActual.current > 1 ? 1 : ESCALA_DOBLE_TOQUE;
            escalaActual.current = nuevaEscala;
            traslacionActual.current = { x: 0, y: 0 };
            Animated.parallel([
              Animated.spring(escala, { toValue: nuevaEscala, useNativeDriver: true }),
              Animated.spring(traslacionX, { toValue: 0, useNativeDriver: true }),
              Animated.spring(traslacionY, { toValue: 0, useNativeDriver: true }),
            ]).start();
          }
          ultimoTiempoToque.current = ahora;
        }
      },

      onPanResponderMove: (evt) => {
        const toques = evt.nativeEvent.touches;

        // Cada vez que cambia el número de dedos a mitad de gesto (se añade o
        // se suelta uno), fijamos de nuevo el punto de partida antes de mover
        // nada, para evitar saltos bruscos.
        if (toques.length !== ultimoNumeroDeToques.current) {
          ultimoNumeroDeToques.current = toques.length;
          escalaAlIniciarGesto.current = escalaActual.current;

          if (toques.length === 2) {
            distanciaInicialPellizco.current = distanciaEntreToques(toques);
          } else if (toques.length === 1) {
            distanciaInicialPellizco.current = null;
            ultimaPosicionToqueUnico.current = { x: toques[0].pageX, y: toques[0].pageY };
          }
          return;
        }

        if (toques.length === 2 && distanciaInicialPellizco.current) {
          // Pellizco con dos dedos: escalamos según cuánto ha cambiado la
          // distancia entre ellos respecto al inicio del pellizco.
          const distanciaActual = distanciaEntreToques(toques);
          const factor = distanciaActual / distanciaInicialPellizco.current;
          const nuevaEscala = Math.max(
            ESCALA_MINIMA,
            Math.min(ESCALA_MAXIMA, escalaAlIniciarGesto.current * factor)
          );
          escalaActual.current = nuevaEscala;
          escala.setValue(nuevaEscala);
        } else if (
          toques.length === 1 &&
          escalaActual.current > 1 &&
          ultimaPosicionToqueUnico.current
        ) {
          // Arrastrar con un dedo, solo tiene efecto si ya hay zoom aplicado.
          // Usamos la posición real del dedo (no el delta acumulado desde el
          // inicio del gesto), porque ese acumulado se desajusta si antes hubo
          // un pellizco con dos dedos en el mismo gesto.
          const toque = toques[0];
          const deltaX = toque.pageX - ultimaPosicionToqueUnico.current.x;
          const deltaY = toque.pageY - ultimaPosicionToqueUnico.current.y;

          const nuevaX = limitarTraslacion(
            traslacionActual.current.x + deltaX,
            escalaActual.current,
            ANCHO_PANTALLA
          );
          const nuevaY = limitarTraslacion(
            traslacionActual.current.y + deltaY,
            escalaActual.current,
            ALTO_PANTALLA
          );
          traslacionActual.current = { x: nuevaX, y: nuevaY };
          traslacionX.setValue(nuevaX);
          traslacionY.setValue(nuevaY);
          ultimaPosicionToqueUnico.current = { x: toque.pageX, y: toque.pageY };
        } else if (
          toques.length === 1 &&
          escalaActual.current <= ESCALA_MINIMA &&
          ultimaPosicionToqueUnico.current
        ) {
          // Sin zoom aplicado, un dedo arrastrando hacia abajo mueve la foto
          // para cerrar el modal. Solo cuenta el movimiento hacia abajo (se
          // recorta a 0 si el dedo sube), para que no se pueda "levantar" la
          // foto sin sentido cuando no hay nada de zoom que mostrar arriba.
          const toque = toques[0];
          const deltaY = toque.pageY - ultimaPosicionToqueUnico.current.y;
          const nuevaCierre = Math.max(0, traslacionCierreActual.current + deltaY);
          traslacionCierreActual.current = nuevaCierre;
          traslacionCierre.setValue(nuevaCierre);
          ultimaPosicionToqueUnico.current = { x: toque.pageX, y: toque.pageY };
        }
      },

      onPanResponderTerminationRequest: () => false,

      onPanResponderRelease: () => {
        distanciaInicialPellizco.current = null;
        ultimaPosicionToqueUnico.current = null;

        if (traslacionCierreActual.current > UMBRAL_CIERRE) {
          onClose();
          return;
        }
        if (traslacionCierreActual.current > 0) {
          traslacionCierreActual.current = 0;
          Animated.spring(traslacionCierre, { toValue: 0, useNativeDriver: true }).start();
        }

        // Si el pellizco deja la foto más pequeña que su tamaño original,
        // volvemos suavemente a la escala normal.
        if (escalaActual.current < ESCALA_MINIMA) {
          resetearZoom(true);
        }
      },
    })
  ).current;

  if (!uri) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fondo}>
        <Pressable style={styles.botonCerrar} onPress={onClose}>
          <ThemedText style={styles.textoCerrar}>✕ Cerrar</ThemedText>
        </Pressable>
        <View style={styles.areaGesto} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.fotoContenedor,
              {
                transform: [
                  { translateX: traslacionX },
                  { translateY: Animated.add(traslacionY, traslacionCierre) },
                  { scale: escala },
                ],
              },
            ]}
          >
            <Image source={{ uri }} style={styles.foto} contentFit="contain" />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  areaGesto: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fotoContenedor: {
    width: '100%',
    height: '100%',
  },
  foto: {
    width: '100%',
    height: '100%',
  },
  botonCerrar: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  textoCerrar: {
    color: 'white',
    fontWeight: '600',
  },
});
