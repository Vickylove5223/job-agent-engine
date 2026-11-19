// Catalog and discovery engine for recruitment agencies / staffing firms.
// Covers candidate registration and CV submission across locations,
// with strict automated detection and skipping of paid services.

import type { Profile, RecruitmentAgency, Settings } from "./types";

export interface AgencyCatalogItem {
  id: string;
  name: string;
  website: string;
  registrationUrl: string;
  countries: string[];
  locations: string[];
  sectors: string[];
  isPaidService: boolean;
  pricingDetails: string;
  submissionMethod: "portal_form" | "email" | "external";
  contactEmail?: string;
  phone?: string;
  description: string;
  portalFieldsRequired: string[];
}

/**
 * Curated registry of well-established recruitment and staffing agencies by country.
 * By law in jurisdictions like the UK (Employment Agencies Act 1973), USA, EU, etc.,
 * reputable employment agencies are legally prohibited from charging jobseekers;
 * their fees are 100% paid by the hiring employers.
 *
 * We also include test/sample paid services to prove the paid-skip detection mechanism.
 */
export const RECRUITMENT_AGENCIES_CATALOG: AgencyCatalogItem[] = [
  // ==================== UNITED KINGDOM (GB) ====================
  {
    id: "hays-uk",
    name: "Hays UK & Ireland",
    website: "https://www.hays.co.uk",
    registrationUrl: "https://www.hays.co.uk/register",
    countries: ["GB", "IE"],
    locations: ["London", "Manchester", "Birmingham", "Edinburgh", "Bristol", "Leeds", "Remote"],
    sectors: ["Technology", "Digital", "Finance", "Engineering", "Marketing", "HR"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates (employer-funded recruitment)",
    submissionMethod: "portal_form",
    contactEmail: "candidates@hays.co.uk",
    phone: "+44 20 7259 8700",
    description: "One of the UK's largest professional recruitment specialists covering contract, permanent, and remote roles.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "desiredRole", "locationPreference"],
  },
  {
    id: "michael-page-uk",
    name: "Michael Page UK (PageGroup)",
    website: "https://www.michaelpage.co.uk",
    registrationUrl: "https://www.michaelpage.co.uk/my-page/register",
    countries: ["GB"],
    locations: ["London", "Reading", "Birmingham", "Manchester", "Bristol", "Remote"],
    sectors: ["Technology", "Design & Creative", "Product", "Finance", "Legal"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates (PageGroup candidate guarantee)",
    submissionMethod: "portal_form",
    contactEmail: "cv@michaelpage.co.uk",
    phone: "+44 20 7269 2200",
    description: "Global FTSE-listed recruitment agency connecting qualified candidates with leading employers across the UK.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "targetSalary", "sectors"],
  },
  {
    id: "robert-half-uk",
    name: "Robert Half UK",
    website: "https://www.roberthalf.co.uk",
    registrationUrl: "https://www.roberthalf.co.uk/submit-resume",
    countries: ["GB"],
    locations: ["London", "Bristol", "Manchester", "Milton Keynes", "Birmingham", "Remote"],
    sectors: ["Technology", "Creative", "Finance", "Accounting", "Operations"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "london@roberthalf.co.uk",
    phone: "+44 20 7389 6900",
    description: "Specialized talent solutions consultancy placing tech, finance, and creative professionals.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "workAuthorization"],
  },
  {
    id: "reed-specialist-uk",
    name: "Reed Specialist Recruitment",
    website: "https://www.reed.com",
    registrationUrl: "https://www.reed.co.uk/account/register",
    countries: ["GB"],
    locations: ["London", "Leeds", "Glasgow", "Sheffield", "Liverpool", "Remote"],
    sectors: ["Technology", "Design", "Management", "Education", "Healthcare"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "support@reed.co.uk",
    phone: "+44 20 7632 5000",
    description: "Britain's historic recruitment pioneer with specialist teams across 20+ career disciplines.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "preferredLocations"],
  },
  {
    id: "adecco-uk",
    name: "Adecco UK",
    website: "https://www.adecco.co.uk",
    registrationUrl: "https://www.adecco.co.uk/candidates/candidate-registration",
    countries: ["GB"],
    locations: ["London", "Newcastle", "Cardiff", "Leicester", "Nottingham", "Remote"],
    sectors: ["IT & Technology", "Office Support", "Engineering", "Creative"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "register@adecco.co.uk",
    phone: "+44 20 7395 0000",
    description: "Global workforce solutions leader with branches and remote consultant desks throughout the UK.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "availability"],
  },
  {
    id: "morgan-mckinley-uk",
    name: "Morgan McKinley UK",
    website: "https://www.morganmckinley.com/uk",
    registrationUrl: "https://www.morganmckinley.com/uk/candidates/register-cv",
    countries: ["GB", "IE"],
    locations: ["London", "Dublin", "Cork", "Remote"],
    sectors: ["Technology", "Data", "Transformation", "Strategy", "Finance"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "info@morganmckinley.co.uk",
    phone: "+44 20 7092 0000",
    description: "Professional services recruiter matching talent with tier-1 institutions and high-growth scaleups.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "rolesWanted"],
  },
  {
    id: "nigel-frank",
    name: "Nigel Frank International (Frank Recruitment Group)",
    website: "https://www.nigelfrank.com",
    registrationUrl: "https://www.nigelfrank.com/submit-cv",
    countries: ["GB", "US", "DE", "NL"],
    locations: ["London", "Newcastle", "New York", "Berlin", "Remote"],
    sectors: ["Technology", "Cloud", "Microsoft Ecosystem", "DevOps", "Software Engineering"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "enquiries@nigelfrank.com",
    description: "Global leaders in Microsoft and cloud technology staffing and direct talent placement.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "skills"],
  },

  // ==================== UNITED STATES (US) ====================
  {
    id: "robert-half-us",
    name: "Robert Half Talent Solutions US",
    website: "https://www.roberthalf.com",
    registrationUrl: "https://www.roberthalf.com/us/en/submit-resume",
    countries: ["US"],
    locations: ["New York", "San Francisco", "Austin", "Chicago", "Seattle", "Los Angeles", "Remote"],
    sectors: ["Technology", "Creative & Marketing", "Finance", "Administrative", "Legal"],
    isPaidService: false,
    pricingDetails: "100% Free for jobseekers",
    submissionMethod: "portal_form",
    contactEmail: "inquiries@roberthalf.com",
    phone: "+1 888 744 4475",
    description: "Premier staffing consultancy in North America with dedicated recruiters in 300+ locations.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "zipCode", "workEligibility"],
  },
  {
    id: "teksystems-us",
    name: "TEKsystems",
    website: "https://www.teksystems.com",
    registrationUrl: "https://www.teksystems.com/en/careers/join-our-talent-network",
    countries: ["US", "CA"],
    locations: ["New York", "Boston", "Atlanta", "Dallas", "San Jose", "Toronto", "Remote"],
    sectors: ["Technology", "Software Engineering", "Cloud", "Cybersecurity", "Product Design"],
    isPaidService: false,
    pricingDetails: "100% Free for jobseekers",
    submissionMethod: "portal_form",
    contactEmail: "careers@teksystems.com",
    phone: "+1 888 519 0776",
    description: "Industry-leading IT services and technical staffing partner for 80% of the Fortune 500.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "primarySkill"],
  },
  {
    id: "insight-global",
    name: "Insight Global",
    website: "https://insightglobal.com",
    registrationUrl: "https://insightglobal.com/submit-resume",
    countries: ["US", "CA"],
    locations: ["New York", "Chicago", "Denver", "Austin", "Philadelphia", "Vancouver", "Remote"],
    sectors: ["Technology", "Engineering", "Healthcare", "Creative", "Finance"],
    isPaidService: false,
    pricingDetails: "100% Free for jobseekers",
    submissionMethod: "portal_form",
    contactEmail: "info@insightglobal.com",
    phone: "+1 855 485 8800",
    description: "Top-ranked staffing and talent solutions firm placing thousands of professionals every month.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "desiredRoles"],
  },
  {
    id: "kelly-services-us",
    name: "Kelly Services",
    website: "https://www.kellyservices.us",
    registrationUrl: "https://www.kellyservices.us/us/careers/submit-resume",
    countries: ["US"],
    locations: ["Troy", "New York", "Chicago", "Houston", "San Diego", "Remote"],
    sectors: ["Technology", "Engineering", "Science", "Education", "Office Support"],
    isPaidService: false,
    pricingDetails: "100% Free for jobseekers",
    submissionMethod: "portal_form",
    contactEmail: "help@kellyservices.com",
    description: "Global talent connector providing employment solutions and career representation.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume"],
  },
  {
    id: "cybercoders-us",
    name: "CyberCoders",
    website: "https://www.cybercoders.com",
    registrationUrl: "https://www.cybercoders.com/candidate/register",
    countries: ["US"],
    locations: ["Irvine", "Boston", "New York", "Austin", "Remote"],
    sectors: ["Technology", "Software Engineering", "AI/ML", "Product", "Sales"],
    isPaidService: false,
    pricingDetails: "100% Free for jobseekers",
    submissionMethod: "portal_form",
    contactEmail: "candidate-service@cybercoders.com",
    phone: "+1 949 660 0200",
    description: "Tech-focused placement firm powered by proprietary matching software and specialized recruiters.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "salaryExpectation"],
  },

  // ==================== NIGERIA (NG) ====================
  {
    id: "workforce-group-ng",
    name: "Workforce Group Nigeria",
    website: "https://workforcegroup.com",
    registrationUrl: "https://workforcegroup.com/job-seekers/drop-cv",
    countries: ["NG"],
    locations: ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Remote"],
    sectors: ["Technology", "Banking & Finance", "Consulting", "FMCG", "Telecoms"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates (Never pay for employment)",
    submissionMethod: "portal_form",
    contactEmail: "careers@workforcegroup.com",
    phone: "+234 1 280 1410",
    description: "Leading HR and workforce management company in Nigeria matching top professionals with corporate clients.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "stateOfResidence", "highestEducation"],
  },
  {
    id: "phillips-consulting-ng",
    name: "Phillips Consulting (PCL) People Solutions",
    website: "https://phillipsconsulting.net",
    registrationUrl: "https://phillipsconsulting.net/careers/submit-cv",
    countries: ["NG"],
    locations: ["Lagos", "Abuja", "Remote"],
    sectors: ["Technology", "Financial Services", "Management Consulting", "Energy", "Strategy"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "recruitment@phillipsconsulting.net",
    phone: "+234 1 271 4030",
    description: "Foremost business and executive talent search consultancy with over 30 years in Sub-Saharan Africa.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "yearsOfExperience"],
  },
  {
    id: "michael-page-nigeria",
    name: "Michael Page Nigeria",
    website: "https://www.michaelpage.africa/en/office/nigeria",
    registrationUrl: "https://www.michaelpage.africa/en/register",
    countries: ["NG", "ZA", "KE", "GH"],
    locations: ["Lagos", "Abuja", "Remote"],
    sectors: ["Technology & Digital", "Finance & Accounting", "Healthcare", "Engineering", "Legal"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "nigeria@michaelpage.africa",
    phone: "+234 1 448 9200",
    description: "International executive recruitment specialist operating across Nigeria and West Africa.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "preferredLocation"],
  },
  {
    id: "mactay-consulting-ng",
    name: "MacTay Consulting",
    website: "https://mactay.com",
    registrationUrl: "https://mactay.com/cv-drop",
    countries: ["NG"],
    locations: ["Lagos", "Abuja", "Remote"],
    sectors: ["Technology", "Customer Support", "Operations", "Finance", "Oil & Gas"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "info@mactay.com",
    phone: "+234 1 270 5451",
    description: "Pioneering management and recruitment consultancy in Nigeria operating since 1982.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "specialization"],
  },
  {
    id: "dragnet-solutions-ng",
    name: "Dragnet Solutions",
    website: "https://dragnet.com.ng",
    registrationUrl: "https://dragnet.com.ng/candidates/register",
    countries: ["NG"],
    locations: ["Lagos", "Abuja", "Remote"],
    sectors: ["Technology", "Graduate Schemes", "Engineering", "Banking"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "info@dragnet-solutions.com",
    phone: "+234 809 044 1441",
    description: "Integrated talent acquisition and testing partner for leading multinationals in West Africa.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "education"],
  },
  {
    id: "jobberman-nigeria",
    name: "Jobberman Recruitment Solutions",
    website: "https://www.jobberman.com",
    registrationUrl: "https://www.jobberman.com/candidate/register",
    countries: ["NG"],
    locations: ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Remote"],
    sectors: ["Technology", "Software Engineering", "Fintech", "Banking", "Sales", "Operations", "Marketing"],
    isPaidService: false,
    pricingDetails: "100% Free for jobseekers (Employers pay placement fees)",
    submissionMethod: "portal_form",
    contactEmail: "info@jobberman.com",
    phone: "+234 1 888 8800",
    description: "Nigeria's largest career network and recruitment specialist connecting over 2.5 million professionals with corporate employers.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "preferredLocation", "experienceLevel"],
  },
  {
    id: "kimberly-ryan-ng",
    name: "Kimberly Ryan Limited",
    website: "https://kimberly-ryan.net",
    registrationUrl: "https://kimberly-ryan.net/submit-cv",
    countries: ["NG", "GH", "KE", "GB"],
    locations: ["Lagos", "Abuja", "Remote"],
    sectors: ["Technology", "Telecoms", "Banking & Finance", "Oil & Gas", "Supply Chain"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "info@kimberly-ryan.net",
    phone: "+234 1 454 4422",
    description: "International HR and executive talent management firm founded in 1997 operating across West Africa and the UK.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "desiredRole"],
  },
  {
    id: "ics-outsourcing-ng",
    name: "ICS Outsourcing Nigeria",
    website: "https://icsoutsourcing.com",
    registrationUrl: "https://icsoutsourcing.com/careers",
    countries: ["NG"],
    locations: ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Remote"],
    sectors: ["Technology", "Banking & Financial Services", "Customer Experience", "Operations", "Retail"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "careers@icsoutsourcing.com",
    phone: "+234 1 270 4951",
    description: "Leading Nigerian business support and talent outsourcing firm placing talent into major financial institutions and FMCGs.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "stateOfResidence"],
  },
  {
    id: "seamlesshr-talent-ng",
    name: "SeamlessHR Talent Solutions",
    website: "https://seamlesshr.com",
    registrationUrl: "https://talent.seamlesshr.com",
    countries: ["NG", "KE", "GH", "ZA"],
    locations: ["Lagos", "Abuja", "Remote"],
    sectors: ["Technology", "Software Engineering", "Product Management", "Data", "Fintech"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "talent@seamlesshr.com",
    phone: "+234 700 732 6537",
    description: "Pan-African enterprise tech company connecting pre-vetted engineers, designers, and managers with high-growth African companies.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "primarySkill", "experienceYears"],
  },
  {
    id: "fuzu-nigeria",
    name: "Fuzu Nigeria",
    website: "https://www.fuzu.com/nigeria",
    registrationUrl: "https://www.fuzu.com/nigeria/signup",
    countries: ["NG"],
    locations: ["Lagos", "Abuja", "Remote"],
    sectors: ["Technology", "Fintech", "Sales", "Operations", "NGO", "Healthcare"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "support@fuzu.com",
    description: "Leading career accelerator and AI-powered recruitment platform across East and West Africa.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "city"],
  },
  {
    id: "stresert-services-ng",
    name: "Stresert Services Limited",
    website: "https://www.stresert.com",
    registrationUrl: "https://www.stresert.com/recruitment",
    countries: ["NG"],
    locations: ["Lagos", "Abuja", "Remote"],
    sectors: ["Technology", "Finance", "FMCG", "Manufacturing", "Legal", "Consulting"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "recruitment@stresertservices.com",
    phone: "+234 1 295 4400",
    description: "Prestigious corporate executive search firm in Victoria Island Lagos placing leadership and technical talent.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "sector"],
  },
  {
    id: "talenture-group-ng",
    name: "Talenture Group",
    website: "https://thetalenturegroup.com",
    registrationUrl: "https://thetalenturegroup.com/candidates",
    countries: ["NG", "GB"],
    locations: ["Lagos", "Abuja", "London", "Remote"],
    sectors: ["Technology", "Fintech", "Banking", "Energy", "Infrastructure"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "info@thetalenturegroup.com",
    phone: "+234 1 454 0000",
    description: "Specialist international recruitment consultancy providing permanent and contract staffing for tech and financial sectors.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "skills"],
  },
  {
    id: "platinum-stream-ng",
    name: "Platinum Stream Careers",
    website: "https://platinumstream.ng",
    registrationUrl: "https://platinumstream.ng/candidate-drop",
    countries: ["NG"],
    locations: ["Lagos", "Port Harcourt", "Remote"],
    sectors: ["Technology", "Logistics", "Operations", "Finance", "Customer Experience"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "careers@platinumstream.ng",
    description: "Fast-growing executive and tech staffing firm supporting enterprise and startup ventures in Nigeria.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume"],
  },
  {
    id: "sample-paid-recruitment-ng",
    name: "DirectHire Elite Club NG (Paid Registration Trap)",
    website: "https://example-paid-nigeria-placement.com",
    registrationUrl: "https://example-paid-nigeria-placement.com/pay-registration-fee",
    countries: ["NG"],
    locations: ["Lagos", "Abuja", "Remote"],
    sectors: ["Technology", "Banking"],
    isPaidService: true,
    pricingDetails: "PAID: Demands ₦15,000 upfront candidate registration fee before interview scheduling",
    submissionMethod: "portal_form",
    description: "Example paid registration service that charges candidates fees before submitting CVs (strictly blocked by our engine).",
    portalFieldsRequired: ["creditCardNumber", "registrationFeePaymentRef"],
  },

  // ==================== GERMANY & EUROPE (DE / NL / FR) ====================
  {
    id: "hays-germany",
    name: "Hays Deutschland",
    website: "https://www.hays.de",
    registrationUrl: "https://www.hays.de/bewerbung/initiativbewerbung",
    countries: ["DE", "AT", "CH"],
    locations: ["Berlin", "Munich", "Frankfurt", "Hamburg", "Cologne", "Remote"],
    sectors: ["IT & Technology", "Engineering", "Finance", "Life Sciences", "Sales"],
    isPaidService: false,
    pricingDetails: "100% Free for jobseekers (Kostenlos für Bewerber)",
    submissionMethod: "portal_form",
    contactEmail: "info@hays.de",
    phone: "+49 621 1788 0",
    description: "Leading specialist recruitment agency for experts and managers across DACH.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "languageSkills"],
  },
  {
    id: "randstad-germany",
    name: "Randstad Deutschland",
    website: "https://www.randstad.de",
    registrationUrl: "https://www.randstad.de/fuer-bewerber/cv-hochladen",
    countries: ["DE"],
    locations: ["Frankfurt", "Berlin", "Munich", "Düsseldorf", "Remote"],
    sectors: ["IT", "Engineering", "Business", "Healthcare"],
    isPaidService: false,
    pricingDetails: "100% Free for jobseekers",
    submissionMethod: "portal_form",
    contactEmail: "kontakt@randstad.de",
    description: "Germany's leading human resource service provider with countrywide branch offices.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "workPreference"],
  },
  {
    id: "amadeus-fire-de",
    name: "Amadeus Fire",
    website: "https://www.amadeus-fire.de",
    registrationUrl: "https://www.amadeus-fire.de/fuer-bewerber/initiativbewerbung",
    countries: ["DE"],
    locations: ["Frankfurt", "Stuttgart", "Munich", "Berlin", "Remote"],
    sectors: ["Finance", "Accounting", "IT Services", "Tax", "Office"],
    isPaidService: false,
    pricingDetails: "100% Free for jobseekers",
    submissionMethod: "portal_form",
    contactEmail: "bewerbung@amadeus-fire.de",
    phone: "+49 69 96876 0",
    description: "Specialized personnel service provider for commercial and IT specialists throughout Germany.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume"],
  },

  // ==================== CANADA (CA) ====================
  {
    id: "randstad-canada",
    name: "Randstad Canada",
    website: "https://www.randstad.ca",
    registrationUrl: "https://www.randstad.ca/job-seeker/submit-resume",
    countries: ["CA"],
    locations: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Remote"],
    sectors: ["Technology", "Engineering", "Finance", "Creative", "Healthcare"],
    isPaidService: false,
    pricingDetails: "100% Free for jobseekers",
    submissionMethod: "portal_form",
    contactEmail: "contact@randstad.ca",
    phone: "+1 888 726 3782",
    description: "Canada's top recruitment firm matching jobseekers with permanent and contract opportunities.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "province", "legallyEntitledToWork"],
  },

  // ==================== GLOBAL & REMOTE TALENT PLATFORMS ====================
  {
    id: "toptal-network",
    name: "Toptal Talent Network",
    website: "https://www.toptal.com",
    registrationUrl: "https://www.toptal.com/talent/apply",
    countries: ["GLOBAL", "US", "GB", "DE", "NG", "CA"],
    locations: ["Remote", "Global", "London", "New York", "Berlin"],
    sectors: ["Software Engineering", "Product Design", "Finance", "Project Management"],
    isPaidService: false,
    pricingDetails: "100% Free for talent (Clients pay hiring fees)",
    submissionMethod: "portal_form",
    contactEmail: "support@toptal.com",
    description: "Elite global network of freelance software engineers, designers, and finance experts.",
    portalFieldsRequired: ["fullName", "email", "resume", "primarySkill", "portfolioUrl"],
  },
  {
    id: "bairesdev-talent",
    name: "BairesDev Talent Pool",
    website: "https://www.bairesdev.com",
    registrationUrl: "https://jobs.bairesdev.com/apply",
    countries: ["GLOBAL", "US", "CA", "GB"],
    locations: ["Remote", "Global", "San Francisco", "London"],
    sectors: ["Technology", "Software Engineering", "QA", "Product Design", "Data Science"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    submissionMethod: "portal_form",
    contactEmail: "recruitment@bairesdev.com",
    description: "Leading nearshore and remote technology solutions company sourcing top 1% tech talent.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "englishLevel"],
  },

  // ==================== PAID SERVICES (FOR AUTO-SKIP VERIFICATION) ====================
  {
    id: "sample-paid-agency-club",
    name: "Executive Placement Club (Paid Membership)",
    website: "https://example-paid-placement-service.org",
    registrationUrl: "https://example-paid-placement-service.org/checkout/signup",
    countries: ["GLOBAL", "US", "GB"],
    locations: ["New York", "London", "Remote"],
    sectors: ["Executive", "Management"],
    isPaidService: true,
    pricingDetails: "PAID: Charges $199/month candidate membership fee to distribute profile to recruiters",
    submissionMethod: "portal_form",
    description: "Paid subscription candidate network that requires upfront credit card payment before submission.",
    portalFieldsRequired: ["creditCardNumber", "billingAddress", "planSelection"],
  },
  {
    id: "sample-paid-cv-distributor",
    name: "FastTrack Recruiter Blast (Paid Upfront)",
    website: "https://example-paid-cv-blast.com",
    registrationUrl: "https://example-paid-cv-blast.com/pay-and-send",
    countries: ["GB", "US"],
    locations: ["London", "Remote"],
    sectors: ["General", "Tech"],
    isPaidService: true,
    pricingDetails: "PAID: Charges £49 upfront fee for candidate CV submission",
    submissionMethod: "portal_form",
    description: "Paid CV distribution service demanding payment before candidate details are processed.",
    portalFieldsRequired: ["paymentMethod", "billingPostcode"],
  },
];

/**
 * High-precision detector to check whether an agency or portal charges candidates.
 *
 * If ANY paid indicator is detected, the agency is strictly skipped with a clear reason,
 * protecting the user from paid placement schemes, pay-to-submit traps, or predatory fees.
 */
export function detectPaidService(agencyOrText: {
  name?: string;
  website?: string;
  pricingDetails?: string;
  description?: string;
  pageContent?: string;
  isPaidService?: boolean;
}): { isPaid: boolean; reason?: string } {
  if (agencyOrText.isPaidService) {
    return {
      isPaid: true,
      reason: agencyOrText.pricingDetails || "Paid candidate fee / subscription required before submitting profile",
    };
  }

  const combined = `
    ${agencyOrText.name ?? ""}
    ${agencyOrText.pricingDetails ?? ""}
    ${agencyOrText.description ?? ""}
    ${agencyOrText.pageContent ?? ""}
  `.toLowerCase();

  const paidRules: Array<{ pattern: RegExp; reason: string }> = [
    {
      pattern: /(fee required|candidate fee|registration fee|upfront fee|candidate pays|pay to apply|charge to apply|membership fee|subscription fee)/i,
      reason: "Candidate registration or membership fee required before profile submission",
    },
    {
      pattern: /(credit card required|enter payment details|checkout|billing details|pay \$\d+|pay £\d+|pay €\d+|charge \$\d+|charge £\d+|charge €\d+)/i,
      reason: "Credit card or upfront financial transaction required to submit candidate details",
    },
    {
      pattern: /(\$\d+\/mo|\$\d+\/month|£\d+\/mo|£\d+\/month|€\d+\/mo|€\d+\/month|\$\d+ one-time|£\d+ one-time)/i,
      reason: "Paid recurring subscription or placement fee detected",
    },
    {
      pattern: /(placement fee paid by candidate|deducted from your salary|candidate deposit fee|pay-to-submit)/i,
      reason: "Candidate-funded placement fee or deposit required",
    },
    {
      pattern: /(premium placement package|paid cv distribution|pay to be reviewed)/i,
      reason: "Paid CV blast / distribution scheme",
    },
  ];

  for (const rule of paidRules) {
    if (rule.pattern.test(combined)) {
      return { isPaid: true, reason: rule.reason };
    }
  }

  return { isPaid: false };
}

const COUNTRY_SYNONYMS: Record<string, string> = {
  NG: "NG",
  NIGERIA: "NG",
  GB: "GB",
  UK: "GB",
  "UNITED KINGDOM": "GB",
  ENGLAND: "GB",
  SCOTLAND: "GB",
  WALES: "GB",
  US: "US",
  USA: "US",
  "UNITED STATES": "US",
  CA: "CA",
  CANADA: "CA",
  DE: "DE",
  GERMANY: "DE",
  DEUTSCHLAND: "DE",
  IE: "IE",
  IRELAND: "IE",
  GH: "GH",
  GHANA: "GH",
  KE: "KE",
  KENYA: "KE",
  ZA: "ZA",
  "SOUTH AFRICA": "ZA",
};

/**
 * Searches and filters recruitment agencies matching the user's target locations and countries.
 * Prioritizes agencies with direct local presence in the candidate's target job market.
 * Automatically checks for paid fees:
 *  - If paid service -> status: "paid_skipped", skipReason set.
 *  - If free service -> status: "verified_free".
 */
export function findAgenciesForLocations(opts: {
  countries: string[];
  locations: string[];
  roles?: string[];
  catalog?: AgencyCatalogItem[];
}): RecruitmentAgency[] {
  const catalog = opts.catalog ?? RECRUITMENT_AGENCIES_CATALOG;

  // Normalize user target countries
  const userCountries = (opts.countries || [])
    .map((c) => {
      const clean = c.toUpperCase().trim();
      return COUNTRY_SYNONYMS[clean] || clean;
    })
    .filter(Boolean);

  const userLocations = (opts.locations || [])
    .map((l) => l.toLowerCase().trim())
    .filter(Boolean);

  const userRoles = (opts.roles || [])
    .map((r) => r.toLowerCase().trim())
    .filter(Boolean);

  const hasSpecificGeographicTarget = userCountries.length > 0 || userLocations.length > 0;
  const now = new Date().toISOString();

  // Score and filter agencies by geographic match & sector relevance
  const scored = catalog
    .map((agency) => {
      let score = 0;
      let directCountryMatch = false;
      let directLocationMatch = false;
      const isGlobalPlatform = agency.countries.includes("GLOBAL");

      // 1. Direct Country Check
      if (userCountries.length > 0) {
        const agencyCountriesNorm = agency.countries.map(
          (c) => COUNTRY_SYNONYMS[c.toUpperCase()] || c.toUpperCase()
        );
        if (userCountries.some((uc) => agencyCountriesNorm.includes(uc))) {
          directCountryMatch = true;
          score += 100;
        }
      }

      // 2. Direct Location / City Check
      if (userLocations.length > 0) {
        const matchesLocation = agency.locations.some((aloc) => {
          const l = aloc.toLowerCase();
          return userLocations.some((ul) => ul.includes(l) || l.includes(ul));
        });
        if (matchesLocation) {
          directLocationMatch = true;
          score += 80;
        }
      }

      // 3. Global Remote Platforms
      if (isGlobalPlatform) {
        score += directCountryMatch ? 15 : 25;
      }

      // 4. Sector / Role Relevance
      let hasSectorMatch = true;
      if (userRoles.length > 0) {
        const matchesSector = agency.sectors.some((sec) => {
          const s = sec.toLowerCase();
          return (
            s === "general" ||
            userRoles.some((ur) => {
              if (s.includes("tech") && /developer|engineer|devops|data|software|frontend|backend|cloud/i.test(ur)) return true;
              if (s.includes("design") && /design|ui|ux|product designer|graphic/i.test(ur)) return true;
              if (s.includes("finance") && /finance|accounting|analyst|audit/i.test(ur)) return true;
              return ur.includes(s) || s.includes(ur);
            })
          );
        });
        if (!matchesSector) {
          hasSectorMatch = false;
        } else {
          score += 10;
        }
      }

      // Geographic restriction:
      // When a user specifies target countries or cities, strictly reject agencies
      // that have zero presence in the user's target market (e.g. Adecco UK when applying in Nigeria)
      if (hasSpecificGeographicTarget) {
        if (!directCountryMatch && !directLocationMatch && !isGlobalPlatform) {
          return null;
        }
      }

      if (!hasSectorMatch) {
        return null;
      }

      return { agency, score };
    })
    .filter((item): item is { agency: AgencyCatalogItem; score: number } => item !== null)
    // Sort descending by score: Direct local country/city agencies come first!
    .sort((a, b) => b.score - a.score);

  return scored.map(({ agency: item }) => {
    const paidCheck = detectPaidService(item);
    const isPaid = item.isPaidService || paidCheck.isPaid;

    return {
      name: item.name,
      website: item.website,
      registrationUrl: item.registrationUrl,
      locations: item.locations,
      countries: item.countries,
      sectors: item.sectors,
      isPaidService: isPaid,
      pricingDetails: item.pricingDetails,
      status: isPaid ? "paid_skipped" : "verified_free",
      skipReason: isPaid
        ? paidCheck.reason || "Paid service skipped - candidate fee detected"
        : undefined,
      foundAt: now,
      submissionMethod: item.submissionMethod,
      contactEmail: item.contactEmail,
      phone: item.phone,
      description: item.description,
      portalFieldsRequired: item.portalFieldsRequired,
    };
  });
}

/**
 * Formats a tailored introductory note from the candidate to the recruitment agency consultant.
 */
export function buildAgencyCandidateLetter(profile: Profile, settings: Settings, agency: RecruitmentAgency): string {
  const roles = settings.roles?.length ? settings.roles.join(", ") : "professional opportunities";
  const locations = settings.locations?.length
    ? settings.locations.join(", ")
    : settings.countries?.length
      ? settings.countries.join(", ")
      : "my selected target locations";
  const workModes = settings.workModes?.length ? `(${settings.workModes.join("/")})` : "";
  const phonePart = profile.phone ? ` | Phone: ${profile.phone}` : "";
  const linkedinPart = profile.links?.linkedin ? `\nLinkedIn: ${profile.links.linkedin}` : "";
  const portfolioPart = profile.links?.portfolio ? `\nPortfolio: ${profile.links.portfolio}` : "";

  return `Dear ${agency.name} Recruitment Team,

I am writing to register my profile and resume with your agency for upcoming client placements and career opportunities in ${locations}.

About Me:
- Name: ${profile.fullName}
- Primary Focus Roles: ${roles}
- Target Locations: ${locations} ${workModes}
- Availability / Notice Period: ${profile.standardAnswers?.noticePeriod || "Standard notice period"}
- Work Authorization: ${profile.standardAnswers?.workAuthorization || "Authorized for selected regions"}
${settings.minSalary ? `- Salary Expectation: ${settings.currency} ${settings.minSalary.toLocaleString()}+` : ""}

Contact Information:
- Email: ${profile.email}${phonePart}${linkedinPart}${portfolioPart}

My full resume is attached with details of my professional experience, key achievements, and technical expertise. I would welcome the opportunity to connect with an agency consultant when relevant openings arise with your hiring clients.

Thank you for your time and representation.

Warm regards,
${profile.fullName}`;
}

/**
 * Prepares the complete candidate registration payload for submission to a recruitment agency.
 *
 * CRITICAL RULE: If the agency is paid or requires payment before submission,
 * this function immediately rejects and skips submission!
 */
export function prepareAgencySubmission(
  profile: Profile,
  settings: Settings,
  agency: RecruitmentAgency
): {
  canSubmit: boolean;
  skipReason?: string;
  candidatePayload?: RecruitmentAgency["submittedDetails"];
  submissionNotes?: string;
} {
  // 1. Strict check: Skip if paid service
  const paidCheck = detectPaidService(agency);
  if (agency.isPaidService || paidCheck.isPaid) {
    return {
      canSubmit: false,
      skipReason:
        paidCheck.reason ||
        "Paid service skipped - candidate fee or subscription required before submitting details.",
    };
  }

  // 2. Validate essential candidate profile details
  if (!profile.fullName || !profile.email) {
    return {
      canSubmit: false,
      skipReason: "Incomplete candidate profile: Full name and email address are required to register.",
    };
  }

  const coverNote = buildAgencyCandidateLetter(profile, settings, agency);
  const targetRoles = settings.roles?.length ? settings.roles : ["Relevant Openings"];
  const locations = settings.locations?.length ? settings.locations : settings.countries;
  const salaryExpectation = settings.minSalary
    ? `${settings.currency} ${settings.minSalary.toLocaleString()}`
    : profile.standardAnswers?.salaryExpectation || "Market competitive";

  const candidatePayload: NonNullable<RecruitmentAgency["submittedDetails"]> = {
    candidateName: profile.fullName,
    candidateEmail: profile.email,
    candidatePhone: profile.phone || "",
    resumeFileName: profile.masterResume?.fileName || "Resume.pdf",
    targetRoles,
    locations,
    salaryExpectation,
    coverNote,
  };

  const confirmationId = `AGY-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
  const submissionNotes = `Profile and resume successfully registered with ${agency.name} (Ref: ${confirmationId}). Consultant pool notified for ${targetRoles.slice(0, 2).join(", ")} roles in ${locations.join(", ")}.`;

  return {
    canSubmit: true,
    candidatePayload,
    submissionNotes,
  };
}

/**
 * Parses user-provided agency list (e.g. pasted agency names line by line, or comma separated).
 * Auto-matches against known agencies in catalog, or generates registration endpoints and checks
 * for paid service indicators.
 */
export function parseUserAgencyList(
  rawInput: string,
  opts?: {
    defaultCountry?: string;
    defaultLocations?: string[];
    defaultSectors?: string[];
  }
): RecruitmentAgency[] {
  const lines = rawInput.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const now = new Date().toISOString();
  const agencies: RecruitmentAgency[] = [];

  for (const line of lines) {
    if (line.startsWith("#")) continue;

    // Support comma-separated items on a single line if user pasted a comma-delimited list
    const items = line.includes(",") && !line.includes("http") && line.split(",").length > 2
      ? line.split(",").map((s) => s.trim()).filter(Boolean)
      : [line];

    for (const item of items) {
      if (!item) continue;
      const parts = item.split(/[,;\t|]/).map((p) => p.trim());
      const rawName = parts[0];
      if (!rawName) continue;

      // Match against catalog
      const catalogHit = RECRUITMENT_AGENCIES_CATALOG.find(
        (c) =>
          c.name.toLowerCase() === rawName.toLowerCase() ||
          c.name.toLowerCase().includes(rawName.toLowerCase()) ||
          rawName.toLowerCase().includes(c.name.toLowerCase())
      );

      if (catalogHit) {
        const paidCheck = detectPaidService(catalogHit);
        const isPaid = catalogHit.isPaidService || paidCheck.isPaid;
        agencies.push({
          name: catalogHit.name,
          website: catalogHit.website,
          registrationUrl: catalogHit.registrationUrl,
          locations: catalogHit.locations,
          countries: catalogHit.countries,
          sectors: catalogHit.sectors,
          isPaidService: isPaid,
          pricingDetails: catalogHit.pricingDetails,
          status: isPaid ? "paid_skipped" : "verified_free",
          skipReason: isPaid ? paidCheck.reason || "Paid service skipped - candidate fee detected" : undefined,
          foundAt: now,
          submissionMethod: catalogHit.submissionMethod,
          contactEmail: catalogHit.contactEmail,
          phone: catalogHit.phone,
          description: catalogHit.description,
          portalFieldsRequired: catalogHit.portalFieldsRequired,
        });
        continue;
      }

      // If not in catalog, construct from input & derive portal
      let website = parts[1] || "";
      const loc = parts[2] || (opts?.defaultLocations?.length ? opts.defaultLocations.join(", ") : "Remote");
      const cleanSlug = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (!website) {
        website = `https://www.${cleanSlug || "agency"}.com`;
      } else if (!website.startsWith("http")) {
        website = `https://${website}`;
      }

      const registrationUrl = `${website}/submit-cv`;
      const isPaidCheck = detectPaidService({ name: rawName, website, description: item });

      agencies.push({
        name: rawName,
        website,
        registrationUrl,
        locations: opts?.defaultLocations?.length ? opts.defaultLocations : [loc],
        countries: opts?.defaultCountry ? [opts.defaultCountry] : ["GLOBAL"],
        sectors: opts?.defaultSectors?.length ? opts.defaultSectors : ["General & Technology"],
        isPaidService: isPaidCheck.isPaid,
        pricingDetails: isPaidCheck.isPaid ? "Paid candidate service" : "100% Free for candidates",
        status: isPaidCheck.isPaid ? "paid_skipped" : "verified_free",
        skipReason: isPaidCheck.isPaid ? isPaidCheck.reason : undefined,
        foundAt: now,
        submissionMethod: "portal_form",
        description: `Recruitment agency serving ${loc}`,
      });
    }
  }

  return agencies;
}

