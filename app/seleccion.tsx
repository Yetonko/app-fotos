import { useState } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  iniciarTorneo,
  parejaActual,
  elegirGanadora,
  EstadoTorneo,
  FotoCandidata,
} from '@/lib/torneo';

// Datos de prueba: se usan solo si se entra a esta pantalla sin pasar
// candidatas reales por parámetro (ej. desde el botón "Probar selección").
const CANDIDATAS_PRUEBA: FotoCandidata[] = [
  { id: '1', uri: 'https://picsum.photos/seed/foto1/400/400' },
  { id: '2', uri: 'https://picsum.photos/seed/foto2/400/400' },
  { id: '3', uri: 'https://picsum.photos/seed/foto3/400/400' },
];

function obtenerCandidatasIniciales(candidatasParam: string | string[] | undefined): FotoCandidata[] {
  if (!candidatasParam) {
    return CANDIDATAS_PRUEBA;
  }
  const valor = Array.isArray(candidatasParam) ? candidatasParam[0] : candidatasParam;
  try {
    const parseadas = JSON.parse(valor) as FotoCandidata[];
    if (Array.isArray(parseadas) && parseadas.length > 0) {
      return parseadas;
    }
    return CANDIDATAS_PRUEBA;
  } catch {
    return CANDIDATAS_PRUEBA;
  }
}

export default function SeleccionScreen() {
  const { candidatas: candidatasParam } = useLocalSearchParams<{ candidatas?: string }>();

  const [estado, setEstado] = useState<EstadoTorneo>(() =>
    iniciarTorneo(obtenerCandidatasIniciales(candidatasParam))
  );

  const pareja = parejaActual(estado);

  const elegir = (foto: FotoCandidata) => {
    setEstado((estadoAnterior) => elegirGanadora(estadoAnterior, foto));
  };

  if (estado.ganadora) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.titulo}>
          ¡Ganadora!
        </ThemedText>
        <Image source={{ uri: estado.ganadora.uri }} style={styles.fotoGanadora} />
      </ThemedView>
    );
  }

  if (!pareja) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.titulo}>Cargando comparación...</ThemedText>
      </ThemedView>
    );
  }

  const [fotoA, fotoB] = pareja;

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.titulo}>
        ¿Cuál prefieres?
      </ThemedText>

      <ThemedView style={styles.opcion}>
        <Image source={{ uri: fotoA.uri }} style={styles.foto} />
        <Pressable style={styles.boton} onPress={() => elegir(fotoA)}>
          <ThemedText style={styles.textoBoton}>Elegir esta</ThemedText>
        </Pressable>
      </ThemedView>

      <ThemedView style={styles.opcion}>
        <Image source={{ uri: fotoB.uri }} style={styles.foto} />
        <Pressable style={styles.boton} onPress={() => elegir(fotoB)}>
          <ThemedText style={styles.textoBoton}>Elegir esta</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  titulo: {
    marginBottom: 24,
    textAlign: 'center',
  },
  opcion: {
    alignItems: 'center',
    marginBottom: 24,
  },
  foto: {
    width: 250,
    height: 250,
    borderRadius: 12,
    marginBottom: 12,
  },
  fotoGanadora: {
    width: 280,
    height: 280,
    borderRadius: 12,
  },
  boton: {
    backgroundColor: '#3478F6',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  textoBoton: {
    color: 'white',
    fontWeight: '600',
  },
});
