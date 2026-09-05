# Spec: lógica de concatenación de frases — "What to Draw"

## Contexto
El usuario elige una categoría y luego uno o más de los 16 "elementos" (slots).
Para cada elemento elegido, la app toma un fragmento al azar del banco de frases
(`banco-de-frases.csv`, columnas: `categoria_id,categoria_nombre,slot_id,slot_nombre,frase`)
y concatena todo en una sola frase final para el prompt de dibujo.

El problema: la app **no tiene IA**, solo concatena texto de la BD. Como se debe
permitir que el usuario combine cualquier cantidad de elementos (incluyendo varios
"sujetos" a la vez: personaje + criatura + animal + vehiculo + objeto), la
concatenación simple ("Un X, un Y, un Z...") queda gramaticalmente rota. Esta spec
define reglas **fijas** (sin IA) para resolverlo.

## 1. Elementos "sujeto" vs elementos "cláusula"

- **Sujetos** (frases nominales completas con artículo): `personaje`, `criatura`, `animal`, `vehiculo`, `objeto`.
- **Cláusulas** (se agregan con coma después del sujeto): `atributo`, `ropa`, `accesorio`, `arma`, `habilidad`, `material`, `lugar`, `clima`, `accion`, `planta`, `comida`.

## 2. Elegir el sujeto principal

Si el usuario eligió más de un elemento "sujeto", solo **uno** actúa como sujeto
principal de la oración (se usa su frase del banco tal cual, sin modificar).

Prioridad fija para decidir cuál es el principal (el primero de esta lista que
el usuario haya activado, gana):

```
1. personaje
2. criatura
3. animal
4. vehiculo
5. objeto
```

Si el usuario no eligió ningún elemento "sujeto", usar un sujeto genérico fijo
según el idioma de la app, ej.: `"Una escena"` (fallback, para que la frase no
empiece directo con una cláusula).

## 3. Conectores fijos para sujetos secundarios

Los demás elementos "sujeto" que el usuario también activó (los que no ganaron
la prioridad) se agregan con un conector **fijo por tipo de slot** (no depende
del contenido de la frase individual):

| slot_id    | conector fijo (se antepone a la frase del banco) |
|------------|---------------------------------------------------|
| criatura   | `junto a {frase}`        |
| animal     | `acompañado de {frase}`  |
| vehiculo   | `sobre {frase}`          |
| objeto     | `cargando {frase}`       |
| personaje  | `junto a {frase}`        |

> Nota: `personaje` normalmente será siempre el principal por prioridad, pero se
> incluye el conector por si en el futuro se cambia el orden de prioridad.

Ejemplo: si el sujeto principal es `personaje` y el usuario también eligió
`animal` y `vehiculo`:

```
{personaje}, acompañado de {animal}, sobre {vehiculo}
```

## 4. Caso especial: `material`

`material` no tiene sujeto propio al que "pertenecer" gramaticalmente (el banco
solo dice "hecho de X"). Para no dejarlo suelto, siempre se le antepone el
conector fijo:

```
con detalles hechos de {frase_material}
```

Ejemplo: `"con detalles hechos de hierro forjado"`.

## 5. Resto de cláusulas

Los slots `atributo`, `ropa`, `accesorio`, `arma`, `habilidad`, `lugar`, `clima`,
`accion`, `planta`, `comida` se agregan tal cual vienen del banco (ya son
cláusulas listas, ej. `"con una cicatriz en forma de estrella"`), separadas por
coma, sin conector adicional.

## 6. Orden final de concatenación

Para que la frase se lea de forma natural, concatenar siempre en este orden fijo
(independiente del orden en que el usuario clickeó los elementos):

```
1. sujeto principal (personaje > criatura > animal > vehiculo > objeto)
2. sujetos secundarios, en el mismo orden de prioridad: criatura, animal, vehiculo, objeto
3. atributo
4. ropa
5. accesorio
6. arma
7. habilidad
8. material  (con el conector "con detalles hechos de")
9. lugar
10. clima
11. accion
12. planta
13. comida
```

Unir todo con `", "` y punto final `"."`.

## 7. Pseudocódigo

```js
const SUBJECT_PRIORITY = ["personaje", "criatura", "animal", "vehiculo", "objeto"];
const SUBJECT_CONNECTORS = {
  personaje: (f) => `junto a ${f}`,
  criatura:  (f) => `junto a ${f}`,
  animal:    (f) => `acompañado de ${f}`,
  vehiculo:  (f) => `sobre ${f}`,
  objeto:    (f) => `cargando ${f}`,
};
const CLAUSE_ORDER = [
  "atributo", "ropa", "accesorio", "arma", "habilidad",
  "material", "lugar", "clima", "accion", "planta", "comida",
];
const FALLBACK_SUBJECT = "Una escena";

function buildPrompt(selectedFragments) {
  // selectedFragments: { slot_id: frase }  (solo los slots que el usuario activó)

  // 1. sujeto principal
  const chosenSubjects = SUBJECT_PRIORITY.filter((s) => selectedFragments[s]);
  const mainSubjectSlot = chosenSubjects[0];
  const parts = [];

  if (mainSubjectSlot) {
    parts.push(selectedFragments[mainSubjectSlot]);
  } else {
    parts.push(FALLBACK_SUBJECT);
  }

  // 2. sujetos secundarios (los que no ganaron la prioridad)
  for (const slot of chosenSubjects.slice(1)) {
    parts.push(SUBJECT_CONNECTORS[slot](selectedFragments[slot]));
  }

  // 3. cláusulas en orden fijo
  for (const slot of CLAUSE_ORDER) {
    if (!selectedFragments[slot]) continue;
    if (slot === "material") {
      parts.push(`con detalles hechos de ${selectedFragments[slot].replace(/^hecho de /, "")}`);
    } else {
      parts.push(selectedFragments[slot]);
    }
  }

  // 4. capitalizar primera letra y unir
  const joined = parts.join(", ");
  return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
}
```

> Ojo: como las frases de `material` en el CSV ya empiezan con `"hecho de "`,
> el pseudocódigo le saca ese prefijo antes de anteponer `"con detalles hechos
> de "`, para no duplicarlo (`"con detalles hechos de hecho de hierro forjado"`).
> Alternativa más simple: cambiar el CSV para que `material` guarde solo el
> complemento (`"hierro forjado"` en vez de `"hecho de hierro forjado"`) y armar
> la cláusula completa siempre en código. Recomendado si se va a tocar el CSV de todos modos.

## 8. Ejemplo esperado (todos los 16 elementos activos, categoría fantasia)

Input (frases elegidas al azar del banco):
```
personaje: "un guardián de la muralla"
criatura:  "un trasgo de las cuevas"
animal:    "un caballo blanco"
vehiculo:  "una carreta de madera"
objeto:    "un pergamino enrollado"
atributo:  "con una cicatriz en forma de estrella"
ropa:      "con una capa raída"
accesorio: "con un amuleto de piedra"
arma:      "con una espada de doble filo"
habilidad: "que puede lanzar hechizos de fuego"
material:  "hecho de hierro forjado"
lugar:     "frente a un castillo en ruinas"
clima:     "bajo una tormenta de rayos"
accion:    "mientras desenvaina su espada"
planta:    "rodeado de enredaderas espinosas"
comida:    "sosteniendo una jarra de cerveza"
```

Output esperado:
```
Un guardián de la muralla, junto a un trasgo de las cuevas, acompañado de un
caballo blanco, sobre una carreta de madera, cargando un pergamino enrollado,
con una cicatriz en forma de estrella, con una capa raída, con un amuleto de
piedra, con una espada de doble filo, que puede lanzar hechizos de fuego, con
detalles hechos de hierro forjado, frente a un castillo en ruinas, bajo una
tormenta de rayos, mientras desenvaina su espada, rodeado de enredaderas
espinosas, sosteniendo una jarra de cerveza.
```

## 9. Tareas para implementar

1. Reemplazar la lógica actual de concatenación (probablemente un `join(", ")`
   plano) por la función `buildPrompt` de la sección 7.
2. Decidir si se ajusta el CSV de `material` (quitar el prefijo "hecho de ") o
   se deja el manejo del prefijo en código (ver nota en sección 7).
3. Agregar tests unitarios que cubran:
   - solo 1 elemento sujeto activo (comportamiento actual, no debe cambiar).
   - varios elementos sujeto activos a la vez (nuevo comportamiento).
   - ningún elemento sujeto activo, solo cláusulas (usa `FALLBACK_SUBJECT`).
   - `material` solo, sin ningún sujeto.
4. Verificar capitalización y puntuación final en todos los casos.
