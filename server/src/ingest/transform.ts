import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { faker } from "@faker-js/faker";
import { z } from "zod";
import type {DistrictRecord,SchoolRecord,LeadRecord,IngestStats,IngestData}  from "../types.js"


// ---------- Rules ----------
const EXCLUDED_DISTRICT_TYPES = new Set([
  "State operated agency",
  "Service agency",
]);

// ---------- CSV Schemas ----------

const text = z.string().transform((s) => s.trim());

const districtRow = z.object({
  LEAID: text,
  LEA_NAME: text,
  LCITY: text,
  LZIP: text,
  PHONE: text,
  WEBSITE: text,
  LEA_TYPE_TEXT: text,
  OPERATIONAL_SCHOOLS: text,
});

const schoolRow = z.object({
  NCESSCH: text,
  LEAID: text,
  SCH_NAME: text,
  LCITY: text,
  LZIP: text,
  PHONE: text,
  WEBSITE: text,
  SCH_TYPE_TEXT: text,
  CHARTER_TEXT: text,
  LEVEL: text,
  GSLO: text,
  GSHI: text,
});

const enrollmentRow = z.object({
  id: text,
  enrollment: text,
});

// ---------- Helpers ----------

function readCsv<T>(
  file: string,
  schema: z.ZodType<T>
): T[] {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing data file: ${file}`);
  }

  const raw: unknown[] = parse(fs.readFileSync(file), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  return raw.map((row: unknown, i: number): T => {
    const result = schema.safeParse(row);

    if (!result.success) {
      const issue = result.error.issues[0];

      throw new Error(
        `${path.basename(file)} row ${i + 2}: ${
          issue?.message
        } (${issue?.path.join(".")})`
      );
    }

    return result.data;
  });
}

const orNull = (s: string): string | null =>
  s === "" ? null : s;

const toInt = (s: string): number | null => {
  if (s === "") return null;

  const n = Number(s);

  return Number.isFinite(n) ? Math.trunc(n) : null;
};

function loadEnrollment(file: string): Map<string, number | null> {
  const map = new Map<string, number | null>();

  for (const row of readCsv(file, enrollmentRow)) {
    map.set(row.id, toInt(row.enrollment));
  }

  return map;
}

// ---------- Mock Admin ----------

function hashSeed(s: string): number {
  let h = 0x811c9dc5;

  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  return h >>> 0;
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30) || "school";

export function mockAdmin(
  key: string,
  orgName: string
): {
  adminName: string;
  adminEmail: string;
} {
  faker.seed(hashSeed(key));

  const first = faker.person.firstName();
  const last = faker.person.lastName();

  const local = `${first}.${last}`
    .toLowerCase()
    .replace(/[^a-z.]/g, "");

  return {
    adminName: `${first} ${last}`,
    adminEmail: `${local}@${slug(orgName)}.example.org`,
  };
}

// ---------- Main Ingestion Logic ----------

export function buildIngestData(dataDir: string): IngestData {
  const districtRows = readCsv(
    path.join(dataDir, "nj_districts.csv"),
    districtRow
  );

  const schoolRows = readCsv(
    path.join(dataDir, "nj_schools.csv"),
    schoolRow
  );

  const districtEnrollment = loadEnrollment(
    path.join(dataDir, "nj_district_enrollment.csv")
  );

  const schoolEnrollment = loadEnrollment(
    path.join(dataDir, "nj_school_enrollment.csv")
  );

  // Transform districts

  const districts: DistrictRecord[] = districtRows.map((r) => ({
    leaid: r.LEAID,
    name: r.LEA_NAME,
    city: orNull(r.LCITY),
    zip: orNull(r.LZIP),
    phone: orNull(r.PHONE),
    website: orNull(r.WEBSITE),
    leaType: orNull(r.LEA_TYPE_TEXT),
    schoolCount: toInt(r.OPERATIONAL_SCHOOLS),
    enrollment: districtEnrollment.get(r.LEAID) ?? null,
  }));

  const districtById = new Map(
    districts.map((d) => [d.leaid, d])
  );

  // Transform schools

  const schools: SchoolRecord[] = schoolRows.map((r) => {
    if (!districtById.has(r.LEAID)) {
      throw new Error(
        `School ${r.NCESSCH} references unknown district ${r.LEAID}`
      );
    }

    return {
      ncessch: r.NCESSCH,
      districtId: r.LEAID,
      name: r.SCH_NAME,
      city: orNull(r.LCITY),
      zip: orNull(r.LZIP),
      phone: orNull(r.PHONE),
      website: orNull(r.WEBSITE),
      schoolType: orNull(r.SCH_TYPE_TEXT),
      level: orNull(r.LEVEL),
      gradeLow: orNull(r.GSLO),
      gradeHigh: orNull(r.GSHI),
      isCharter: r.CHARTER_TEXT.toLowerCase() === "yes",
      enrollment: schoolEnrollment.get(r.NCESSCH) ?? null,
    };
  });

  // Statistics

  const stats: IngestStats = {
    districtsTotal: districts.length,
    schoolsTotal: schools.length,
    schoolLeads: 0,
    districtLeads: 0,
    skippedSchools: {
      noEnrollment: 0,
      excludedParent: 0,
    },
    skippedDistricts: {
      noEnrollment: 0,
      excludedType: 0,
    },
  };

  const leads: LeadRecord[] = [];

  // Generate school leads

  for (const school of schools) {
    if (!school.enrollment || school.enrollment <= 0) {
      stats.skippedSchools.noEnrollment++;
      continue;
    }

    const parent = districtById.get(school.districtId)!;

    if (
      parent.leaType &&
      EXCLUDED_DISTRICT_TYPES.has(parent.leaType)
    ) {
      stats.skippedSchools.excludedParent++;
      continue;
    }

    const sourceKey = `school:${school.ncessch}`;

    leads.push({
      sourceKey,
      role: "PRINCIPAL",
      ...mockAdmin(sourceKey, school.name),
      phone: school.phone,
      districtId: school.districtId,
      schoolId: school.ncessch,
    });

    stats.schoolLeads++;
  }

  // Generate district leads

  for (const district of districts) {
    if (!district.enrollment || district.enrollment <= 0) {
      stats.skippedDistricts.noEnrollment++;
      continue;
    }

    if (
      district.leaType &&
      EXCLUDED_DISTRICT_TYPES.has(district.leaType)
    ) {
      stats.skippedDistricts.excludedType++;
      continue;
    }

    const sourceKey = `district:${district.leaid}`;

    leads.push({
      sourceKey,
      role: "DISTRICT_ADMIN",
      ...mockAdmin(sourceKey, district.name),
      phone: district.phone,
      districtId: district.leaid,
      schoolId: null,
    });

    stats.districtLeads++;
  }

  return {
    districts,
    schools,
    leads,
    stats,
  };
}
