import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

import { formatearDecimal } from './idioma';

// Tamaño en disco de UNA foto, o null si no se puede saber sin descargarla
// (p. ej. está solo en iCloud). Nunca descarga nada de la red.
async function tamanoDeFoto(id: string): Promise<number | null> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: false });
    if (!info.localUri) return null;
    const datos = await FileSystem.getInfoAsync(info.localUri);
    return datos.exists && typeof datos.size === 'number' ? datos.size : null;
  } catch {
    return null;
  }
}

// Suma el tamaño de un conjunto de fotos, para decir cuánto espacio se ha
// liberado al borrarlas. Las que no se pueden medir no cuentan.
export async function calcularTamanoTotal(ids: string[]): Promise<number> {
  let total = 0;
  for (const id of ids) {
    total += (await tamanoDeFoto(id)) ?? 0;
  }
  return total;
}

// "350 MB", "1,2 GB"... Vacío si no hay nada que mostrar.
export function formatearTamano(bytes: number): string {
  if (bytes <= 0) return '';
  const MB = 1024 * 1024;
  if (bytes >= 1024 * MB) return `${formatearDecimal(bytes / (1024 * MB), 1)} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Estimación barata de cuánto ocupan las fotos de un rango de fechas: mide
// unas pocas repartidas por el rango y multiplica la media por el total.
// Por eso se muestra siempre como "unos X". null si no se pudo medir ninguna.
const MUESTRA = 6;
const cacheEstimaciones = new Map<string, number | null>();

// Tras borrar fotos, las estimaciones guardadas ya no valen.
export function invalidarEstimaciones(): void {
  cacheEstimaciones.clear();
}

export async function estimarTamanoRango(
  clave: string,
  desde: number,
  hasta: number,
  totalFotos: number
): Promise<number | null> {
  if (cacheEstimaciones.has(clave)) return cacheEstimaciones.get(clave)!;
  if (totalFotos <= 0) return null;

  const tamanos: number[] = [];
  try {
    // Una sola consulta (solo datos, sin abrir fotos) y una muestra
    // repartida entre ellas.
    const pagina = await MediaLibrary.getAssetsAsync({
      mediaType: 'photo',
      createdAfter: desde,
      createdBefore: hasta,
      first: Math.min(totalFotos, 200),
    });
    const fotos = pagina.assets;
    const salto = Math.max(1, Math.floor(fotos.length / MUESTRA));
    for (let i = 0; i < fotos.length && tamanos.length < MUESTRA; i += salto) {
      const t = await tamanoDeFoto(fotos[i].id);
      if (t) tamanos.push(t);
    }
  } catch {
    // Sin muestra: no se enseña estimación.
  }

  const estimacion =
    tamanos.length === 0
      ? null
      : Math.round((tamanos.reduce((a, b) => a + b, 0) / tamanos.length) * totalFotos);
  cacheEstimaciones.set(clave, estimacion);
  return estimacion;
}
