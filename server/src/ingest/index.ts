import { prisma } from "../config/db.js";
import path from "node:path";
import { buildIngestData } from "./transform.js";

const BATCH = 1000;
const dryRun = process.argv.includes("--dry-run");

const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), "src/data");

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }

  return out;
}

async function main(): Promise<void> {
  console.log("Reading data from:", dataDir);

  const { districts, schools, leads, stats } = buildIngestData(dataDir);

  console.log("Prepared data");
  console.log(`Districts: ${stats.districtsTotal}`);
  console.log(`Schools: ${stats.schoolsTotal}`);
  console.log(`Leads: ${leads.length}`);

  if (dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }

  try {
    let n = 0;

    for (const b of chunks(districts, BATCH)) {
      n += (
        await prisma.district.createMany({
          data: b,
          skipDuplicates: true,
        })
      ).count;
    }

    console.log(`Districts inserted: ${n}`);

    n = 0;

    for (const b of chunks(schools, BATCH)) {
      n += (
        await prisma.school.createMany({
          data: b,
          skipDuplicates: true,
        })
      ).count;
    }

    console.log(`Schools inserted: ${n}`);

    n = 0;

    for (const b of chunks(leads, BATCH)) {
      n += (
        await prisma.lead.createMany({
          data: b,
          skipDuplicates: true,
        })
      ).count;
    }

    console.log(`Leads inserted: ${n}`);

    const pending = await prisma.lead.count({
      where: { status: "PENDING" },
    });

    console.log(`Leads in database: ${await prisma.lead.count()}`);
    console.log(`Pending leads: ${pending}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
