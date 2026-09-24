#!/usr/bin/env python3
"""
MyCrewMate: Datenbasiertes Markt- und 5-Jahres-Umsatzmodell (DACH-L)
Berechnet Marktgrößen, Kohorten, ARR, Wachstumsraten und Unit Economics.
"""

import json
from dataclasses import dataclass, asdict
from typing import Dict, List

# ---------------------------------------------------------
# 1. Parameter & Bepreisung
# ---------------------------------------------------------
PRICE_SINGLE = 69.0        # Euro einmalig pro Event
PRICE_PRO = 149.0          # Euro pro Jahr Lizenz
PRICE_ENTERPRISE = 990.0   # Euro pro Jahr Rahmenvertrag

# ---------------------------------------------------------
# 2. Reale Plattform-Startmetriken (MyCrewMate Status Quo)
# ---------------------------------------------------------
PLATFORM_METRICS = {
    "mandanten_gesamt": 3,
    "mandanten_aktiv_pilot": 3,
    "mandanten_segmente": {
        "radsport_ausdauer": 1,
        "schuetzen_tradition": 1,
        "kirmes_volksfest": 1
    },
    "events_gesamt": 10,
    "events_jahr_2025": 4,
    "events_jahr_2026": 1,
    "events_jahr_2027": 5,
    "durchschnitt_events_pro_mandant": 3.33,
    "helfer_gesamt": 302,
    "durchschnitt_helfer_pro_event": 75.5,
    "helferspanne_min": 65,
    "helferspanne_max": 87,
    "schichten_gesamt": 47,
    "durchschnitt_schichten_pro_event": 11.75,
    "max_schichten_pro_event": 21,
    "aktive_zugewiesene_helfer": 84,
    "zuordnungen_gesamt": 125,
    "kontakte_ansprechpartner": 49
}

# ---------------------------------------------------------
# 3. Marktstruktur DACH-L (Events & Organisationen pro Jahr)
# ---------------------------------------------------------
MARKET_SEGMENTS = {
    "schuetzen_tradition": {
        "label": "Schützen- & Traditionsvereine",
        "tam_events": 24000,
        "sam_events": 8500,  # 10–200 Helfer, mehrtägige Schützen- & Schützenfestwochenenden
        "primary_product": "Pro-Abo & Single Event",
        "rationale": "13.600 DSB-Vereine in DE, ca. 2.600 in CH, ca. 1.200 in AT/LU; rund 24.000 relevante Königsschießen/Schützenfeste/Traditionstage."
    },
    "kirmes_stadtfeste": {
        "label": "Stadtfeste, Kirmessen & Volksfeste",
        "tam_events": 23500,
        "sam_events": 9200,  # Ortskirmessen, Bürgervereine, Vereinsgemeinschaften
        "primary_product": "Single Event Pass & Pro-Abo",
        "rationale": "9.750 größere Volksfeste/Jahrmärkte in DE plus ca. 14.000 lokale Kirmessen, Kirchweihen, Dorffeste und Vereinsfeste in AT/CH/DE."
    },
    "radsport_ausdauer": {
        "label": "Radsport- & Ausdauersportveranstaltungen",
        "tam_events": 3800,
        "sam_events": 2600,  # RTFs, Gravel-Rides, Marathons, Triathlons mit komplexen Streckenposten
        "primary_product": "Pro-Abo & Single Event",
        "rationale": "BDR (2.400 Vereine in DE), Swiss Cycling, Cycling Austria; RTF, Radmarathons, Jedermannrennen, Lauf-/Triathlonveranstaltungen."
    },
    "weitere_vereins_events": {
        "label": "Weitere Vereins- & Breitensportevents",
        "tam_events": 68700,
        "sam_events": 16700, # Große Turniere, Feuerwehrfeste, Jubiläen, Musikfeste
        "primary_product": "Single Event & Verbandslizenz",
        "rationale": "Über 615.000 Vereine in DE, 125.000 in AT, 90.000 in CH. Turniere, Feuerwehr- und Musikfeste mit ehrenamtlicher Koordination."
    }
}

TAM_TOTAL_EVENTS = sum(s["tam_events"] for s in MARKET_SEGMENTS.values())
SAM_TOTAL_EVENTS = sum(s["sam_events"] for s in MARKET_SEGMENTS.values())

# ---------------------------------------------------------
# 4. Fünfjahres-Szenariorechnung (Base Case)
# ---------------------------------------------------------
# Logik der Phasen:
# J1: Markteintritt, Piloten, regionale Schützenkreise, BDR-Bezirke
# J2: Multiplikator-Verträge (erste Kreis-/Landesverbände), Mundpropaganda
# J3: DACH-L Expansion (CH/AT/LU), Verbandsrahmenverträge greifen
# J4: Ökosystem & Standard in Traditions- & Sportverbänden
# J5: Konsolidierung, hoher Renewal-Bestand, Plattform-Netzwerkeffekt

@dataclass
class YearProjection:
    year: int
    phase_title: str
    single_pass_units: int
    pro_new: int
    pro_renewed: int
    pro_total: int
    enterprise_new: int
    enterprise_renewed: int
    enterprise_total: int
    sam_events_covered: int
    sam_penetration_pct: float
    rev_single: float
    rev_pro: float
    rev_enterprise: float
    rev_total: float
    growth_rate_pct: float

