"""Generate the Maastricht fake data set for centrix (one JSON file per collection).

Usage: python3 -I gen.py <output_dir>
Everything is made up. Times are UTC ("Z"). "Now" in the data is 2026-11-21 09:00Z.
"""
import json, sys, os
from datetime import datetime, timedelta, date

OUT = sys.argv[1]
NOW = datetime(2026, 11, 21, 9, 0)
VAT = 21


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:00Z")


def T(s):
    return datetime.strptime(s, "%Y-%m-%d %H:%M")


# ---------------------------------------------------------------- manager
property_manager = {
    "manager_id": "pm_org",
    "name": "Maaszicht Vastgoedbeheer B.V.",
    "address": "Stationsstraat 9, 6221 BM Maastricht",
    "email": "service@maaszicht.example",
    "phone": "+31 43 000 0000",
    "staff": [
        {"staff_id": "pm_01", "name": "Eva Dirix", "role": "property manager", "portfolio": ["prop_01", "prop_02", "prop_04"]},
        {"staff_id": "pm_02", "name": "Mark Lemmens", "role": "property manager", "portfolio": ["prop_03", "prop_05", "prop_06"]},
    ],
    "repair_policy": {
        "pre_approved_limit_eur": 3000,
        "owner_approval_above_eur": 5000,
        "vat_rate_pct": VAT,
        "currency": "EUR",
        "emergency_definition": "Water that cannot be stopped, no toilet in the home, sewage backing up, or no heating/hot water in winter for a vulnerable tenant.",
        "small_repairs_rule": "Besluit kleine herstellingen: small repairs (e.g. tap washers, unblocking a drain the tenant blocked) are paid by the tenant. The tenant is told before the job is booked.",
        "invoice_to": "Maaszicht Vastgoedbeheer B.V., Stationsstraat 9, 6221 BM Maastricht",
    },
    "never_shared_with_partners": ["tenant_email", "owner_details", "lease_and_rent", "meter_numbers", "other_tenants", "payment_history"],
}

# ---------------------------------------------------------------- properties
properties = [
    {"property_id": "prop_01", "name": "Brusselsestraat 74", "address": {"street": "Brusselsestraat", "number": "74", "postcode": "6211 PG", "city": "Maastricht", "district": "Binnenstad"},
     "lat": 50.8499, "lng": 5.6838, "building_year": 1905, "building_type": "townhouse split into 4 apartments", "units": 4, "lift": False,
     "heating": "individual gas combi boiler per unit", "energy_label": {"class": "E", "valid_until": "2031-06-30"},
     "water_main": "Cellar, left of the stairs, behind the meter cabinet", "pipework": "Copper since 1988 renovation; short lead section at the street connection",
     "owner_contact_id": "c_o01", "manager_staff_id": "pm_01", "caretaker_contact_id": None, "key_location": "Key safe at the manager's office (key K-074)"},
    {"property_id": "prop_02", "name": "Rechtstraat 58", "address": {"street": "Rechtstraat", "number": "58", "postcode": "6221 EJ", "city": "Maastricht", "district": "Wyck"},
     "lat": 50.8490, "lng": 5.6985, "building_year": 1890, "building_type": "shop with 3 apartments above (shop not managed)", "units": 3, "lift": False,
     "heating": "individual gas combi boiler per unit", "energy_label": {"class": "F", "valid_until": "2030-02-28"},
     "water_main": "Entrance hall, cupboard under the stairs", "pipework": "Copper and PVC drains, renovated 2004",
     "owner_contact_id": "c_o03", "manager_staff_id": "pm_01", "caretaker_contact_id": None, "key_location": "Key safe at the manager's office (key K-058)"},
    {"property_id": "prop_03", "name": "Scharnerweg 112", "address": {"street": "Scharnerweg", "number": "112", "postcode": "6224 JG", "city": "Maastricht", "district": "Scharn"},
     "lat": 50.8500, "lng": 5.7170, "building_year": 1968, "building_type": "gallery flat, 3 floors", "units": 6, "lift": True,
     "heating": "block heating (central boiler room, shared)", "energy_label": {"class": "C", "valid_until": "2033-09-30"},
     "water_main": "Boiler room, ground floor (caretaker has the key)", "pipework": "Galvanised steel risers, copper in the flats",
     "owner_contact_id": "c_o02", "manager_staff_id": "pm_02", "caretaker_contact_id": "c_k01", "key_location": "Caretaker Harrie Bemelmans"},
    {"property_id": "prop_04", "name": "Sint Maartenslaan 30", "address": {"street": "Sint Maartenslaan", "number": "30", "postcode": "6221 AX", "city": "Maastricht", "district": "Wyck"},
     "lat": 50.8468, "lng": 5.6993, "building_year": 1932, "building_type": "mansion split into 3 apartments", "units": 3, "lift": False,
     "heating": "individual gas combi boiler per unit", "energy_label": {"class": "D", "valid_until": "2032-04-30"},
     "water_main": "Cellar, front wall, under the window", "pipework": "Original lead supply pipe in the risers (known issue), copper in the kitchens",
     "owner_contact_id": "c_o01", "manager_staff_id": "pm_01", "caretaker_contact_id": None, "key_location": "Key safe at the manager's office (key K-030)"},
    {"property_id": "prop_05", "name": "Oranjeplein 87", "address": {"street": "Oranjeplein", "number": "87", "postcode": "6224 KM", "city": "Maastricht", "district": "Wittevrouwenveld"},
     "lat": 50.8558, "lng": 5.7095, "building_year": 1955, "building_type": "walk-up flat (portiekflat), 3 floors", "units": 6, "lift": False,
     "heating": "individual gas combi boiler per unit (one old gas geyser left in unit 2)", "energy_label": {"class": "D", "valid_until": "2031-11-30"},
     "water_main": "Basement storage corridor, at the end on the right", "pipework": "Copper, cast-iron soil stack",
     "owner_contact_id": "c_o02", "manager_staff_id": "pm_02", "caretaker_contact_id": "c_k01", "key_location": "Caretaker Harrie Bemelmans"},
    {"property_id": "prop_06", "name": "Randwycksingel 15", "address": {"street": "Randwycksingel", "number": "15", "postcode": "6229 EB", "city": "Maastricht", "district": "Randwyck"},
     "lat": 50.8395, "lng": 5.7100, "building_year": 2019, "building_type": "new-build apartment block", "units": 6, "lift": True,
     "heating": "collective heat pump with underfloor heating", "energy_label": {"class": "A+", "valid_until": "2029-05-31"},
     "water_main": "Technical room, ground floor (code lock, code with the manager)", "pipework": "PEX supply, PVC drains",
     "owner_contact_id": "c_o04", "manager_staff_id": "pm_02", "caretaker_contact_id": None, "key_location": "Digital lock, one-time code sent by the manager"},
]

# ---------------------------------------------------------------- units
# unit_id, property, label, floor, sqm, rooms, boiler(brand,year) or None, shutoff
U = [
    ("u_01_0", "prop_01", "Ground floor", 0, 58, 2, ("Remeha Tzerra", 2016), "Under the kitchen sink, blue tap"),
    ("u_01_1", "prop_01", "1st floor", 1, 46, 2, ("Intergas Kombi Kompakt", 2019), "In the bathroom, behind the panel under the washbasin"),
    ("u_01_2", "prop_01", "2nd floor", 2, 46, 2, ("Nefit EcoLine", 2011), "Next to the boiler in the hall cupboard"),
    ("u_01_3", "prop_01", "3rd floor (attic)", 3, 38, 1, ("Intergas Kombi Kompakt", 2021), "Under the kitchen sink"),
    ("u_02_1", "prop_02", "1st floor", 1, 62, 3, ("Remeha Calenta", 2014), "In the kitchen, cupboard left of the sink"),
    ("u_02_2", "prop_02", "2nd floor", 2, 62, 3, ("Remeha Calenta", 2014), "In the kitchen, cupboard left of the sink"),
    ("u_02_3", "prop_02", "3rd floor", 3, 51, 2, ("Intergas HRE", 2017), "In the bathroom next to the toilet"),
    ("u_03_01", "prop_03", "A01", 0, 72, 3, None, "Meter cupboard by the front door"),
    ("u_03_02", "prop_03", "A02", 0, 72, 3, None, "Meter cupboard by the front door"),
    ("u_03_11", "prop_03", "B11", 1, 72, 3, None, "Meter cupboard by the front door"),
    ("u_03_12", "prop_03", "B12", 1, 72, 3, None, "Meter cupboard by the front door"),
    ("u_03_21", "prop_03", "C21", 2, 72, 3, None, "Meter cupboard by the front door"),
    ("u_03_22", "prop_03", "C22", 2, 72, 3, None, "Meter cupboard by the front door"),
    ("u_04_0", "prop_04", "Ground floor", 0, 85, 3, ("Nefit ProLine", 2013), "Cellar, front wall (shared main valve)"),
    ("u_04_1", "prop_04", "1st floor", 1, 78, 3, ("Vaillant ecoTEC", 2018), "Kitchen, cupboard under the sink"),
    ("u_04_2", "prop_04", "2nd floor", 2, 64, 2, ("Vaillant ecoTEC", 2018), "Kitchen, cupboard under the sink"),
    ("u_05_1", "prop_05", "87A (ground left)", 0, 55, 3, ("Intergas Kombi Kompakt", 2015), "Kitchen, under the sink"),
    ("u_05_2", "prop_05", "87B (ground right)", 0, 55, 3, ("Vaillant atmoMAG geyser", 1997), "Kitchen, under the sink"),
    ("u_05_3", "prop_05", "87C (1st left)", 1, 55, 3, ("Intergas Kombi Kompakt", 2015), "Kitchen, under the sink"),
    ("u_05_4", "prop_05", "87D (1st right)", 1, 55, 3, ("Remeha Tzerra", 2020), "Kitchen, under the sink"),
    ("u_05_5", "prop_05", "87E (2nd left)", 2, 55, 3, ("Intergas Kombi Kompakt", 2015), "Kitchen, under the sink"),
    ("u_05_6", "prop_05", "87F (2nd right)", 2, 55, 3, ("Remeha Tzerra", 2020), "Kitchen, under the sink"),
    ("u_06_1", "prop_06", "0.1", 0, 48, 2, None, "Technical cupboard in the hall"),
    ("u_06_2", "prop_06", "0.2", 0, 52, 2, None, "Technical cupboard in the hall"),
    ("u_06_3", "prop_06", "1.1", 1, 48, 2, None, "Technical cupboard in the hall"),
    ("u_06_4", "prop_06", "1.2", 1, 52, 2, None, "Technical cupboard in the hall"),
    ("u_06_5", "prop_06", "2.1", 2, 48, 2, None, "Technical cupboard in the hall"),
    ("u_06_6", "prop_06", "2.2", 2, 52, 2, None, "Technical cupboard in the hall"),
]
prop_by_id = {p["property_id"]: p for p in properties}
units = []
for i, (uid, pid, label, floor, sqm, rooms, boiler, shutoff) in enumerate(U):
    has_gas = boiler is not None
    meters = [{"type": "electricity", "ean": f"8716{(i * 7919 + 1234567) % 10**14:014d}"}]
    if has_gas:
        meters.append({"type": "gas", "ean": f"8716{(i * 6007 + 7654321) % 10**14:014d}"})
    meters.append({"type": "water", "number": f"WML-{(i * 131 + 40000) % 100000:05d}"})
    units.append({
        "unit_id": uid, "property_id": pid, "label": label, "floor": floor, "size_sqm": sqm, "rooms": rooms,
        "lift": prop_by_id[pid]["lift"],
        "boiler": {"model": boiler[0], "install_year": boiler[1], "last_service": None} if boiler else None,
        "water_shutoff": shutoff, "meters": meters, "history": [],
    })
unit_by_id = {u["unit_id"]: u for u in units}
for u in units:
    if u["boiler"]:
        u["boiler"]["last_service"] = "2025-%02d-15" % (3 + (int(u["unit_id"][-1]) * 2) % 9)

# ---------------------------------------------------------------- contacts
contacts = []


def person(cid, role, first, last, unit=None, lang="nl", channel="portal", avatar=True, move_in=None, move_out=None, phone_n=None, note=None, org=None):
    c = {"contact_id": cid, "role": role, "first_name": first, "last_name": last, "name": org or f"{first} {last}".strip(),
         "email": (f"{first}.{last}".lower().replace(" ", "").replace("ı", "i").replace("í", "i") + "@example.com") if not org else f"info@{org.split()[0].lower()}.example",
         "phone": f"+31 6 0000 {phone_n:04d}" if phone_n else None,
         "language": lang, "preferred_channel": channel,
         "avatar": f"assets/avatars/{first.lower()}-{last.lower().replace(' ', '-')}.jpg".replace("ı", "i") if avatar else None}
    if unit:
        c["unit_id"] = unit
    if move_in:
        c["move_in"] = move_in
    c["move_out"] = move_out
    if note:
        c["notes"] = note
    contacts.append(c)


# owners and caretaker (no avatar)
person("c_o01", "owner", "Marie-José", "Kurvers", lang="nl", channel="email", avatar=False, phone_n=101)
person("c_o02", "owner", "", "", lang="nl", channel="email", avatar=False, phone_n=102, org="Limburgse Woonbelegging B.V.")
person("c_o03", "owner", "Peter", "Ramakers", lang="nl", channel="email", avatar=False, phone_n=103)
person("c_o04", "owner", "", "", lang="en", channel="email", avatar=False, phone_n=104, org="Randwyck Residences C.V.")
person("c_k01", "caretaker", "Harrie", "Bemelmans", lang="nl", channel="phone", avatar=False, phone_n=105, note="Caretaker for Scharnerweg 112 and Oranjeplein 87, Mon-Fri 08:00-16:30. Holds keys.")
for c in contacts:
    if c["role"] == "owner":
        c["owns"] = [p["property_id"] for p in properties if p["owner_contact_id"] == c["contact_id"]]
contacts[4]["covers"] = ["prop_03", "prop_05"]

