import AsyncStorage from '@react-native-async-storage/async-storage';
import { FotoCandidata } from './torneo';

const CLAVE_MOMENTOS = 'momentos_guardados';

export type MomentoGuardado = {
  grupoId: string;
  ganadoraId: string;
  ganadoraUri: string;
  creationTime: number;
};

// Cache en memoria para lectura sincrona desde el render, mismo patron que
// revisados.ts / etiquetas.ts. Se rellena una vez por sesion con
// inicializarMomentos().
let cache: Record<string, MomentoGuardado> | null = null;

async function cargarCache(): Promise<Record<string, MomentoGuardado>> {
  if (cache) return cache;
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_MOMENTOS);
    cache = guardado ? JSON.parse(guardado) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

export async function inicializarMomentos(): Promise<void> {
  await cargarCache();
}

// Guarda de forma permanente la foto ganadora de un grupo, junto con la
// fecha del momento. Se llama justo cuando termina el torneo (independiente
// de si el grupo tiene o no un nombre de actividad puesto: el nombre se
// puede añadir despues, y Álbumes lo consulta en el momento de mostrarse,
// no aqui). Si ya existia un registro para este grupoId, se sobreescribe
// (por si el usuario vuelve a elegir otra ganadora distinta).
export async function registrarMomento(
  grupoId: string,
  ganadora: FotoCandidata,
  creationTime: number
): Promise<void> {
  const actual = await cargarCache();
  cache = {
    ...actual,
    [grupoId]: {
      grupoId,
      ganadoraId: ganadora.id,
      ganadoraUri: ganadora.uri,
      creationTime,
    },
  };
  try {
    await AsyncStorage.setItem(CLAVE_MOMENTOS, JSON.stringify(cache));
  } catch {
    // Si falla el guardado persistente, al menos queda en memoria para
    // esta sesion; no rompemos el flujo del usuario por esto.
  }
}

// Lectura sincrona de todos los momentos guardados. Asume que
// inicializarMomentos() ya se ha llamado; si no, devuelve una lista vacia
// en vez de lanzar un error.
export function obtenerMomentos(): MomentoGuardado[] {
  return cache ? Object.values(cache) : [];
}
