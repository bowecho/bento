import { neonConfig, Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import ws from "ws";

config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

const foods = [
  { name: "Eggs", pairsWellWith: "Cheese, English muffins, whole-grain toast, tortillas" },
  { name: "Hard-boiled eggs", pairsWellWith: "Fruit, turkey sandwich meat, cheese, whole-grain crackers" },
  { name: "Scrambled eggs", pairsWellWith: "Cheese, whole-grain toast, English muffins" },
  { name: "Greek yogurt", pairsWellWith: "Berries, strawberries, bananas, cereal, lower-sugar granola, oats" },
  { name: "Yogurt", pairsWellWith: "Apples, bananas, grapes, berries, oranges, cereal" },
  { name: "Milk", pairsWellWith: "Original Cheerios, Multigrain Cheerios, Wheat Chex, shredded wheat, Kix, Raisin Bran, oats" },
  { name: "Cheese", pairsWellWith: "Eggs, tortillas, refried beans, chicken, turkey sandwich meat, whole-grain bread" },
  { name: "Cheese sticks", pairsWellWith: "Apples, grapes, oranges, whole-grain crackers, pretzels, popcorn" },
  { name: "Cheese slices", pairsWellWith: "Turkey sandwich meat, whole-grain bread, English muffins, eggs" },
  { name: "Cheese cubes", pairsWellWith: "Apples, grapes, turkey pepperoni, whole-grain crackers" },
  { name: "Turkey sandwich meat", pairsWellWith: "Cheese slices, whole-grain bread, tortillas, whole-grain crackers, fruit" },
  { name: "Turkey pepperoni", pairsWellWith: "Cheese cubes, cheese sticks, whole-grain crackers, fruit" },
  { name: "Turkey sausage", pairsWellWith: "Eggs, cheese, English muffins, whole-grain toast" },
  { name: "Ground turkey", pairsWellWith: "Rice, beans, corn, salsa, tortillas, cheese" },
  { name: "Chicken", pairsWellWith: "Rice, carrots, tortillas, cheese, refried beans" },
  { name: "Steak", pairsWellWith: "Rice, carrots, corn, salsa" },
  { name: "Refried beans", pairsWellWith: "Tortillas, cheese, chicken, rice, salsa" },
  { name: "Beans", pairsWellWith: "Rice, ground turkey, cheese, corn, salsa" },
  { name: "Peanut butter", pairsWellWith: "Apples, bananas, whole-grain bread, whole-grain toast, pretzels, jelly" },
  { name: "Whole-grain bread", pairsWellWith: "Turkey sandwich meat, cheese slices, peanut butter, jelly, eggs" },
  { name: "Whole-grain toast", pairsWellWith: "Eggs, peanut butter, bananas, berries, Greek yogurt" },
  { name: "English muffins", pairsWellWith: "Eggs, cheese, turkey sausage" },
  { name: "Tortillas", pairsWellWith: "Turkey sandwich meat, cheese, refried beans, chicken, ground turkey, salsa", avoidPairingWith: "Chocolate chips" },
  { name: "White rice", pairsWellWith: "Chicken, steak, ground turkey, beans, refried beans, carrots, corn" },
  { name: "Brown rice", pairsWellWith: "Chicken, steak, ground turkey, beans, refried beans, carrots, corn" },
  { name: "Whole-grain crackers", pairsWellWith: "Turkey sandwich meat, turkey pepperoni, cheese, hard-boiled eggs, fruit" },
  { name: "Pretzels", pairsWellWith: "Cheese sticks, peanut butter" },
  { name: "Popcorn", pairsWellWith: "Cheese sticks" },
  { name: "Oats", pairsWellWith: "Milk, Greek yogurt, strawberries, berries, bananas" },
  { name: "Overnight oats", pairsWellWith: "Greek yogurt, strawberries, berries, bananas" },
  { name: "Original Cheerios", pairsWellWith: "Milk, Greek yogurt, berries, bananas" },
  { name: "Multigrain Cheerios", pairsWellWith: "Milk, Greek yogurt, berries, bananas" },
  { name: "Wheat Chex", pairsWellWith: "Milk, Greek yogurt, berries, bananas" },
  { name: "Shredded wheat", pairsWellWith: "Milk, Greek yogurt, berries, bananas" },
  { name: "Kix", pairsWellWith: "Milk, Greek yogurt, berries, bananas" },
  { name: "Raisin Bran", pairsWellWith: "Milk, Greek yogurt, bananas" },
  { name: "Lower-sugar granola", pairsWellWith: "Greek yogurt, milk, berries, strawberries, bananas, Original Cheerios" },
  { name: "Apples", pairsWellWith: "Peanut butter, cheese cubes, cheese sticks, yogurt" },
  { name: "Bananas", pairsWellWith: "Peanut butter, Greek yogurt, yogurt, oats, cereal" },
  { name: "Grapes", pairsWellWith: "Cheese sticks, cheese cubes, turkey sandwich meat, yogurt" },
  { name: "Berries", pairsWellWith: "Greek yogurt, yogurt, cereal, oats, whole-grain toast" },
  { name: "Strawberries", pairsWellWith: "Greek yogurt, yogurt, overnight oats, cereal" },
  { name: "Oranges", pairsWellWith: "Cheese sticks, hard-boiled eggs, yogurt" },
  { name: "Carrots", pairsWellWith: "Chicken, turkey sandwich meat, rice, cheese" },
  { name: "Corn", pairsWellWith: "Rice, ground turkey, chicken, beans, salsa" },
  { name: "Salsa", pairsWellWith: "Ground turkey, beans, rice, tortillas, cheese" },
  { name: "Jelly", pairsWellWith: "Peanut butter, whole-grain bread" },
].map((food) => ({ avoidPairingWith: "", ...food }));

const categoryNames = {
  protein: [
    "Eggs", "Hard-boiled eggs", "Scrambled eggs", "Turkey sandwich meat",
    "Turkey pepperoni", "Turkey sausage", "Ground turkey", "Chicken", "Steak",
    "Refried beans", "Beans", "Peanut butter",
  ],
  fruit: ["Apples", "Bananas", "Grapes", "Berries", "Strawberries", "Oranges"],
  vegetable: ["Carrots", "Corn"],
  dairy: ["Greek yogurt", "Yogurt", "Milk", "Cheese", "Cheese sticks", "Cheese slices", "Cheese cubes"],
  grain_starch: [
    "Whole-grain bread", "Whole-grain toast", "English muffins", "Tortillas",
    "White rice", "Brown rice", "Whole-grain crackers", "Pretzels", "Popcorn",
    "Oats", "Overnight oats", "Original Cheerios", "Multigrain Cheerios",
    "Wheat Chex", "Shredded wheat", "Kix", "Raisin Bran", "Lower-sugar granola",
  ],
  pantry_extra: ["Salsa", "Jelly"],
};

const categoryByName = new Map(
  Object.entries(categoryNames).flatMap(([category, names]) => names.map((name) => [name, category])),
);

function referencedNames(value) {
  return value.split(/[,;\n]+/).map((name) => name.trim().toLowerCase()).filter(Boolean);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query("delete from food_item");
  await client.query("delete from ai_generation_rate_limit");
  const foodIdsByName = new Map();
  for (const food of foods) {
    const result = await client.query(
      "insert into food_item (name, category) values ($1, $2) returning id",
      [food.name, categoryByName.get(food.name) ?? "pantry_extra"],
    );
    foodIdsByName.set(food.name.toLowerCase(), result.rows[0].id);
  }
  for (const food of foods) {
    const sourceFoodId = foodIdsByName.get(food.name.toLowerCase());
    for (const [kind, names] of [
      ["pairs_well", referencedNames(food.pairsWellWith)],
      ["avoid", referencedNames(food.avoidPairingWith)],
    ]) {
      for (const name of names) {
        const targetFoodId = foodIdsByName.get(name);
        if (!targetFoodId || targetFoodId === sourceFoodId) continue;
        await client.query(
          "insert into food_relationship (source_food_id, target_food_id, kind) values ($1, $2, $3), ($2, $1, $3) on conflict do nothing",
          [sourceFoodId, targetFoodId, kind],
        );
      }
    }
  }
  await client.query("commit");
  console.log(`Seeded ${foods.length} foods with pairing guidance.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
