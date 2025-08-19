# Estructura de Estilos

Esta carpeta contiene todos los estilos del proyecto organizados de forma modular.

## Archivos CSS

### `index.css`
- **Propósito**: Estilos base y variables globales
- **Contenido**: 
  - Variables CSS (colores, espaciados, radios, sombras)
  - Reset CSS
  - Configuración global de fonts
  - Estilos de accesibilidad y rendimiento

### `app.css`
- **Propósito**: Estilos del componente principal App
- **Contenido**: Contenedor principal y título

### `lobby.css`
- **Propósito**: Estilos del lobby de entrada
- **Contenido**: Formulario de sala, botones principales, animaciones de entrada

### `game.css`
- **Propósito**: Estilos del contenedor principal del juego
- **Contenido**: Header de sala, mensajes, game over

### `pokemon.css`
- **Propósito**: Estilos relacionados con Pokemon
- **Contenido**: Cartas de Pokemon, equipos, turnos de selección

### `auction.css`
- **Propósito**: Estilos del sistema de subastas
- **Contenido**: Sección de subastas, timer, inputs de puja

### `game-info.css`
- **Propósito**: Estilos de información del juego
- **Contenido**: Estado de jugadores, progreso, spinner de carga

### `bid-results-modal.css`
- **Propósito**: Modal complejo de resultados de subasta
- **Contenido**: Modal overlay, animaciones complejas, resultados

## Uso

Los estilos se importan en el archivo principal `App.css` usando:

```css
@import './styles/index.css';
@import './styles/app.css';
/* ... otros imports ... */
```

## Variables CSS Disponibles

### Colores
- `--yellow`, `--yellow-alt`
- `--green`, `--green-alt`
- `--blue`, `--blue-alt`
- `--red`, `--red-alt`
- `--bg`, `--bg-alt` (fondos)
- `--fg`, `--fg-alt` (textos)

### Espaciados
- `--spacing-xs` (5px)
- `--spacing-sm` (10px)
- `--spacing-md` (15px)
- `--spacing-lg` (20px)
- `--spacing-xl` (30px)

### Border Radius
- `--radius-sm` (8px)
- `--radius-md` (12px)
- `--radius-lg` (15px)
- `--radius-xl` (20px)
- `--radius-full` (50%)

### Sombras
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`

## Responsive Design

Todos los archivos incluyen media queries para:
- **768px y menos**: Tablet/móvil
- **480px y menos**: Móvil pequeño
- **360px y menos**: Móvil ultra pequeño

## Animaciones

Cada archivo contiene sus propias animaciones con nombres descriptivos y tiempos optimizados para móvil.
