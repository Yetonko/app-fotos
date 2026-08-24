import { agruparPorTiempo, GrupoFotos } from './agrupar';
import { calcularHash, distanciaHamming } from './hash';

export type FotoConUri = { id: string; uri: string };

export type GrupoDetectado = GrupoFotos & {
  distancias: number[];
  fotosConUri: FotoConUri[];
  grupoId: string;
};

type OpcionesDeteccion = {
  // Se llama justo antes de procesar cada grupo (antes del hash), para
  // poder reflejar el avance en pantalla mientras se analiza.
  onProgreso?: (indice: number, total: number, primeraFotoUri: string) => void;
  // Se llama una vez calculado el hash de cada grupo, antes de pasar al
  // siguiente. Aquí es donde cada pantalla decide qué hacer con las fotos
  // del grupo (ej. Home aplica nitidez; Periodos no aplica ningún filtro).
  onGrupo?: (grupo: GrupoDetectado) => Promise<void> | void;
};

// Agrupa fotos por cercanía temporal y confirma cada grupo con hashing
// visual (aHash + distancia de Hamming). A propósito NO aplica ningún
// filtro de nitidez ni decide qué es una "buena" candidata — eso depende
// del caso de uso de quien llama (ver `onGrupo`).
export async function detectarRafagas(
  fotos: { id: string; uri: string; creationTime: number }[],
  opciones?: OpcionesDeteccion
): Promise<GrupoDetectado[]> {
  // Mapa id -> uri para poder recuperar el uri de cada foto más adelante,
  // ya que agruparPorTiempo solo trabaja con id y creationTime.
  const uriPorId = new Map(fotos.map((f) => [f.id, f.uri]));

  const paraAgrupar = fotos.map((f) => ({ id: f.id, creationTime: f.creationTime }));
  const gruposCalculados = agruparPorTiempo(paraAgrupar);
  const soloRafagas = gruposCalculados.filter((g) => g.fotos.length > 1);

  const resultado: GrupoDetectado[] = [];

  for (let indice = 0; indice < soloRafagas.length; indice++) {
    const grupo = soloRafagas[indice];

    opciones?.onProgreso?.(indice, soloRafagas.length, uriPorId.get(grupo.fotos[0].id) ?? '');

    // Se calculan los hashes de todas las fotos del grupo a la vez (en vez
    // de una por una) para aprovechar que el móvil puede decodificar varias
    // imágenes en paralelo.
    const hashes = await Promise.all(grupo.fotos.map((foto) => calcularHash(foto.id)));

    const distancias: number[] = [];
    for (let i = 1; i < hashes.length; i++) {
      distancias.push(distanciaHamming(hashes[i - 1], hashes[i]));
    }

    const fotosConUri: FotoConUri[] = grupo.fotos.map((foto) => ({
      id: foto.id,
      uri: uriPorId.get(foto.id) ?? '',
    }));

    // El id de la primera foto de la ráfaga (ordenadas por fecha) es un
    // identificador estable del grupo: a diferencia del índice en el
    // array, no cambia si la lista se recalcula en otra apertura de la
    // pantalla. Solo debería colisionar si dos ráfagas empiezan por la
    // misma foto exacta, lo cual no ocurre.
    const grupoId = grupo.fotos[0].id;

    const grupoDetectado: GrupoDetectado = { ...grupo, distancias, fotosConUri, grupoId };

    await opciones?.onGrupo?.(grupoDetectado);

    resultado.push(grupoDetectado);
  }

  return resultado;
}
