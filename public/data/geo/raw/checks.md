# Retrieval checks: in-browser (JS) against on-disk (Python)

Each raw file is the compact string built in the browser from the publisher's own response, typed to disk, and then checked against values computed in the browser before it was typed: the length of the string, a whole-string hash (h = h*31 + character code, mod 1,000,000,007), and for every column the sum and the count of non-empty cells. Retrieved 4 October 2026.


## raw/acs2024_5yr_profile_tracts.csv  (120 rows)

Whole string: length JS 11974 / Python 11974; hash JS 715552189 / Python 715552189; OK

| column | JS sum | JS count | Python sum | Python count | match |
|---|---|---|---|---|---|
| pop_total | 6079336.00 | 120 | 6079336.00 | 120 | OK |
| pct_under18 | 2565.50 | 120 | 2565.50 | 120 | OK |
| pct_65plus | 2026.60 | 120 | 2026.60 | 120 | OK |
| pct_black | 2420.10 | 120 | 2420.10 | 120 | OK |
| pct_hispanic | 816.30 | 120 | 816.30 | 120 | OK |
| pct_white_nh | 7941.20 | 120 | 7941.20 | 120 | OK |
| pct_veterans | 1202.70 | 120 | 1202.70 | 120 | OK |
| median_hh_income | 10206031.00 | 120 | 10206031.00 | 120 | OK |
| pct_poverty | 1455.30 | 120 | 1455.30 | 120 | OK |
| unemployment_rate | 457.20 | 120 | 457.20 | 120 | OK |
| pct_uninsured | 1042.10 | 120 | 1042.10 | 120 | OK |
| pct_public_coverage | 3856.20 | 120 | 3856.20 | 120 | OK |
| pct_disability | 1820.00 | 120 | 1820.00 | 120 | OK |
| pct_no_vehicle | 480.80 | 120 | 480.80 | 120 | OK |
| pct_broadband | 10908.70 | 120 | 10908.70 | 120 | OK |
| pct_bachelors | 4739.00 | 120 | 4739.00 | 120 | OK |
| pct_renter | 3620.00 | 120 | 3620.00 | 120 | OK |
| pct_rent_burden_35 | 3973.10 | 119 | 3973.10 | 119 | OK |

## raw/acs2024_5yr_profile_tracts_moe.csv  (120 rows)

Whole string: length JS 10855 / Python 10855; hash JS 670453325 / Python 670453325; OK

| column | JS sum | JS count | Python sum | Python count | match |
|---|---|---|---|---|---|
| pop_total_moe | 71877.00 | 117 | 71877.00 | 117 | OK |
| pct_under18_moe | 597.30 | 118 | 597.30 | 118 | OK |
| pct_65plus_moe | 526.50 | 120 | 526.50 | 120 | OK |
| pct_black_moe | 668.20 | 120 | 668.20 | 120 | OK |
| pct_hispanic_moe | 571.00 | 118 | 571.00 | 118 | OK |
| pct_white_nh_moe | 876.80 | 120 | 876.80 | 120 | OK |
| pct_veterans_moe | 486.40 | 120 | 486.40 | 120 | OK |
| median_hh_income_moe | 2023370.00 | 120 | 2023370.00 | 120 | OK |
| pct_poverty_moe | 757.40 | 120 | 757.40 | 120 | OK |
| unemployment_rate_moe | 396.90 | 120 | 396.90 | 120 | OK |
| pct_uninsured_moe | 546.40 | 120 | 546.40 | 120 | OK |
| pct_public_coverage_moe | 843.10 | 120 | 843.10 | 120 | OK |
| pct_disability_moe | 621.80 | 120 | 621.80 | 120 | OK |
| pct_no_vehicle_moe | 413.90 | 120 | 413.90 | 120 | OK |
| pct_broadband_moe | 677.40 | 120 | 677.40 | 120 | OK |
| pct_bachelors_moe | 916.70 | 120 | 916.70 | 120 | OK |
| pct_renter_moe | 907.10 | 120 | 907.10 | 120 | OK |
| pct_rent_burden_35_moe | 2710.80 | 119 | 2710.80 | 119 | OK |

## raw/places2025_tracts.csv  (117 rows)

Whole string: length JS 7758 / Python 7758; hash JS 845734373 / Python 845734373; OK

| column | JS sum | JS count | Python sum | Python count | match |
|---|---|---|---|---|---|
| pop18plus | 372383.00 | 117 | 372383.00 | 117 | OK |
| places_depression | 2648.70 | 117 | 2648.70 | 117 | OK |
| places_mhlth | 1915.30 | 117 | 1915.30 | 117 | OK |
| places_loneliness | 4073.90 | 117 | 4073.90 | 117 | OK |
| places_emotionspt | 2759.00 | 117 | 2759.00 | 117 | OK |
| places_foodinsecu | 1873.40 | 117 | 1873.40 | 117 | OK |
| places_housinsecu | 1432.60 | 117 | 1432.60 | 117 | OK |
| places_lacktrpt | 1040.40 | 117 | 1040.40 | 117 | OK |
| places_access2 | 1049.40 | 117 | 1049.40 | 117 | OK |
| places_binge | 1698.30 | 117 | 1698.30 | 117 | OK |
| places_ghlth | 2351.70 | 117 | 2351.70 | 117 | OK |
