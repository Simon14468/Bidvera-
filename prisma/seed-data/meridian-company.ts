/**
 * Production-compatible seed definition for Bidvera's primary internal test org.
 * Fictional company — not a real-world business. Used only by Prisma seed / upsert scripts.
 * Never imported by UI components.
 */

export const MERIDIAN_TEST_ORG = {
  name: "Meridian Integrated Facilities Ltd",
  slug: "meridian-integrated-facilities",
  /** Fictional domain for the test org — not a live public website */
  domain: "meridian-facilities.test",
  country: "United Kingdom",
  companySize: "Medium",
  legalType: "Private limited company (Ltd)",
  foundedYear: 2011,
  city: "Reading",
  website: "https://www.meridian-facilities.test",
  contactEmail: "bids@meridian-facilities.test",
  contactPhone: "+44 118 555 0142",
  description:
    "Meridian Integrated Facilities Ltd is a mid-sized UK facilities management contractor delivering soft FM, hard FM, planned preventive maintenance, and specialist cleaning for public-sector estates, education campuses, and commercial portfolios across southern England.",
  mainActivity:
    "Integrated facilities management and building maintenance services for public and private sector clients",
  profile: {
    industry: "Security & Facilities",
    country: "United Kingdom",
    companySize: "Medium",
    experienceLevel: "highly_experienced",
    services: [
      "Soft facilities management",
      "Hard facilities management",
      "Planned preventive maintenance (PPM)",
      "Reactive building maintenance",
      "Specialist cleaning",
      "Grounds maintenance",
      "Helpdesk / CAFM coordination",
      "TUPE mobilisation support",
    ],
    certifications: [
      "ISO 9001:2015 (quality management — self-declared test record)",
      "ISO 14001:2015 (environmental — self-declared test record)",
      "ISO 45001:2018 (OH&S — self-declared test record)",
      "SSIP / SafeContractor (test record)",
      "Cyber Essentials (test record)",
    ],
    experienceYears: 14,
    revenueRange: "£5m–£12m",
    employeeRange: "120–180",
    geographicCoverage: [
      "Greater London",
      "South East England",
      "Thames Valley",
      "East of England",
      "South West England (selected lots)",
    ],
    contractSizeMin: 75_000,
    contractSizeMax: 4_000_000,
    customQualificationRules: [
      "Do not bid if public liability indemnity above £10m is mandatory without board approval",
      "Prefer contracts with an initial term of 3 years or more",
      "Require clear TUPE employee liability data before committing to Bid",
      "Flag any requirement for out-of-area mobilisation beyond southern England",
    ],
  },
  users: {
    owner: {
      name: "Sarah Chen",
      email: "owner@meridian-facilities.test",
      role: "OWNER" as const,
      /** Dev/test credential only — hashed at seed time; never stored plaintext in DB */
      passwordEnvKey: "MERIDIAN_OWNER_PASSWORD",
      defaultPassword: "MeridianOwner1!",
    },
    admin: {
      name: "James Okonkwo",
      email: "admin@meridian-facilities.test",
      role: "ADMIN" as const,
      passwordEnvKey: "MERIDIAN_ADMIN_PASSWORD",
      defaultPassword: "MeridianAdmin1!",
    },
    member: {
      name: "Priya Nair",
      email: "analyst@meridian-facilities.test",
      role: "MEMBER" as const,
      passwordEnvKey: "MERIDIAN_MEMBER_PASSWORD",
      defaultPassword: "MeridianMember1!",
    },
  },
  /** Historical tenders for private outcome / fit testing — analysis engine not bypassed for live runs */
  historicalTenders: [
    {
      title: "County Council Soft FM Framework — Lot 2 Cleaning",
      client: "Thames Valley County Council (fictional)",
      country: "United Kingdom",
      region: "South East England",
      industry: "Security & Facilities",
      estimatedValue: 850_000,
      decision: "BID" as const,
      fitScore: 86,
      confidence: "HIGH" as const,
      outcome: "WON" as const,
      reasoning:
        "Strong service and geography match; certifications aligned; internal test outcome WON.",
      missingMandatory: 0,
    },
    {
      title: "University Campus Hard FM & PPM Contract",
      client: "Reading Technical University (fictional)",
      country: "United Kingdom",
      region: "Thames Valley",
      industry: "Security & Facilities",
      estimatedValue: 1_200_000,
      decision: "BID" as const,
      fitScore: 78,
      confidence: "HIGH" as const,
      outcome: "LOST" as const,
      reasoning:
        "Good capability fit; commercial score lost on price — internal test outcome LOST.",
      missingMandatory: 0,
    },
    {
      title: "NHS Estate Specialist Cleaning Framework",
      client: "Wessex NHS Trust Group (fictional)",
      country: "United Kingdom",
      region: "South West England",
      industry: "Security & Facilities",
      estimatedValue: 420_000,
      decision: "REVIEW" as const,
      fitScore: 61,
      confidence: "MEDIUM" as const,
      outcome: "BID_SUBMITTED" as const,
      reasoning:
        "Partial clinical cleaning evidence; submitted after clarifications — test outcome BID_SUBMITTED.",
      missingMandatory: 1,
    },
    {
      title: "National Cyber Security Operations Tender",
      client: "Central Digital Agency (fictional)",
      country: "United Kingdom",
      region: "Greater London",
      industry: "Information Technology",
      estimatedValue: 2_500_000,
      decision: "NO_BID" as const,
      fitScore: 28,
      confidence: "HIGH" as const,
      outcome: "NO_BID_CONFIRMED" as const,
      reasoning:
        "Outside core FM capability; no SOC operations evidence — test outcome NO_BID_CONFIRMED.",
      missingMandatory: 3,
    },
    {
      title: "Multi-site Grounds Maintenance Framework",
      client: "Southern Education Estates (fictional)",
      country: "United Kingdom",
      region: "South East England",
      industry: "Security & Facilities",
      estimatedValue: 310_000,
      decision: "BID" as const,
      fitScore: 72,
      confidence: "MEDIUM" as const,
      outcome: "WITHDRAWN" as const,
      reasoning:
        "TUPE data incomplete after ITT clarification deadline — test outcome WITHDRAWN.",
      missingMandatory: 1,
    },
    {
      title: "Corporate HQ Integrated Soft & Hard FM",
      client: "Northbridge Holdings PLC (fictional)",
      country: "United Kingdom",
      region: "Greater London",
      industry: "Security & Facilities",
      estimatedValue: 1_850_000,
      decision: "BID" as const,
      fitScore: 81,
      confidence: "HIGH" as const,
      outcome: "WON" as const,
      reasoning:
        "Full integrated FM scope; London coverage strong — internal test outcome WON.",
      missingMandatory: 0,
    },
    {
      title: "Airport Airside Cleaning Specialism",
      client: "Southern Gateway Airport Authority (fictional)",
      country: "United Kingdom",
      region: "South East England",
      industry: "Security & Facilities",
      estimatedValue: 960_000,
      decision: "REVIEW" as const,
      fitScore: 54,
      confidence: "MEDIUM" as const,
      outcome: "LOST" as const,
      reasoning:
        "Airside security clearance gap unresolved — test outcome LOST.",
      missingMandatory: 2,
    },
    {
      title: "Local Authority Reactive Maintenance DPS",
      client: "Chiltern District Council (fictional)",
      country: "United Kingdom",
      region: "Thames Valley",
      industry: "Security & Facilities",
      estimatedValue: 180_000,
      decision: "BID" as const,
      fitScore: 74,
      confidence: "MEDIUM" as const,
      outcome: null,
      reasoning:
        "DPS application in progress — outcome intentionally PENDING (null) for open-case testing.",
      missingMandatory: 0,
    },
  ],
  sampleDocuments: [
    {
      fileName: "Meridian_Company_Profile_Summary.txt",
      mimeType: "text/plain",
      body: `MERIDIAN INTEGRATED FACILITIES LTD — INTERNAL TEST COMPANY PROFILE
Legal form: Private limited company (Ltd)
Registered office: Reading, United Kingdom (fictional test address)
Founded: 2011
Employees: 120–180
Main activity: Integrated facilities management

This document is fictional test data for Bidvera product validation.
Certifications listed in the company profile are self-declared test records, not externally verified credentials.
`,
    },
    {
      fileName: "Meridian_Capability_Statement.txt",
      mimeType: "text/plain",
      body: `CAPABILITY STATEMENT (FICTIONAL TEST DATA)

Core services: Soft FM, Hard FM, PPM, reactive maintenance, specialist cleaning, grounds, CAFM helpdesk.
Typical contract sizes: £75,000 – £4,000,000.
Coverage: Greater London, South East, Thames Valley, East of England; selected South West lots.

Typical project types:
- Local authority soft FM frameworks
- Education campus hard FM / PPM
- Commercial HQ integrated FM
- NHS estate cleaning (non-clinical and limited clinical support)

Do not treat this file as a real-world accredited capability proof.
`,
    },
    {
      fileName: "Meridian_Insurance_Summary.txt",
      mimeType: "text/plain",
      body: `INSURANCE SUMMARY (FICTIONAL TEST DATA)

Public liability: £5m (test figure)
Employers' liability: £10m (test figure)
Professional indemnity: £2m (test figure)

Values are invented for compliance-matrix testing only.
`,
    },
  ],
} as const;

export type MeridianHistoricalTender =
  (typeof MERIDIAN_TEST_ORG.historicalTenders)[number];
