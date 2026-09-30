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
    intentaloDeNuevo: 'Inténtalo de nuevo.',
    cancelar: 'Cancelar',
    revisado: '  ·  Revisado ✓',
    elegirMejorFoto: 'Elegir la mejor foto ✨',
    // Tras borrar, cómo recuperar las fotos. En Android varía según el
    // fabricante, así que ahí no prometemos días ni nombre de carpeta.
    recuperacionIos:
      'Podrás recuperarlas desde "Eliminados recientemente" durante 30 días si cambias de opinión.',
    recuperacionAndroid: 'Podrás recuperarlas desde Eliminados recientemente si cambias de opinión.',
    // Aviso "borrar todas las fotos de un momento" (Home y Periodo)
    borrarTodo: {
      titulo: 'Borrar todas las fotos',
      mensaje: (n: number, recuperacion: string) =>
        `Se ${n === 1 ? 'borrará' : 'borrarán'} ${n} ${n === 1 ? 'foto' : 'fotos'} de este momento, sin elegir ninguna. ${recuperacion}`,
      boton: 'Borrar todas',
      nadaBorradoTitulo: 'No se ha borrado nada',
      nadaBorradoTexto: 'Cancelaste la confirmación del sistema. Tus fotos siguen en el carrete.',
      errorTitulo: 'No hemos podido eliminar las fotos.',
      errorTexto: 'Revisa los permisos e inténtalo de nuevo.',
    },
  },

  home: {
    insigniaPrivacidad: (dispositivo: string) => `🔒 100% en tu ${dispositivo}`,
    espacioLibre: (espacio: string, critico: boolean) =>
      `${critico ? 'Solo te quedan ' : 'Te quedan '}${espacio} libres`,
    elegidasHoy: (n: number) => `Llevas ${n}${n === 1 ? ' elegida' : ' elegidas'} hoy ✨`,
    tituloTarjeta: (fecha: string, n: number) => `${fecha} · ${n} fotos`,
    volverAElegir: 'Volver a elegir',
    revisarYLimpiar: 'Revisar y limpiar ✨',
    explorarTitulo: '📅 Revisar fotos más antiguas',
    explorarSubtitulo: 'Elige tus mejores momentos de otros periodos',
    // Frases que rotan mientras se escanea el carrete
    frasesEscaneo: [
      'Mirando tus fotos con cariño…',
      'Agrupando lo que va junto…',
      'Buscando tus mejores momentos…',
      'Casi está…',
    ],
  },

  momento: {
    titulo: '⚡ Momento',
    subtitulo: 'Súbelo antes de que se acabe',
    ventana5min: 'Últimos 5 min',
    ventana1h: 'Última hora',
    ventanaHoy: 'Hoy',
    vacio: 'No hay fotos en este rango. Prueba a ampliar la ventana de tiempo.',
    publicar: 'Publicar',
    quitar: 'Quitar',
    descartar: 'Descartar',
    preparando: 'Preparando...',
    publicarN: (n: number) => `Publicar ${n} ${n === 1 ? 'foto' : 'fotos'}`,
    listasTitulo: '¡Tus fotos están listas!',
    listasTexto: (n: number) =>
      `Hemos guardado tus ${n} fotos juntas en tu álbum Fondly. Ábrelo desde Instagram para publicarlas como carrusel.`,
    entendido: 'Entendido',
    errorCompartir: 'No hemos podido abrir las opciones para compartir.',
    borrarDescartadasTitulo: '¿Borrar las descartadas?',
    borrarDescartadasTexto: (n: number) =>
      `Descartaste ${n} ${n === 1 ? 'foto' : 'fotos'}. ¿Quieres borrarlas del carrete para hacer sitio? Podrás recuperarlas 30 días desde Fotos.`,
    noDejarlas: 'No, dejarlas',
    borrar: 'Borrar',
  },

  // Pantalla de un periodo concreto (al tocar una tarjeta de Periodos)
  periodo: {
    volver: '‹ Volver',
    tituloPorDefecto: 'Periodo',
    vacio: 'No hemos encontrado fotos casi iguales en este periodo.',
    tituloTarjeta: (numero: number, n: number) => `Momento ${numero} · ${n} fotos casi iguales`,
    ningunaDeEstas: '🗑 No quiero ninguna de estas',
    frasesEscaneo: [
      'Mirando tus fotos con cariño…',
      'Agrupando lo que va junto…',
      'Reviviendo esta época…',
      'Casi está…',
    ],
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
    avisoMuchasFotos: 'Son bastantes fotos, puede tardar un poco más',
    errorPermisos: (dispositivo: string) =>
      `No hemos podido acceder a tus fotos. Revisa los permisos en Ajustes de tu ${dispositivo}.`,
    errorCarga: 'No hemos podido revisar tus periodos. Inténtalo de nuevo.',
  },
};
