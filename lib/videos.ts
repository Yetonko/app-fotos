import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

import { tamanoDeFoto } from './tamano';

// Vídeos del carrete: listarlos por fechas, saber cuánto ocupan y
// prepararlos para compartir. Todo en el móvil, sin descargar nada salvo
// cuando ella pide verlo o compartirlo.

export type VideoCarrete = {
  id: string;
  uri: string; // sirve para la miniatura
  filename: string;
  creationTime: number;
  duracion: number; // segundos
  ancho: number;
  alto: number;
  // Cámara lenta, modo Cine, time-lapse o vídeo espacial: para medirlos el
  // iPhone tiene que convertir el vídeo entero (y deja la copia en la
  // caché), así que no se miden.
  noMedible: boolean;
};

// Por debajo de esto, casi siempre es un vídeo grabado sin querer.
export const DURACION_SIN_QUERER = 2;

// Tope por época: de sobra para casi cualquier carrete y evita listas
// eternas en móviles con miles de vídeos.
const MAX_VIDEOS = 500;

const SUBTIPOS_NO_MEDIBLES: MediaLibrary.MediaSubtype[] = [
  'highFrameRate',
  'videoCinematic',
  'timelapse',
  'spatialMedia',
];

export function esNoMedible(subtipos?: MediaLibrary.MediaSubtype[]): boolean {
  return !!subtipos?.some((t) => SUBTIPOS_NO_MEDIBLES.includes(t));
}

export function aVideo(a: MediaLibrary.Asset): VideoCarrete {
  return {
    id: a.id,
    uri: a.uri,
    filename: a.filename,
    creationTime: a.creationTime,
    duracion: a.duration ?? 0,
    ancho: a.width,
    alto: a.height,
    noMedible: esNoMedible(a.mediaSubtypes),
  };
}

export async function videosDeRango(desde: number, hasta: number): Promise<VideoCarrete[]> {
  const resultado = await MediaLibrary.getAssetsAsync({
    mediaType: 'video',
    createdAfter: desde,
    createdBefore: hasta,
    first: MAX_VIDEOS,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });
  return resultado.assets.map(aVideo);
}

// Conteo barato (no abre ningún vídeo).
export async function contarVideos(desde: number, hasta: number): Promise<number> {
  const resultado = await MediaLibrary.getAssetsAsync({
    mediaType: 'video',
    createdAfter: desde,
    createdBefore: hasta,
    first: 1,
  });
  return resultado.totalCount;
}

// Lo que pesa un vídeo depende sobre todo de cuánto dura y de su
// resolución. Sirve para ordenar "los que más ocupan" sin abrir ninguno.
export function pesoRelativo(v: VideoCarrete): number {
  return Math.max(v.duracion, 0.1) * Math.max(v.ancho * v.alto, 1);
}

// Tamaño real de un vídeo, o null si no se puede medir sin descargarlo
// (está solo en iCloud) o es de un tipo que no se mide (ver noMedible).
export async function tamanoDeVideo(v: VideoCarrete): Promise<number | null> {
  if (v.noMedible) return null;
  return tamanoDeFoto(v.id);
}

// Estimación de lo que ocupan todos los vídeos de una lista: mide unos
// pocos y reparte en proporción a su duración y resolución. Se muestra
// siempre como "unos X". null si no se pudo medir ninguno.
const MUESTRA = 4;

export async function estimarTamanoVideos(videos: VideoCarrete[]): Promise<number | null> {
  if (videos.length === 0) return null;
  const medibles = videos.filter((v) => !v.noMedible);
  const salto = Math.max(1, Math.floor(medibles.length / MUESTRA));
  let bytesMedidos = 0;
  let pesoMedido = 0;
  for (let n = 0, i = 0; n < MUESTRA && i < medibles.length; n++, i += salto) {
    const t = await tamanoDeVideo(medibles[i]);
    if (t) {
      bytesMedidos += t;
      pesoMedido += pesoRelativo(medibles[i]);
    }
  }
  if (pesoMedido === 0) return null;
  const pesoTotal = videos.reduce((suma, v) => suma + pesoRelativo(v), 0);
  return Math.round((bytesMedidos / pesoMedido) * pesoTotal);
}

