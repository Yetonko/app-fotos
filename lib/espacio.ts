import * as FileSystem from 'expo-file-system/legacy';

// Por debajo de este umbral (en bytes) consideramos el espacio "crítico":
// es donde iOS empieza a ralentizarse y a fallar la cámara. Se muestra en
// coral para transmitir urgencia sin alarmar.
const UMBRAL_CRITICO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

// Convierte un número de bytes a un texto legible para el usuario:
// - 1 GB o más  -> "12,4 GB" (un decimal, coma como en español)
// - menos de 1 GB -> "640 MB" (sin decimales)
export function formatearBytes(bytes: number): string {
  if (bytes >= GB) {
    const gb = bytes / GB;
    return `${gb.toFixed(1).replace('.', ',')} GB`;
  }
  const mb = Math.round(bytes / MB);
  return `${mb} MB`;
}

export type EspacioLibre = {
  bytesLibres: number;
  texto: string; // ej. "12,4 GB"
  critico: boolean; // true si está por debajo del umbral
};

// Lee el espacio libre real del dispositivo. Devuelve null si la lectura
// falla (por ejemplo, en un entorno donde la API nativa no esté disponible),
// para que quien la use pueda decidir simplemente no mostrar el indicador
// en lugar de romper la pantalla.
export async function obtenerEspacioLibre(): Promise<EspacioLibre | null> {
  try {
    const bytesLibres = await FileSystem.getFreeDiskStorageAsync();
    return {
      bytesLibres,
      texto: formatearBytes(bytesLibres),
      critico: bytesLibres < UMBRAL_CRITICO_BYTES,
    };
  } catch {
    return null;
  }
}

// Cache en memoria del último valor leído, para poder pintarlo sin esperar
// a la API nativa en cada render. Igual patrón que revisados.ts / progreso.ts.
let cache: EspacioLibre | null = null;

// Lee el espacio y lo guarda en cache. Se llama al arrancar la Home.
// Devuelve el valor (o null si la lectura falla) para usarlo directamente.
export async function inicializarEspacio(): Promise<EspacioLibre | null> {
  cache = await obtenerEspacioLibre();
  return cache;
}

// Vuelve a leer el espacio (por ejemplo al volver del torneo, donde el
// usuario puede haber borrado fotos) y actualiza el cache.
export async function obtenerEspacioCache(): Promise<EspacioLibre | null> {
  cache = await obtenerEspacioLibre();
  return cache;
}