# tenants: (cid, first, last, unit, lang, channel, move_in, has_case, note)
TEN = [
    ("c_201", "Harrie", "Coenen", "u_01_0", "nl", "phone", "1998-04-01", True, "78 years old, prefers a phone call over the portal. Speaks Limburgish/Dutch."),
    ("c_202", "Elena", "Rossi", "u_01_1", "en", "portal", "2024-09-01", True, "PhD candidate at Maastricht University."),
    ("c_203", "Daan", "Smeets", "u_01_2", "nl", "whatsapp", "2021-02-01", True, None),
    ("c_204", "Amara", "Mensah", "u_01_3", "en", "portal", "2025-08-15", True, "Student. Often away at weekends."),
    ("c_205", "Lukas", "Schmidt", "u_02_1", "de", "email", "2023-10-01", True, "Works in Aachen, home after 18:00."),
    ("c_206", "Sanne", "Janssen", "u_02_2", "nl", "portal", "2022-06-01", True, None),
    ("c_207", "Mateo", "Garcia", "u_02_3", "en", "whatsapp", "2025-01-15", True, None),
    ("c_208", "Yasmina", "El Amrani", "u_03_01", "nl", "portal", "2019-03-01", True, None),
    ("c_209", "Jos", "Vliegen", "u_03_02", "nl", "phone", "2006-07-01", True, "81 years old, hard of hearing: speak slowly, or call his daughter (permission on file)."),
    ("c_210", "Kwame", "Asante", "u_03_11", "en", "portal", "2023-05-01", False, None),
    ("c_211", "Femke", "Habets", "u_03_12", "nl", "portal", "2020-11-01", True, None),
    ("c_212", "Noor", "Bakker", "u_03_21", "nl", "email", "2024-02-01", False, None),
    ("c_213", "Thomas", "Wouters", "u_04_0", "nl", "email", "2017-09-01", True, None),
    ("c_214", "Julia", "Kowalska", "u_04_1", "pl", "portal", "2024-03-01", True, "Works night shifts at MUMC+, sleeps until 14:00."),
    ("c_215", "Omar", "Haddad", "u_04_2", "nl", "whatsapp", "2022-12-01", True, None),
    ("c_216", "Leyla", "Yilmaz", "u_05_1", "tr", "phone", "2016-05-01", True, "Prefers Turkish; her son translates if needed."),
    ("c_217", "Sjef", "Ubachs", "u_05_2", "nl", "phone", "1989-10-01", True, "84 years old, lives alone. Counts as vulnerable for the emergency rule."),
    ("c_218", "Lotte", "Hendriks", "u_05_3", "nl", "portal", "2023-08-01", True, None),
    ("c_219", "Hannah", "Becker", "u_05_4", "de", "portal", "2025-09-01", True, "Exchange student."),
    ("c_220", "Bart", "Meijers", "u_05_5", "nl", "email", "2018-01-01", False, None),
    ("c_221", "Ilse", "Frissen", "u_05_6", "nl", "portal", "2021-04-01", False, None),
    ("c_222", "Anouk", "Vermeulen", "u_06_1", "nl", "portal", "2019-09-01", True, None),
    ("c_223", "Sofia", "Martins", "u_06_2", "en", "portal", "2024-09-01", True, None),
    ("c_224", "Wei", "Zhang", "u_06_3", "en", "email", "2025-02-01", False, None),
    ("c_225", "Mehmet", "Demir", "u_06_4", "nl", "whatsapp", "2020-06-01", False, None),
    ("c_226", "Sophie", "Willems", "u_06_5", "nl", "portal", "2022-09-01", False, None),
    ("c_227", "Ruben", "Claessens", "u_03_22", "nl", "portal", "2026-12-01", False, "New tenant, moves in on 1 December 2026."),
]
for n, (cid, f, l, u, lang, ch, mi, case, note) in enumerate(TEN):
    person(cid, "tenant", f, l, unit=u, lang=lang, channel=ch, move_in=mi, phone_n=200 + n, avatar=case, note=note)
# outgoing tenant of u_06_6 (vacant from 1 Dec) and previous tenant of u_03_22
person("c_228", "tenant", "Lars", "Nijsten", unit="u_06_6", lang="nl", channel="email", move_in="2023-12-01", move_out="2026-11-30", phone_n=228, avatar=False, note="Moving out on 30 November 2026; handover inspection booked.")
contact_by_id = {c["contact_id"]: c for c in contacts}
tenant_of_unit = {c["unit_id"]: c for c in contacts if c["role"] == "tenant" and c.get("move_out") is None and c["move_in"] <= "2026-11-21"}
tenant_of_unit["u_06_6"] = contact_by_id["c_228"]

# ---------------------------------------------------------------- contracts
RENT = {"prop_01": 22.0, "prop_02": 19.5, "prop_03": 13.5, "prop_04": 18.0, "prop_05": 12.8, "prop_06": 21.5}
contracts = []
k = 1
for c in contacts:
    if c["role"] != "tenant":
        continue
    u = unit_by_id[c["unit_id"]]
    rent = round(u["size_sqm"] * RENT[u["property_id"]] / 5) * 5
    contracts.append({"contract_id": f"ct_{k:03d}", "type": "lease", "unit_id": u["unit_id"], "contact_id": c["contact_id"],
                      "start": c["move_in"], "end": c["move_out"], "rent_base_eur": rent,
                      "service_costs_eur": 45 if u["property_id"] in ("prop_03", "prop_05") else 30 if u["property_id"] == "prop_06" else 0,
                      "deposit_eur": rent * 2 if rent < 1200 else rent, "status": "ended_soon" if c["move_out"] else ("signed" if c["move_in"] > "2026-11-21" else "active")})
    k += 1
for p in properties:
    contracts.append({"contract_id": f"ct_{k:03d}", "type": "management", "property_id": p["property_id"], "contact_id": p["owner_contact_id"],
                      "start": "2024-01-01", "end": None, "fee_pct_of_rent": 6.5, "repair_authority_eur": 3000, "status": "active"})
    k += 1
contracts.append({"contract_id": f"ct_{k:03d}", "type": "service", "category": "boiler_maintenance", "partner_id": "p_02",
                  "property_ids": ["prop_01", "prop_02", "prop_04", "prop_05"], "start": "2025-01-01", "end": "2027-12-31",
                  "terms": "Yearly boiler service per unit, fixed €95 excl. VAT per boiler", "status": "active"}); k += 1
contracts.append({"contract_id": f"ct_{k:03d}", "type": "service", "category": "block_heating", "partner_id": "p_02",
                  "property_ids": ["prop_03"], "start": "2024-07-01", "end": "2026-12-31",
                  "terms": "Maintenance and 24/7 breakdown cover for the central boiler room", "status": "expiring"}); k += 1
contracts.append({"contract_id": f"ct_{k:03d}", "type": "service", "category": "heat_pump", "partner_id": "p_05",
                  "property_ids": ["prop_06"], "start": "2024-01-01", "end": "2028-12-31",
                  "terms": "Maintenance of the collective heat pump", "status": "active"}); k += 1

# ---------------------------------------------------------------- partners
WEEKDAYS = [NOW.date() + timedelta(days=d) for d in range(0, 10)]


def availability(slots_per_day, start_hours):
    out = []
    for d in WEEKDAYS:
        if d.weekday() >= 5:
            continue
        for h in start_hours[:slots_per_day]:
            s = datetime(d.year, d.month, d.day, h, 0)
            if s > NOW:
                out.append({"start": iso(s), "end": iso(s + timedelta(hours=2))})
    return out


