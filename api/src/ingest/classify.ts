import { Type } from "@google/genai";
import { pool } from "../db";
import { generateJson } from "../../../ai/gemini";
import { config } from "../../../ai/config";

// Decides, once per concept, which chain is the natural comparison ("default_chain").
// The answer is stored on concept.default_chain, so search never calls Gemini for this.
// Payload: {} classifies concepts that have no default_chain yet.
//          { "force": true } re-classifies every concept (overwrites manual edits).
// To fix one by hand:  UPDATE concept SET default_chain = 'Starbucks' WHERE id = 'matcha_latte';
// Hand edits survive, because only NULL rows are touched unless force is set.

const schema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { conceptId: { type: Type.STRING }, chain: { type: Type.STRING } },
        required: ["conceptId", "chain"],
      },
    },
  },
  required: ["results"],
};

const BATCH = 80;

export async function runClassifyConcepts(payload: Record<string, unknown>): Promise<void> {
  if (process.env.AI_REAL !== "1") throw new Error("AI_REAL=1 is not set; refusing to write stub data");
  const force = payload.force === true;

  const { rows: chainRows } = await pool.query(
    `SELECT cr.chain_name, array_agg(DISTINCT c.name ORDER BY c.name) AS sells
       FROM chain_reference cr JOIN concept c ON c.id = cr.concept_id
      GROUP BY cr.chain_name ORDER BY cr.chain_name`,
  );
  if (chainRows.length === 0) throw new Error("no chains in chain_reference yet");
  const chains: string[] = chainRows.map((r) => r.chain_name);

  const { rows: targets } = await pool.query(
    `SELECT id, name, aliases FROM concept WHERE $1::boolean OR default_chain IS NULL ORDER BY id`,
    [force],
  );
  if (targets.length === 0) { console.log("classify_concepts: nothing to do"); return; }

  // One chain: no judgment needed.
  if (chains.length === 1) {
    await pool.query(`UPDATE concept SET default_chain = $1 WHERE id = ANY($2)`, [chains[0], targets.map((t) => t.id)]);
    console.log(`classify_concepts: only one chain (${chains[0]}), set ${targets.length} concepts`);
    return;
  }

  const system = `You decide which chain is the most natural price comparison for a drink, for an app that compares local cafes to chains.
Chains and what they sell:
${chainRows.map((r) => `- ${r.chain_name}: ${r.sells.join(", ")}`).join("\n")}

Rules:
- For each drink concept, pick the one chain whose menu it most resembles, meaning the chain a customer who wants this drink would compare against.
- If a chain's list above includes this exact drink, pick that chain.
- Otherwise judge by the kind of drink: espresso, coffee and milk-and-espresso drinks go to the coffee chain; boba, milk tea, fruit tea, cheese foam and slushes go to the tea chain; ambiguous drinks (matcha, chai, hot chocolate, lemonade) go to the chain that sells the closest drink.
- Answer with a chain name exactly as written above. Never invent a chain.`;

  let updated = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const prompt = batch
      .map((t) => `${t.id}: ${t.name}${t.aliases?.length ? " (" + t.aliases.slice(0, 6).join(", ") + ")" : ""}`)
      .join("\n");
    const out = await generateJson<{ results: { conceptId: string; chain: string }[] }>({
      model: config.models.fast, system, prompt, schema,
    });
    const valid = new Set(batch.map((t) => t.id));
    for (const r of out.results) {
      if (!valid.has(r.conceptId) || !chains.includes(r.chain)) continue; // ignore anything off-list
      await pool.query(`UPDATE concept SET default_chain = $2 WHERE id = $1`, [r.conceptId, r.chain]);
      updated++;
    }
  }
  console.log(`classify_concepts: ${updated} of ${targets.length} concepts assigned across ${chains.join(", ")}`);
}