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
    ahoraNo: 'Ahora no',
    publicar: 'Publicar',
    borrar: 'Borrar',
    descartar: 'Descartar',
    volver: 'Volver',
    volverAMisFotos: 'Volver a mis fotos',
    listo: '¡Listo!',
    errorCompartir: 'No hemos podido abrir las opciones para compartir.',
    // Nombre de actividad cuando la usuaria aún no ha puesto ninguno
    sinEtiquetar: 'Sin etiquetar',
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
      nadaBorradoTexto: 'Tus fotos siguen en el carrete, no ha cambiado nada.',
      // En iPhone, cancelar el aviso del sistema llega como "error": por
      // eso este texto no culpa a nadie y dice lo único seguro.
      errorTitulo: 'No se ha borrado nada',
      errorTexto: 'Tus fotos siguen en el carrete. Si querías borrarlas, inténtalo de nuevo.',
    },
  },

  home: {
    titulo: 'Inicio',
    insigniaPrivacidad: (dispositivo: string) => `🔒 100% en tu ${dispositivo}`,
    espacioLibre: (espacio: string, critico: boolean) =>
      `${critico ? 'Solo te quedan ' : 'Te quedan '}${espacio} libres`,
    elegidasHoy: (n: number) => `Llevas ${n}${n === 1 ? ' elegida' : ' elegidas'} hoy ✨`,
    tituloTarjeta: (fecha: string, n: number) => `${fecha} · ${n} fotos`,
    volverAElegir: 'Volver a elegir',
    revisarYLimpiar: 'Revisar y limpiar ✨',
    explorarTitulo: 'Revisar fotos más antiguas',
    explorarSubtitulo: 'Elige tus mejores momentos de otros periodos',
    // Si no nos da permiso para ver sus fotos
    sinPermisoTitulo: 'Necesitamos ver tus fotos',
    sinPermisoTexto: (dispositivo: string) =>
      `Para encontrar tus mejores momentos, Fondly tiene que poder ver tus fotos. Se quedan en tu ${dispositivo}: no se suben a ningún sitio.\n\nAbre Ajustes y deja que Fondly vea tus fotos. Al volver, empezamos solas.`,
    abrirAjustes: 'Abrir Ajustes',
    // Frases que rotan mientras se escanea el carrete
    frasesEscaneo: [
      'Mirando tus fotos con cariño…',
      'Agrupando lo que va junto…',
      'Buscando tus mejores momentos…',
      'Casi está…',
    ],
  },

  momento: {
    titulo: 'Ahora',
    subtitulo: 'Elige tus fotos de hace un rato y compártelas',
    ventana5min: 'Últimos 5 min',
    ventana1h: 'Última hora',
    ventanaHoy: 'Hoy',
    vacio: 'No hay fotos en este rango. Prueba a ampliar la ventana de tiempo.',
    publicar: 'Elegir',
    quitar: 'Quitar',
    descartar: 'Descartar',
    preparando: 'Preparando...',
    publicarN: (n: number) => `Publicar ${n} ${n === 1 ? 'foto' : 'fotos'}`,
    listasTitulo: '¡Tus fotos están listas!',
    listasTexto: (n: number) =>
      `Hemos guardado tus ${n} fotos juntas en tu álbum Fondly. Ábrelo desde Instagram para publicarlas como carrusel.`,
    entendido: 'Entendido',
    borrarDescartadasTitulo: '¿Borrar las descartadas?',
    borrarDescartadasTexto: (n: number) =>
      `Descartaste ${n} ${n === 1 ? 'foto' : 'fotos'}. ¿Quieres borrarlas del carrete para hacer sitio? Podrás recuperarlas 30 días desde Fotos.`,
    noDejarlas: 'No, dejarlas',
    borrar: 'Borrar',
  },

  // Pantalla de un periodo concreto (al tocar una tarjeta de Periodos)
  periodo: {
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
    titulo: 'Elegidas',
    vacio:
      'Aquí se guardarán tus fotos elegidas, mes a mes. Empieza eligiendo tu primer momento en Inicio.',
    fotosElegidas: (n: number) => `${n} ${n === 1 ? 'foto elegida' : 'fotos elegidas'}`,
  },

  // Nombres de las pestañas de abajo
  pestanas: {
    home: 'Inicio',
    momento: 'Ahora',
    periodos: 'Épocas',
    albumes: 'Elegidas',
  },

  // Pantallas de bienvenida (primera vez que se abre la app)
  bienvenida: {
    atras: 'Atrás',
    siguiente: 'Siguiente',
    empezar: 'Empezar',
    paso1Titulo: 'Encuentra tu mejor foto\ny publícala',
    paso1Texto:
      'Agrupamos las fotos parecidas de un mismo momento. Tú eliges la que más te gusta y la compartes al momento — sin vueltas. De paso, haces sitio para el siguiente.',
    paso2Titulo: 'Una foto cada vez',
    paso2Texto:
      'Vamos momento a momento, sin prisa. No borramos nada que tú no decidas: aquí tú tienes el control.',
    paso3Titulo: 'Tus fotos son solo tuyas',
    paso3Texto: (dispositivo: string) =>
      `Todo pasa aquí, en tu ${dispositivo}. Ninguna foto sale de aquí: no hay servidores, no hay copias en la nube, no hay nadie más mirando.`,
  },

  // Pantalla de un álbum mensual (al tocar uno en Álbumes)
  album: {
    tituloPorDefecto: 'Álbum',
  },

  // Ventana para poner nombre a una actividad
  etiqueta: {
    titulo: 'Nombre de la actividad',
    ejemplo: 'Ej. Benasque ski',
    guardar: 'Guardar',
    quitar: 'Quitar etiqueta',
  },

  // Visor de foto ampliada
  visor: {
    cerrar: '✕ Cerrar',
  },

  // Torneo y pantalla de la foto elegida
  seleccion: {
    // Torneo
    cargando: 'Un momento...',
    cualPrefieres: '¿Cuál prefieres?',
    pista: 'Elige la que mejor representa el momento.',
    pistaGrupo: (n: number) => `Elige tu favorita de estas ${n}. Tranquila, aquí no se borra nada.`,
    pistaGestos: 'Toca dos veces para elegir · toca una vez para ampliar',
    vs: 'vs',
    // Si no se encuentra el grupo
    noEncontrado: 'No encontramos este momento',
    noEncontradoTexto: 'Puede que la app se haya reiniciado. Vuelve a la lista y ábrela de nuevo.',
    // Foto elegida
    laElegida: '¡Esta es la elegida! ✨',
    guardadaEnAlbum: '✓ Ya está en tu álbum Fondly',
    compartir: 'Compartir o publicar',
    seguirConOtras: (n: number) =>
      n === 1 ? 'Siguiente: qué hago con la otra' : `Siguiente: qué hago con las otras ${n}`,
    masOpciones: 'Más opciones',
    // Mejora de brillo
    darBrillo: 'Dar un toque de brillo ✨',
    mejorando: 'Mejorando la luz y el contraste...',
    versionMejorada: 'Versión mejorada',
    guardarEnCarrete: 'Guardar en el carrete',
    errorMejorar: 'No hemos podido mejorar esta foto.',
    pruebaDeNuevo: 'Prueba de nuevo.',
    guardadaTitulo: '¡Guardada!',
    guardadaTexto: 'La nueva versión ya está en tu carrete.',
    errorGuardarMejora: 'No hemos podido guardar la versión mejorada.',
    // Limpiar el resto
    ningunaBorrarTambien: 'Borrar todas, también la elegida',
    otrasTitulo: (n: number) => (n === 1 ? '¿Y la otra foto?' : `¿Y las otras ${n}?`),
    otrasSubtitulo:
      'Toca las que quieras guardar también. Las demás irán a "Eliminados recientemente".',
    calculandoEspacio: 'Calculando cuánto espacio ganas...',
    vasALiberar: (tamano: string) => `Vas a liberar ${tamano}`,
    sinEspacioALiberar: 'Te las quedas todas',
    pistaLupa: 'Toca la lupa para verla en grande',
    borrosa: 'Borrosa',
    eliminando: 'Borrando...',
    borrarN: (n: number) => `Borrar ${n} ${n === 1 ? 'foto' : 'fotos'}`,
    quedarmelasTodas: 'Quedármelas todas',
    volverAMiFoto: 'Volver a mi foto',
    // Avisos de borrado
    borrarFotosTitulo: 'Borrar fotos',
    borrarFotosTexto: (n: number, recuperacion: string) =>
      `Se ${n === 1 ? 'borrará' : 'borrarán'} ${n} ${n === 1 ? 'foto' : 'fotos'} de este momento. ${recuperacion}`,
    borrarTodoTexto: (n: number, recuperacion: string) =>
      `Se ${n === 1 ? 'borrará' : 'borrarán'} ${n} ${n === 1 ? 'foto' : 'fotos'} de este momento, incluida la que elegiste. ${recuperacion}`,
    hasLiberado: (tamano: string) => `Has liberado ${tamano} de espacio.`,
    borradasNoElegidas: 'Se han borrado las fotos que no elegiste.',
    borradasTodas: 'Se han borrado todas las fotos de este momento.',
  },

  periodos: {
    titulo: 'Épocas',
    subtitulo: 'Haz sitio repasando tus fotos antiguas',
    cargando: 'Revisando tu carrete por periodos...',
    vacio: 'No hemos encontrado fotos en tu carrete todavía.',
    avisoMuchasFotos: 'Son bastantes fotos, puede tardar un poco más',
    errorPermisos: (dispositivo: string) =>
      `No hemos podido acceder a tus fotos. Revisa los permisos en Ajustes de tu ${dispositivo}.`,
    errorCarga: 'No hemos podido revisar tus periodos. Inténtalo de nuevo.',
  },
};
