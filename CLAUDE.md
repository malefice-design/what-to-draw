# Reglas: mantenimiento del banco de frases — "What to Draw"

Este documento define cómo actualizar `banco-de-frases.csv` a partir de listas
simples que te voy a ir pasando en el chat (sin adjuntar archivos). Guarda este
archivo como `CLAUDE.md` en la raíz del proyecto para que lo leas automáticamente
en cada sesión.

## Formato del CSV (no cambiar)
```
categoria_id,categoria_nombre,slot_id,slot_nombre,frase
```

## Categorías válidas
```
fantasia        -> Fantasía medieval
editorial       -> Editorial y cartoon
cienciaficcion  -> Ciencia Ficción
terror          -> Terror y misterio
mitologia       -> Mitología
estudio         -> Estudio de dibujo
transversal     -> Transversal   (funciona en TODAS las categorías)
```

## Los 16 elementos (slot_id / slot_nombre / qué va ahí)

| slot_id | slot_nombre | tipo | qué va ahí (y nada más) |
|---|---|---|---|
| personaje | Personaje | sujeto | tipo de persona/personaje — sin objetos, ropa ni habilidades pegadas |
| criatura | Criatura | sujeto | criatura fantástica/no-humana — **siempre categórico, nunca transversal** |
| animal | Animal | sujeto | especie animal real, máximo un descriptor simple e inherente (color, tamaño, raza) |
| vehiculo | Vehículo | sujeto | medio de transporte, máximo un descriptor simple de estado físico |
| objeto | Objeto | sujeto | objeto que el sujeto lleva/carga — sin explicar función mágica ni quién lo usa |
| atributo | Atributo | cláusula | rasgo físico/personalidad o modificación mágica/inusual del sujeto |
| ropa | Ropa | cláusula | una prenda de vestir |
| accesorio | Accesorio | cláusula | accesorio pequeño (joya, lentes, amuleto) |
| arma | Arma | cláusula | arma o herramienta que empuña |
| habilidad | Habilidad | cláusula | poder, magia o destreza |
| material | Material | cláusula | de qué está hecho algo (siempre empieza con "hecho de") |
| lugar | Lugar | cláusula | escenario o locación |
| clima | Clima | cláusula | condición climática/atmósfera |
| accion | Acción | cláusula | qué está haciendo / qué pasa en ese momento |
| planta | Planta | cláusula | flora del entorno |
| comida | Comida | cláusula | comida o bebida |

**Sujeto** = frase nominal completa con artículo, funciona sola como sujeto de
oración: `"un panda que trabaja como repartidor de pizza"`.
**Cláusula** = fragmento que se agrega después de una coma al sujeto:
`"con una cicatriz en forma de estrella"`, `"mientras toca la guitarra"`.

## Regla de pureza conceptual (la más importante)

Cada fragmento representa ÚNICAMENTE el concepto de su propio slot. Nunca
mezcles dentro de un slot algo que pertenece a otro. Ejemplo de error:
`"un zorro con una cola hecha de fuego frío"` ❌ (el atributo mágico no va
pegado al animal). Correcto: `"un zorro"` (animal) + `"con una cola hecha de
fuego frío"` (atributo), como dos filas separadas.

## Transversal vs categórico — cómo decidir

- `criatura` → **siempre** categórico (nunca crear fila transversal para este slot).
- Para el resto de los slots: si el concepto es genérico y no tiene "carga
  temática" (no es mágico, ni tecnológico, ni de terror, ni mitológico real),
  va en `transversal`. Si el concepto ya trae el tema incorporado (una espada
  de fuego, una pistola láser, un fantasma, un dios nórdico), va en la
  categoría correspondiente.
- Ante la duda, pregúntame en vez de asumir.

## Cómo voy a pasarte las listas

Te voy a tirar líneas simples, algunas con la categoría/slot indicados entre
corchetes y otras sin nada (para que tú infieras). Formato:

```
mapache
[cienciaficcion] alien tocando el ukelele
pulpo jugando ajedrez
[terror] payaso que nunca parpadea
[fantasia:objeto] espada rota clavada en una roca
```

Reglas para procesar cada línea:

1. **Si trae `[categoria]` o `[categoria:slot]` al inicio** → usa esa categoría
   (y ese slot si lo especifiqué) directamente, sin inferir.
2. **Si no trae nada** → infiere tú el slot y decide si es transversal o
   categórico según la regla de arriba. Si el concepto es claramente temático
   (ej. "alien", "fantasma", "dios griego") pero no puse categoría, infiere la
   categoría más obvia.
3. **Si la línea describe una idea compuesta** (sujeto + acción, sujeto +
   atributo, etc., ej. "pulpo jugando ajedrez") → **sepárala en dos filas
   distintas**, una por slot, aplicando la regla de pureza conceptual:
   - `un pulpo` → slot `animal`
   - `mientras juega ajedrez` → slot `accion`
   Nunca la guardes como una sola frase fusionada.
4. **Nunca dupliques** una fila que ya exista (compara insensible a
   mayúsculas/tildes contra el CSV actual) — si ya existe, sáltala.
5. Si una línea es genuinamente ambigua (no puedes decidir slot ni categoría
   con confianza), pregúntame en vez de adivinar.

## Después de actualizar

1. Corre una validación (duplicados exactos, duplicados de frase dentro del
   mismo categoria+slot) antes de guardar.
2. Dame un resumen corto: cuántas filas agregaste, en qué categoría/slot cada
   una, y qué líneas saltaste o necesitas que aclare.

## Ejemplo de resumen esperado

```
Agregadas 6 filas:
- transversal / animal: "un mapache"
- cienciaficcion / criatura: "un alien tocando el ukelele" → dividido en:
  cienciaficcion/criatura: "un alienígena"
  transversal/accion: "mientras toca el ukelele"
- transversal / animal: "un pulpo"
- transversal / accion: "mientras juega ajedrez"
- terror / personaje: "un payaso que nunca parpadea"
- fantasia / objeto: "una espada rota clavada en una roca"

Sin duplicados. Sin líneas ambiguas.
```