partners = [
    {"partner_id": "p_01", "name": "Jekerdal Loodgieters", "category": "plumbing", "kvk": "00000001",
     "services": ["leak", "blockage", "running_toilet", "dripping_tap", "low_pressure", "burst_pipe", "sewer_smell", "lead_pipe_replacement"],
     "service_area_postcodes": ["6211", "6212", "6213", "6221", "6222", "6224", "6229"], "emergency_24_7": True,
     "response_time_hours": {"emergency": 2, "urgent": 24, "normal": 72},
     "rates_eur_excl_vat": {"call_out": 45, "hourly": 62, "emergency_call_out": 95, "evening_weekend_surcharge_pct": 50},
     "rating": 4.7, "jobs_done_for_us": 61, "languages": ["nl", "en", "de"],
     "connector": {"channel": "partner_portal", "job_notifications": ["portal", "whatsapp"], "status_updates": "portal buttons + dictation", "invoice_format": "UBL e-invoice + PDF"},
     "technicians": [
         {"technician_id": "t_01", "name": "Bram Peters", "avatar": "assets/avatars/bram-peters.jpg", "phone": "+31 6 0000 0901", "languages": ["nl", "en"]},
         {"technician_id": "t_02", "name": "Niels Hermans", "avatar": "assets/avatars/niels-hermans.jpg", "phone": "+31 6 0000 0902", "languages": ["nl", "de"]}],
     "availability": availability(3, [8, 11, 14])},
    {"partner_id": "p_02", "name": "Maasland Installatietechniek B.V.", "category": "plumbing_heating", "kvk": "00000002",
     "services": ["no_hot_water", "boiler", "leak", "low_pressure", "radiator", "block_heating"],
     "service_area_postcodes": ["6211", "6212", "6213", "6214", "6215", "6216", "6221", "6222", "6223", "6224", "6225", "6229"], "emergency_24_7": True,
     "response_time_hours": {"emergency": 4, "urgent": 24, "normal": 96},
     "rates_eur_excl_vat": {"call_out": 55, "hourly": 68, "emergency_call_out": 110, "evening_weekend_surcharge_pct": 50},
     "rating": 4.4, "jobs_done_for_us": 38, "languages": ["nl", "en", "fr"],
     "connector": {"channel": "api", "job_notifications": ["webhook"], "status_updates": "REST callback", "invoice_format": "UBL e-invoice"},
     "technicians": [
         {"technician_id": "t_03", "name": "Karim Bouzid", "avatar": "assets/avatars/karim-bouzid.jpg", "phone": "+31 6 0000 0903", "languages": ["nl", "fr", "ar"]}],
     "availability": availability(2, [9, 13])},
    {"partner_id": "p_03", "name": "Sint-Pieter Sanitair & Riool", "category": "plumbing", "kvk": "00000003",
     "services": ["blockage", "sewer_smell", "running_toilet", "leak", "dripping_tap"],
     "service_area_postcodes": ["6211", "6212", "6221", "6224", "6225", "6229"], "emergency_24_7": False,
     "response_time_hours": {"emergency": None, "urgent": 24, "normal": 48},
     "rates_eur_excl_vat": {"call_out": 39, "hourly": 58, "emergency_call_out": None, "evening_weekend_surcharge_pct": 0},
     "rating": 4.8, "jobs_done_for_us": 24, "languages": ["nl", "en"],
     "connector": {"channel": "email", "job_notifications": ["email with one-click accept link"], "status_updates": "reply links in the email", "invoice_format": "PDF"},
     "technicians": [
         {"technician_id": "t_04", "name": "Tim Lardinois", "avatar": "assets/avatars/tim-lardinois.jpg", "phone": "+31 6 0000 0904", "languages": ["nl", "en"]}],
     "availability": availability(3, [8, 10, 13])},
    {"partner_id": "p_04", "name": "Wyck Elektro", "category": "electrical", "kvk": "00000004",
     "services": ["socket", "fuse", "lighting", "doorbell"], "service_area_postcodes": ["6211", "6221", "6222", "6224", "6229"], "emergency_24_7": False,
     "response_time_hours": {"emergency": None, "urgent": 24, "normal": 72},
     "rates_eur_excl_vat": {"call_out": 45, "hourly": 60, "emergency_call_out": None, "evening_weekend_surcharge_pct": 0},
     "rating": 4.5, "jobs_done_for_us": 12, "languages": ["nl", "en"],
     "connector": {"channel": "email", "job_notifications": ["email"], "status_updates": "reply links", "invoice_format": "PDF"},
     "technicians": [], "availability": availability(2, [9, 14])},
    {"partner_id": "p_05", "name": "Heuvelland Warmtepompen", "category": "heat_pump", "kvk": "00000005",
     "services": ["heat_pump", "underfloor_heating"], "service_area_postcodes": ["62"], "emergency_24_7": False,
     "response_time_hours": {"emergency": None, "urgent": 48, "normal": 120},
     "rates_eur_excl_vat": {"call_out": 65, "hourly": 75, "emergency_call_out": None, "evening_weekend_surcharge_pct": 0},
     "rating": 4.2, "jobs_done_for_us": 4, "languages": ["nl"],
     "connector": {"channel": "email", "job_notifications": ["email"], "status_updates": "email", "invoice_format": "PDF"},
     "technicians": [], "availability": []},
]
partner_by_id = {p["partner_id"]: p for p in partners}