const cacheEstimaciones = new Map<string, { total: number; bytes: number | null }>();

export function invalidarEstimacionesVideo(): void {
  cacheEstimaciones.clear();
}

// Cuántos vídeos hay en una época y cuánto ocupan (aprox.), con caché.
export async function resumenVideosRango(
  clave: string,
  desde: number,
  hasta: number
): Promise<{ total: number; bytes: number | null }> {
  const guardado = cacheEstimaciones.get(clave);
  if (guardado) return guardado;
  try {
    const [total, videos] = await Promise.all([contarVideos(desde, hasta), videosDeRango(desde, hasta)]);
    const resumen = { total, bytes: await estimarTamanoVideos(videos) };
    cacheEstimaciones.set(clave, resumen);
    return resumen;
  } catch {
    // Sin datos: no se enseña nada de vídeos (y se reintentará otra vez).
    return { total: 0, bytes: null };
  }
}

// "0:04", "1:23", "12:05"
export function formatearDuracion(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${String(seg).padStart(2, '0')}`;
}

// Para compartir, se hace una copia temporal dentro de la app: así el menú
// de compartir (e Instagram) puede leerla sin problemas de permisos. Quien
// la pide debe llamar a borrarCopiaCompartida al terminar; por si acaso, al
// preparar una nueva se borran las anteriores. Solo una a la vez.
const CARPETA_COMPARTIR = `${FileSystem.cacheDirectory}compartir-video/`;

export async function prepararVideoParaCompartir(v: {
  id: string;
  uri: string;
  filename?: string;
}): Promise<string> {
  await FileSystem.deleteAsync(CARPETA_COMPARTIR, { idempotent: true }).catch(() => {});
  await FileSystem.makeDirectoryAsync(CARPETA_COMPARTIR, { intermediates: true });
  const extension = v.filename?.split('.').pop()?.toLowerCase() || 'mov';
  const destino = `${CARPETA_COMPARTIR}${Date.now()}.${extension}`;
  if (v.uri.startsWith('ph://')) {
    // iPhone: copia directa desde la fototeca (la versión editada si la hay).
    await FileSystem.copyAsync({ from: v.uri, to: destino });
    return destino;
  }
  // Android: la dirección ya es un fichero que se puede compartir.
  const info = await MediaLibrary.getAssetInfoAsync(v.id);
  return info.localUri ?? v.uri;
}

export async function borrarCopiaCompartida(url: string): Promise<void> {
  if (!url.startsWith(CARPETA_COMPARTIR)) return; // nunca toca nada fuera
  await FileSystem.deleteAsync(url, { idempotent: true }).catch(() => {});
}

// Cuánto ocupa (aprox.) cada vídeo de una lista y en total. Los que se
// pueden medir se miden; los demás (cámara lenta, Cine…) se estiman por su
// duración con la media de los medidos. Siempre se enseña como "unos X".
export async function tamanosAproximados(
  videos: { id: string; duracion: number; noMedible: boolean }[]
): Promise<{ porId: Record<string, number>; total: number; totalMedido: number }> {
  const porId: Record<string, number> = {};
  let bytesMedidos = 0;
  let segundosMedidos = 0;
  for (const v of videos) {
    if (v.noMedible) continue;
    const t = await tamanoDeFoto(v.id);
    if (t) {
      porId[v.id] = t;
      bytesMedidos += t;
      segundosMedidos += Math.max(v.duracion, 0.1);
    }
  }
  const bytesPorSegundo = segundosMedidos > 0 ? bytesMedidos / segundosMedidos : 0;
  for (const v of videos) {
    if (!(v.id in porId) && v.noMedible && bytesPorSegundo > 0) {
      porId[v.id] = Math.round(bytesPorSegundo * Math.max(v.duracion, 0.1));
    }
  }
  const total = Object.values(porId).reduce((a, b) => a + b, 0);
  // totalMedido: solo lo medido de verdad (lo que se suma al contador).
  return { porId, total, totalMedido: bytesMedidos };
}
