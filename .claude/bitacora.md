# Bitácora de misiones (la mantiene el orquestador)

Formato: `AAAA-MM-DD · rama · qué se cambió · por qué (principio de la brújula) · estado (en prueba / mergeado / descartado)`


2026-10-10 · mejora/tras-torneo · La pantalla tras el torneo (app/seleccion.tsx) se divide en dos pasos. Paso "foto": elegida + "Compartir o publicar" + "Siguiente: qué hago con las otras N"; brillo y "Borrar todas, también la elegida" pasan a "Más opciones". Paso "otras": miniaturas más grandes (♥ = me la quedo), un solo botón "Borrar N fotos" (sustituye a "Guardar N más y borrar el resto" + "Borrar las demás"), aviso de recuperación justo encima, "Quedármelas todas" como salida. Se quita la alerta automática "¿La publicamos?". Robustez: estado borradoHecho impide un segundo borrado tras uno correcto; fallo de sumarEleccion ya no se muestra como fallo de borrado. · Principios 2 (una pantalla, una decisión) y 1 (borrar lejos de compartir, tranquilidad antes del botón) · en prueba. Pendiente: final tras borrar sin "siguiente momento"; pastilla ✏️ sin explicar; atrás de Android en paso 2 sale de la pantalla (seguro, no borra). No hay expo-updates: llega solo con build nueva.