# ---------------------------------------------------------------- cases (hand-written)
# window: (start, hours) of the booked visit; parts: [(name, qty, price)]; hours: labour
CASES = [
    dict(id="C-2026-0141", unit="u_01_0", by="c_201", at="2026-09-08 07:40", channel="voice", lang="nl", status="closed",
         text="Goedemorgen, de kraan in de keuken blijft druppelen, ook als hij helemaal dicht is.",
         summary="Kitchen tap keeps dripping when closed", problem="dripping_tap", urgency="normal",
         answers=[("Is it dripping or running?", "Dripping, about one drop a second"), ("Since when?", "A week")],
         photos=0, partner="p_03", tech="t_04", window=("2026-09-10 10:00", 2), hours=0.5,
         parts=[("Tap cartridge 35 mm", 1, 24.50)], finding="Worn ceramic cartridge in the mixer tap", work="Replaced the cartridge, tested",
         cost_bearer="landlord", cost_note="Small repair, but paid by the landlord as goodwill (tenant 78, cannot do it himself).",
         feedback=(5, "Vriendelijke man, snel klaar."), followup="Still fine", home="Kitchen mixer cartridge replaced, Sep 2026"),
    dict(id="C-2026-0148", unit="u_03_02", by="c_209", at="2026-09-19 21:15", channel="phone", lang="nl", status="closed",
         text="Er komt water uit de muur achter de wc, het loopt de gang in.",
         summary="Water coming from the wall behind the toilet, spreading into the hall", problem="burst_pipe", urgency="emergency",
         answers=[("Is water still coming out right now?", "Yes"), ("Can you close the water tap in the meter cupboard?", "Daughter closed it")],
         photos=2, partner="p_01", tech="t_01", window=("2026-09-19 22:30", 1), hours=2.0,
         parts=[("Copper pipe 15 mm, 1 m", 1, 14.00), ("Compression fittings 15 mm", 2, 6.50), ("Wall repair kit", 1, 18.00)],
         finding="Corroded copper supply pipe in the wall behind the toilet", work="Opened the wall, replaced 60 cm of pipe, pressure-tested, closed temporarily",
         cost_bearer="landlord", emergency=True, feedback=(5, "Midden in de nacht nog geholpen, top."), followup="Dry, tiler finished the wall",
         home="Supply pipe behind the toilet replaced, Sep 2026"),
    dict(id="C-2026-0152", unit="u_01_1", by="c_202", at="2026-09-29 18:05", channel="portal", lang="en", status="closed",
         text="The shower drain is very slow, water stays about 3 cm high after a shower.",
         summary="Shower drain very slow", problem="blockage", urgency="normal",
         answers=[("Is the water not draining at all?", "It drains slowly"), ("One drain or several?", "Just the shower")],
         photos=1, partner="p_03", tech="t_04", window=("2026-10-01 08:00", 2), hours=0.75,
         parts=[], finding="Hair and soap build-up in the shower trap", work="Cleaned the trap and the branch pipe with a spiral",
         cost_bearer="tenant", cost_note="Small repair (Besluit kleine herstellingen). Tenant agreed to pay before booking.",
         feedback=(4, "Quick, but the slot was early."), followup="Draining fine", home=None),
    dict(id="C-2026-0157", unit="u_02_2", by="c_206", at="2026-10-06 08:12", channel="portal", lang="nl", status="closed",
         text="Er lekt water onder de gootsteen in de keuken, de bodem van het kastje is zacht.",
         summary="Leak under the kitchen sink, cupboard floor soft", problem="leak", urgency="urgent",
         answers=[("Is water still coming out right now?", "Only when I use the sink"), ("Is it reaching the floor or other rooms?", "I don't know"), ("Since when?", "A few days")],
         photos=2, partner="p_01", tech="t_02", window=("2026-10-06 14:00", 2), hours=1.0,
         parts=[("Siphon 40 mm", 1, 19.00), ("Seal set", 1, 6.00)], finding="Cracked siphon, water ran down behind the cupboard", work="Replaced siphon and seals, dried the cupboard",
         cost_bearer="landlord", feedback=(5, "Zelfde dag geholpen!"), followup="Dry", home="Kitchen siphon replaced, Oct 2026"),
    dict(id="C-2026-0158", unit="u_02_1", by="c_205", at="2026-10-06 19:30", channel="email", lang="de", status="closed",
         text="Hallo, an der Küchendecke ist ein feuchter Fleck, ungefähr 30 cm groß.",
         summary="Damp patch on the kitchen ceiling (flat below the leak in 2nd floor)", problem="leak", urgency="normal",
         answers=[("Is it dripping?", "No, just a damp patch")], photos=1, partner="p_01", tech="t_02",
         linked=["C-2026-0157"], resolution_kind="linked", window=None, hours=0, parts=[],
         finding="Caused by the leak in the flat above (C-2026-0157), already fixed", work="No visit needed; damp patch checked by the plumber from above on 6 Oct; painter booked by the manager",
         cost_bearer="landlord", feedback=None, followup="Ceiling dry, repainted", home="Kitchen ceiling repainted after leak from above, Oct 2026"),
    dict(id="C-2026-0163", unit="u_04_1", by="c_214", at="2026-10-14 15:20", channel="portal", lang="pl", status="closed",
         text="Toaleta jest zatkana, woda się podnosi. To jedyna toaleta w mieszkaniu.",
         summary="Toilet blocked, the only toilet in the flat", problem="blockage", urgency="urgent",
         answers=[("Is the water rising when you flush?", "Yes"), ("Is it the only toilet?", "Yes")],
         photos=0, partner="p_03", tech="t_04", window=("2026-10-14 17:00", 2), hours=1.0,
         parts=[], finding="Blockage in the soil pipe below the toilet (wet wipes)", work="Cleared with a drain machine, camera check OK",
         cost_bearer="tenant", cost_note="Blockage caused by use (wet wipes). Tenant informed in Polish before booking and agreed.",
         feedback=(4, "Dziękuję, szybko."), followup="No problems", home=None),
    dict(id="C-2026-0170", unit="u_05_2", by="c_217", at="2026-10-26 07:55", channel="phone", lang="nl", status="closed",
         text="Ik heb geen warm water meer, de geiser slaat niet aan.",
         summary="No hot water, old gas geyser won't ignite (tenant 84, lives alone)", problem="no_hot_water", urgency="urgent",
         answers=[("Does the geyser show a flame or light?", "No"), ("Do you have heating?", "Yes, gas stove in the living room")],
         photos=0, partner="p_02", tech="t_03", window=("2026-10-27 09:00", 3), hours=3.5,
         parts=[("Intergas Kombi Kompakt HRE 28/24", 1, 1650.00), ("Flue and connection set", 1, 185.00)],
         finding="1997 geyser beyond repair (thermocouple and heat exchanger)", work="Replaced the geyser with a combi boiler; also heats the flat from now on",
         cost_bearer="landlord", quote=2128.00, feedback=(5, "Eindelijk warm water uit de kraan, en nu ook verwarming."),
         followup="Working, tenant happy", home="Geyser replaced by combi boiler (Intergas), Oct 2026"),
    dict(id="C-2026-0174", unit="u_04_2", by="c_215", at="2026-11-12 12:10", channel="whatsapp", lang="nl", status="follow_up",
         text="Kraan in de badkamer lekt bij de knop, druppelt de hele tijd.",
         summary="Bathroom tap leaks at the handle", problem="dripping_tap", urgency="normal",
         answers=[("Is it dripping or running?", "Dripping"), ("Since when?", "Two weeks")],
         photos=1, partner="p_03", tech="t_04", window=("2026-11-16 13:00", 2), hours=0.5,
         parts=[("Tap washer set", 1, 4.50), ("O-rings", 1, 3.00)], finding="Worn washer and O-ring", work="Replaced washer and O-rings",
         cost_bearer="tenant", cost_note="Small repair (tap washer). Tenant chose a plumber over doing it himself.",
         feedback=(4, "Prima"), followup=None, home="Bathroom tap washer replaced, Nov 2026"),
    dict(id="C-2026-0177", unit="u_01_3", by="c_204", at="2026-11-15 22:40", channel="portal", lang="en", status="invoiced",
         text="The toilet keeps running after flushing, I can hear it all night.",
         summary="Toilet keeps running after flushing", problem="running_toilet", urgency="normal",
         answers=[("Does it stop by itself?", "No"), ("Is water running into the bowl?", "Yes, a thin stream")],
         photos=1, partner="p_01", tech="t_01", window=("2026-11-18 11:00", 2), hours=0.75,
         parts=[("Geberit fill valve", 1, 32.00)], finding="Fill valve not closing", work="Replaced the fill valve, adjusted the float",
         cost_bearer="landlord", feedback=(5, "Fixed in 30 minutes, thanks!"), followup=None, home="Toilet fill valve replaced, Nov 2026"),
    dict(id="C-2026-0179", unit="u_03_01", by="c_208", at="2026-11-14 18:20", channel="portal", lang="nl", status="awaiting_confirmation",
         text="Gootsteen in de keuken loopt helemaal niet meer door.",
         summary="Kitchen sink not draining at all", problem="blockage", urgency="urgent",
         answers=[("Is the water not draining at all?", "Nothing drains"), ("One drain or several?", "Just the kitchen")],
         photos=1, partner="p_03", tech="t_04", window=("2026-11-20 13:00", 2), hours=1.0,
         parts=[], finding="Grease plug in the kitchen drain", work="Cleared the drain, advised not to pour fat down the sink",
         cost_bearer="tenant", cost_note="Small repair (grease blockage). Tenant agreed before booking.", feedback=None, followup=None, home=None),
    dict(id="C-2026-0181", unit="u_04_0", by="c_213", at="2026-11-16 08:45", channel="email", lang="nl", status="quote_approval",
         text="Het water uit de kraan is soms bruin en de druk is laag, vooral 's ochtends.",
         summary="Brown water and low pressure in the mornings (1932 building, lead risers)", problem="low_pressure", urgency="normal",
         answers=[("All taps or one?", "All taps"), ("Does it clear after running?", "After a minute")],
         photos=1, partner="p_01", tech="t_02", window=("2026-11-20 08:00", 2), hours=1.0, parts=[],
         finding="Original lead supply pipe in the riser, corroded and partly narrowed", work=None,
         cost_bearer="landlord", quote=3850.00,
         quote_text="Replace the lead riser for all 3 flats with copper, 2 days work incl. wall openings and restoring", feedback=None, followup=None, home=None),
    dict(id="C-2026-0183", unit="u_05_1", by="c_216", at="2026-11-18 16:05", channel="voice", lang="tr", status="in_progress",
         text="Çamaşır makinesinin musluğundan su sızıyor, yer ıslak.",
         summary="Washing machine tap leaking, floor wet", problem="leak", urgency="urgent",
         answers=[("Is water still coming out right now?", "Only a little, I closed the tap"), ("Is it reaching other rooms?", "No")],
         photos=2, partner="p_01", tech="t_01", window=("2026-11-21 08:00", 2), hours=None, parts=[],
         finding=None, work=None, cost_bearer="landlord", feedback=None, followup=None, home=None),
    dict(id="C-2026-0184", unit="u_02_3", by="c_207", at="2026-11-19 10:30", channel="whatsapp", lang="en", status="scheduled",
         text="There's a sewer smell in the bathroom, especially in the morning.",
         summary="Sewer smell in the bathroom", problem="sewer_smell", urgency="normal",
         answers=[("Where is it strongest?", "Near the shower drain"), ("Since when?", "About a week")],
         photos=0, partner="p_03", tech="t_04", window=("2026-11-24 10:00", 2), cost_bearer="landlord"),
    dict(id="C-2026-0185", unit="u_05_4", by="c_219", at="2026-11-19 20:50", channel="portal", lang="de", status="scheduled",
         text="Das Waschbecken im Bad läuft sehr langsam ab.",
         summary="Bathroom washbasin drains slowly", problem="blockage", urgency="normal",
         answers=[("Is the water not draining at all?", "It drains slowly"), ("One drain or several?", "Just the washbasin")],
         photos=1, partner="p_03", tech="t_04", window=("2026-11-25 13:00", 2), cost_bearer="tenant",
         cost_note="Small repair. Tenant told in German she pays the €39 call-out + labour, and agreed."),
    dict(id="C-2026-0186", unit="u_01_2", by="c_203", at="2026-11-20 07:15", channel="whatsapp", lang="nl", status="scheduling",
         text="Geen warm water sinds vanochtend, ketel geeft F28.",
         summary="No hot water since this morning, boiler shows error F28", problem="no_hot_water", urgency="urgent",
         answers=[("Does the boiler show an error code?", "F28"), ("Do you have heating?", "No")],
         photos=1, partner="p_02", tech="t_03", cost_bearer="landlord"),
    dict(id="C-2026-0187", unit="u_05_3", by="c_218", at="2026-11-20 21:30", channel="portal", lang="nl", status="awaiting_consent",
         text="De douchemengkraan lekt aan de onderkant, er staat steeds een plasje.",
         summary="Shower mixer leaks at the bottom", problem="leak", urgency="normal",
         answers=[("Is water still coming out right now?", "Only when the shower is on"), ("Since when?", "A few days")],
         photos=1, partner="p_01", cost_bearer="landlord"),
    dict(id="C-2026-0188", unit="u_06_1", by="c_222", at="2026-11-21 08:40", channel="portal", lang="nl", status="new",
         text="Onder de vaatwasser komt water vandaan.",
         summary="Water coming from under the dishwasher", problem="leak", urgency=None,
         answers=[], photos=0, cost_bearer=None),
    dict(id="C-2026-0180", unit="u_03_12", by="c_211", at="2026-11-15 19:00", channel="portal", lang="nl", status="manager_review",
         text="Twee radiatoren in de slaapkamers worden niet warm.",
         summary="Two bedroom radiators stay cold (block heating)", problem="radiator", category="heating", urgency="normal",
         answers=[("Have you bled the radiators?", "No, don't know how")], photos=0, partner="p_02", cost_bearer="landlord",
         review_reason="Not plumbing: block heating falls under the boiler-room service contract (ct_ block_heating). Manager checks with Maasland first."),
    dict(id="C-2026-0182", unit="u_06_2", by="c_223", at="2026-11-17 09:10", channel="portal", lang="en", status="manager_review",
         text="Two sockets in the living room stopped working, the rest is fine.",
         summary="Two living-room sockets dead", problem="socket", category="electrical", urgency="normal",
         answers=[], photos=0, partner="p_04", cost_bearer="landlord",
         review_reason="Not plumbing. Routed to the manager; electrician partner Wyck Elektro suggested."),
]

