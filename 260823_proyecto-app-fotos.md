# Fondly (antes "app-fotos") — Proyecto de Aprendizaje

## Contexto y objetivo

Primer proyecto de desarrollo de apps móviles (iOS/Android), con fin de aprendizaje. Es una de dos apps planeadas: esta es la "generalista" (mainstream, de uso cotidiano); la segunda estará orientada a medios de pago/BTC/stablecoins.

El producto se rebautizó de "app-fotos" a **Fondly** durante el desarrollo. El nombre del repositorio, la carpeta local y el `slug` de Expo siguen siendo los antiguos — es uno de los pendientes antes de publicar (ver "Bloqueantes de tienda").

Existe interés en explorar el modelo de monetización por pago por uso/suscripción con esta app como campo de pruebas.

**Público objetivo**: mujeres de 17 a 50 años, usuarias intensivas de redes sociales (Instagram, WhatsApp).

## Idea del producto

App de **utilidad para fotos**, no documental ni legal — orientada al gran público.

Problema que resuelve: el carrete del móvil se llena de fotos repetidas de una misma escena (varios intentos de la misma foto) y cuesta decidir cuál conservar, cuál compartir y cuál borrar.

Funcionalidad core:
1. **Agrupar fotos parecidas** del carrete (ej. detectar que varias fotos seguidas son la misma escena/momento)
2. **Elegir la mejor foto** de cada grupo mediante un torneo de comparación 1 contra 1
3. Compartir la ganadora, darle un toque de mejora automática, y borrar el resto liberando espacio
4. (Fase posterior) Mejora de foto asistida por IA

Diferenciador frente a limpiadores de espacio genéricos (Gemini Photos, Slidebox, "Fotos similares" de Google Photos): no es solo liberar espacio, es ayudar a elegir la foto que de verdad se va a compartir en redes — la selección es participativa y subjetiva (pose, mirada, expresión), no un criterio puramente técnico.

## Repositorio

Código en GitHub (público): github.com/Yetonko/app-fotos
Ruta local: `/Users/mariopalomar/Claude Projects/App-photos/app-fotos./` (el punto final en el nombre de carpeta es intencional, no un error)

## Estado actual del código

### Estructura relevante
- `app/(tabs)/index.tsx` — pantalla principal: pide permisos, escanea el carrete, agrupa y muestra la lista de grupos
- `app/bienvenida.tsx` — onboarding de dos pasos, se ve una sola vez antes del primer permiso
- `app/seleccion.tsx` — torneo de comparación 1 contra 1 y pantalla de ganadora (compartir / mejorar / borrar)
- `app/_layout.tsx` — Stack raíz (registra `(tabs)`, `bienvenida`, `seleccion`, `modal`)
- `lib/agrupar.ts` — agrupación por proximidad temporal (umbral 5 segundos)
- `lib/hash.ts` — perceptual hashing (average hash 8×8, distancia de Hamming) para confirmar parecido visual dentro de cada grupo temporal
- `lib/nitidez.ts` — filtro Laplaciano + varianza (`UMBRAL_BORROSA = 1200`) para descartar fotos borrosas, con salvaguarda que rescata la más nítida si un grupo se queda sin candidatas
- `lib/torneo.ts` — lógica pura del torneo de eliminación 1 contra 1 (sin dependencias de React Native)
- `lib/gruposElegidos.ts` — store en memoria: guarda candidatas + descartadas + ganadora de cada grupo, indexado por `grupoId`
- `lib/onboarding.ts` — clave de `AsyncStorage` para recordar si ya se vio el onboarding
- `lib/mejora.ts` — mejora automática de la foto (contraste) vía `jpeg-js`

### Stack técnico
- **Expo (React Native)**, SDK 54, Expo Router ~6.0.24, TypeScript
- `expo-media-library`: acceso al carrete
- `expo-image-manipulator` + `jpeg-js` + `base64-js`: hashing y mejora de imagen en JS puro, sin módulos nativos, compatible con Expo Go
- `@react-native-async-storage/async-storage`: persistencia del estado "onboarding visto" en el propio dispositivo
- Todos los textos de usuario y comentarios de código en español

## Seguridad — auditoría y correcciones (completado)

Se recibió una auditoría de seguridad externa antes de acercarse a la publicación en tienda. Los tres hallazgos críticos, todos corregidos y probados en dispositivo real:

