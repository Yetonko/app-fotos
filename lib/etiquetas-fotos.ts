import AsyncStorage from '@react-native-async-storage/async-storage';

// Etiquetas puestas a mano a fotos sueltas ("Boda de Ana", "Menorca"), para
// agrupar por experiencias dentro de una época. Una foto tiene como mucho
// una etiqueta. Se guarda solo en el móvil.
//
// No confundir con lib/etiquetas.ts, que nombra los momentos (ráfagas).

const CLAVE = 'etiquetas_fotos';

let cache: Record<string, string> | null = null;

async function cargar(): Promise<Record<string, string>> {
  if (cache) return cache;
  try {
    const guardado = await AsyncStorage.getItem(CLAVE);
    cache = guardado ? JSON.parse(guardado) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

export async function inicializarEtiquetasFotos(): Promise<void> {
  await cargar();
}

export function etiquetaDeFoto(id: string): string | undefined {
  return cache?.[id];
}

// Nombres ya usados, el más repetido primero (para sugerirlos).
export function nombresUsados(): string[] {
  const cuenta = new Map<string, number>();
  for (const nombre of Object.values(cache ?? {})) {
    cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1);
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

export async function etiquetarFotos(ids: string[], nombre: string): Promise<void> {
  const limpio = nombre.trim();
  if (!limpio || ids.length === 0) return;
  const actual = await cargar();
  cache = { ...actual };
  for (const id of ids) cache[id] = limpio;
  try {
    await AsyncStorage.setItem(CLAVE, JSON.stringify(cache));
  } catch {
    // Queda en memoria esta sesión.
  }
}
