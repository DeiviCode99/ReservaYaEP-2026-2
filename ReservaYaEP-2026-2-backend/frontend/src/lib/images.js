/* El backend todavía no guarda fotos de las sedes. Mientras tanto se usan
   fotos de referencia (Unsplash, licencia libre) elegidas según el tipo de
   cocina. Cuando el backend entregue imágenes, basta cambiar photosFor(). */
const photo = (id, alt, kind) => ({
  id,
  src: `/images/fotos/f${id}-1200.webp`,
  thumb: `/images/fotos/f${id}-640.webp`,
  srcSet: `/images/fotos/f${id}-640.webp 640w, /images/fotos/f${id}-1200.webp 1200w`,
  alt,
  kind,
});

const PHOTOS = {
  "01": photo("01", "Mesa con platos de carne, ensalada y salsas", "plato"),
  "02": photo("02", "Salón de restaurante con mesas de madera y luz cálida", "salon"),
  "03": photo("03", "Mesa servida con copas y un plato de autor", "plato"),
  "04": photo("04", "Salón amplio de techo alto con comensales", "salon"),
  "05": photo("05", "Ensalada fresca con queso, aceitunas y cebolla", "plato"),
  "06": photo("06", "Pizza recién horneada sobre tabla de madera", "plato"),
  "07": photo("07", "Hamburguesa doble con queso y vegetales", "plato"),
  "08": photo("08", "Costillas a la parrilla con tomate y papas", "plato"),
  "09": photo("09", "Terraza con mesas y vista al atardecer", "salon"),
  "10": photo("10", "Salón con barra y sillas rojas", "salon"),
  "11": photo("11", "Bowl de pollo con vegetales, maíz y huevo", "plato"),
  "12": photo("12", "Porción de torta con frambuesas", "plato"),
  "13": photo("13", "Parrillada de carnes y vegetales asados", "plato"),
  "14": photo("14", "Amigos compartiendo hamburguesas y papas en la mesa", "salon"),
  "15": photo("15", "Albóndigas servidas sobre hojas verdes", "plato"),
  "16": photo("16", "Picada de pollo apanado con ensalada y salsa", "plato"),
};

const COVER_RULES = [
  [/parrill|asad|carne|santander|llaner|bbq|criolla|típic|tipic/i, ["13", "08", "16"]],
  [/pizza|ital|pasta/i, ["06", "03"]],
  [/hamburg|rápida|rapida|burger/i, ["07", "14"]],
  [/saludable|veg|ensalad|bowl|fit/i, ["11", "05"]],
  [/postre|café|cafe|repost|panader|dulce/i, ["12", "03"]],
  [/mar|pesc|autor|gourmet|intern/i, ["03", "01"]],
];
const DEFAULT_COVERS = ["01", "16", "15", "03", "13"];
const ROOMS = ["02", "04", "09", "10", "14"];
const DISHES = ["01", "03", "05", "08", "11", "12", "13", "15", "16"];

const pick = (list, seed) => list[Math.abs(seed) % list.length];

/* Devuelve 5 fotos estables para la sede: portada + salón + platos. */
export function photosFor(branch) {
  const seed = Number(branch?.id) || 0;
  const rule = COVER_RULES.find(([pattern]) => pattern.test(branch?.cuisineType || ""));
  const ids = [pick(rule ? rule[1] : DEFAULT_COVERS, seed)];
  const add = (list, offset) => {
    for (let step = 0; step < list.length; step += 1) {
      const candidate = pick(list, seed + offset + step);
      if (!ids.includes(candidate)) return ids.push(candidate);
    }
    return null;
  };
  add(ROOMS, 0);
  add(DISHES, 1);
  add(ROOMS, 2);
  add(DISHES, 4);
  return ids.map((id) => PHOTOS[id]);
}

export const coverFor = (branch) => photosFor(branch)[0];

export const HERO_SLIDES = [
  { src: "/images/comida-colombiana-imagen-destacada.jpg", alt: "Mesa con platos típicos de la cocina colombiana" },
  { ...PHOTOS["03"] },
  { ...PHOTOS["13"] },
  { ...PHOTOS["09"] },
];