STATUS_STAGE = {"new": 1, "manager_review": 1, "awaiting_consent": 2, "dispatched": 4, "scheduling": 6, "scheduled": 7,
                "in_progress": 10, "quote_approval": 10, "awaiting_confirmation": 12, "invoiced": 15, "follow_up": 15, "closed": 17}
SHARED = ["first_name", "phone", "address", "unit_and_floor", "problem_description", "follow_up_answers", "photos", "access_instructions", "water_shutoff_location"]
CHANNEL_TO = {"portal": "portal", "voice": "voice", "phone": "voice", "whatsapp": "whatsapp", "email": "email"}

cases, jobs, appointments, consents, work_reports, invoices, events, comms = [], [], [], [], [], [], [], []
ev_n = comm_n = 1


def ev(name, at, case, data=None, actor=None):
    global ev_n
    if at > NOW:
        return
    events.append({"event_id": f"ev_{ev_n:04d}", "event": name, "occurred_at": iso(at), "unit_id": case["unit"],
                   "contact_id": case["by"], "case_id": case["id"], "actor": actor, "data": data or {}})
    ev_n += 1


def cm(at, case, channel, direction, frm, to, text, lang="en"):
    global comm_n
    if at > NOW:
        return
    comms.append({"comm_id": f"cm_{comm_n:04d}", "case_id": case["id"], "unit_id": case["unit"], "at": iso(at), "channel": channel,
                  "direction": direction, "from": frm, "to": to, "language": lang, "text": text})
    comm_n += 1


