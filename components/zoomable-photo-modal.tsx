import { useEffect, useRef, useState } from 'react';
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

// Una foto navegable dentro del visor: solo necesita id (para poder
// distinguirla al elegir) y uri (para mostrarla).
export type FotoModal = { id: string; uri: string };

type Props = {
  // Modo simple (compatibilidad): una sola foto, sin deslizar ni elegir.
  // Se usa para la foto ganadora, la versión mejorada y las miniaturas
  // extra, donde no tiene sentido navegar entre varias.
  uri?: string | null;
  // Modo navegable: varias fotos entre las que se puede deslizar. Se usa
  // en el duelo del torneo, para pasar de una foto a otra sin salir del
  // zoom.
  fotos?: FotoModal[];
  indiceInicial?: number;
  visible: boolean;
  onClose: () => void;
  // Si se da, un doble toque SIN zoom aplicado elige la foto actual en vez
  // de ampliarla (el pellizco sigue siendo la única forma de hacer zoom).
  // Sin este callback, el doble toque amplía la foto, como antes.
  onElegir?: (foto: FotoModal) => void;
};

const { width: ANCHO_PANTALLA, height: ALTO_PANTALLA } = Dimensions.get('window');
const ESCALA_MINIMA = 1;
const ESCALA_MAXIMA = 4;
const ESCALA_DOBLE_TOQUE = 2.5;
const TIEMPO_MAX_DOBLE_TOQUE = 280; // ms
const UMBRAL_CIERRE = 120; // px arrastrados hacia abajo para cerrar el modal
const UMBRAL_SWIPE = 60; // px arrastrados en horizontal para cambiar de foto

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

