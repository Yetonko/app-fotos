import { useCallback, useEffect, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';

import { BouncyPressable } from '@/components/bouncy-pressable';
import {
  contarFotosEnPeriodo,
  generarPeriodos,
  mesesDeTrimestre,
  Periodo,
  UMBRAL_DIVIDIR_EN_MESES,
} from '@/lib/periodos';
import { COLORES } from '@/constants/estilo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { T } from '@/lib/i18n';
import { inicializarRevisados, esRevisado } from '@/lib/revisados';
import { obtenerLiberadoTotal } from '@/lib/progreso';
import { estimarTamanoRango, formatearTamano } from '@/lib/tamano';

// Misma paleta que index.tsx y seleccion.tsx — se repite aquí siguiendo el
// mismo patrón que ya usan esas pantallas.

const DISPOSITIVO = Platform.OS === 'ios' ? 'iPhone' : T.comun.movil;

// A partir de este número de fotos en el periodo, avisamos de que puede
// tardar un poco más de lo normal — no bloqueamos el acceso, solo avisamos
// (así lo decidimos: informar antes de entrar y dejar decidir al usuario).
const AVISO_MUCHAS_FOTOS = 800;

type PeriodoConConteo = Periodo & { totalFotos: number; portadaUri: string | null };

function formatearConteo(n: number): string {
  return T.comun.fotos(n);
}

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodos, setPeriodos] = useState<PeriodoConConteo[]>([]);
  // Se incrementa al volver de periodo.tsx, para reflejar los periodos que
  // se hayan marcado como revisados mientras tanto.
  const [tick, setTick] = useState(0);
  // Recompensa visible: todo lo liberado con Fondly hasta ahora.
  const [liberado, setLiberado] = useState(0);
  // Cuánto ocupa (aprox.) cada época, por id. Se va rellenando poco a poco.
  const [tamanos, setTamanos] = useState<Record<string, number | null>>({});

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
      obtenerLiberadoTotal().then(setLiberado);
    }, [])
  );

  useEffect(() => {
    (async () => {
      try {
        await inicializarRevisados();

        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          setError(T.periodos.errorPermisos(DISPOSITIVO));
          setCargando(false);
          return;
        }

        // La foto más antigua marca hasta dónde hay que generar periodos.
        const primera = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          first: 1,
          sortBy: [[MediaLibrary.SortBy.creationTime, true]], // ascendente = la más antigua
        });

        if (primera.assets.length === 0) {
          setPeriodos([]);
          setCargando(false);
          return;
        }

        const fechaMasAntigua = primera.assets[0].creationTime;
        const base = generarPeriodos(fechaMasAntigua);

        // El conteo de cada periodo es barato (no descarga fotos), así que
        // se piden todos a la vez en paralelo.
        const contar = async (periodo: Periodo): Promise<PeriodoConConteo> => {
          const conteo = await contarFotosEnPeriodo(periodo);
          return { ...periodo, totalFotos: conteo.total, portadaUri: conteo.portadaUri };
        };
        const trimestres = await Promise.all(base.map(contar));

        // Los trimestres con demasiadas fotos se sustituyen por sus meses
        // (en su mismo sitio de la lista), contados igual de barato.
        const conConteo = (
          await Promise.all(
            trimestres.map((t) =>
              t.totalFotos > UMBRAL_DIVIDIR_EN_MESES
                ? Promise.all(mesesDeTrimestre(t).map(contar))
                : Promise.resolve([t])
            )
          )
        ).flat();

        setPeriodos(conConteo.filter((p) => p.totalFotos > 0));
      } catch {
        setError(T.periodos.errorCarga);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // Estima el tamaño de cada época de una en una, después de pintar la lista,
  // para que la pantalla aparezca enseguida y los "unos X GB" vayan llegando.
  useEffect(() => {
    if (periodos.length === 0) return;
    let cancelado = false;
    (async () => {
      for (const p of periodos) {
        if (cancelado) return;
        const t = await estimarTamanoRango(p.id, p.desde, p.hasta, p.totalFotos);
        if (cancelado) return;
        setTamanos((actual) => ({ ...actual, [p.id]: t }));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [periodos]);

  const tocarPeriodo = (periodo: PeriodoConConteo) => {
    router.push({
      pathname: '/periodo',
      params: {
        id: periodo.id,
        desde: String(periodo.desde),
        hasta: String(periodo.hasta),
        etiqueta: periodo.etiqueta,
      },
    });
  };

  // Un mes cuenta como revisado si lo está él o si se revisó entero su
  // trimestre antes de que se partiera en meses.
  const estaRevisado = (p: PeriodoConConteo) =>
    esRevisado(p.id) || (!!p.trimestreId && esRevisado(p.trimestreId));

  // No revisados primero, revisados al final (mismo criterio que en Home
  // y en los grupos dentro de cada periodo).
  const periodosOrdenados = [...periodos].sort((a, b) => {
    const aRevisado = estaRevisado(a);
    const bRevisado = estaRevisado(b);
    if (aRevisado === bRevisado) return 0;
    return aRevisado ? 1 : -1;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <Text style={styles.titulo}>{T.periodos.titulo}</Text>
      <Text style={styles.subtitulo}>{T.periodos.subtitulo}</Text>

      {cargando && (
        <View style={styles.centrado}>
          <ActivityIndicator color={COLORES.acento} size="large" />
          <Text style={styles.textoCargando}>{T.periodos.cargando}</Text>
        </View>
      )}

      {!cargando && error && (
        <View style={styles.centrado}>
          <Text style={styles.textoError}>{error}</Text>
        </View>
      )}

      {!cargando && !error && periodos.length === 0 && (
        <View style={styles.centrado}>
          <Text style={styles.emoji}>📅</Text>
          <Text style={styles.textoVacio}>{T.periodos.vacio}</Text>
        </View>
      )}

      {!cargando && !error && periodos.length > 0 && (
        <FlatList
          data={periodosOrdenados}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          extraData={[tick, tamanos]}
          ListHeaderComponent={
            liberado > 0 ? (
              <View style={styles.liberadoCaja}>
                <IconSymbol name="checkmark" size={26} color={COLORES.acentoOscuro} />
                <Text style={styles.liberadoTexto}>
                  {T.periodos.hasLiberado(formatearTamano(liberado))}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const revisado = estaRevisado(item);
            const tamano = tamanos[item.id];
            return (
              <BouncyPressable
                style={[styles.tarjeta, revisado && styles.tarjetaRevisada]}
                onPress={() => tocarPeriodo(item)}
              >
                {item.portadaUri ? (
                  <Image source={{ uri: item.portadaUri }} style={styles.tarjetaPortada} />
                ) : (
                  <View style={[styles.tarjetaPortada, styles.tarjetaPortadaVacia]}>
                    <Text style={styles.tarjetaPortadaEmoji}>📷</Text>
                  </View>
                )}
                <View style={styles.tarjetaCuerpo}>
                  <Text style={styles.tarjetaTitulo}>
                    {item.etiqueta}
                    {revisado ? T.comun.revisado : ''}
                  </Text>
                  <Text style={styles.tarjetaConteo}>
                    {tamano
                      ? T.periodos.conteoConTamano(
                          formatearConteo(item.totalFotos),
                          formatearTamano(tamano)
                        )
                      : formatearConteo(item.totalFotos)}
                  </Text>
                  {item.totalFotos >= AVISO_MUCHAS_FOTOS && (
                    <Text style={styles.tarjetaAviso}>{T.periodos.avisoMuchasFotos}</Text>
                  )}
                </View>
              </BouncyPressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  liberadoCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORES.acentoSuave,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  liberadoTexto: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORES.acentoOscuro,
  },
  container: {
    flex: 1,
    backgroundColor: COLORES.fondo,
    paddingHorizontal: 20,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORES.texto,
    textAlign: 'left',
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 15,
    color: COLORES.textoSecundario,
    marginBottom: 20,
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  textoCargando: {
    marginTop: 14,
    fontSize: 14,
    color: COLORES.textoSecundario,
    textAlign: 'center',
  },
  textoError: {
    fontSize: 15,
    color: COLORES.texto,
    textAlign: 'center',
  },
  textoVacio: {
    fontSize: 15,
    color: COLORES.textoSecundario,
    textAlign: 'center',
  },
  lista: {
    flex: 1,
  },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORES.superficie,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#3B2A28',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  tarjetaPortada: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: COLORES.borde,
    marginRight: 14,
  },
  tarjetaPortadaVacia: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarjetaPortadaEmoji: {
    fontSize: 26,
  },
  tarjetaCuerpo: {
    flex: 1,
  },
  tarjetaRevisada: {
    opacity: 0.8,
  },
  tarjetaTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORES.texto,
    marginBottom: 4,
  },
  tarjetaConteo: {
    fontSize: 14,
    color: COLORES.acentoOscuro,
    fontWeight: '600',
  },
  tarjetaAviso: {
    fontSize: 13,
    color: COLORES.textoSecundario,
    marginTop: 6,
  },
});