1. **Fixture `CANDIDATAS_PRUEBA` eliminado de `seleccion.tsx`**: contenía ids con pinta de asset real; si el parseo de parámetros fallaba, la app podía acabar operando (y potencialmente borrando) sobre esos ids de relleno.
2. **Navegación sin datos sensibles en la URL**: `candidatas` y `descartadas` ya no viajan como JSON en los parámetros de ruta. Solo se pasa un `grupoId` estable; los datos reales se leen de `lib/gruposElegidos.ts`, un store en memoria que solo la propia app rellena a partir de una consulta real al carrete en esta sesión. Un deep link externo no puede colar fotos ni ids falsos.
3. **`grupoId` estable**: pasó de ser `String(index)` (cambia si la lista se recalcula) a ser el `id` de la primera foto del grupo (estable entre recargas).
4. **Pantalla de aviso en vez de datos de relleno**: si `seleccion.tsx` recibe un `grupoId` que no existe en el store (deep link inventado, o app reiniciada y store vacío), se muestra un aviso claro con botón de vuelta — nunca se rellena con datos de prueba.

## Rediseño de UX (completado: Bloques A, B y C)

Diagnóstico de partida: la app se construyó en el orden en que tiene sentido programarla (agrupar → seleccionar → mejorar), y ese orden técnico se había quedado pegado a la experiencia de usuario, sin reflejar el beneficio real ni generar confianza antes de pedir acceso a las fotos.

### Bloque A — Copy (completado)
- Eliminado el término "ráfaga" del texto visible al usuario (sigue existiendo internamente en comentarios de código, sin impacto); ahora se habla de "grupos de fotos casi iguales"
- Título de "¿Cuál prefieres?" mantenido sin cambios (decisión explícita de Mario)
- Pista de zoom ("Toca la foto para ampliarla y comparar bien") visible solo en la primera comparación de cada grupo, para no repetirla en cada pareja de fotos

### Bloque B — Onboarding y confianza (completado)
- `app/bienvenida.tsx`: dos pantallas antes del primer permiso — paso 1 con el beneficio ("Quédate con la mejor. Suelta el resto."), paso 2 con la promesa de privacidad, mencionando el dispositivo detectado
- Detección automática de dispositivo (`Platform.OS`): "iPhone" en iOS, "móvil" en Android, sin librerías nuevas — reutilizado en la bienvenida y en la insignia de privacidad de la pantalla principal
- Insignia discreta y permanente "🔒 100% en tu iPhone/móvil" bajo el título de la pantalla principal — mensaje de privacidad dicho fuerte y claro una vez en el onboarding, y recordado con moderación después (evitar la sensación de "protestar demasiado" si se repite en cada pantalla)
- Botón de desarrollo `__DEV__` en `index.tsx` para volver a ver el onboarding sin reinstalar Expo Go — **debe revisarse/quitarse antes de publicar** (aunque `__DEV__` ya lo excluye automáticamente del build de producción)
- Pantalla de carga con fases visibles y texto grande: "Buscando tus fotos..." → "Agrupando fotos parecidas..." → "Comparando N grupos de fotos..." → lista. Incluye una pausa artificial de 400 ms entre fases para que React no las agrupe en una sola actualización de estado invisible al usuario
- Botón inferior de la bienvenida a ancho total de pantalla (sin bordes redondeados, borde a borde)
- Avanzar de paso en la bienvenida con gesto de swipe lateral (`PanResponder`), además del botón

### Bloque C — Contador de espacio en tiempo real (completado)
- En la pantalla de ganadora de `seleccion.tsx`, un contador ("🗑 Vas a liberar X MB" / "Calculando espacio a liberar...") se recalcula en vivo según el usuario marca o desmarca fotos extra para conservar, en vez de calcularse solo al confirmar el borrado
- Implementado con un `useEffect` que depende de la ganadora y de las extras seleccionadas, con flag de cancelación para evitar que una respuesta de cálculo antigua sobrescriba una más reciente

## Pendiente de UX

### Bloque D — Gesto del modal de zoom (no empezado)
Arrastrar hacia abajo para cerrar el modal de foto ampliada (`components/zoomable-photo-modal.tsx`). Requiere cuidado: el componente ya usa `PanResponder` para el pellizco de zoom, así que el nuevo gesto solo debe activarse con la foto a tamaño normal y un solo dedo, para no chocar con el zoom existente.

