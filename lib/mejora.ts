import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { toByteArray, fromByteArray } from 'base64-js';
import jpeg from 'jpeg-js';

// Redimensionamos antes de procesar: decodificar/codificar JPEG en JS puro
// a resolución completa (12+ megapíxeles de un iPhone) sería demasiado lento
// en el propio móvil. 1600px de ancho es de sobra para publicar en redes.
const ANCHO_MAXIMO = 1600;
const CALIDAD_JPEG = 90;

// Porcentaje de píxeles más oscuros/claros que se ignoran al calcular el
// rango de estiramiento, para que un puñado de píxeles extremos (un brillo
// de sol, una sombra muy cerrada) no arruinen el ajuste del resto de la foto.
const PERCENTIL_RECORTE = 0.01;

export type ResultadoMejora = {
  uri: string;
  ancho: number;
  alto: number;
};

export async function mejorarFoto(assetId: string): Promise<ResultadoMejora> {
  const info = await MediaLibrary.getAssetInfoAsync(assetId);
  const uriLocal = info.localUri ?? info.uri;

  const manipulado = await ImageManipulator.manipulateAsync(
    uriLocal,
    [{ resize: { width: ANCHO_MAXIMO } }],
    { base64: true, compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );

  const bytes = toByteArray(manipulado.base64!);
  const decodificado = jpeg.decode(bytes, { useTArray: true });
  const { width: ancho, height: alto, data } = decodificado;

  const dataMejorada = estirarContraste(data, ancho, alto);

  const codificado = jpeg.encode({ width: ancho, height: alto, data: dataMejorada }, CALIDAD_JPEG);
  const base64Mejorado = fromByteArray(new Uint8Array(codificado.data));

  const destino = `${FileSystem.cacheDirectory}mejora-${assetId}-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(destino, base64Mejorado, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { uri: destino, ancho, alto };
}

// Estira el histograma de cada canal de color (R, G, B) de forma
// independiente para que use todo el rango 0-255. Es el equivalente a "auto
// niveles" / "auto contraste" de apps como Lightroom o VSCO — no es IA
// generativa, es estadística clásica de imagen, pero da un salto visible en
// fotos que salen planas o apagadas.
function estirarContraste(
  data: Uint8ClampedArray | Uint8Array,
  ancho: number,
  alto: number
): Uint8Array {
  const totalPixeles = ancho * alto;
  const salida = new Uint8Array(data.length);

  for (let canal = 0; canal < 3; canal++) {
    const histograma = new Uint32Array(256);
    for (let i = 0; i < totalPixeles; i++) {
      histograma[data[i * 4 + canal]]++;
    }

    const limiteRecorte = Math.floor(totalPixeles * PERCENTIL_RECORTE);

    let minimo = 0;
    let acumulado = 0;
    for (let v = 0; v < 256; v++) {
      acumulado += histograma[v];
      if (acumulado > limiteRecorte) {
        minimo = v;
        break;
      }
    }

    let maximo = 255;
    acumulado = 0;
    for (let v = 255; v >= 0; v--) {
      acumulado += histograma[v];
      if (acumulado > limiteRecorte) {
        maximo = v;
        break;
      }
    }

    const rango = Math.max(maximo - minimo, 1);
    for (let i = 0; i < totalPixeles; i++) {
      const idx = i * 4 + canal;
      const valor = ((data[idx] - minimo) / rango) * 255;
      salida[idx] = Math.max(0, Math.min(255, Math.round(valor)));
    }
  }

  // El 4º byte por píxel (alfa/padding de jpeg-js) se copia tal cual.
  for (let i = 0; i < totalPixeles; i++) {
    salida[i * 4 + 3] = data[i * 4 + 3];
  }

  return salida;
}