export function ZoomablePhotoModal({ uri, fotos, indiceInicial, visible, onClose, onElegir }: Props) {
  // Lista de fotos navegables: si se pasa `fotos`, se usa tal cual; si no,
  // se envuelve `uri` en una lista de una sola foto (modo simple).
  const listaFotos: FotoModal[] =
    fotos && fotos.length > 0 ? fotos : uri ? [{ id: '_unica', uri }] : [];

  const [indice, setIndice] = useState(indiceInicial ?? 0);

  // Cada vez que se abre el visor, empezamos en la foto indicada por
  // indiceInicial (0 en el modo simple).
  useEffect(() => {
    if (visible) {
      setIndice(indiceInicial ?? 0);
    }
  }, [visible, indiceInicial]);

  const indiceSeguro = Math.max(0, Math.min(indice, listaFotos.length - 1));
  const fotoActual = listaFotos[indiceSeguro] ?? null;
  const uriActual = fotoActual?.uri ?? null;
  const puedeDeslizar = listaFotos.length > 1;

  const escala = useRef(new Animated.Value(1)).current;
  const traslacionX = useRef(new Animated.Value(0)).current;
  const traslacionY = useRef(new Animated.Value(0)).current;
  const traslacionCierre = useRef(new Animated.Value(0)).current;

  const escalaActual = useRef(1);
  const traslacionActual = useRef({ x: 0, y: 0 });
  const traslacionCierreActual = useRef(0);
  const distanciaInicialPellizco = useRef<number | null>(null);
  const escalaAlIniciarGesto = useRef(1);
  const ultimoNumeroDeToques = useRef(0);
  const ultimaPosicionToqueUnico = useRef<{ x: number; y: number } | null>(null);
  const ultimoTiempoToque = useRef(0);

  const inicioGestoRef = useRef<{ x: number; y: number } | null>(null);
  const modoGestoRef = useRef<'swipe' | 'cierre' | null>(null);
  const deltaXSwipeActual = useRef(0);

  const fotoActualRef = useRef<FotoModal | null>(null);
  fotoActualRef.current = fotoActual;
  const onElegirRef = useRef(onElegir);
  onElegirRef.current = onElegir;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const listaFotosRef = useRef(listaFotos);
  listaFotosRef.current = listaFotos;
  const puedeDeslizarRef = useRef(puedeDeslizar);
  puedeDeslizarRef.current = puedeDeslizar;

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

  useEffect(() => {
    resetearZoom(false);
  }, [uriActual, visible]);

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
        ultimoNumeroDeToques.current = 0;

        if (toques.length === 1) {
          const ahora = Date.now();
          if (ahora - ultimoTiempoToque.current < TIEMPO_MAX_DOBLE_TOQUE) {
            if (escalaActual.current > ESCALA_MINIMA) {
              escalaActual.current = 1;
              traslacionActual.current = { x: 0, y: 0 };
              Animated.parallel([
                Animated.spring(escala, { toValue: 1, useNativeDriver: true }),
                Animated.spring(traslacionX, { toValue: 0, useNativeDriver: true }),
                Animated.spring(traslacionY, { toValue: 0, useNativeDriver: true }),
              ]).start();
            } else if (onElegirRef.current && fotoActualRef.current) {
              onElegirRef.current(fotoActualRef.current);
              onCloseRef.current();
            } else {
              escalaActual.current = ESCALA_DOBLE_TOQUE;
              traslacionActual.current = { x: 0, y: 0 };
              Animated.parallel([
                Animated.spring(escala, { toValue: ESCALA_DOBLE_TOQUE, useNativeDriver: true }),
                Animated.spring(traslacionX, { toValue: 0, useNativeDriver: true }),
                Animated.spring(traslacionY, { toValue: 0, useNativeDriver: true }),
              ]).start();
            }
          }
          ultimoTiempoToque.current = ahora;
        }
      },

      onPanResponderMove: (evt) => {
        const toques = evt.nativeEvent.touches;

        if (toques.length !== ultimoNumeroDeToques.current) {
          ultimoNumeroDeToques.current = toques.length;
          escalaAlIniciarGesto.current = escalaActual.current;

          if (toques.length === 2) {
            distanciaInicialPellizco.current = distanciaEntreToques(toques);
          } else if (toques.length === 1) {
            distanciaInicialPellizco.current = null;
            ultimaPosicionToqueUnico.current = { x: toques[0].pageX, y: toques[0].pageY };
            inicioGestoRef.current = { x: toques[0].pageX, y: toques[0].pageY };
            modoGestoRef.current = null;
            deltaXSwipeActual.current = 0;
          }
          return;
        }

        if (toques.length === 2 && distanciaInicialPellizco.current) {
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
          inicioGestoRef.current
        ) {
          const toque = toques[0];
          const deltaX = toque.pageX - inicioGestoRef.current.x;
          const deltaY = toque.pageY - inicioGestoRef.current.y;

          if (modoGestoRef.current === null && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
            modoGestoRef.current =
              puedeDeslizarRef.current && Math.abs(deltaX) > Math.abs(deltaY) ? 'swipe' : 'cierre';
          }

          if (modoGestoRef.current === 'swipe') {
            deltaXSwipeActual.current = deltaX;
            traslacionX.setValue(deltaX);
          } else if (modoGestoRef.current === 'cierre') {
            const nuevaCierre = Math.max(0, deltaY);
            traslacionCierreActual.current = nuevaCierre;
            traslacionCierre.setValue(nuevaCierre);
          }
        }
      },

      onPanResponderTerminationRequest: () => false,

      onPanResponderRelease: () => {
        distanciaInicialPellizco.current = null;
        ultimaPosicionToqueUnico.current = null;

        if (modoGestoRef.current === 'swipe') {
          if (Math.abs(deltaXSwipeActual.current) > UMBRAL_SWIPE) {
            const direccion = deltaXSwipeActual.current < 0 ? 1 : -1;
            setIndice((i) => {
              const nuevo = i + direccion;
              return nuevo >= 0 && nuevo < listaFotosRef.current.length ? nuevo : i;
            });
          }
          traslacionX.setValue(0);
          deltaXSwipeActual.current = 0;
          modoGestoRef.current = null;
          inicioGestoRef.current = null;
        } else {
          if (traslacionCierreActual.current > UMBRAL_CIERRE) {
            modoGestoRef.current = null;
            inicioGestoRef.current = null;
            onCloseRef.current();
            return;
          }
          if (traslacionCierreActual.current > 0) {
            traslacionCierreActual.current = 0;
            Animated.spring(traslacionCierre, { toValue: 0, useNativeDriver: true }).start();
          }
          modoGestoRef.current = null;
          inicioGestoRef.current = null;
        }

        if (escalaActual.current < ESCALA_MINIMA) {
          resetearZoom(true);
        }
      },
    })
  ).current;

  if (!uriActual) {
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
            <Image source={{ uri: uriActual }} style={styles.foto} contentFit="contain" transition={150} />
          </Animated.View>
        </View>
        {puedeDeslizar && (
          <View style={styles.puntosContenedor} pointerEvents="none">
            {listaFotos.map((foto, i) => (
              <View
                key={foto.id}
                style={[styles.punto, i === indiceSeguro && styles.puntoActivo]}
              />
            ))}
          </View>
        )}
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
  puntosContenedor: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    gap: 8,
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  puntoActivo: {
    backgroundColor: '#FFFFFF',
    width: 20,
  },
});
