"""
Script 1: prepare the NCES CCD *Directory* files (schools + districts).

Input  (same folder): ccd_lea_029_2425_*  and  ccd_sch_029_2425_*   (.csv or .xlsx)
Output: prepared/nj_districts.csv, prepared/nj_schools.csv

Keeps New Jersey only, drops closed/inactive records, keeps the columns the
app needs, and keeps IDs and ZIP codes as zero-padded text.
Run:  python prepare_directory.py
"""
import sys
from pathlib import Path
import pandas as pd

KEEP_STATUS = {"Open", "New", "Reopened"}   # drops Closed, Inactive, Future

LEA_COLS = ["LEAID", "LEA_NAME", "LCITY", "LZIP", "PHONE", "WEBSITE",
            "LEA_TYPE_TEXT", "CHARTER_LEA_TEXT", "GSLO", "GSHI", "OPERATIONAL_SCHOOLS"]
SCH_COLS = ["NCESSCH", "LEAID", "SCH_NAME", "LEA_NAME", "LCITY", "LZIP", "PHONE",
            "WEBSITE", "SCH_TYPE_TEXT", "CHARTER_TEXT", "LEVEL", "GSLO", "GSHI"]
REQUIRED_LEA = {"ST", "LEAID", "LEA_NAME", "SY_STATUS_TEXT"}
REQUIRED_SCH = {"ST", "NCESSCH", "LEAID", "SCH_NAME", "SY_STATUS_TEXT"}

OUT = Path("prepared")
OUT.mkdir(exist_ok=True)


def find_file(prefix):
    hits = [p for p in Path(".").iterdir()
            if p.name.lower().startswith(f"ccd_{prefix}_029_2425")
            and p.suffix.lower() in (".csv", ".xlsx")]
    if not hits:
        sys.exit(f"Could not find ccd_{prefix}_029_2425_* in this folder")
    return hits[0]


def load(path):
    print(f"\nReading {path.name} ...")
    if path.suffix.lower() == ".csv":
        df = pd.read_csv(path, dtype=str, low_memory=False)
    else:
        df = pd.read_excel(path, dtype=str)   # slow for big xlsx, but works
    df.columns = [c.strip().upper() for c in df.columns]
    print("Columns:", list(df.columns))
    return df


def clean(df, wanted, required, id_widths):
    missing_req = required - set(df.columns)
    if missing_req:
        sys.exit(f"Missing required columns: {sorted(missing_req)}")
    for c in wanted:
        if c not in df.columns:
            print(f"WARNING: column {c} not found, leaving it empty")
            df[c] = None

    df = df[df["ST"].str.strip().str.upper() == "NJ"]
    print("NJ rows:", len(df))
    print("Status values:\n", df["SY_STATUS_TEXT"].value_counts().to_string())
    df = df[df["SY_STATUS_TEXT"].str.strip().isin(KEEP_STATUS)].copy()
    print("After keeping Open/New/Reopened:", len(df))

    for col, width in id_widths.items():
        df[col] = df[col].str.strip().str.replace(r"\.0$", "", regex=True).str.zfill(width)
    df["LZIP"] = (df["LZIP"].astype("string").str.strip()
                  .str.replace(r"\.0$", "", regex=True).str.zfill(5))
    return df[wanted]


def match_rate(df, key, enrollment_file):
    for folder in (OUT, Path(".")):
        p = folder / enrollment_file
        if p.exists():
            e = pd.read_csv(p, dtype={"id": str})
            print(f"Match against {enrollment_file}: {df[key].isin(e['id']).mean():.1%}")
            return
    print(f"({enrollment_file} not found yet, skipped match check)")


# districts
lea = clean(load(find_file("lea")), LEA_COLS, REQUIRED_LEA, {"LEAID": 7})
print("Duplicate LEAID:", lea["LEAID"].duplicated().sum())
match_rate(lea, "LEAID", "nj_district_enrollment.csv")
lea.to_csv(OUT / "nj_districts.csv", index=False)
print("Wrote prepared/nj_districts.csv with", len(lea), "rows")

# schools
sch = clean(load(find_file("sch")), SCH_COLS, REQUIRED_SCH, {"NCESSCH": 12, "LEAID": 7})
print("Duplicate NCESSCH:", sch["NCESSCH"].duplicated().sum())
print("Schools whose LEAID is not in the district file:", (~sch["LEAID"].isin(lea["LEAID"])).sum())
match_rate(sch, "NCESSCH", "nj_school_enrollment.csv")
sch.to_csv(OUT / "nj_schools.csv", index=False)
print("Wrote prepared/nj_schools.csv with", len(sch), "rows")