for c in CASES:
    t0 = T(c["at"])
    st = c["status"]
    stage = STATUS_STAGE[st]
    unit = unit_by_id[c["unit"]]
    prop = prop_by_id[unit["property_id"]]
    tenant = contact_by_id[c["by"]]
    urg = c.get("urgency")
    fast = urg in ("emergency", "urgent")
    emergency = c.get("emergency", False)
    pid = c.get("partner")
    partner = partner_by_id.get(pid)
    tech = c.get("tech")
    win = c.get("window")
    linked_only = c.get("resolution_kind") == "linked"
    job_id = "J-" + c["id"][2:] if pid and stage >= 4 and not linked_only else None
    tl = []

    def step(name, at, by, note=None):
        if at <= NOW:
            tl.append({"at": iso(at), "step": name, "by": by, **({"note": note} if note else {})})
        return at

    tch = CHANNEL_TO[c["channel"]]
    step("reported", t0, c["by"], f"via {c['channel']}")
    ev("case.created", t0, c, {"channel": c["channel"], "language": c["lang"], "text": c["text"]}, c["by"])
    cm(t0, c, tch, "inbound", c["by"], "centrix", c["text"], c["lang"])
    cat = c.get("category", "plumbing")
    t1 = step("classified", t0 + timedelta(minutes=1), "centrix_ai", f"{cat} / {c['problem']}" + (" (unsure, sent to manager)" if st == "manager_review" else ""))
    ev("case.classified", t1, c, {"category": cat, "problem_type": c["problem"], "urgency": urg, "confidence": 0.62 if st == "manager_review" else 0.93}, "centrix_ai")
    if c.get("linked"):
        step("linked_to_existing_case", t1, "centrix_ai", ", ".join(c["linked"]))
        ev("case.linked", t1, c, {"linked_case_ids": c["linked"]}, "centrix_ai")
    if st == "manager_review":
        step("sent_to_manager_review", t1, "centrix_ai", c["review_reason"])
    t2 = t0 + timedelta(minutes=4)
    if stage >= 2 and c["answers"]:
        step("follow_ups_answered", t2, c["by"])
        for q, a in c["answers"]:
            cm(t1, c, tch, "outbound", "centrix", c["by"], q, c["lang"])
            cm(t2, c, tch, "inbound", c["by"], "centrix", a, c["lang"])
    if emergency:
        step("urgent_path", t2, "centrix_ai", "Voice agent explained the water shut-off and alerted the manager on call")
        cm(t2, c, "voice", "outbound", "centrix", c["by"], f"Please close the water tap: {unit['water_shutoff']}. A plumber is being sent now.", c["lang"])

    consent = None
    if stage >= 3 and not linked_only:
        t3 = step("consent_given", t0 + timedelta(minutes=6), c["by"])
        consent = {"consent_id": "CON-" + c["id"][2:], "case_id": c["id"], "contact_id": c["by"], "partner_id": pid,
                   "data_shared": SHARED if c["photos"] else [s for s in SHARED if s != "photos"],
                   "data_withheld": property_manager["never_shared_with_partners"],
                   "given_at": iso(t3), "channel": tch,
                   "wording": f"I agree that {partner['name']} receives my first name, phone number, address and the details of this report, only to fix this problem.",
                   "revoked_at": None}
        consents.append(consent)
        ev("consent.given", t3, c, {"consent_id": consent["consent_id"], "partner_id": pid, "channel": tch}, c["by"])
    elif st == "awaiting_consent":
        cm(t0 + timedelta(minutes=5), c, tch, "outbound", "centrix", c["by"],
           f"To send a plumber, {partner['name']} will receive your first name, phone, address, the problem and your photos. Your email, lease and meter numbers stay private. Do you agree?", c["lang"])

    t4 = t0 + timedelta(minutes=20 if fast else 120)
    if emergency:
        t4 = t0 + timedelta(minutes=10)
    t5 = t4 + timedelta(minutes=10 if fast else 60)
    t6 = t5 + timedelta(minutes=5)
    t7 = t6 + timedelta(minutes=25)
    appt = None
    if job_id:
        staff = prop["manager_staff_id"]
        step("dispatched", t4, staff, f"to {partner['name']}")
        ev("job.dispatched", t4, c, {"job_id": job_id, "partner_id": pid}, staff)
        cm(t4, c, partner["connector"]["channel"], "outbound", "centrix", pid, f"New job {job_id}: {c['summary']} at {prop['name']}, {unit['label']}.", "nl")
    if job_id and stage >= 5:
        step("accepted", t5, pid)
        ev("job.accepted", t5, c, {"job_id": job_id, "technician_id": tech}, pid)
    windows = []
    if job_id and stage >= 6:
        if win:
            ws = T(win[0])
            windows = [ws, ws + timedelta(days=1), ws + timedelta(days=2)] if not emergency and ws.date() != t0.date() else [ws]
        else:
            windows = [datetime(2026, 11, 21, 13), datetime(2026, 11, 24, 9), datetime(2026, 11, 24, 13)]
        step("windows_proposed", t6, pid, f"{len(windows)} windows")
        ev("job.windows_proposed", t6, c, {"job_id": job_id, "windows": [iso(w) for w in windows]}, pid)
        cm(t6, c, tch, "outbound", "centrix", c["by"], "The plumber can come: " + "; ".join(w.strftime("%a %d %b %H:%M") for w in windows) + ". Which one suits you?", c["lang"])
    if job_id and stage >= 7 and win:
        ws = T(win[0]); we = ws + timedelta(hours=win[1])
        step("slot_chosen", t7, c["by"], ws.strftime("%a %d %b %H:%M"))
        appt = {"appointment_id": "APT-" + c["id"][2:], "job_id": job_id, "case_id": c["id"], "technician_id": tech,
                "window_start": iso(ws), "window_end": iso(we), "chosen_by": c["by"], "chosen_at": iso(t7),
                "access": "Daughter lets the plumber in" if c["by"] == "c_209" else "Tenant at home",
                "reminder_sent_at": None, "status": "scheduled"}
        ev("appointment.booked", t7, c, {"appointment_id": appt["appointment_id"], "window_start": iso(ws)}, c["by"])
        cm(t7, c, tch, "outbound", "centrix", c["by"], f"Booked: {partner['name']} comes on {ws.strftime('%a %d %b, %H:%M')}-{we.strftime('%H:%M')}.", c["lang"])
        rem = datetime(ws.year, ws.month, ws.day, 17) - timedelta(days=1)
        if rem > t7 and rem <= NOW:
            appt["reminder_sent_at"] = iso(rem)
            step("reminder_sent", rem, "centrix_ai")
            cm(rem, c, tch, "outbound", "centrix", c["by"], f"Reminder: the plumber comes tomorrow {ws.strftime('%H:%M')}-{we.strftime('%H:%M')}. Reply 'change' to rebook.", c["lang"])
        appointments.append(appt)
    report = None
    invoice = None
    quote = None
    if job_id and stage >= 10 and win:
        ws = T(win[0])
        t9 = step("on_the_way", ws + timedelta(minutes=5), tech, "ETA 20 min")
        ev("job.on_the_way", t9, c, {"job_id": job_id, "eta_minutes": 20}, tech)
        cm(t9, c, tch, "outbound", "centrix", c["by"], "Your plumber is on the way, about 20 minutes.", c["lang"])
        t10 = step("work_started", ws + timedelta(minutes=25), tech)
        ev("job.started", t10, c, {"job_id": job_id}, tech)
        if c.get("quote"):
            q = c["quote"]
            quote = {"amount_eur_excl_vat": q, "description": c.get("quote_text", c.get("work")), "submitted_at": iso(t10 + timedelta(minutes=40)),
                     "needs_approval": q > property_manager["repair_policy"]["pre_approved_limit_eur"]}
            step("quote_submitted", t10 + timedelta(minutes=40), tech, f"€{q:,.0f} excl. VAT")
            ev("quote.submitted", t10 + timedelta(minutes=40), c, {"job_id": job_id, "amount_eur": q, "needs_approval": quote["needs_approval"]}, tech)
            if stage > 10:
                quote.update({"approved_by": prop["manager_staff_id"] if quote["needs_approval"] else "pre_approved_policy", "approved_at": iso(t10 + timedelta(minutes=55))})
                if quote["needs_approval"]:
                    step("quote_approved", t10 + timedelta(minutes=55), prop["manager_staff_id"])
            else:
                quote.update({"approved_by": None, "approved_at": None, "status": "waiting for manager approval (over €3,000)"})
                cm(t10 + timedelta(minutes=45), c, "email", "outbound", "centrix", prop["manager_staff_id"],
                   f"Quote €{q:,.0f} excl. VAT for {c['id']} is over the €3,000 limit. Approve or decline in centrix.", "nl")
    if appt:
        appt["status"] = "completed" if stage >= 12 else ("in_progress" if st == "in_progress" else ("visited" if st == "quote_approval" else "scheduled"))
    if job_id and stage >= 12:
        ws = T(win[0])
        t12 = ws + timedelta(minutes=25 + int(c["hours"] * 60) + (60 if c.get("quote") else 0))
        if c.get("quote"):
            t12 = ws + timedelta(hours=6)
        step("work_done", t12, tech, c["work"])
        labour = round(c["hours"] * partner["rates_eur_excl_vat"]["hourly"], 2)
        report = {"report_id": "WR-" + c["id"][2:], "job_id": job_id, "case_id": c["id"], "technician_id": tech, "completed_at": iso(t12),
                  "finding": c["finding"], "work_done": c["work"], "labour_hours": c["hours"],
                  "parts": [{"name": n, "qty": q, "unit_price_eur": p} for n, q, p in c["parts"]],
                  "photos_after": [f"photos/{c['id']}/after_1.jpg"], "dictated": tch in ("voice", "whatsapp"),
                  "tenant_confirmed_at": None, "home_record_update": c.get("home")}
        ev("job.completed", t12, c, {"job_id": job_id, "report_id": report["report_id"]}, tech)
        cm(t12 + timedelta(minutes=30), c, tch, "outbound", "centrix", c["by"], "The plumber says the repair is done. Is everything dry and working now?", c["lang"])
        if stage >= 13:
            t13 = step("tenant_confirmed", t12 + timedelta(hours=1), c["by"])
            report["tenant_confirmed_at"] = iso(t13)
            ev("tenant.confirmed_fix", t13, c, {"job_id": job_id}, c["by"])
            cm(t13, c, tch, "inbound", c["by"], "centrix", "Yes, it works.", c["lang"])
        work_reports.append(report)
    if job_id and stage >= 14:
        t14 = T(win[0]) + timedelta(days=1, hours=2)
        rates = partner["rates_eur_excl_vat"]
        lines = [{"description": "Emergency call-out (evening)" if emergency else "Call-out", "qty": 1, "unit_price_eur": rates["emergency_call_out"] if emergency else rates["call_out"]},
                 {"description": "Labour", "qty": c["hours"], "unit_price_eur": rates["hourly"]}]
        lines += [{"description": n, "qty": q, "unit_price_eur": p} for n, q, p in c["parts"]]
        for l in lines:
            l["total_eur"] = round(l["qty"] * l["unit_price_eur"], 2)
        sub = round(sum(l["total_eur"] for l in lines), 2)
        vat = round(sub * VAT / 100, 2)
        bill_to = "tenant" if c["cost_bearer"] == "tenant" else "property_manager"
        invoice = {"invoice_id": "INV-" + c["id"][2:], "job_id": job_id, "case_id": c["id"], "unit_id": c["unit"], "partner_id": pid,
                   "issued_at": iso(t14), "lines": lines, "subtotal_eur": sub, "vat_rate_pct": VAT, "vat_eur": vat, "total_eur": round(sub + vat, 2),
                   "bill_to": bill_to, "bill_to_contact_id": c["by"] if bill_to == "tenant" else "pm_org",
                   "status": "paid" if st == "closed" else "sent", "document": f"invoices/INV-{c['id'][2:]}.pdf"}
        invoices.append(invoice)
        step("invoice_linked", t14, pid, f"€{invoice['total_eur']:.2f} incl. VAT, billed to {bill_to}")
        ev("invoice.issued", t14, c, {"invoice_id": invoice["invoice_id"], "total_eur": invoice["total_eur"], "bill_to": bill_to}, pid)
        cm(t14, c, "email", "outbound", pid, "pm_org" if bill_to != "tenant" else c["by"], f"Invoice {invoice['invoice_id']} for {c['id']}: €{invoice['total_eur']:.2f}", "nl")
    fb = None
    if (job_id or linked_only) and stage >= 15 and c.get("feedback"):
        tfb = T(win[0]) + timedelta(days=1, hours=4)
        fb = {"rating": c["feedback"][0], "comment": c["feedback"][1], "given_at": iso(tfb)}
        step("feedback_given", tfb, c["by"], f"{fb['rating']}/5")
        ev("tenant.feedback", tfb, c, fb, c["by"])
    follow = None
    if (job_id or linked_only) and stage >= 15:
        base = T(win[0]) if win else T(c["at"])
        due = base + timedelta(days=7)
        follow = {"due_at": iso(due), "done_at": iso(due + timedelta(hours=2)) if st == "closed" else None, "result": c.get("followup") if st == "closed" else None}
    if stage >= 17:
        base = T(win[0]) if win else t0
        tc = base + timedelta(days=7, hours=2)
        step("closed", tc, "centrix_ai", c.get("followup"))
        ev("case.closed", tc, c, {"resolution": c.get("work")}, "centrix_ai")
        if c.get("home"):
            unit["history"].append({"date": tc.strftime("%Y-%m-%d"), "case_id": c["id"], "note": c["home"]})
    elif st == "follow_up" and c.get("home"):
        unit["history"].append({"date": T(win[0]).strftime("%Y-%m-%d"), "case_id": c["id"], "note": c["home"]})

    if job_id:
        jstatus = {"dispatched": "offered", "scheduling": "windows_proposed", "scheduled": "scheduled", "in_progress": "in_progress",
                   "quote_approval": "quote_pending_approval", "awaiting_confirmation": "done", "invoiced": "invoiced", "follow_up": "invoiced", "closed": "closed"}[st]
        jobs.append({
            "job_id": job_id, "case_id": c["id"], "partner_id": pid, "technician_id": tech, "status": jstatus, "created_at": iso(t4),
            "brief": {"title": c["summary"], "category": cat, "problem_type": c["problem"], "urgency": urg,
                      "address": f"{prop['address']['street']} {prop['address']['number']}, {prop['address']['postcode']} Maastricht",
                      "unit": unit["label"], "floor": unit["floor"], "lift": unit["lift"], "tenant_first_name": tenant["first_name"],
                      "tenant_phone": tenant["phone"], "tenant_language": tenant["language"],
                      "description": c["text"], "description_translated": c["summary"],
                      "answers": [{"q": q, "a": a} for q, a in c["answers"]],
                      "photos": [f"photos/{c['id']}/before_{i + 1}.jpg" for i in range(c["photos"])],
                      "access": appt["access"] if appt else ("Tenant at home" if not prop["caretaker_contact_id"] else "Tenant at home, otherwise caretaker"),
                      "water_shutoff": unit["water_shutoff"], "water_main": prop["water_main"],
                      "boiler": unit["boiler"]["model"] if unit["boiler"] else None, "building_year": prop["building_year"],
                      "pipework": prop["pipework"], "linked_case_ids": c.get("linked", []),
                      "cost_bearer": c["cost_bearer"], "pre_approved_limit_eur": 3000},
            "withheld": property_manager["never_shared_with_partners"],
            "consent_id": consent["consent_id"] if consent else None,
            "proposed_windows": [{"start": iso(w), "end": iso(w + timedelta(hours=2))} for w in windows],
            "appointment_id": appt["appointment_id"] if appt else None,
            "quote": quote, "work_report_id": report["report_id"] if report else None, "invoice_id": invoice["invoice_id"] if invoice else None,
        })

    case_status = st
    cases.append({
        "case_id": c["id"], "unit_id": c["unit"], "property_id": unit["property_id"], "reported_by": c["by"], "reported_at": iso(t0),
        "channel": c["channel"], "language": c["lang"], "original_text": c["text"], "summary": c["summary"],
        "category": cat, "problem_type": c["problem"], "urgency": urg, "status": case_status,
        "follow_up_answers": [{"q": q, "a": a} for q, a in c["answers"]],
        "photos": [f"photos/{c['id']}/before_{i + 1}.jpg" for i in range(c["photos"])],
        "linked_case_ids": c.get("linked", []), "assigned_partner_id": pid if (job_id or st == "manager_review" or st == "awaiting_consent" or linked_only) else None,
        "suggested_partner_id": pid if st in ("manager_review", "awaiting_consent") else None,
        "job_id": job_id, "consent_id": consent["consent_id"] if consent else None,
        "cost_bearer": c.get("cost_bearer"), "cost_note": c.get("cost_note"),
        "manager_staff_id": prop["manager_staff_id"], "review_reason": c.get("review_reason"),
        "resolution": c.get("work") if st in ("closed", "follow_up", "invoiced", "awaiting_confirmation") else None,
        "feedback": fb, "follow_up_7d": follow, "closed_at": tl[-1]["at"] if st == "closed" else None,
        "timeline": tl,
    })
