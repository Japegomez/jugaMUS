# Google Play — recursos gráficos

Generados según [especificaciones de icono de Play](https://developer.android.com/distribute/google-play/resources/icon-design-specifications?hl=es-419).

| Archivo                        | Tamaño   | Uso                                          |
| ------------------------------ | -------- | -------------------------------------------- |
| `icon-512.png`                 | 512×512  | **Icono de la aplicación** en Play Console   |
| `feature-graphic-1024x500.png` | 1024×500 | **Gráfico de funciones** en la ficha de Play |

En la app (Expo), `assets/icon.png` y `assets/adaptive-icon.png` están a **1024×1024** (recomendación Expo / icono adaptativo).

Regenerar tras cambiar el diseño:

```bash
npm install --no-save sharp
node scripts/export-play-store-graphics.mjs
```

Fuentes IA (si existen en `.cursor/projects/.../assets/`): `play-icon-512.png`, `play-feature-graphic.png`.
