import * as MediaLibrary from 'expo-media-library';

// Nombre del álbum propio donde se guardan las fotos elegidas, para que el
// usuario las tenga juntas y listas para publicar desde la app Fotos.
const NOMBRE_ALBUM = 'Fondly';
// Nombre usado hasta sept 2026. Si ya existe, se sigue usando ese album para
// no crear un duplicado en el carrete de quien ya tenia la app.
const NOMBRE_ALBUM_ANTIGUO = 'Fondly · Favoritas';

// Guarda un asset (la ganadora) en el álbum de favoritas, creándolo la
// primera vez. Devuelve true si se guardó, false si algo falló.
//
// copyAsset=true es importante en iOS: añade una copia al álbum dejando la
// foto original intacta en el carrete. Con false, iOS movería el asset y
// podría sacarlo del flujo principal, lo que confundiría al usuario.
export async function guardarEnAlbumFavoritas(assetId: string): Promise<boolean> {
  try {
    const existente =
      (await MediaLibrary.getAlbumAsync(NOMBRE_ALBUM)) ??
      (await MediaLibrary.getAlbumAsync(NOMBRE_ALBUM_ANTIGUO));
    if (existente) {
      return await MediaLibrary.addAssetsToAlbumAsync([assetId], existente, true);
    }
    // createAlbumAsync crea el álbum ya con el primer asset dentro.
    const creado = await MediaLibrary.createAlbumAsync(NOMBRE_ALBUM, assetId, true);
    return !!creado;
  } catch {
    return false;
  }
}

// Junta varias fotos en un álbum propio con el nombre indicado (uno por
// carrusel), para elegirlas de una vez desde Instagram. En iOS un álbum solo
// guarda referencias: no duplica fotos ni ocupa espacio. Si el álbum ya
// existe (repite el carrusel), se reutiliza. Devuelve true si todo fue bien.
export async function guardarEnAlbumCarrusel(nombre: string, assetIds: string[]): Promise<boolean> {
  if (assetIds.length === 0) return false;
  try {
    const existente = await MediaLibrary.getAlbumAsync(nombre);
    if (existente) {
      return await MediaLibrary.addAssetsToAlbumAsync(assetIds, existente, true);
    }
    const [primera, ...resto] = assetIds;
    const creado = await MediaLibrary.createAlbumAsync(nombre, primera, true);
    if (!creado) return false;
    return resto.length === 0 || (await MediaLibrary.addAssetsToAlbumAsync(resto, creado, true));
  } catch {
    return false;
  }
}
