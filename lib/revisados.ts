import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_REVISADOS = 'grupos_revisados';

// Por debajo de este numero de fotos "extra" (todo lo que no es la
// ganadora) tras terminar el torneo, se considera que no merece la pena
// obligar a revisar el grupo otra vez: se marca como revisado en
// automatico para no repetir torneos con poca ganancia real.
export const UMBRAL_EXTRAS_AUTO_REVISADO = 5;

// Cache en memoria para poder consultar el estado de forma sincrona desde
// el render de las listas, sin esperar a AsyncStorage en cada fotograma.
// Se rellena una vez por sesion con inicializarRevisados().
let cache: Record<string, true> | null = null;

async function cargarCache(): Promise<Record<string, true>> {
  if (cache) return cache;
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_REVISADOS);
    cache = guardado ? JSON.parse(guardado) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

// Se llama una vez al arrancar la pantalla de listado, antes de pintar la
// lista, para que esRevisado() ya tenga datos disponibles.
export async function inicializarRevisados(): Promise<void> {
  await cargarCache();
}

// Lectura sincrona: asume que inicializarRevisados() ya se ha llamado.
// Si no se ha llamado todavia, se comporta como "no revisado" (false),
// nunca lanza un error.
export function esRevisado(grupoId: string): boolean {
  return !!cache?.[grupoId];
}

export async function marcarRevisado(grupoId: string): Promise<void> {
  const actual = await cargarCache();
  if (actual[grupoId]) return;
  cache = { ...actual, [grupoId]: true };
  try {
    await AsyncStorage.setItem(CLAVE_REVISADOS, JSON.stringify(cache));
  } catch {
    // Si falla el guardado persistente, al menos queda marcado en memoria
    // para esta sesion; no rompemos el flujo del usuario por esto.
  }
}

// Marca automaticamente como revisado si, tras terminar el torneo, el
// numero de fotos que no son la ganadora (se borren o no ya) es menor
// que el umbral.
export async function marcarRevisadoSiProcede(grupoId: string, numExtras: number): Promise<void> {
  if (numExtras < UMBRAL_EXTRAS_AUTO_REVISADO) {
    await marcarRevisado(grupoId);
  }
}
