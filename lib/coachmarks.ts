import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_COACHMARKS = 'coachmarks_vistos';

// Cache en memoria para poder consultar de forma sincrona desde el render
// si un coachmark ya se ha visto, sin esperar a AsyncStorage en cada
// fotograma. Se rellena con inicializarCoachmarks().
let cache: Record<string, true> | null = null;

async function cargarCache(): Promise<Record<string, true>> {
  if (cache) return cache;
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_COACHMARKS);
    cache = guardado ? JSON.parse(guardado) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

// Se llama al entrar a una pantalla que use coachmarkVisto(), antes de
// pintar, para que la lectura sincrona ya tenga datos disponibles.
export async function inicializarCoachmarks(): Promise<void> {
  await cargarCache();
}

// Lectura sincrona: asume que inicializarCoachmarks() ya se ha llamado.
// Si todavia no se ha llamado, se comporta como "no visto" (false), para
// que el aviso destacado se muestre por defecto hasta que se confirme lo
// contrario.
export function coachmarkVisto(clave: string): boolean {
  return !!cache?.[clave];
}

// Marca un coachmark como visto para siempre (persistente en el
// dispositivo): a partir de este momento, en cualquier grupo, ese aviso
// deja de mostrarse destacado.
export async function marcarCoachmarkVisto(clave: string): Promise<void> {
  const actual = await cargarCache();
  if (actual[clave]) return;
  cache = { ...actual, [clave]: true };
  try {
    await AsyncStorage.setItem(CLAVE_COACHMARKS, JSON.stringify(cache));
  } catch {
    // Si falla el guardado persistente, al menos queda marcado en memoria
    // para esta sesion; no rompemos el flujo del usuario por esto.
  }
}
