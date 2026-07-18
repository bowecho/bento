import { neonConfig, Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import ws from "ws";

config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

const starterCategories = [
  "Protein",
  "Fruit",
  "Vegetable",
  "Dairy",
  "Grain & Starch",
  "Pantry & Extras",
];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query("delete from meal_plan_item");
  await client.query("delete from food_item");
  await client.query("delete from food_category_record");

  for (const [index, name] of starterCategories.entries()) {
    await client.query(
      "insert into food_category_record (name, sort_order) values ($1, $2)",
      [name, index + 1],
    );
  }

  await client.query("commit");
  console.log(`Reset Bento to an empty food library with ${starterCategories.length} categories.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
