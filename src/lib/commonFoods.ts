// Everyday foods that work instantly and offline. Values per 100 g (USDA-style references;
// local dishes are typical-plate estimates). `s` = grams in one typical portion, `sl` = its label.
import type { Food } from './store';

type Row = [name: string, kcal: number, protein: number, carbs: number, fat: number, s: number, sl: string, aliases?: string];

const ROWS: Row[] = [
  // Eggs
  ['Egg, boiled', 155, 12.6, 1.1, 10.6, 50, '1 large egg', 'hard boiled egg boiled eggs telur rebus'],
  ['Egg, fried', 196, 13.6, 0.8, 15, 46, '1 large egg', 'fried eggs telur goreng sunny side'],
  ['Egg, scrambled', 149, 10, 1.6, 11, 61, '1 egg', 'scrambled eggs'],
  ['Egg, raw (whole)', 143, 12.6, 0.7, 9.5, 50, '1 large egg', 'eggs'],
  ['Egg white', 52, 10.9, 0.7, 0.2, 33, '1 egg white', 'egg whites'],
  ['Omelette (plain)', 154, 10.6, 0.6, 11.7, 61, '1 egg omelette', 'omelet telur dadar'],
  // Grains, bread, noodles
  ['White rice, cooked', 130, 2.7, 28.2, 0.3, 158, '1 cup', 'rice nasi putih steamed rice'],
  ['Brown rice, cooked', 123, 2.7, 25.6, 1, 195, '1 cup', 'rice'],
  ['Bread, white', 266, 7.6, 50, 3.3, 28, '1 slice', 'toast'],
  ['Bread, wholemeal', 247, 13, 41, 3.4, 32, '1 slice', 'whole wheat wholegrain toast'],
  ['Rolled oats (dry)', 379, 13.2, 67.7, 6.5, 40, '½ cup', 'oatmeal porridge oat'],
  ['Pasta, cooked', 158, 5.8, 30.9, 0.9, 140, '1 cup', 'spaghetti macaroni penne'],
  ['Yellow noodles (mee), cooked', 138, 4.5, 25, 2, 160, '1 cup', 'mee noodle'],
  ['Rice vermicelli (bihun), cooked', 108, 1.8, 24, 0.2, 160, '1 cup', 'bee hoon noodle'],
  ['Instant noodles (dry pack)', 450, 9, 60, 19, 80, '1 pack', 'maggi mamee ramen noodle'],
  ['Granola', 471, 10, 64, 20, 60, '½ cup', 'muesli'],
  ['Cornflakes', 357, 7.5, 84, 0.4, 28, '1 cup', 'cereal'],
  ['Chapati', 297, 9.6, 50, 7.5, 40, '1 piece', 'roti chapatti'],
  ['Roti canai', 330, 7, 45, 13, 90, '1 piece', 'roti prata paratha'],
  ['Tortilla wrap (flour)', 312, 8.3, 51.6, 8, 45, '1 wrap', 'wrap'],
  ['Potato, boiled', 87, 1.9, 20, 0.1, 150, '1 medium', 'potatoes'],
  ['Sweet potato, baked', 90, 2, 20.7, 0.2, 130, '1 medium', 'keledek'],
  ['Corn on the cob', 96, 3.4, 21, 1.5, 90, '1 ear', 'sweetcorn jagung'],
  // Protein
  ['Chicken breast, cooked', 165, 31, 0, 3.6, 120, '1 breast', 'chicken ayam grilled'],
  ['Chicken thigh, cooked (no skin)', 209, 26, 0, 10.9, 100, '1 thigh', 'chicken ayam'],
  ['Fried chicken (with skin)', 260, 22, 9, 15, 120, '1 piece', 'ayam goreng chicken'],
  ['Salmon, cooked', 206, 22, 0, 12, 150, '1 fillet', 'fish'],
  ['White fish, cooked', 128, 26, 0, 2.7, 100, '1 fillet', 'tilapia fish ikan'],
  ['Tuna, canned in water (drained)', 116, 25.5, 0, 0.8, 120, '1 can', 'tuna fish'],
  ['Prawns, cooked', 99, 24, 0.2, 0.3, 100, '100 g', 'shrimp udang'],
  ['Beef mince, lean, cooked', 250, 26, 0, 15, 100, '100 g', 'ground beef daging'],
  ['Tofu, firm', 144, 17, 3, 9, 150, '½ block', 'tauhu taukua bean curd'],
  ['Tempeh', 192, 20, 7.6, 10.8, 100, '100 g', ''],
  ['Chicken sausage', 223, 15.5, 2.7, 16.2, 45, '1 sausage', 'frankfurter hotdog'],
  ['Ham', 145, 21, 1.5, 5.5, 28, '1 slice', ''],
  ['Bacon, cooked', 541, 37, 1.4, 42, 8, '1 slice', ''],
  ['Whey protein powder', 400, 80, 8, 6, 30, '1 scoop', 'protein shake'],
  ['Chickpeas, cooked', 164, 8.9, 27.4, 2.6, 164, '1 cup', 'garbanzo'],
  ['Lentils, cooked', 116, 9, 20, 0.4, 198, '1 cup', 'dhal dal'],
  ['Hummus', 166, 7.9, 14.3, 9.6, 30, '2 tbsp', ''],
  // Dairy
  ['Milk, full cream', 61, 3.2, 4.8, 3.3, 244, '1 cup (240 ml)', 'whole milk susu'],
  ['Milk, low fat', 42, 3.4, 5, 1, 244, '1 cup (240 ml)', 'skim milk susu'],
  ['Almond milk, unsweetened', 15, 0.6, 0.3, 1.2, 240, '1 cup (240 ml)', ''],
  ['Soy milk', 54, 3.3, 6.3, 1.8, 243, '1 cup (240 ml)', 'soya'],
  ['Oat milk', 46, 1, 6.7, 1.5, 240, '1 cup (240 ml)', ''],
  ['Greek yogurt, plain, non-fat', 59, 10.2, 3.6, 0.4, 170, '1 tub', 'yoghurt'],
  ['Greek yogurt, plain, full fat', 97, 9, 4, 5, 170, '1 tub', 'yoghurt'],
  ['Yogurt, plain', 61, 3.5, 4.7, 3.3, 170, '1 tub', 'yoghurt'],
  ['Cheddar cheese', 403, 24.9, 1.3, 33.1, 20, '1 slice', 'cheese'],
  ['Cheese slice (processed)', 316, 16, 8, 24, 19, '1 slice', 'cheese singles kraft'],
  ['Mozzarella', 280, 28, 3, 17, 28, '1 slice', 'cheese'],
  ['Cream cheese', 342, 6, 4, 34, 15, '1 tbsp', 'cheese spread'],
  ['Butter', 717, 0.9, 0.1, 81, 14, '1 tbsp', 'mentega'],
  ['Ice cream, vanilla', 207, 3.5, 24, 11, 66, '1 scoop', ''],
  // Fruit
  ['Banana', 89, 1.1, 22.8, 0.3, 118, '1 medium', 'pisang'],
  ['Apple', 52, 0.3, 13.8, 0.2, 182, '1 medium', 'epal'],
  ['Orange', 47, 0.9, 11.8, 0.1, 131, '1 medium', 'oren'],
  ['Mango', 60, 0.8, 15, 0.4, 165, '1 cup', 'mangga'],
  ['Papaya', 43, 0.5, 10.8, 0.3, 145, '1 cup', 'betik'],
  ['Watermelon', 30, 0.6, 7.6, 0.2, 152, '1 cup', 'tembikai'],
  ['Grapes', 69, 0.7, 18, 0.2, 151, '1 cup', 'anggur'],
  ['Strawberries', 32, 0.7, 7.7, 0.3, 152, '1 cup', 'berries'],
  ['Blueberries', 57, 0.7, 14.5, 0.3, 148, '1 cup', 'berries'],
  ['Avocado', 160, 2, 8.5, 14.7, 100, '½ avocado', ''],
  ['Dates', 282, 2.5, 75, 0.4, 8, '1 date', 'kurma'],
  // Veg
  ['Broccoli', 34, 2.8, 6.6, 0.4, 91, '1 cup', 'brokoli'],
  ['Spinach', 23, 2.9, 3.6, 0.4, 30, '1 cup', 'bayam'],
  ['Carrot', 41, 0.9, 9.6, 0.2, 61, '1 medium', 'lobak merah'],
  ['Cucumber', 15, 0.7, 3.6, 0.1, 150, '½ cucumber', 'timun'],
  ['Tomato', 18, 0.9, 3.9, 0.2, 123, '1 medium', 'tomato'],
  ['Bell pepper', 31, 1, 6, 0.3, 119, '1 medium', 'capsicum'],
  ['Lettuce', 15, 1.4, 2.9, 0.2, 36, '1 cup', 'salad'],
  ['Onion', 40, 1.1, 9.3, 0.1, 110, '1 medium', 'bawang'],
  ['Mushrooms', 22, 3.1, 3.3, 0.3, 70, '1 cup', 'cendawan'],
  ['Mixed salad (no dressing)', 17, 1.2, 3.3, 0.2, 85, '1 bowl', 'salad greens'],
  // Nuts, spreads, fats, sweets
  ['Peanut butter', 588, 25, 20, 50, 16, '1 tbsp', ''],
  ['Peanuts', 567, 25.8, 16, 49, 28, '1 handful', 'kacang'],
  ['Almonds', 579, 21, 21.6, 49.9, 28, '1 handful', ''],
  ['Cashews', 553, 18, 30, 44, 28, '1 handful', 'gajus'],
  ['Olive oil', 884, 0, 0, 100, 13.5, '1 tbsp', 'oil'],
  ['Cooking oil', 884, 0, 0, 100, 14, '1 tbsp', 'vegetable oil palm oil minyak'],
  ['Honey', 304, 0.3, 82, 0, 21, '1 tbsp', 'madu'],
  ['Sugar', 387, 0, 100, 0, 4, '1 tsp', 'gula'],
  ['Dark chocolate (70%)', 598, 7.8, 45.9, 42.6, 10, '1 square', 'chocolate'],
  ['Milk chocolate', 535, 7.6, 59, 30, 10, '1 square', 'chocolate'],
  ['Potato chips', 536, 7, 53, 35, 28, '1 small bag', 'crisps kerepek'],
  ['Curry puff', 357, 6, 36, 21, 70, '1 piece', 'karipap epok epok'],
  // Drinks
  ['Coffee, black', 2, 0.3, 0, 0, 240, '1 cup', 'kopi o kosong americano'],
  ['Teh tarik', 50, 1.2, 8, 1.4, 250, '1 glass', 'milk tea'],
  ['Kopi O (with sugar)', 25, 0, 6, 0, 250, '1 glass', 'coffee'],
  ['Milo (with milk & sugar)', 80, 3, 12, 2, 250, '1 glass', 'chocolate malt'],
  ['Orange juice', 45, 0.7, 10.4, 0.2, 248, '1 cup', 'jus oren'],
  ['Cola', 42, 0, 10.6, 0, 330, '1 can', 'coke coca cola soda'],
  // Local plates (typical portions, rough)
  ['Nasi lemak (with egg, sambal, peanuts)', 170, 5, 21, 7.5, 350, '1 plate', 'nasi lemak'],
  ['Nasi goreng', 175, 5.5, 22, 7, 350, '1 plate', 'fried rice'],
  ['Mee goreng mamak', 190, 6, 24, 8, 350, '1 plate', 'fried noodles'],
  ['Char kuey teow', 210, 6, 25, 10, 350, '1 plate', 'fried kuey teow'],
  ['Chicken rice', 160, 8, 20, 5, 380, '1 plate', 'nasi ayam hainanese'],
];

export const COMMON_FOODS: (Food & { aliases: string })[] = ROWS.map(([name, kcal, protein, carbs, fat, s, sl, aliases = '']) => ({
  id: `common-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name,
  per: '100g',
  kcal,
  protein,
  carbs,
  fat,
  servingG: s,
  servingLabel: `${sl} (${s} g)`,
  source: 'common',
  aliases: aliases.toLowerCase(),
}));

/** Every word of the query must start a word in the name or aliases ("boil egg" finds "Egg, boiled"). */
export function searchCommon(query: string, limit = 8): Food[] {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return [];
  const scored = COMMON_FOODS.map((f) => {
    const hay = `${f.name.toLowerCase()} ${f.aliases}`;
    const tokens = hay.split(/[^a-z0-9]+/);
    const ok = words.every((w) => tokens.some((t) => t.startsWith(w) || (w.length > 3 && t.startsWith(w.replace(/s$/, '')))));
    const score = ok ? (f.name.toLowerCase().startsWith(words[0]) ? 2 : 1) : 0;
    return { f, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ f }) => {
    const { aliases: _a, ...food } = f;
    return food;
  });
}
