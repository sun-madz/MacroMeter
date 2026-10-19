// Built-in recipe library used to suggest menus from what's in the pantry.
// Nutrition is an estimate per serving. `match` lists words that count as having the ingredient.
import type { Nutrition, PantryItem } from './store';

export interface RecipeIngredient {
  name: string;
  amount: string;
  match: string[];
  optional?: boolean;
}

export interface Recipe extends Nutrition {
  id: string;
  name: string;
  slot: 'breakfast' | 'main' | 'snack';
  minutes: number;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
}

const i = (name: string, amount: string, match: string[] = [name.toLowerCase()], optional = false): RecipeIngredient => ({
  name,
  amount,
  match,
  optional,
});

const EGG = ['egg'];
const CHICKEN = ['chicken'];
const RICE = ['rice'];
const ONION = ['onion', 'shallot'];
const GARLIC = ['garlic'];
const GREENS = ['spinach', 'kale', 'bok choy', 'pak choy', 'sawi', 'kangkung', 'lettuce', 'greens', 'choy sum'];
const TOMATO = ['tomato'];
const PEPPER = ['bell pepper', 'capsicum', 'pepper'];
const OATS = ['oat'];
const MILK = ['milk'];
const YOGURT = ['yogurt', 'yoghurt'];
const BERRIES = ['berry', 'berries', 'strawberr', 'blueberr', 'raspberr'];
const BANANA = ['banana'];
const BREAD = ['bread', 'toast', 'wrap', 'tortilla'];
const TUNA = ['tuna'];
const TOFU = ['tofu', 'taukua', 'tauhu'];
const NOODLES = ['noodle', 'mee', 'pasta', 'spaghetti', 'udon', 'soba'];
const BEANS = ['bean', 'chickpea', 'lentil', 'dhal', 'dal'];
const POTATO = ['potato', 'sweet potato'];
const CUCUMBER = ['cucumber'];
const CHEESE = ['cheese', 'feta', 'mozzarella', 'cheddar'];
const FISH = ['fish', 'salmon', 'mackerel', 'tilapia', 'cod', 'ikan'];
const BEEF = ['beef', 'mince'];
const PRAWN = ['prawn', 'shrimp', 'udang'];
const SOY = ['soy sauce', 'kicap', 'soy'];
const LEMON = ['lemon', 'lime', 'limau'];
const AVOCADO = ['avocado'];
const CARROT = ['carrot'];
const MUSHROOM = ['mushroom', 'cendawan'];
const COCONUT = ['coconut milk', 'santan', 'coconut'];
const CURRY = ['curry'];
const PEANUT = ['peanut butter', 'peanut'];
const CORN = ['corn'];
const BROCCOLI = ['broccoli'];

