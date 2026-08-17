import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { toByteArray } from 'base64-js';
import jpeg from 'jpeg-js';

const TAMANO_HASH = 8;

export async function calcularHash(assetId: string): Promise<string> {
  const info = await MediaLibrary.getAssetInfoAsync(assetId);
  const uriLocal = info.localUri ?? info.uri;

  const manipulado = await ImageManipulator.manipulateAsync(
    uriLocal,
    [{ resize: { width: TAMANO_HASH, height: TAMANO_HASH } }],
    { base64: true, compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );

  const bytes = toByteArray(manipulado.base64!);
  const decodificado = jpeg.decode(bytes, { useTArray: true });

  const grises: number[] = [];
  for (let i = 0; i < decodificado.data.length; i += 4) {
    const r = decodificado.data[i];
    const g = decodificado.data[i + 1];
    const b = decodificado.data[i + 2];
    grises.push((r + g + b) / 3);
  }

  const promedio = grises.reduce((a, b) => a + b, 0) / grises.length;

  let hash = '';
  for (const gris of grises) {
    hash += gris > promedio ? '1' : '0';
  }

  return hash;
}

export function distanciaHamming(hashA: string, hashB: string): number {
  let distancia = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) distancia++;
  }
  return distancia;
}