# fix: suggested vs assigned
for cs in cases:
    if cs["status"] in ("manager_review", "awaiting_consent"):
        cs["assigned_partner_id"] = None
    if cs["status"] == "new":
        cs["assigned_partner_id"] = None

# linked back-reference
by_case = {c["case_id"]: c for c in cases}
for c in cases:
    for l in c["linked_case_ids"]:
        if c["case_id"] not in by_case[l]["linked_case_ids"]:
            by_case[l]["linked_case_ids"].append(c["case_id"])

# pre-existing home history (before this data set)
unit_by_id["u_03_11"]["history"].insert(0, {"date": "2025-06-12", "case_id": "C-2025-0388", "note": "Kitchen tap replaced (Jekerdal Loodgieters)"})
unit_by_id["u_02_2"]["history"].insert(0, {"date": "2024-03-04", "case_id": "C-2024-0102", "note": "Toilet cistern replaced"})
unit_by_id["u_04_0"]["history"].insert(0, {"date": "2023-11-20", "case_id": "C-2023-0410", "note": "Lead pipe flagged during boiler service; replacement advised"})

# ---------------------------------------------------------------- non-case events (other moments in a property's life)
extra = [
    ("tenant.move_in_scheduled", "2026-11-15 10:00", "u_03_22", "c_227", {"move_in_date": "2026-12-01", "contract_id": next(x["contract_id"] for x in contracts if x.get("contact_id") == "c_227")}),
    ("tenant.move_out_scheduled", "2026-10-30 14:00", "u_06_6", "c_228", {"move_out_date": "2026-11-30", "inspection_at": "2026-11-30T10:00:00Z"}),
    ("contract.expiring", "2026-11-01 06:00", None, None, {"contract_id": next(x["contract_id"] for x in contracts if x.get("category") == "block_heating"), "property_id": "prop_03", "ends": "2026-12-31"}),
    ("boiler.service_due", "2026-11-20 06:00", "u_01_2", "c_203", {"boiler": "Nefit EcoLine", "install_year": 2011, "note": "15 years old: replacement advised at next service"}),
]
for name, at, u, cid, data in extra:
    events.append({"event_id": f"ev_{ev_n:04d}", "event": name, "occurred_at": iso(T(at)), "unit_id": u, "contact_id": cid, "case_id": None, "actor": "centrix", "data": data})
    ev_n += 1
events.sort(key=lambda e: e["occurred_at"])
for i, e in enumerate(events, 1):
    e["event_id"] = f"ev_{i:04d}"
comms.sort(key=lambda m: m["at"])
for i, m in enumerate(comms, 1):
    m["comm_id"] = f"cm_{i:04d}"
cases.sort(key=lambda c: c["reported_at"])

# ---------------------------------------------------------------- write
meta = {"generated_for": "reltix challenge 'Plug a Partner into centrix'", "city": "Maastricht", "now": iso(NOW), "timezone_note": "All times are UTC (Z).",
        "fake": True, "note": "All people, companies, phone numbers, emails, KvK and EAN numbers are made up. Street names are real Maastricht streets; house numbers and postcodes are illustrative."}
files = {"_meta": meta, "property_manager": property_manager, "properties": properties, "units": units, "contacts": contacts,
         "contracts": contracts, "partners": partners, "cases": cases, "jobs": jobs, "consents": consents,
         "appointments": appointments, "work_reports": work_reports, "invoices": invoices, "events": events, "communications": comms}
os.makedirs(OUT, exist_ok=True)
for name, data in files.items():
    with open(os.path.join(OUT, f"{name}.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
print({k: (len(v) if isinstance(v, list) else 1) for k, v in files.items()})
