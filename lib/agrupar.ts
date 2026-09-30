export type Foto = {
  id: string;
  creationTime: number;
};

export type GrupoFotos = {
  fotos: Foto[];
};

const UMBRAL_MS = 5000;

// Distancia máxima (sobre 64) entre dos fotos seguidas para considerarlas
// "casi iguales" con el hash visual. Por debajo o igual: misma escena.
//
// Ante la duda, separamos. Si juntamos dos fotos distintas, la app acaba
// ofreciendo borrar una foto que la usuaria sí quiere conservar. Si
// separamos dos parecidas, solo se pierde la detección de ese duplicado.
export const UMBRAL_PARECIDAS = 10;

// Parte una ráfaga allí donde cambia la escena. Recibe las distancias entre
// cada foto y la anterior (distancias[i] compara la foto i+1 con la i) y
// devuelve los índices de las fotos agrupados en tramos de fotos parecidas.
// Ej.: distancias [2, 25, 3] -> [[0, 1], [2, 3]]
export function partirPorParecido(distancias: number[], umbral = UMBRAL_PARECIDAS): number[][] {
  const tramos: number[][] = [[0]];
  distancias.forEach((distancia, i) => {
    if (distancia <= umbral) {
      tramos[tramos.length - 1].push(i + 1);
    } else {
      tramos.push([i + 1]);
    }
  });
  return tramos;
}

export function agruparPorTiempo(fotos: Foto[]): GrupoFotos[] {
  if (fotos.length === 0) return [];

  const ordenadas = [...fotos].sort((a, b) => a.creationTime - b.creationTime);

  const grupos: GrupoFotos[] = [];
  let grupoActual: Foto[] = [ordenadas[0]];

  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1];
    const actual = ordenadas[i];
    const diferencia = actual.creationTime - anterior.creationTime;

    if (diferencia <= UMBRAL_MS) {
      grupoActual.push(actual);
    } else {
      grupos.push({ fotos: grupoActual });
      grupoActual = [actual];
    }
  }

  grupos.push({ fotos: grupoActual });

  return grupos;
}
