import { useCallback, useEffect, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { FlatList, StyleSheet, Pressable, View, Text, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { GrupoFotos } from '@/lib/agrupar';
import { detectarRafagas } from '@/lib/escaneo';
import { obtenerGanadora, registrarGrupo } from '@/lib/gruposElegidos';
import { inicializarRevisados, esRevisado } from '@/lib/revisados';
import { inicializarProgreso, obtenerProgresoHoy } from '@/lib/progreso';
import { inicializarEspacio, obtenerEspacioCache, type EspacioLibre } from '@/lib/espacio';
import {
  inicializarEtiquetas,
  obtenerNombreActividad,
  guardarNombreActividad,
  formatearEtiqueta,
  formatearFecha,
} from '@/lib/etiquetas';
import { EtiquetaModal } from '@/components/etiqueta-modal';
import { CLAVE_ONBOARDING_VISTO } from '@/lib/onboarding';
import { BouncyPressable } from '@/components/bouncy-pressable';
import { Image } from 'expo-image';

// --- Sistema de diseño (paleta cálida, suavizada hacia coral-rosado) -----
// Centralizado aquí para reutilizar los mismos valores en seleccion.tsx.
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

// Igual que en bienvenida.tsx: "iPhone" en iOS, "móvil" en cualquier otro
// caso (Android), sin necesidad de ninguna librería nueva.
const DISPOSITIVO = Platform.OS === 'ios' ? 'iPhone' : 'móvil';

// La papelera de 30 días de "Eliminados recientemente" es un comportamiento
// verificado de iOS. En Android varía según el fabricante y la app de
// galería, así que ahí evitamos prometer un número de días o un nombre de
// carpeta concretos. (Mismo texto que en seleccion.tsx.)
const TEXTO_RECUPERACION =
  Platform.OS === 'ios'
    ? 'Podrás recuperarlas desde "Eliminados recientemente" durante 30 días si cambias de opinión.'
    : 'Podrás recuperarlas desde Eliminados recientemente si cambias de opinión.';

type CandidataConUri = { id: string; uri: string; nitidez?: number };

// Frases cálidas que rotan durante el escaneo, en vez de un contador
// técnico. Transmiten cuidado en lugar de tarea pendiente.
const FRASES_ESCANEO = [
  'Mirando tus fotos con cariño…',
  'Agrupando lo que va junto…',
  'Buscando tus mejores momentos…',
  'Casi está…',
];

// Fecha legible con día de la semana para el título del momento, ej.
// "Sáb 30 ago". Se define aquí para no tocar etiquetas.ts, que usa un
// formato distinto (año + mes) pensado para búsqueda futura.
const DIAS_ABREV = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_MINUS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];
function fechaConDia(creationTime: number): string {
  const f = new Date(creationTime);
  return `${DIAS_ABREV[f.getDay()]} ${f.getDate()} ${MESES_MINUS[f.getMonth()]}`;
}

type GrupoConDistancias = GrupoFotos & {
  distancias: number[];
  candidatas: CandidataConUri[];
  descartadas: CandidataConUri[];
  grupoId: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState('Buscando tus mejores momentos...');
  const [totalFotos, setTotalFotos] = useState<number | null>(null);
  const [grupos, setGrupos] = useState<GrupoConDistancias[]>([]);
  // Uri de la primera foto del grupo que se está analizando ahora mismo,
  // para mostrarla en la pantalla de carga y que el usuario vea que algo
  // está pasando de verdad, no solo un texto fijo.
  const [previewEscaneo, setPreviewEscaneo] = useState<string | null>(null);
  // Progreso real del escaneo (0..1) para la barra, sin mostrar números.
  const [progresoEscaneo, setProgresoEscaneo] = useState(0);
  // Índice de la frase cálida que se muestra ahora mismo; rota sola.
  const [fraseEscaneo, setFraseEscaneo] = useState(0);
  // Se incrementa cada vez que la pantalla vuelve a tener el foco, para forzar
  // un re-render y reflejar las ganadoras marcadas en gruposElegidos.ts.
  const [tick, setTick] = useState(0);
  // Id del grupo cuyo modal de etiqueta esta abierto ahora mismo, o null
  // si no hay ninguno abierto.
  const [grupoEditando, setGrupoEditando] = useState<string | null>(null);
  // Espacio libre del dispositivo, leído una vez al arrancar y refrescado
  // al volver a la pantalla (por si el usuario borró fotos en el torneo).
  const [espacio, setEspacio] = useState<EspacioLibre | null>(null);

  // Mientras el escaneo está en marcha, rota la frase cálida cada 2,2 s.
  useEffect(() => {
    if (status === '¡Listo!') return;
    const id = setInterval(() => {
      setFraseEscaneo((f) => (f + 1) % FRASES_ESCANEO.length);
    }, 2200);
    return () => clearInterval(id);
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
      // Al volver del torneo el espacio libre puede haber cambiado.
      obtenerEspacioCache().then(setEspacio);
    }, [])
  );

  useEffect(() => {
    (async () => {
      let yaVioOnboarding = true;
      try {
        yaVioOnboarding = (await AsyncStorage.getItem(CLAVE_ONBOARDING_VISTO)) === 'true';
      } catch {
        // Si falla la lectura, asumimos que ya lo vio para no dejar a
        // alguien atrapado en el onboarding por un fallo de almacenamiento.
      }
      if (!yaVioOnboarding) {
        router.replace('/bienvenida');
        return;
      }

      await inicializarRevisados();
      await inicializarEtiquetas();
      await inicializarProgreso();
      const esp = await inicializarEspacio();
      setEspacio(esp);

      const { status: permisoStatus } = await MediaLibrary.requestPermissionsAsync();

      if (permisoStatus !== 'granted') {
        setStatus('No hemos podido acceder a tus fotos. Revisa los permisos en Ajustes.');
        return;
      }

      setStatus('Buscando momentos en tu carrete...');

      const resultado = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: 200,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      setTotalFotos(resultado.totalCount);
      setStatus('Reconociendo tus momentos...');
      // Pausa corta a propósito: agrupar por tiempo ya ha terminado dentro
      // de detectarRafagas (es prácticamente instantáneo), pero sin esto React agruparía este cambio de estado
      // con el siguiente y el usuario nunca llegaría a ver esta fase.
      await new Promise((resolve) => setTimeout(resolve, 400));

      const gruposConDistancias: GrupoConDistancias[] = [];

      await detectarRafagas(resultado.assets, {
        onProgreso: (indice, total, primeraFotoUri) => {
          setProgresoEscaneo(total > 0 ? (indice + 1) / total : 0);
          setPreviewEscaneo(primeraFotoUri || null);
        },
        onGrupo: async (grupo) => {
          const candidatas: CandidataConUri[] = grupo.fotosConUri.map((foto) => ({
            id: foto.id,
            uri: foto.uri,
          }));

          registrarGrupo(grupo.grupoId, candidatas, [], grupo.fotos[0]?.creationTime);

          const { fotosConUri, ...grupoBase } = grupo;
          gruposConDistancias.push({
            ...grupoBase,
            candidatas,
            descartadas: [],
          });
        },
      });

      setGrupos(gruposConDistancias);
      setPreviewEscaneo(null);
      setStatus('¡Listo!');
    })();
  }, []);

  const seleccionarGrupo = (grupoId: string) => {
    router.push({
      pathname: '/seleccion',
      params: { grupoId },
    });
  };

  // Borra el grupo entero (todas sus fotos, sin elegir ninguna) para casos
  // de fotos-recordatorio (ej. una foto de un ticket o una pizarra) donde
  // ninguna merece quedarse. Distinto del borrado que hace seleccion.tsx,
  // que siempre parte de haber elegido una ganadora primero.
  const descartarGrupoCompleto = (item: GrupoConDistancias) => {
    const idsTodo = item.candidatas.map((c) => c.id);
    Alert.alert(
      'Borrar todas las fotos',
      `Se ${idsTodo.length === 1 ? 'borrará' : 'borrarán'} ${idsTodo.length} ${idsTodo.length === 1 ? 'foto' : 'fotos'} de este momento, sin elegir ninguna. ${TEXTO_RECUPERACION}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todas',
          style: 'destructive',
          onPress: async () => {
            try {
              const borradoOk = await MediaLibrary.deleteAssetsAsync(idsTodo);
              if (!borradoOk) {
                Alert.alert(
                  'No se ha borrado nada',
                  'Cancelaste la confirmación del sistema. Tus fotos siguen en el carrete.'
                );
                return;
              }
              setGrupos((actuales) => actuales.filter((g) => g.grupoId !== item.grupoId));
            } catch {
              Alert.alert(
                'No hemos podido eliminar las fotos.',
                'Revisa los permisos e inténtalo de nuevo.'
              );
            }
          },
        },
      ]
    );
  };

  const guardarEtiquetaGrupo = async (nombre: string) => {
    if (!grupoEditando) return;
    await guardarNombreActividad(grupoEditando, nombre);
    setTick((t) => t + 1);
  };

  // No revisados primero, revisados al final (con su orden relativo
  // intacto en cada bloque, ya que Array.sort es estable).
  const gruposOrdenados = [...grupos].sort((a, b) => {
    const aRevisado = esRevisado(a.grupoId);
    const bRevisado = esRevisado(b.grupoId);
    if (aRevisado === bRevisado) return 0;
    return aRevisado ? 1 : -1;
  });

  const grupoEditandoData = grupos.find((g) => g.grupoId === grupoEditando);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <Text style={styles.titulo}>Fondly</Text>
      <Text style={styles.insigniaPrivacidad}>🔒 100% en tu {DISPOSITIVO}</Text>

      {status === '¡Listo!' && (
        <View style={styles.cabeceraGanancia}>
          {espacio && (
            <Text
              style={[styles.espacioTexto, espacio.critico && styles.espacioCritico]}
            >
              {espacio.critico ? 'Solo te quedan ' : 'Te quedan '}
              {espacio.texto} libres
            </Text>
          )}
          {obtenerProgresoHoy().elegidas > 0 && (
            <Text style={styles.gananciaTexto}>
              Llevas {obtenerProgresoHoy().elegidas}
              {obtenerProgresoHoy().elegidas === 1 ? ' elegida' : ' elegidas'} hoy ✨
            </Text>
          )}
        </View>
      )}

      {status !== '¡Listo!' && (
        <View style={styles.escaneoContenedor}>
          <Image
            source={require('@/assets/images/escaneo-ilustracion.png')}
            style={styles.escaneoIlustracion}
            contentFit="contain"
          />

          {previewEscaneo && (
            <View style={styles.polaroidMarco}>
              <Image source={{ uri: previewEscaneo }} style={styles.polaroidFoto} />
            </View>
          )}

          <Text style={styles.fraseEscaneo}>{FRASES_ESCANEO[fraseEscaneo]}</Text>

          <View style={styles.barraProgreso}>
            <View
              style={[
                styles.barraProgresoRelleno,
                { width: `${Math.round(progresoEscaneo * 100)}%` },
              ]}
            />
          </View>
        </View>
      )}

      {status === '¡Listo!' && (
        <FlatList
        data={gruposOrdenados}
        keyExtractor={(item) => item.grupoId}
        style={styles.lista}
        extraData={tick}
        renderItem={({ item, index }) => {
          const ganadora = obtenerGanadora(item.grupoId);
          const portada = ganadora?.uri ?? item.candidatas[0]?.uri;
          const revisado = esRevisado(item.grupoId);

          return (
            <View style={[styles.tarjeta, revisado && styles.tarjetaRevisada]}>
              {portada ? (
                <Pressable
                  onPress={() => item.candidatas.length > 0 && seleccionarGrupo(item.grupoId)}
                >
                  <View style={styles.portadaContenedor}>
                    <Image source={{ uri: portada }} style={styles.portada} />
                    {ganadora && (
                      <View style={styles.insignia}>
                        <Text style={styles.insigniaTexto}>✓</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ) : null}

              <View style={styles.tarjetaCuerpo}>
                <Text style={styles.tarjetaTitulo}>
                  {fechaConDia(item.fotos[0].creationTime)} · {item.fotos.length} fotos
                  {revisado ? '  ·  Revisado ✓' : ''}
                </Text>

                {item.candidatas.length > 0 && (
                  <BouncyPressable
                    style={ganadora ? styles.botonSecundario : styles.botonGrupo}
                    onPress={() => seleccionarGrupo(item.grupoId)}
                  >
                    <Text style={ganadora ? styles.textoBotonSecundario : styles.textoBotonGrupo}>
                      {ganadora
                        ? 'Volver a elegir'
                        : item.candidatas.length === 1
                        ? 'Revisar y limpiar ✨'
                        : 'Elegir la mejor foto ✨'}
                    </Text>
                  </BouncyPressable>
                )}

              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <BouncyPressable
            style={styles.tarjetaExplorar}
            onPress={() => router.push('/explore')}
          >
            <Text style={styles.textoExplorar}>📅 Revisar fotos más antiguas</Text>
            <Text style={styles.subtextoExplorar}>
              Elige tus mejores momentos de otros periodos
            </Text>
          </BouncyPressable>
        }
        />
      )}

      <EtiquetaModal
        visible={grupoEditando !== null}
        valorInicial={grupoEditando ? obtenerNombreActividad(grupoEditando) ?? '' : ''}
        etiquetaFecha={
          grupoEditandoData ? formatearFecha(grupoEditandoData.fotos[0].creationTime) : ''
        }
        onGuardar={guardarEtiquetaGrupo}
        onCerrar={() => setGrupoEditando(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: COLORES.fondo,
  },
  titulo: {
    textAlign: 'center',
    marginBottom: 8,
    color: COLORES.texto,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cabeceraGanancia: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
    gap: 2,
  },
  espacioTexto: {
    fontSize: 14,
    color: COLORES.textoSecundario,
    fontWeight: '600',
  },
  espacioCritico: {
    color: COLORES.acento,
  },
  gananciaTexto: {
    fontSize: 15,
    color: COLORES.acentoOscuro,
    fontWeight: '700',
  },
  insigniaPrivacidad: {
    alignSelf: 'center',
    marginBottom: 14,
    color: COLORES.acentoOscuro,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    backgroundColor: COLORES.acentoSuave,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  botonDevReset: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  textoDevReset: {
    color: COLORES.textoSecundario,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  status: {
    textAlign: 'center',
    marginBottom: 16,
    color: COLORES.texto,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 10,
  },
  escaneoContenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  escaneoIlustracion: {
    width: 150,
    height: 150,
    marginBottom: 10,
  },
  polaroidMarco: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 22,
    borderRadius: 8,
    marginTop: 4,
    transform: [{ rotate: '-3deg' }],
    shadowColor: '#3B2A28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  polaroidFoto: {
    width: 230,
    height: 230,
    borderRadius: 4,
    backgroundColor: COLORES.borde,
  },
  fraseEscaneo: {
    textAlign: 'center',
    color: COLORES.acentoOscuro,
    fontSize: 17,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginTop: 24,
    marginBottom: 16,
  },
  barraProgreso: {
    width: 160,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORES.borde,
    overflow: 'hidden',
  },
  barraProgresoRelleno: {
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORES.acento,
  },
  subtitulo: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    color: COLORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
  lista: {
    flex: 1,
  },

  // --- Tarjeta de grupo (estilo VSCO/Instagram: portada + badge + info) ---
  tarjeta: {
    backgroundColor: COLORES.superficie,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.borde,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tarjetaRevisada: {
    opacity: 0.55,
  },
  portadaContenedor: {
    position: 'relative',
  },
  portada: {
    width: '100%',
    height: 220,
  },
  insignia: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORES.acento,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insigniaTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  tarjetaCuerpo: {
    padding: 14,
  },
  tarjetaTitulo: {
    color: COLORES.texto,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  tarjetaEtiqueta: {
    alignSelf: 'flex-start',
    color: COLORES.acentoOscuro,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: COLORES.acentoSuave,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },

  botonGrupo: {
    backgroundColor: COLORES.acento,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignSelf: 'flex-start',
  },
  botonSecundario: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  textoBotonGrupo: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  textoBotonSecundario: {
    color: COLORES.acento,
    fontWeight: '600',
    fontSize: 13,
  },
  botonDescartarGrupo: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },
  textoDescartarGrupo: {
    color: COLORES.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  tarjetaExplorar: {
    backgroundColor: COLORES.acentoSuave,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.acento,
    borderStyle: 'dashed',
    padding: 20,
    marginTop: 4,
    marginBottom: 24,
    alignItems: 'center',
  },
  textoExplorar: {
    color: COLORES.acentoOscuro,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtextoExplorar: {
    color: COLORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
  },
});
