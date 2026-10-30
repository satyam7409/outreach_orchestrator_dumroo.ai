import sys
from pathlib import Path
import pandas as pd

CHUNK = 200_000
NO_CAT = "No Category Codes"
TOTAL_ROWS = ["Education Unit Total",
              "Derived - Education Unit Total minus Adult Education Count"]

def find_file(prefix):
    """Find ccd_<prefix>_052_*  (csv or xlsx) in the current folder."""
    hits = [p for p in Path(".").iterdir()
            if p.name.lower().startswith(f"ccd_{prefix}_052_")
            and p.suffix.lower() in (".csv", ".xlsx")]
    if not hits:
        sys.exit(f"Could not find a file starting with ccd_{prefix}_052_ in this folder")
    return hits[0]

def read_chunks(path):
    if path.suffix.lower() == ".csv":
        yield from pd.read_csv(path, dtype=str, chunksize=CHUNK, low_memory=False)
    else:  # xlsx cannot be chunked, so this is slow and memory heavy
        yield pd.read_excel(path, dtype=str)

def col(df, *names):
    upper = {c.upper(): c for c in df.columns}
    for n in names:
        if n in upper:
            return upper[n]
    return None

def extract(path, id_names, out_name):
    print(f"\nReading {path.name} ...")
    parts = []
    printed_cols = False
    for chunk in read_chunks(path):
        if not printed_cols:
            print("Columns:", list(chunk.columns))
            printed_cols = True
        st   = col(chunk, "ST")
        fips = col(chunk, "FIPST")
        idc  = col(chunk, *id_names)
        grade, race, sex = col(chunk, "GRADE"), col(chunk, "RACE_ETHNICITY"), col(chunk, "SEX")
        ind, cnt = col(chunk, "TOTAL_INDICATOR"), col(chunk, "STUDENT_COUNT")
        flag = col(chunk, "DMS_FLAG")
        if None in (idc, grade, race, sex, ind, cnt):
            sys.exit(f"Missing an expected column. Found: {list(chunk.columns)}")

        if st:
            nj = chunk[chunk[st].str.strip().str.upper() == "NJ"]
        elif fips:
            nj = chunk[chunk[fips].str.strip().isin(["34", "34.0"])]
        else:
            sys.exit("No ST or FIPST column found")

        tot = nj[
            nj[ind].str.strip().isin(TOTAL_ROWS)
            & (nj[grade].str.strip() == NO_CAT)
            & (nj[race].str.strip() == NO_CAT)
            & (nj[sex].str.strip() == NO_CAT)
        ]
        keep = tot[[idc, ind, cnt] + ([flag] if flag else [])].copy()
        keep.columns = ["id", "indicator", "raw_count"] + (["flag"] if flag else [])
        parts.append(keep)

    df = pd.concat(parts, ignore_index=True)
    df["count"] = pd.to_numeric(df["raw_count"], errors="coerce")
    df.loc[df["count"] < 0, "count"] = None            # negative = special codes

    # prefer the plain "Education Unit Total" row, fall back to the Derived one
    df["rank"] = (df["indicator"].str.strip() != TOTAL_ROWS[0]).astype(int)
    df = df.sort_values(["id", "rank"])

    # check: do the two total rows ever disagree?
    pivot = df.pivot_table(index="id", columns="rank", values="count", aggfunc="first")
    if 0 in pivot.columns and 1 in pivot.columns:
        diff = pivot[(pivot[0].notna()) & (pivot[1].notna()) & (pivot[0] != pivot[1])]
        print(f"Rows where Education Unit Total != Derived total: {len(diff)}")

    # one row per id: first non-null count
    out = (df.groupby("id", as_index=False)["count"]
             .apply(lambda s: s.dropna().iloc[0] if s.notna().any() else None))
    out.columns = ["id", "enrollment"]
    out["enrollment"] = out["enrollment"].astype("Int64")

    print(f"Rows (unique IDs): {len(out)}")
    print(f"Missing enrollment: {out['enrollment'].isna().sum()}")
    print(out["enrollment"].describe())
    out.to_csv(out_name, index=False)
    print(f"Wrote {out_name}")

extract(find_file("lea"), ["LEAID"],   "nj_district_enrollment.csv")
extract(find_file("sch"), ["NCESSCH"], "nj_school_enrollment.csv")