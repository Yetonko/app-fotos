// Textos de Fondly en español.
//
// Es el diccionario de referencia: el inglés (en.ts, fase 4) tendrá
// exactamente la misma forma y TypeScript avisará si falta algún texto.
// Las funciones son textos que llevan datos dentro (números, precios...).
// Para cambiar una frase de la app, se cambia aquí y en ningún otro sitio.
import { formatearNumero } from '../idioma';

export const es = {
  comun: {
    intentaloMasTarde: 'Inténtalo de nuevo más tarde.',
    movil: 'móvil',
    // "1 foto" / "1.234 fotos"
    fotos: (n: number) => `${formatearNumero(n)} ${n === 1 ? 'foto' : 'fotos'}`,
  },

  paywall: {
    titulo: '¡Gran mes!',
    subtitulo: (selecciones: number, mbLiberados: number) =>
      `Has elegido tus ${selecciones} mejores fotos` +
      (mbLiberados > 0 ? ` y liberado ${mbLiberados} MB` : ''),
    ciclo: (dias: number) =>
      `Tu ciclo gratuito se renueva en ${dias} día${dias !== 1 ? 's' : ''}`,
    popular: 'Popular',
    ilimitadoTitulo: 'Ilimitado',
    precioMensual: (precio: string) => `${precio}/mes`,
    ilimitadoDescripcion: 'Elige sin límites, todos los meses',
    suscribirme: 'Suscribirme',
    packTitulo: 'Pack de 50',
    packDescripcion: '50 selecciones extra, sin caducidad',
    comprarPack: 'Comprar pack',
    restaurar: 'Restaurar compras',
    terminos: 'Términos',
    privacidad: 'Privacidad',
    volverInicio: 'Volver al inicio',
    ahoraNo: 'Ahora no',
    // Avisos
    noDisponible: 'No disponible',
    errorCargaSuscripcion:
      'No hemos podido cargar la suscripción. Inténtalo de nuevo en unos minutos.',
    errorCargaPack: 'No hemos podido cargar el pack. Inténtalo de nuevo en unos minutos.',
    compraFallida: 'No se pudo completar la compra',
    listo: '¡Listo!',
    packAnadido: 'Se han añadido 50 selecciones a tu cuenta.',
    restauradasTitulo: 'Compras restauradas',
    restauradasTexto: 'Tu suscripción está activa.',
    nadaRestaurarTitulo: 'Nada que restaurar',
    nadaRestaurarTexto: 'No hemos encontrado compras previas en esta cuenta de Apple.',
    restaurarFallido: 'No se pudo restaurar',
  },

  albumes: {
    titulo: 'Tus momentos',
    vacio:
      'Aquí se guardarán tus fotos elegidas, mes a mes. Empieza eligiendo tu primer momento en Home.',
    fotosElegidas: (n: number) => `${n} ${n === 1 ? 'foto elegida' : 'fotos elegidas'}`,
  },

  periodos: {
    titulo: 'Tus recuerdos por épocas',
    subtitulo: 'Revive cada época y quédate con lo mejor',
    cargando: 'Revisando tu carrete por periodos...',
    vacio: 'No hemos encontrado fotos en tu carrete todavía.',
    revisado: '  ·  Revisado ✓',
    avisoMuchasFotos: 'Son bastantes fotos, puede tardar un poco más',
    errorPermisos: (dispositivo: string) =>
      `No hemos podido acceder a tus fotos. Revisa los permisos en Ajustes de tu ${dispositivo}.`,
    errorCarga: 'No hemos podido revisar tus periodos. Inténtalo de nuevo.',
  },
};
