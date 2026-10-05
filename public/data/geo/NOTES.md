# Map datasets: notes (retrieved 4 October 2026)

The regional maps have two grains. The **fifteen counties** of the Huntsville crisis-center catchment use the county
table checked for the statewide report, unchanged. The **117 census tracts** of Madison and Cullman counties use two
federal sources retrieved for this pack. Everything here was assembled by `build_geo.py` (kept with the draft masters
in `notes/draft/`) from the files in `raw/`.

## What is in the folder

| File | What it is |
|---|---|
| `ring_counties.csv` | 15 rows: Madison and Cullman (`role` = core) and the thirteen ring counties, with their community mental health center and the 36 county layers of the statewide pack. |
| `alabama_benchmark.csv` | Alabama's value for the same county layers, from the statewide pack's state table. |
| `tracts.csv` | 117 rows, one per census tract: 18 American Community Survey estimates and 10 CDC PLACES estimates, plus the PLACES adult population. |
| `tracts_moe.csv` | The Census Bureau's published margin of error for each of the 18 survey estimates. |
| `benchmarks.csv` | The same 18 survey estimates and margins for Alabama, Madison County and Cullman County, from the same tables. |
| `layers.json` | 65 layer definitions: 36 county layers (`geography: ["county"]`, reference 52) and 29 tract layers (28 map layers and one panel-only denominator; references 406 and 407). |
| `overlays.json` | The core, the crisis catchment, the five community mental health centers, the two 2-1-1 centers, and 54 service locations. |
| `raw/` | The retrieved strings, the check record, the retrieval metadata, the geocoding record and SHA-256 sums. |

## How the tract data was retrieved

The research environment cannot reach census.gov or cdc.gov, so the tract data was fetched in the browser on the
builder's own computer, as the statewide map data was. Each raw file is the compact string built in the browser from
the publisher's own response, typed to disk, and then checked against values computed in the browser before it was
typed: the string's length, a whole-string hash, and for every column the sum and the count of non-empty cells. All
three files matched exactly (`raw/checks.md`). Every tract layer is `retrieval: "browser-js"`.

- **American Community Survey.** The keyed service at api.census.gov now requires an API key and was not used. The
  values come from the endpoint that the data.census.gov table pages themselves call, for tables DP02, DP03, DP04 and
  DP05 of the 2020-2024 five-year release. Variable codes were chosen by their printed labels, which are recorded in
  `raw/retrieval_meta.json`. Percentages are the Bureau's own published percentages (the `PE` variables); nothing was
  computed from counts.
- **Suppressed and not-applicable cells.** One estimate is suppressed: the share of renters paying 35 percent or more
  of income in rent, for Census Tract 106.30 in Madison County (the Bureau prints "-"). Its cell and its margin are
  empty. For Alabama and the two counties, the population total and two percentages are controlled estimates with no
  margin of error (the Bureau prints "*****"); those margin cells are empty and mean "not applicable", not "missing".
- **CDC PLACES.** The 2025 release, GIS-friendly tract file (dataset `yjkw-uj5s`, rows updated 4 December 2025),
  filtered to the two counties: 117 rows, the same tracts as the survey tables. Ten crude-prevalence measures were
  taken. CDC also publishes a 95 percent confidence interval for each value; the intervals were not retrieved, and
  each layer's caveat says so.
- **Tract names** are derived from the tract code (for example `01089010630` is "Census Tract 106.30").

## How to read the two kinds of tract value

The survey values are **sample estimates** with margins of error that are often wide at tract level: a tract's
poverty rate of 20 percent with a margin of 10 points is somewhere between 10 and 30. Show the margin with every
value, and do not rank tracts whose ranges overlap. The PLACES values are **model-based**: CDC predicts each tract
from the statewide health survey and the tract's population mix, so tracts with similar populations get similar
values by construction. They show a pattern across tracts and are not a measurement of any one tract. Neither set of
values is used in the report's text.

## Tract boundaries are not in the pack

The pack carries no geometry. The app fetches the Census Bureau's cartographic boundary file for Alabama's census
tracts when it is built, keeps the 117 tracts of counties 089 and 043, and checks that their identifiers match
`tracts.csv` exactly (the KICKOFF gives the address and the test). The PLACES dataset's own description says its
tract estimates join to the 2023 tract boundary file. County geometry comes from the same package the statewide site
uses.

## Service locations

The 54 locations are places the report names with a street address in a cited source; `ref` on each is the reference
that prints the address. They were placed by geocoding on 4 October 2026, in this order: the Census Bureau's
geocoder (address ranges, current benchmark); where it had no match or matched the wrong street, OpenStreetMap's
Nominatim; and for one campus, the federal treatment locator. `precision` on each point says how far to trust it.

- **`address` (46 points).** The geocoder matched the printed address. Where the source gave no street quadrant
  (Huntsville addresses end in NW, NE, SW or SE) and the geocoder had exactly one match, that match was used and the
  note says so.
- **`approximate` (6 points).** WellStone's Huntsville campus, 4020 and 4040 Memorial Parkway SW, is in neither
  geocoder. Its three markers (the adult crisis center, the pediatric unit and the clinic) use the coordinate that
  SAMHSA's FindTreatment.gov locator gives for WellStone's mental health record at 4040. The locator's substance use
  record for the same address gives a different point, about 1.7 km south, so the position needs a person to confirm
  it. The other approximate points are one HAPPI Health site with two possible quadrants 160 meters apart, the Cullman
  treatment center matched on "Commerce St", and Mountain View Hospital matched on "Scenic Hwy".
- **No marker (2 points).** The Huntsville Vet Center (415 Church Street matches both NW and SW, 900 meters apart)
  and CED's Cherokee County office (no match in either geocoder). They are listed without coordinates.
- A geocoded point is where the address range falls on the street, not the building's front door. Do not present
  the markers as surveyed positions.
- The list is the places the report happens to name with an address. It is not a directory of services, and a tract
  with no marker is not a tract with no services.

## Overlays

- **Crisis catchment** (15 counties) and **community mental health centers** (five centers, one per county) come
  from the Department of Mental Health's pages as read for the statewide report and re-read on 4 October 2026.
  WellStone and Mountain Lakes carry a certified-clinic flag with the month the report gives.
- **2-1-1** lists the counties each of the two centers names on its own page. Seven ring counties are named by
  neither and are left unassigned.
- Not encoded: public health districts, councils of governments, area agencies on aging, homelessness continuums and
  Medicaid regions. The report describes them in prose (Section 13), and the county lists were not all read in a form
  that could be checked row by row.

## Things that need a human eye

- The position of WellStone's Huntsville campus (above).
- County layers are a year or more older than some tract layers and use different definitions (QuickFacts "persons
  in poverty" against the survey's five-year poverty rate, for example). Do not put a county value and a tract value
  in the same sentence without their vintages.
- Small renter counts make several tract housing figures unstable: margins of 40 to 88 points appear for the
  rent-burden layer in `tracts_moe.csv`.