export const RECIPES: Recipe[] = [
  {
    id: 'veg-omelette', name: 'Veggie omelette', slot: 'breakfast', minutes: 10, servings: 1,
    kcal: 280, protein: 20, carbs: 6, fat: 19,
    ingredients: [i('Eggs', '3', EGG), i('Spinach or greens', '1 handful', GREENS), i('Tomato', '1 small', TOMATO, true), i('Onion', '¼', ONION, true), i('Cheese', '15 g', CHEESE, true)],
    steps: ['Whisk the eggs with a pinch of salt.', 'Soften onion and greens in a lightly oiled pan.', 'Pour in the eggs, add tomato and cheese, fold when set.'],
  },
  {
    id: 'overnight-oats', name: 'Overnight oats', slot: 'breakfast', minutes: 5, servings: 1,
    kcal: 360, protein: 18, carbs: 52, fat: 9,
    ingredients: [i('Rolled oats', '45 g', OATS), i('Milk', '150 ml', MILK), i('Yogurt', '80 g', YOGURT, true), i('Berries or banana', '1 handful', [...BERRIES, ...BANANA], true)],
    steps: ['Mix oats, milk and yogurt in a jar.', 'Refrigerate overnight.', 'Top with fruit in the morning.'],
  },
  {
    id: 'yogurt-bowl', name: 'Greek yogurt bowl', slot: 'breakfast', minutes: 3, servings: 1,
    kcal: 300, protein: 22, carbs: 34, fat: 8,
    ingredients: [i('Greek yogurt', '200 g', YOGURT), i('Berries or banana', '1 handful', [...BERRIES, ...BANANA]), i('Oats or granola', '20 g', [...OATS, 'granola'], true), i('Honey', '1 tsp', ['honey'], true)],
    steps: ['Spoon yogurt into a bowl.', 'Top with fruit, oats and a drizzle of honey.'],
  },
  {
    id: 'egg-toast', name: 'Eggs on toast', slot: 'breakfast', minutes: 8, servings: 1,
    kcal: 330, protein: 19, carbs: 28, fat: 15,
    ingredients: [i('Eggs', '2', EGG), i('Wholegrain bread', '2 slices', BREAD), i('Avocado', '¼', AVOCADO, true), i('Tomato', '1 small', TOMATO, true)],
    steps: ['Toast the bread.', 'Fry, poach or scramble the eggs.', 'Serve on toast with sliced tomato or avocado.'],
  },
  {
    id: 'banana-pb-oats', name: 'Banana peanut butter oats', slot: 'breakfast', minutes: 7, servings: 1,
    kcal: 410, protein: 15, carbs: 58, fat: 13,
    ingredients: [i('Rolled oats', '45 g', OATS), i('Milk', '200 ml', MILK), i('Banana', '1', BANANA), i('Peanut butter', '1 tbsp', PEANUT)],
    steps: ['Simmer oats in milk for 4–5 minutes.', 'Top with sliced banana and peanut butter.'],
  },
  {
    id: 'chicken-stirfry', name: 'Chicken & veg stir-fry', slot: 'main', minutes: 20, servings: 2,
    kcal: 420, protein: 38, carbs: 42, fat: 10,
    ingredients: [i('Chicken breast', '250 g', CHICKEN), i('Rice', '120 g dry', RICE), i('Garlic', '2 cloves', GARLIC), i('Bell pepper', '1', PEPPER, true), i('Greens or broccoli', '2 handfuls', [...GREENS, ...BROCCOLI], true), i('Soy sauce', '2 tbsp', SOY)],
    steps: ['Cook the rice.', 'Stir-fry sliced chicken in a little oil until cooked through.', 'Add garlic and vegetables, then soy sauce. Serve over rice.'],
  },
  {
    id: 'nasi-goreng', name: 'Lighter nasi goreng', slot: 'main', minutes: 20, servings: 2,
    kcal: 450, protein: 24, carbs: 55, fat: 14,
    ingredients: [i('Cooked rice', '300 g', RICE), i('Eggs', '2', EGG), i('Shallots or onion', '2', ONION), i('Garlic', '2 cloves', GARLIC), i('Kicap / soy sauce', '1½ tbsp', SOY), i('Chicken or prawns', '120 g', [...CHICKEN, ...PRAWN], true), i('Cucumber', 'to serve', CUCUMBER, true)],
    steps: ['Fry shallots and garlic in 1 tbsp oil.', 'Add protein, then day-old rice and kicap; toss on high heat.', 'Top with a fried egg each and cucumber slices.'],
  },
  {
    id: 'chicken-rice-bowl', name: 'Chicken rice bowl', slot: 'main', minutes: 25, servings: 2,
    kcal: 470, protein: 40, carbs: 50, fat: 11,
    ingredients: [i('Chicken thigh or breast', '280 g', CHICKEN), i('Rice', '120 g dry', RICE), i('Cucumber', '1', CUCUMBER), i('Garlic', '2 cloves', GARLIC), i('Soy sauce', '1 tbsp', SOY), i('Greens', '1 handful', GREENS, true)],
    steps: ['Cook rice with a crushed garlic clove.', 'Pan-sear or poach chicken, slice.', 'Serve with cucumber, greens and soy-garlic dressing.'],
  },
  {
    id: 'tuna-salad', name: 'Tuna salad bowl', slot: 'main', minutes: 10, servings: 1,
    kcal: 340, protein: 32, carbs: 18, fat: 15,
    ingredients: [i('Canned tuna', '1 can', TUNA), i('Lettuce or greens', '2 handfuls', GREENS), i('Cucumber', '½', CUCUMBER), i('Tomato', '1', TOMATO, true), i('Beans or corn', '60 g', [...BEANS, ...CORN], true), i('Lemon', '½', LEMON, true)],
    steps: ['Drain tuna.', 'Chop vegetables and toss with tuna.', 'Dress with lemon, a little olive oil, salt and pepper.'],
  },
  {
    id: 'tuna-wrap', name: 'Tuna wrap', slot: 'main', minutes: 8, servings: 1,
    kcal: 380, protein: 30, carbs: 35, fat: 12,
    ingredients: [i('Canned tuna', '1 can', TUNA), i('Wrap / tortilla', '1 large', BREAD), i('Yogurt (as mayo swap)', '2 tbsp', YOGURT, true), i('Lettuce or greens', '1 handful', GREENS), i('Cucumber', '¼', CUCUMBER, true)],
    steps: ['Mix tuna with yogurt, salt and pepper.', 'Fill the wrap with greens, cucumber and tuna. Roll up.'],
  },
  {
    id: 'tofu-stirfry', name: 'Crispy tofu & greens', slot: 'main', minutes: 20, servings: 2,
    kcal: 380, protein: 22, carbs: 40, fat: 14,
    ingredients: [i('Firm tofu', '300 g', TOFU), i('Greens', '2 handfuls', GREENS), i('Garlic', '2 cloves', GARLIC), i('Soy sauce', '2 tbsp', SOY), i('Rice or noodles', '100 g dry', [...RICE, ...NOODLES])],
    steps: ['Press and cube tofu, pan-fry until golden.', 'Add garlic and greens, splash in soy sauce.', 'Serve with rice or noodles.'],
  },
  {
    id: 'garlic-noodles', name: 'Garlic soy noodles with egg', slot: 'main', minutes: 15, servings: 1,
    kcal: 430, protein: 19, carbs: 60, fat: 12,
    ingredients: [i('Noodles', '75 g dry', NOODLES), i('Eggs', '1', EGG), i('Garlic', '2 cloves', GARLIC), i('Soy sauce', '1 tbsp', SOY), i('Greens', '1 handful', GREENS, true)],
    steps: ['Boil noodles.', 'Fry garlic in 1 tsp oil, add noodles, soy sauce and greens.', 'Top with a fried or soft-boiled egg.'],
  },
  {
    id: 'tomato-pasta', name: 'Tomato & bean pasta', slot: 'main', minutes: 20, servings: 2,
    kcal: 440, protein: 19, carbs: 72, fat: 7,
    ingredients: [i('Pasta', '160 g dry', NOODLES), i('Tomatoes (fresh or canned)', '400 g', TOMATO), i('Beans or chickpeas', '1 can', BEANS), i('Garlic', '2 cloves', GARLIC), i('Onion', '1', ONION, true)],
    steps: ['Cook pasta.', 'Simmer garlic, onion and tomatoes 10 min, add drained beans.', 'Toss with pasta; season well.'],
  },
  {
    id: 'chickpea-curry', name: 'Chickpea & spinach curry', slot: 'main', minutes: 25, servings: 3,
    kcal: 390, protein: 15, carbs: 52, fat: 13,
    ingredients: [i('Chickpeas or lentils', '2 cans', BEANS), i('Curry powder or paste', '2 tbsp', CURRY), i('Onion', '1', ONION), i('Tomatoes', '400 g', TOMATO), i('Spinach or greens', '2 handfuls', GREENS), i('Light coconut milk', '150 ml', COCONUT, true), i('Rice', '150 g dry', RICE, true)],
    steps: ['Soften onion, add curry paste for a minute.', 'Add tomatoes, chickpeas and coconut milk, simmer 15 min.', 'Stir in greens. Serve with rice.'],
  },
  {
    id: 'dhal', name: 'Simple dhal', slot: 'main', minutes: 30, servings: 3,
    kcal: 340, protein: 17, carbs: 50, fat: 7,
    ingredients: [i('Red lentils', '200 g', BEANS), i('Onion', '1', ONION), i('Garlic', '3 cloves', GARLIC), i('Curry powder', '1 tbsp', [...CURRY, 'turmeric', 'cumin']), i('Tomato', '1', TOMATO, true), i('Rice or bread', 'to serve', [...RICE, ...BREAD], true)],
    steps: ['Fry onion, garlic and spices.', 'Add rinsed lentils and 700 ml water, simmer 20 min.', 'Season and serve with rice or roti.'],
  },
  {
    id: 'baked-fish', name: 'Baked fish, potatoes & greens', slot: 'main', minutes: 30, servings: 2,
    kcal: 410, protein: 36, carbs: 38, fat: 12,
    ingredients: [i('Fish fillets', '300 g', FISH), i('Potatoes', '350 g', POTATO), i('Lemon', '1', LEMON), i('Garlic', '2 cloves', GARLIC, true), i('Greens or broccoli', '2 handfuls', [...GREENS, ...BROCCOLI])],
    steps: ['Roast potato chunks at 200 °C for 15 min.', 'Add fish with lemon and garlic, bake 12 min more.', 'Steam the greens and serve.'],
  },
  {
    id: 'salmon-rice', name: 'Salmon rice bowl', slot: 'main', minutes: 20, servings: 2,
    kcal: 520, protein: 34, carbs: 50, fat: 19,
    ingredients: [i('Salmon or fish', '250 g', FISH), i('Rice', '120 g dry', RICE), i('Cucumber', '1', CUCUMBER), i('Soy sauce', '1 tbsp', SOY), i('Avocado', '½', AVOCADO, true), i('Carrot', '1', CARROT, true)],
    steps: ['Cook rice.', 'Pan-sear or air-fry salmon 8–10 min.', 'Build bowls with rice, flaked salmon, cucumber, carrot; drizzle soy.'],
  },
  {
    id: 'beef-mince-bowl', name: 'Lean beef & veg bowl', slot: 'main', minutes: 20, servings: 2,
    kcal: 480, protein: 36, carbs: 44, fat: 16,
    ingredients: [i('Lean beef mince', '250 g', BEEF), i('Onion', '1', ONION), i('Rice or potatoes', '120 g dry rice', [...RICE, ...POTATO]), i('Carrot', '1', CARROT, true), i('Tomatoes', '200 g', TOMATO, true)],
    steps: ['Brown the mince with onion, drain fat.', 'Add grated carrot and tomatoes, simmer 10 min.', 'Serve over rice or potatoes.'],
  },
  {
    id: 'prawn-noodles', name: 'Prawn stir-fried noodles', slot: 'main', minutes: 15, servings: 2,
    kcal: 430, protein: 30, carbs: 55, fat: 9,
    ingredients: [i('Prawns', '250 g', PRAWN), i('Noodles', '150 g dry', NOODLES), i('Garlic', '2 cloves', GARLIC), i('Greens', '2 handfuls', GREENS), i('Soy sauce', '2 tbsp', SOY), i('Egg', '1', EGG, true)],
    steps: ['Boil noodles.', 'Stir-fry garlic and prawns until pink.', 'Add greens, noodles and soy; scramble in the egg.'],
  },
  {
    id: 'mushroom-omelette-rice', name: 'Mushroom egg fried rice', slot: 'main', minutes: 15, servings: 1,
    kcal: 420, protein: 18, carbs: 55, fat: 14,
    ingredients: [i('Cooked rice', '180 g', RICE), i('Eggs', '2', EGG), i('Mushrooms', '100 g', MUSHROOM), i('Soy sauce', '1 tbsp', SOY), i('Garlic', '1 clove', GARLIC, true)],
    steps: ['Fry mushrooms and garlic.', 'Push aside, scramble the eggs.', 'Add rice and soy, toss on high heat.'],
  },
  {
    id: 'chicken-soup', name: 'Chicken vegetable soup', slot: 'main', minutes: 35, servings: 3,
    kcal: 290, protein: 30, carbs: 24, fat: 7,
    ingredients: [i('Chicken', '350 g', CHICKEN), i('Carrot', '2', CARROT), i('Potato', '1', POTATO), i('Onion', '1', ONION), i('Garlic', '2 cloves', GARLIC, true), i('Greens', '1 handful', GREENS, true)],
    steps: ['Simmer chicken with onion, garlic and 1.2 L water for 20 min.', 'Shred chicken, add diced carrot and potato, cook 10 min.', 'Add greens and season.'],
  },
  {
    id: 'sweet-potato-egg', name: 'Sweet potato & egg hash', slot: 'main', minutes: 20, servings: 1,
    kcal: 390, protein: 17, carbs: 45, fat: 15,
    ingredients: [i('Sweet potato', '200 g', POTATO), i('Eggs', '2', EGG), i('Onion', '½', ONION), i('Bell pepper', '½', PEPPER, true), i('Greens', '1 handful', GREENS, true)],
    steps: ['Dice and pan-fry sweet potato until soft (10 min).', 'Add onion and pepper.', 'Make wells, crack in eggs, cover until set.'],
  },
  {
    id: 'cucumber-yogurt-salad', name: 'Cucumber yogurt salad', slot: 'snack', minutes: 5, servings: 1,
    kcal: 120, protein: 9, carbs: 11, fat: 4,
    ingredients: [i('Cucumber', '1', CUCUMBER), i('Yogurt', '120 g', YOGURT), i('Garlic', '½ clove', GARLIC, true), i('Lemon', 'squeeze', LEMON, true)],
    steps: ['Grate or slice cucumber.', 'Mix with yogurt, garlic, lemon and a pinch of salt.'],
  },
  {
    id: 'pb-banana-toast', name: 'Peanut butter banana toast', slot: 'snack', minutes: 4, servings: 1,
    kcal: 280, protein: 9, carbs: 36, fat: 11,
    ingredients: [i('Bread', '1 slice', BREAD), i('Peanut butter', '1 tbsp', PEANUT), i('Banana', '½', BANANA)],
    steps: ['Toast the bread, spread peanut butter, top with banana.'],
  },
  {
    id: 'boiled-eggs', name: 'Boiled eggs & cucumber', slot: 'snack', minutes: 10, servings: 1,
    kcal: 170, protein: 13, carbs: 4, fat: 10,
    ingredients: [i('Eggs', '2', EGG), i('Cucumber', '½', CUCUMBER, true)],
    steps: ['Boil eggs 8–9 minutes, cool, peel.', 'Serve with cucumber sticks and a pinch of salt.'],
  },
  {
    id: 'cheese-toast', name: 'Tomato cheese toastie', slot: 'snack', minutes: 6, servings: 1,
    kcal: 260, protein: 13, carbs: 26, fat: 11,
    ingredients: [i('Bread', '2 slices', BREAD), i('Cheese', '25 g', CHEESE), i('Tomato', '1', TOMATO, true)],
    steps: ['Fill bread with cheese and tomato.', 'Toast in a dry pan, pressing down, until golden.'],
  },
];

const STAPLES = ['salt', 'pepper', 'oil', 'water'];

function normalise(s: string) {
  return s.toLowerCase().trim();
}

export function hasIngredient(ing: RecipeIngredient, pantry: PantryItem[]) {
  const names = pantry.map((p) => normalise(p.name));
  return ing.match.some((m) => names.some((n) => n.includes(m) || (m.length > 3 && m.includes(n) && n.length > 3)));
}

export interface RecipeMatch {
  recipe: Recipe;
  have: RecipeIngredient[];
  missing: RecipeIngredient[];
  score: number; // 0..1 share of required ingredients on hand
}

export function matchRecipes(pantry: PantryItem[]): RecipeMatch[] {
  if (!pantry.length) return [];
  return RECIPES.map((recipe) => {
    const required = recipe.ingredients.filter((x) => !x.optional && !STAPLES.includes(normalise(x.name)));
    const have = recipe.ingredients.filter((x) => hasIngredient(x, pantry));
    const missing = required.filter((x) => !hasIngredient(x, pantry));
    const score = required.length ? (required.length - missing.length) / required.length : 0;
    return { recipe, have, missing, score };
  })
    .filter((m) => m.have.length > 0 && m.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length);
}
