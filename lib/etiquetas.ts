import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_ETIQUETAS = 'grupos_etiquetas';

const MESES_ABREV = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

// Texto que se muestra cuando el usuario todavia no ha puesto nombre a la
// actividad de este grupo. Se muestra igual que un nombre real (tocable,
// no como un error o hueco vacio) para invitar a rellenarlo.
export const SIN_ETIQUETAR = 'Sin etiquetar';

// Cache en memoria para poder leer de forma sincrona desde el render de
// las listas, igual que en lib/revisados.ts. Se rellena una vez por
// sesion con inicializarEtiquetas().
let cache: Record<string, string> | null = null;

async function cargarCache(): Promise<Record<string, string>> {
  if (cache) return cache;
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_ETIQUETAS);
    cache = guardado ? JSON.parse(guardado) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

// Se llama una vez al arrancar la pantalla de listado, antes de pintar la
// lista, para que obtenerNombreActividad()/formatearEtiqueta() ya tengan
// datos disponibles.
export async function inicializarEtiquetas(): Promise<void> {
  await cargarCache();
}

// Lectura sincrona del nombre puesto por el usuario (sin formatear, sin
// fecha). Devuelve undefined si no hay nombre guardado todavia. Asume que
// inicializarEtiquetas() ya se ha llamado; si no, se comporta como si no
// hubiera nombre, nunca lanza un error.
export function obtenerNombreActividad(grupoId: string): string | undefined {
  return cache?.[grupoId];
}

export async function guardarNombreActividad(grupoId: string, nombre: string): Promise<void> {
  const actual = await cargarCache();
  const limpio = nombre.trim();
  cache = { ...actual };
  if (limpio) {
    cache[grupoId] = limpio;
  } else {
    delete cache[grupoId];
  }
  try {
    await AsyncStorage.setItem(CLAVE_ETIQUETAS, JSON.stringify(cache));
  } catch {
    // Si falla el guardado persistente, al menos queda en memoria para
    // esta sesion; no rompemos el flujo del usuario por esto.
  }
}

// Solo la parte de fecha (anio + mes), sin el nombre de actividad. Se usa
// como contexto fijo no editable en el modal de edicion.
export function formatearFecha(creationTime: number): string {
  const fecha = new Date(creationTime);
  const anio = fecha.getFullYear();
  const mes = MESES_ABREV[fecha.getMonth()];
  return `${anio} ${mes}`;
}

// Anio (4 digitos) + mes (3 letras) + nombre de actividad, en ese orden
// para que en el futuro se pueda buscar el mismo concepto a traves de
// varios anios (ej. "ski" deberia encontrar "2024 Ene · ski" y
// "2026 Ene · Benasque ski").
export function formatearEtiqueta(grupoId: string, creationTime: number): string {
  const nombre = obtenerNombreActividad(grupoId) ?? SIN_ETIQUETAR;
  return `${formatearFecha(creationTime)} · ${nombre}`;
}

// Palabras muy comunes que no aportan nada como "álbum" por si solas (ej.
// "Excursión de Bret" no deberia crear un album "de"). Deliberadamente no
// se filtra por longitud de palabra: nombres cortos como "Ana" o "Bob"
// tienen que seguir contando.
const PALABRAS_COMUNES = new Set([
  'de', 'la', 'el', 'en', 'con', 'un', 'una', 'unos', 'unas', 'los', 'las',
  'y', 'o', 'a', 'al', 'del', 'para', 'por', 'se', 'su', 'sus', 'mi', 'mis',
  'tu', 'tus', 'es', 'son', 'fue', 'ya', 'no', 'si', 'sí', 'más', 'mas',
  'tan', 'muy', 'pero', 'este', 'esta', 'estos', 'estas', 'ese', 'esa',
  'esos', 'esas', 'lo', 'le', 'les', 'nos', 'que', 'como', 'cuando', 'donde',
]);

// Divide el nombre de actividad en palabras "significativas" (para usar
// como álbumes independientes): quita signos de puntuación sueltos,
// descarta palabras muy comunes y palabras de menos de 3 letras, y
// elimina duplicados dentro del mismo nombre. Se conserva la mayúscula
// original de cada palabra (quien la use para mostrarla decide si la
// normaliza). Ej: "Excursión Bret" -> ["Excursión", "Bret"].
export function extraerPalabrasClave(nombre: string): string[] {
  const tokens = nombre
    .split(/\s+/)
    .map((token) => token.replace(/[.,;:!?¿¡"'()\[\]{}]/g, '').trim())
    .filter(Boolean);

  const vistas = new Set<string>();
  const resultado: string[] = [];

  for (const token of tokens) {
    if (token.length < 3) continue;
    const clave = token.toLowerCase();
    if (PALABRAS_COMUNES.has(clave)) continue;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    resultado.push(token);
  }

  return resultado;
}
