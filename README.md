# Umbrales olfativos - App móvil de registro por bloques

Aplicación web móvil (PWA) de alto rendimiento diseñada para entrenadores, preparadores y jueces caninos. Permite registrar pasadas en **bloques estructurados de 10 rondas**, clasificar aciertos y errores en tiempo real, evaluar si se alcanza la meta del **80% de aciertos**, calcular métricas psicofísicas y sincronizar los datos automáticamente con **Google Sheets**.

---

## Características principales

- **Paleta de diseño limpia y moderna:**
  - Base: Blanco suave (`#F3F5F2`)
  - Acentos del logo: Naranja (`#FA963D`) y verde (`#30E674`)
  - Secundario: Azul (`#108BF7`)
- **Organización por bloques de 10 rondas:**
  - Contador en tiempo real: e.g. "Bloque 1 • Ronda 4 de 10".
  - Barra visual de 10 indicadores para ver aciertos y errores de un vistazo.
  - Evaluación automática al completar la ronda 10: verifica si el perro superó el nivel con $\ge 80\%$ de aciertos (mínimo 8 de 10).
  - Opción de pasar directamente al siguiente nivel de dilución o repetir bloque.
- **Tabla oficial de diluciones precargada:**
  1. Solución madre (Stock): $1 : 1.000$
  2. Nivel 0: $1 : 2.000$
  3. Nivel 1: $1 : 10.000$
  4. Nivel 1,5: $1 : 20.000$
  5. Nivel 2: $1 : 100.000$
  6. Nivel 2,5: $1 : 200.000$
  7. Nivel 3: $1 : 1.000.000$
  8. Nivel 3,5: $1 : 2.000.000$
  9. Nivel 4: $1 : 10.000.000$
  10. Nivel 4,5: $1 : 20.000.000$
  11. Nivel 5: $1 : 100.000.000$
  12. Nivel 5,5: $1 : 200.000.000$
  13. Nivel 6: $1 : 1.000.000.000$
- **Cálculo permanente de umbrales:**
  - **Sensibilidad (%):** Meta $\ge 80\%$.
  - **Especificidad (%):** Meta $\ge 85\%$.
  - **Exactitud global (%):** Total de aciertos sobre total de rondas.
  - **Umbral operativo confiable:** Dilución más baja con sensibilidad $\ge 80\%$ y especificidad $\ge 85\%$.
  - **Umbral límite sensorial:** Caída de sensibilidad al rango 15% - 30% (cercano al azar de 1 en 8 = 12.5%).
  - **Criterio de exclusión:** Alerta si la especificidad cae por debajo del 70% (el perro adivina en los controles).
- **Sincronización con Google Sheets:** Funciona **offline** (guarda todo en el teléfono) y sincroniza con tu hoja de cálculo mediante Google Apps Script.
- **Exportación:** Descarga en formato CSV (Excel) y JSON con un solo toque.

---

## Cómo alojar en GitHub Pages

1. Crea un repositorio en GitHub (ejemplo: `umbrales-olfativos`).
2. Sube el código:
   ```bash
   git init
   git add .
   git commit -m "feat: app de umbrales olfativos caninos por bloques"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```
3. En tu repositorio de GitHub, ve a **Settings** → **Pages**:
   - En **Build and deployment** → **Source**, selecciona: **GitHub Actions**.
4. ¡Listo! En un par de minutos tu app estará disponible en:
   `https://TU_USUARIO.github.io/TU_REPOSITORIO/`

---

## Cómo instalar la app en el celular

1. Abre la URL en el navegador de tu celular:
   - **En iPhone (Safari):** Toca el botón de compartir y selecciona **"Añadir a pantalla de inicio"**.
   - **En Android (Chrome):** Toca el menú de tres puntos y selecciona **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**.
2. La app se abrirá a pantalla completa como una app nativa, con icono propio y funcionamiento sin conexión.