### Feedback de un contacto UX de Lidl Europa (no empezado)
- En `seleccion.tsx`, mientras "Dar un toque de brillo ✨" mejora la foto, indicarlo de forma más visible (hoy ya no bloquea el resto de botones, solo falta un indicador claro tipo badge no bloqueante de que está trabajando en segundo plano)
- Para la futura sección de gamificación (medallas/logros): iconos con estilo 3D tipo drawkit.com/illustration-types/3d, tono "girly" sin caer en infantil

## Bloqueantes de tienda (antes de publicar)

- `bundleIdentifier` / `slug` de Expo malformado (`"app-fotos."`, con punto final)
- Quitar la pestaña "Explore" de plantilla y el `modal.tsx` de plantilla (ambos siguen del scaffold inicial de Expo)
- Import sin usar de `react-native-reanimated` en `app/_layout.tsx`
- Política de privacidad + Privacy Manifest + formulario de Data Safety de la App Store
- Revisar/quitar el botón de desarrollo del onboarding (`__DEV__`, ya excluido de producción automáticamente, pero conviene limpiar el código)
- Pinch-to-zoom real diferido hasta tener un dev build propio (no viable dentro de Expo Go)

## Fases futuras

### Fase 2 — Mejora con IA
Mejora de foto o sugerencias vía modelos de visión/IA generativa. Al implicar coste real de API por uso, es la candidata natural para monetización de pago por uso/suscripción.

### Fase 3 (idea, sin planificar) — Edición de outfit y asistencia en vivo
- **Edición de outfit post-captura** vía APIs externas de edición/virtual try-on. Pendiente: consentimiento si la foto incluye a otras personas.
- **Asistente de pose/peinado en tiempo real**: cambiaría la naturaleza del producto de "organizador de fotos" a "cámara con asistencia en vivo" — desarrollo aparte, no incremental.

## Modelo de monetización (preferencia de Mario)

- **Gratis**: límite mensual de selecciones (ej. ~20/mes), no de por vida, para que los usuarios activos lleguen al límite regularmente
- **De pago**: packs de créditos (ej. 50 selecciones por 2,99€) o suscripción mensual (ej. 3,99€/mes ilimitado) — evitando micropagos por acción individual, que generan fricción de autenticación repetida y dejan poco margen tras la comisión de Apple (15-30%)
- La limpieza de fotos acumuladas del carrete se vendería como sesión de limpieza completa a precio fijo, no por bloques pequeños

## Aprendizajes técnicos clave de esta sesión

- **Edición de archivos**: sustitución completa del archivo vía heredoc de Terminal (`cat > archivo << 'EOF' ... EOF`) es más fiable que ediciones parciales, sobre todo en archivos tocados varias veces
- **Navegación segura**: nunca pasar ids de fotos ni arrays por parámetros de URL — usar un `grupoId` estable como clave a un store en memoria
- **`grupoId` estable**: usar el id de la primera foto del grupo, no el índice en el array (que cambia si la lista se recalcula)
- **Lotes de actualización de estado de React**: si dos `setStatus`/`setEstado` seguidos no tienen ningún `await` real entre medias, React los agrupa y la fase intermedia nunca llega a pintarse en pantalla — a veces hace falta una pausa artificial (`setTimeout`) solo para que el cambio de fase sea perceptible
- **Gestos**: `PanResponder` (núcleo de React Native) en vez de `react-native-gesture-handler` para cualquier gesto nuevo, por el historial de crashes de esa librería dentro de modales en Expo Go — mejor mantener un único patrón de gestos en toda la app
- **`__DEV__`**: variable global de React Native que permite código exclusivo de desarrollo (como el botón de reinicio del onboarding) sin que llegue nunca al build de producción

## Próximos pasos

1. Bloque D: gesto de cerrar el modal de zoom arrastrando hacia abajo
2. Indicador visible de "mejorando en segundo plano" en la pantalla de ganadora
3. Bloqueantes de tienda: `bundleIdentifier`/`slug`, quitar plantillas sobrantes, política de privacidad
4. Más adelante: iconos de gamificación estilo 3D, recalibrar umbral de nitidez con más fotos reales, decidir enfoque para ojos cerrados, etiqueta de estilo/tendencia para selección orientada a redes sociales
