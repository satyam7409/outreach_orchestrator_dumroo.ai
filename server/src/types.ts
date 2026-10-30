export type LeadRole = "PRINCIPAL" | "DISTRICT_ADMIN";

export interface DistrictRecord {
  leaid: string;
  name: string;
  city: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  leaType: string | null;
  schoolCount: number | null;
  enrollment: number | null;
}

export interface SchoolRecord {
  ncessch: string;
  districtId: string;
  name: string;
  city: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  schoolType: string | null;
  level: string | null;
  gradeLow: string | null;
  gradeHigh: string | null;
  isCharter: boolean;
  enrollment: number | null;
}

export interface LeadRecord {
  sourceKey: string;
  role: LeadRole;
  adminName: string;
  adminEmail: string;
  phone: string | null;
  districtId: string;
  schoolId: string | null;
}

export interface IngestStats {
  districtsTotal: number;
  schoolsTotal: number;
  schoolLeads: number;
  districtLeads: number;
  skippedSchools: {
    noEnrollment: number;
    excludedParent: number;
  };
  skippedDistricts: {
    noEnrollment: number;
    excludedType: number;
  };
}

export interface IngestData {
  districts: DistrictRecord[];
  schools: SchoolRecord[];
  leads: LeadRecord[];
  stats: IngestStats;
}