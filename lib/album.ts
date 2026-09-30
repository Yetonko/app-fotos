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
