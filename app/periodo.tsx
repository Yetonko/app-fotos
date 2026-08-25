import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { FlatList, StyleSheet, View, Text, Pressable } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';

import { detectarRafagas, GrupoDetectado } from '@/lib/escaneo';
import { registrarGrupo } from '@/lib/gruposElegidos';
import { inicializarRevisados, esRevisado, marcarRevisado } from '@/lib/revisados';
import {
  inicializarEtiquetas,
  obtenerNombreActividad,
  guardarNombreActividad,
  formatearEtiqueta,
  formatearFecha,
} from '@/lib/etiquetas';
import { EtiquetaModal } from '@/components/etiqueta-modal';
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

type CandidataConUri = { id: string; uri: string };
type GrupoConCandidatas = GrupoDetectado & { candidatas: CandidataConUri[] };

export default function PeriodoScreen() {
  const router = useRouter();
  const { desde, hasta, etiqueta, id } = useLocalSearchParams<{
    desde?: string;
    hasta?: string;
    etiqueta?: string;
    id?: string;
  }>();

  const [status, setStatus] = useState('Buscando fotos de este periodo...');
  const [previewEscaneo, setPreviewEscaneo] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoConCandidatas[]>([]);
  // Se incrementa al volver de seleccion.tsx, para reflejar los grupos que
  // se hayan marcado como revisados mientras tanto.
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, [])
  );

  // Id del grupo cuyo modal de etiqueta esta abierto ahora mismo, o null.
  const [grupoEditando, setGrupoEditando] = useState<string | null>(null);

  useEffect(() => {
    if (!desde || !hasta) return;

    (async () => {
      await inicializarRevisados();
      await inicializarEtiquetas();

      const desdeMs = Number(desde);
      const hastaMs = Number(hasta);

      // Sin filtro de nitidez a propósito: en un periodo antiguo el objetivo
      // es limpiar duplicados, no elegir la foto perfecta para publicar, así
      // que todas las fotos del grupo pasan a ser candidatas directamente
      // (misma decisión que ya tomamos para simplificar Home).
      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        createdAfter: desdeMs,
        createdBefore: hastaMs,
        first: 5000,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      setStatus('Agrupando fotos parecidas...');
      await new Promise((resolve) => setTimeout(resolve, 400));

      const resultado: GrupoConCandidatas[] = [];

      await detectarRafagas(assets.assets, {
        onProgreso: (indice, total, primeraFotoUri) => {
          setStatus(`Revisando grupo ${indice + 1} de ${total}...`);
          setPreviewEscaneo(primeraFotoUri || null);
        },
        onGrupo: (grupo) => {
          const candidatas: CandidataConUri[] = grupo.fotosConUri.map((foto) => ({
            id: foto.id,
            uri: foto.uri,
          }));

          registrarGrupo(grupo.grupoId, candidatas, [], grupo.fotos[0]?.creationTime);

          resultado.push({ ...grupo, candidatas });
        },
      });

      setGrupos(resultado);
      setPreviewEscaneo(null);
      setStatus('¡Listo!');
    })();
  }, [desde, hasta]);

  // Si no hay grupos, o todos los grupos de este periodo ya estan
  // revisados, se marca el periodo entero como revisado (mismo mecanismo
  // que en Home, reutilizando marcarRevisado con el id del periodo).
  useEffect(() => {
    if (status !== '¡Listo!' || !id) return;
    const todosRevisados = grupos.length === 0 || grupos.every((g) => esRevisado(g.grupoId));
    if (todosRevisados) {
      marcarRevisado(id);
    }
  }, [grupos, tick, id, status]);

  // No revisados primero, revisados al final (mismo criterio que en Home).
  const gruposOrdenados = [...grupos].sort((a, b) => {
    const aRevisado = esRevisado(a.grupoId);
    const bRevisado = esRevisado(b.grupoId);
    if (aRevisado === bRevisado) return 0;
    return aRevisado ? 1 : -1;
  });

  const guardarEtiquetaGrupo = async (nombre: string) => {
    if (!grupoEditando) return;
    await guardarNombreActividad(grupoEditando, nombre);
    setTick((t) => t + 1);
  };

  const grupoEditandoData = grupos.find((g) => g.grupoId === grupoEditando);

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>{etiqueta ?? 'Periodo'}</Text>

      {status !== '¡Listo!' && (
        <View style={styles.centrado}>
          <Text style={styles.status}>{status}</Text>
          {previewEscaneo && (
            <Image source={{ uri: previewEscaneo }} style={styles.preview} />
          )}
        </View>
      )}

      {status === '¡Listo!' && grupos.length === 0 && (
        <View style={styles.centrado}>
          <Text style={styles.emoji}>✨</Text>
          <Text style={styles.textoVacio}>
            No hemos encontrado fotos casi iguales en este periodo.
          </Text>
        </View>
      )}

      {status === '¡Listo!' && grupos.length > 0 && (
        <FlatList
          data={gruposOrdenados}
          keyExtractor={(item) => item.grupoId}
          style={styles.lista}
          extraData={tick}
          renderItem={({ item, index }) => {
            const portada = item.candidatas[0]?.uri;
            const revisado = esRevisado(item.grupoId);
            return (
              <View style={[styles.tarjeta, revisado && styles.tarjetaRevisada]}>
                {portada && (
                  <Image source={{ uri: portada }} style={styles.portada} />
                )}
                <View style={styles.tarjetaCuerpo}>
                  <Text style={styles.tarjetaTitulo}>
                    Grupo {index + 1} · {item.fotos.length} fotos casi iguales
                    {revisado ? '  ·  Revisado ✓' : ''}
                  </Text>
                  <Pressable onPress={() => setGrupoEditando(item.grupoId)} hitSlop={6}>
                    <Text style={styles.tarjetaEtiqueta}>
                      {formatearEtiqueta(item.grupoId, item.fotos[0].creationTime)} ✏️
                    </Text>
                  </Pressable>
                  <BouncyPressable
                    style={styles.boton}
                    onPress={() =>
                      router.push({ pathname: '/seleccion', params: { grupoId: item.grupoId } })
                    }
                  >
                    <Text style={styles.textoBoton}>Elegir la mejor foto ✨</Text>
                  </BouncyPressable>
                </View>
              </View>
            );
          }}
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
    backgroundColor: COLORES.fondo,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORES.texto,
    marginBottom: 16,
    textAlign: 'center',
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORES.texto,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  preview: {
    width: 200,
    height: 200,
    borderRadius: 18,
    backgroundColor: COLORES.superficie,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  textoVacio: {
    fontSize: 15,
    color: COLORES.textoSecundario,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  lista: {
    flex: 1,
  },
  tarjeta: {
    backgroundColor: COLORES.superficie,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.borde,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tarjetaRevisada: {
    opacity: 0.55,
  },
  portada: {
    width: '100%',
    height: 180,
  },
  tarjetaCuerpo: {
    padding: 14,
  },
  tarjetaTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORES.texto,
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
  boton: {
    backgroundColor: COLORES.acento,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  textoBoton: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
