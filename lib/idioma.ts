// Idioma de la app: meses y numeros segun el idioma del iPhone.
//
// Mientras la traduccion al ingles no este terminada, INGLES_ACTIVADO = false
// fuerza espanol en todo, para que nadie vea la app mezclando idiomas.
// Al terminar la traduccion, se pone a true (y se sustituira la deteccion por
// expo-localization junto con el resto del sistema de textos).
const INGLES_ACTIVADO = false;

export type Idioma = 'es' | 'en';

function detectarIdioma(): Idioma {
  if (!INGLES_ACTIVADO) return 'es';
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'es';
    return locale.toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'es';
  }
}

export const IDIOMA: Idioma = detectarIdioma();
export const LOCALE = IDIOMA === 'es' ? 'es-ES' : 'en-US';

// Escritos a mano (no Intl) para que el espanol quede exactamente igual que
// antes: 'Ene', 'Sep'... y no 'ene.' o 'sept' segun la version de iOS.
const MESES_LARGOS: Record<Idioma, string[]> = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December'],
};

const MESES_CORTOS: Record<Idioma, string[]> = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
       'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

// mes: 0-11, como devuelve Date.getMonth()
export function nombreMesLargo(mes: number): string {
  return MESES_LARGOS[IDIOMA][mes];
}

export function nombreMesCorto(mes: number): string {
  return MESES_CORTOS[IDIOMA][mes];
}

export function formatearNumero(n: number): string {
  return n.toLocaleString(LOCALE);
}