def run_model(churn_pro=0.12, churn_ent=0.05):
    # Definierte Neukundendynamik über die 5 Jahre
    # [J1, J2, J3, J4, J5]
    new_single = [120, 340, 780, 1420, 2150]
    new_pro =    [45,  130, 310,  590,  880]
    new_ent =    [2,     8,  22,   42,   65]
    
    phases = [
        "Jahr 1: Markteintritt & Validierung (Piloten & Bezirke)",
        "Jahr 2: Multiplikatoren & erste Verbandsrahmenverträge",
        "Jahr 3: DACH-L Durchdringung (CH, AT, LU & Bundesländer)",
        "Jahr 4: Branchenstandard & Verbandsökosystem",
        "Jahr 5: Plattform-Dominanz, Konsolidierung & Skaleneffekt"
    ]
    
    projections: List[YearProjection] = []
    
    prev_pro_active = 0
    prev_ent_active = 0
    prev_rev = 0.0
    
    for y in range(5):
        year_num = y + 1
        
        # Single Pass (jedes Jahr neu, transaktional)
        s_units = new_single[y]
        rev_s = s_units * PRICE_SINGLE
        
        # Pro-Abo (Bestand + Zuwachs)
        pro_ren = int(round(prev_pro_active * (1.0 - churn_pro)))
        pro_n = new_pro[y]
        pro_tot = pro_ren + pro_n
        rev_p = pro_tot * PRICE_PRO
        
        # Enterprise (Verband / Großorganisation)
        ent_ren = int(round(prev_ent_active * (1.0 - churn_ent)))
        ent_n = new_ent[y]
        ent_tot = ent_ren + ent_n
        rev_e = ent_tot * PRICE_ENTERPRISE
        
        rev_tot = rev_s + rev_p + rev_e
        
        growth = 0.0 if y == 0 else ((rev_tot - prev_rev) / prev_rev) * 100.0
        
        # Abgedeckte Events schätzen:
        # Single: 1 Event/Kunde
        # Pro: Schnitt 1.8 Events/Jahr (Mehrfachveranstalter/Abteilungen)
        # Enterprise: ca. 12–15 Mitgliedsvereine/Events pro Verbandslizenz
        covered_events = int(s_units + (pro_tot * 1.8) + (ent_tot * 14))
        sam_pct = (covered_events / SAM_TOTAL_EVENTS) * 100.0
        
        proj = YearProjection(
            year=year_num,
            phase_title=phases[y],
            single_pass_units=s_units,
            pro_new=pro_n,
            pro_renewed=pro_ren,
            pro_total=pro_tot,
            enterprise_new=ent_n,
            enterprise_renewed=ent_ren,
            enterprise_total=ent_tot,
            sam_events_covered=covered_events,
            sam_penetration_pct=round(sam_pct, 2),
            rev_single=round(rev_s, 2),
            rev_pro=round(rev_p, 2),
            rev_enterprise=round(rev_e, 2),
            rev_total=round(rev_tot, 2),
            growth_rate_pct=round(growth, 1)
        )
        projections.append(proj)
        
        prev_pro_active = pro_tot
        prev_ent_active = ent_tot
        prev_rev = rev_tot
        
    return projections

# ---------------------------------------------------------
# 5. Sensitivitätsanalyse (Konservativ / Base / Optimistisch)
# ---------------------------------------------------------
def run_scenarios():
    scenarios = {
        "Konservativ (-25% Adoption, 18% Churn)": {
            "single": [90, 255, 585, 1065, 1610],
            "pro": [35, 95, 230, 440, 660],
            "ent": [1, 6, 16, 31, 48],
            "churn_pro": 0.18,
            "churn_ent": 0.08
        },
        "Base Case (Kernmodell)": {
            "single": [120, 340, 780, 1420, 2150],
            "pro": [45, 130, 310, 590, 880],
            "ent": [2, 8, 22, 42, 65],
            "churn_pro": 0.12,
            "churn_ent": 0.05
        },
        "Optimistisch (+30% Adoption, 8% Churn)": {
            "single": [155, 440, 1010, 1840, 2800],
            "pro": [60, 170, 400, 770, 1150],
            "ent": [3, 11, 29, 55, 85],
            "churn_pro": 0.08,
            "churn_ent": 0.03
        }
    }
    
    results = {}
    for name, cfg in scenarios.items():
        prev_p = 0
        prev_e = 0
        revs = []
        for y in range(5):
            s = cfg["single"][y]
            p = cfg["pro"][y] + int(round(prev_p * (1.0 - cfg["churn_pro"])))
            e = cfg["ent"][y] + int(round(prev_e * (1.0 - cfg["churn_ent"])))
            rev = (s * PRICE_SINGLE) + (p * PRICE_PRO) + (e * PRICE_ENTERPRISE)
            revs.append(round(rev, 2))
            prev_p = p
            prev_e = e
        results[name] = revs
    return results

if __name__ == "__main__":
    base_model = run_model()
    scenarios = run_scenarios()
    
    output = {
        "platform_metrics": PLATFORM_METRICS,
        "market_segments": MARKET_SEGMENTS,
        "tam_total": TAM_TOTAL_EVENTS,
        "sam_total": SAM_TOTAL_EVENTS,
        "base_model": [asdict(p) for p in base_model],
        "scenarios": scenarios
    }
    
    with open("/home/ubuntu/myeifelride/docs/market_financial_model.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        
    print("Modell erfolgreich berechnet und in docs/market_financial_model.json gespeichert.")
    print("--- 5-Jahres-Übersicht Base Case ---")
    for row in base_model:
        print(f"J{row.year}: Single={row.single_pass_units:4d} | Pro={row.pro_total:4d} | Ent={row.enterprise_total:3d} | Rev={row.rev_total:10.2f} € | Growth={row.growth_rate_pct:5.1f}% | SAM={row.sam_penetration_pct:4.1f}%")
