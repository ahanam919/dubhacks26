import "./env";
import { pool } from "./db";
import { runIngest } from "./ingest/pipeline";
import { runDiscover } from "./ingest/discover";

const POLL_MS = 3000;
const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

type Job = { id: string; type: string; payload: Record<string, unknown>; attempts: number };

// One atomic statement: pick the oldest queued job and mark it running.
// SKIP LOCKED means two workers never grab the same job.
async function claimJob(): Promise<Job | null> {
  const { rows } = await pool.query(
    `UPDATE job
        SET status = 'running', started_at = now(), attempts = attempts + 1
      WHERE id = (
        SELECT id FROM job WHERE status = 'queued'
        ORDER BY created_at LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, type, payload, attempts`,
  );
  return rows[0] ?? null;
}

// Success -> done. Failure -> back in the queue, until it has used all its attempts.
async function finish(job: Job, error?: string) {
  const status = !error ? "done" : job.attempts >= MAX_ATTEMPTS ? "failed" : "queued";
  await pool.query(
    `UPDATE job SET status = $2, error = $3, finished_at = now() WHERE id = $1`,
    [job.id, status, error ?? null],
  );
}

async function main() {
  // A crash can leave a job stuck as 'running'. Put old ones back in the queue.
  await pool.query(
    `UPDATE job SET status = 'queued'
      WHERE status = 'running' AND started_at < now() - interval '10 minutes'`,
  );
  console.log("worker started");

  while (!stopping) {
    const job = await claimJob();
    if (!job) { await sleep(POLL_MS); continue; }

    console.log(`job ${job.id} (${job.type}) attempt ${job.attempts}`);
    try {
      if (job.type === "ingest_shop") await runIngest(job.payload);
      else if (job.type === "discover_area") await runDiscover(job.payload);
      else throw new Error(`unknown job type: ${job.type}`);
      await finish(job);
      console.log(`job ${job.id} done`);
    } catch (err) {
      console.error(`job ${job.id} failed`, err);
      await finish(job, err instanceof Error ? err.message : String(err));
    }
  }
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });