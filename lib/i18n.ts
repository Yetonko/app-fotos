// Textos de la app según el idioma.
//
// Uso en cualquier pantalla:  import { T } from '@/lib/i18n';
//                             <Text>{T.paywall.titulo}</Text>
//
// Mientras no exista en.ts (fase 4), todos los idiomas usan español.
import { IDIOMA, Idioma } from './idioma';
import { es } from './textos/es';

export type Textos = typeof es;

const DICCIONARIOS: Record<Idioma, Textos> = {
  es,
  en: es, // fase 4: sustituir por el diccionario en inglés
};

export const T: Textos = DICCIONARIOS[IDIOMA];
