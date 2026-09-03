import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { inicializarMomentos, obtenerMomentos } from '@/lib/momentos';
import { inicializarEtiquetas, obtenerNombreActividad, extraerPalabrasClave } from '@/lib/etiquetas';
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

  // Solo cuentan los momentos que tienen un nombre de etiqueta puesto (los
  // "Sin etiquetar" no aparecen en Álbumes, a propósito). Cada palabra
  // significativa del nombre se convierte en su propio álbum (ignorando
  // mayúsculas): "Excursión Bret" contribuye tanto al álbum "Excursión"
  // como al álbum "Bret", para que no haga falta escribir siempre el mismo
  // texto exacto para que dos momentos se agrupen juntos.
  const cargar = useCallback(async () => {
    await inicializarMomentos();
    await inicializarEtiquetas();
    const momentos = obtenerMomentos();

    const porClave = new Map<string, Album>();

    for (const momento of momentos) {
      const nombre = obtenerNombreActividad(momento.grupoId)?.trim();
      if (!nombre) continue;

      for (const palabra of extraerPalabrasClave(nombre)) {
        const clave = palabra.toLowerCase();

        const existente = porClave.get(clave);
        if (!existente) {
          porClave.set(clave, {
            clave,
            nombreMostrar: palabra,
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
          existente.nombreMostrar = palabra;
        }
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
      <Text style={styles.titulo}>Álbumes</Text>

      {!cargando && albumes.length === 0 && (
        <View style={styles.vacioContenedor}>
          <Text style={styles.vacioEmoji}>📷</Text>
          <Text style={styles.vacioTexto}>
            Todavía no tienes álbumes. Ponle un nombre a un momento (✏️) desde Home o Periodos y
            aparecerá aquí.
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
                  {item.numFotos} {item.numFotos === 1 ? 'foto' : 'fotos'}
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
