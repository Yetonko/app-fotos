import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { inicializarMomentos, obtenerMomentos } from '@/lib/momentos';
import { BouncyPressable } from '@/components/bouncy-pressable';

// Misma paleta que el resto de pantallas.
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

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Clave 'YYYY-MM' (para agrupar y ordenar) y nombre visible 'Agosto 2026'
// a partir de un creationTime en milisegundos.
function claveMes(creationTime: number): string {
  const f = new Date(creationTime);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
}
function nombreMes(creationTime: number): string {
  const f = new Date(creationTime);
  return `${MESES[f.getMonth()]} ${f.getFullYear()}`;
}

type Album = {
  clave: string;
  nombreMostrar: string;
  portadaUri: string;
  numFotos: number;
  masReciente: number;
};

export default function AlbumesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cargando, setCargando] = useState(true);
  const [albumes, setAlbumes] = useState<Album[]>([]);

  // Agrupa automáticamente todas las fotos elegidas por mes/año, usando el
  // creationTime que se guarda al elegir. No depende de que la usuaria haya
  // etiquetado nada: cada mes con fotos elegidas es un álbum.
  const cargar = useCallback(async () => {
    await inicializarMomentos();
    const momentos = obtenerMomentos();

    const porClave = new Map<string, Album>();

    for (const momento of momentos) {
      const clave = claveMes(momento.creationTime);

      const existente = porClave.get(clave);
      if (!existente) {
        porClave.set(clave, {
          clave,
          nombreMostrar: nombreMes(momento.creationTime),
          portadaUri: momento.ganadoraUri,
          numFotos: 1,
          masReciente: momento.creationTime,
        });
        continue;
      }

      existente.numFotos += 1;
      if (momento.creationTime > existente.masReciente) {
        existente.masReciente = momento.creationTime;
        existente.portadaUri = momento.ganadoraUri;
      }
    }

    const lista = Array.from(porClave.values()).sort((a, b) => b.masReciente - a.masReciente);
    setAlbumes(lista);
    setCargando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <Text style={styles.titulo}>Tus momentos</Text>

      {!cargando && albumes.length === 0 && (
        <View style={styles.vacioContenedor}>
          <Text style={styles.vacioEmoji}>📷</Text>
          <Text style={styles.vacioTexto}>
            Aquí se guardarán tus fotos elegidas, mes a mes. Empieza eligiendo tu primer momento en
            Home.
          </Text>
        </View>
      )}

      {albumes.length > 0 && (
        <FlatList
          data={albumes}
          keyExtractor={(item) => item.clave}
          style={styles.lista}
          renderItem={({ item }) => (
            <BouncyPressable
              style={styles.tarjeta}
              onPress={() =>
                router.push({
                  pathname: '/album',
                  params: { clave: item.clave, nombre: item.nombreMostrar },
                })
              }
            >
              <Image source={{ uri: item.portadaUri }} style={styles.portada} />
              <View style={styles.tarjetaCuerpo}>
                <Text style={styles.tarjetaTitulo}>{item.nombreMostrar}</Text>
                <Text style={styles.tarjetaSubtitulo}>
                  {item.numFotos} {item.numFotos === 1 ? 'foto elegida' : 'fotos elegidas'}
                </Text>
              </View>
            </BouncyPressable>
          )}
        />
      )}
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
    marginBottom: 16,
    color: COLORES.texto,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  vacioContenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  vacioEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  vacioTexto: {
    fontSize: 15,
    color: COLORES.textoSecundario,
    textAlign: 'center',
    lineHeight: 22,
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
    marginBottom: 14,
    overflow: 'hidden',
  },
  portada: {
    width: 84,
    height: 84,
  },
  tarjetaCuerpo: {
    flex: 1,
    paddingHorizontal: 14,
  },
  tarjetaTitulo: {
    color: COLORES.texto,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  tarjetaSubtitulo: {
    color: COLORES.textoSecundario,
    fontSize: 13,
    fontWeight: '600',
  },
});
