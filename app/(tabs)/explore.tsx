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

import { BouncyPressable } from '@/components/bouncy-pressable';
import { contarFotosEnPeriodo, generarPeriodos, Periodo } from '@/lib/periodos';
import { inicializarRevisados, esRevisado } from '@/lib/revisados';

// Misma paleta que index.tsx y seleccion.tsx — se repite aquí siguiendo el
// mismo patrón que ya usan esas pantallas.
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

const DISPOSITIVO = Platform.OS === 'ios' ? 'iPhone' : 'móvil';

// A partir de este número de fotos en el periodo, avisamos de que puede
// tardar un poco más de lo normal — no bloqueamos el acceso, solo avisamos
// (así lo decidimos: informar antes de entrar y dejar decidir al usuario).
const AVISO_MUCHAS_FOTOS = 800;

type PeriodoConConteo = Periodo & { totalFotos: number };

function formatearConteo(n: number): string {
  const numero = n.toLocaleString('es-ES');
  return `${numero} ${n === 1 ? 'foto' : 'fotos'}`;
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

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, [])
  );

  useEffect(() => {
    (async () => {
      try {
        await inicializarRevisados();

        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          setError(`No hemos podido acceder a tus fotos. Revisa los permisos en Ajustes de tu ${DISPOSITIVO}.`);
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
        const conConteo = await Promise.all(
          base.map(async (periodo) => ({
            ...periodo,
            totalFotos: await contarFotosEnPeriodo(periodo),
          }))
        );

        setPeriodos(conConteo.filter((p) => p.totalFotos > 0));
      } catch {
        setError('No hemos podido revisar tus periodos. Inténtalo de nuevo.');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

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

  // No revisados primero, revisados al final (mismo criterio que en Home
  // y en los grupos dentro de cada periodo).
  const periodosOrdenados = [...periodos].sort((a, b) => {
    const aRevisado = esRevisado(a.id);
    const bRevisado = esRevisado(b.id);
    if (aRevisado === bRevisado) return 0;
    return aRevisado ? 1 : -1;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <Text style={styles.titulo}>Revisar fotos antiguas</Text>
      <Text style={styles.subtitulo}>Elige un periodo para limpiarlo cuando quieras</Text>

      {cargando && (
        <View style={styles.centrado}>
          <ActivityIndicator color={COLORES.acento} size="large" />
          <Text style={styles.textoCargando}>Revisando tu carrete por periodos...</Text>
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
          <Text style={styles.textoVacio}>No hemos encontrado fotos en tu carrete todavía.</Text>
        </View>
      )}

      {!cargando && !error && periodos.length > 0 && (
        <FlatList
          data={periodosOrdenados}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          extraData={tick}
          renderItem={({ item }) => {
            const revisado = esRevisado(item.id);
            return (
              <BouncyPressable
                style={[styles.tarjeta, revisado && styles.tarjetaRevisada]}
                onPress={() => tocarPeriodo(item)}
              >
                <View>
                  <Text style={styles.tarjetaTitulo}>
                    {item.etiqueta}
                    {revisado ? '  ·  Revisado ✓' : ''}
                  </Text>
                  <Text style={styles.tarjetaConteo}>{formatearConteo(item.totalFotos)}</Text>
                  {item.totalFotos >= AVISO_MUCHAS_FOTOS && (
                    <Text style={styles.tarjetaAviso}>
                      Son bastantes fotos, revisarlas puede tardar un poco más de lo normal
                    </Text>
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
  container: {
    flex: 1,
    backgroundColor: COLORES.fondo,
    paddingHorizontal: 20,
  },
  titulo: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORES.texto,
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 14,
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
    backgroundColor: COLORES.superficie,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 16,
    marginBottom: 12,
  },
  tarjetaRevisada: {
    opacity: 0.55,
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
    fontSize: 12,
    color: COLORES.textoSecundario,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
