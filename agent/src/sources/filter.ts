// Hard (rule-based) filter applied to every scanned job before it reaches AI scoring.
// Cheap and deterministic: role/title, keywords, companies, seniority, location, salary.
import type { Settings } from "@shared/types";
import type { RawJob } from "../contracts";

// ---------------------------------------------------------------- geography

interface Geo {
  names: string[]; // lower-case country names / demonyms used in postings
  cities: string[]; // lower-case major cities
  /** region words that include this country ("europe", "emea" …) */
  regions: string[];
}

const EUROPE = ["europe", "european union", "eu", "eea", "emea", "cet", "cest", "european time"];
const AMERICAS = ["americas", "north america", "namer", "amer"];
const LATAM = ["latam", "latin america", "south america", "central america"];
const APAC = ["apac", "asia pacific", "asia-pacific"];
const AFRICA = ["africa", "emea"];
const MIDEAST = ["middle east", "mena", "gcc", "emea"];

export const GEO: Record<string, Geo> = {
  NL: {
    names: ["netherlands", "the netherlands", "nederland", "holland"],
    cities: [
      "amsterdam", "rotterdam", "utrecht", "the hague", "den haag", "'s-gravenhage", "eindhoven", "delft", "leiden",
      "haarlem", "groningen", "amstelveen", "hoofddorp", "schiphol", "almere", "arnhem", "nijmegen", "tilburg",
      "breda", "den bosch", "'s-hertogenbosch", "zwolle", "enschede", "maastricht", "hilversum", "diemen", "amersfoort",
    ],
    regions: [...EUROPE, "benelux"],
  },
  GB: {
    names: ["united kingdom", "uk", "u.k.", "great britain", "britain", "england", "scotland", "wales", "northern ireland"],
    cities: [
      "london", "manchester", "birmingham", "edinburgh", "glasgow", "bristol", "leeds", "liverpool", "cambridge",
      "oxford", "brighton", "cardiff", "belfast", "newcastle", "sheffield", "nottingham", "reading", "milton keynes",
    ],
    regions: ["europe", "emea", "gmt", "bst", "uk time"],
  },
  NG: {
    names: ["nigeria", "nigerian"],
    cities: ["lagos", "abuja", "port harcourt", "ibadan", "kano", "enugu", "benin city", "ikeja", "lekki", "yaba"],
    regions: [...AFRICA, "wat", "west africa"],
  },
  US: {
    names: ["united states", "united states of america", "usa", "u.s.", "u.s.a.", "us-based"],
    cities: [
      "new york", "nyc", "san francisco", "sf bay area", "bay area", "los angeles", "seattle", "austin", "boston",
      "chicago", "denver", "atlanta", "miami", "washington, dc", "washington dc", "dallas", "houston", "portland",
      "san diego", "san jose", "palo alto", "menlo park", "mountain view", "sunnyvale", "philadelphia", "pittsburgh",
      "salt lake city", "phoenix", "minneapolis", "nashville", "raleigh", "detroit", "brooklyn", "oakland",
    ],
    regions: [...AMERICAS, "est", "pst", "cst", "us time"],
  },
  CA: { names: ["canada", "canadian"], cities: ["toronto", "vancouver", "montreal", "montréal", "ottawa", "calgary", "waterloo", "edmonton"], regions: [...AMERICAS] },
  IE: { names: ["ireland"], cities: ["dublin", "cork", "galway", "limerick"], regions: EUROPE },
  DE: { names: ["germany", "deutschland"], cities: ["berlin", "munich", "münchen", "hamburg", "frankfurt", "cologne", "köln", "düsseldorf", "stuttgart", "leipzig"], regions: EUROPE },
  FR: { names: ["france"], cities: ["paris", "lyon", "marseille", "toulouse", "bordeaux", "nantes", "lille"], regions: EUROPE },
  BE: { names: ["belgium", "belgië", "belgique"], cities: ["brussels", "bruxelles", "antwerp", "antwerpen", "ghent", "gent", "leuven"], regions: [...EUROPE, "benelux"] },
  ES: { names: ["spain", "españa"], cities: ["madrid", "barcelona", "valencia", "seville", "málaga", "malaga"], regions: EUROPE },
  PT: { names: ["portugal"], cities: ["lisbon", "lisboa", "porto", "braga", "aveiro"], regions: EUROPE },
  IT: { names: ["italy", "italia"], cities: ["milan", "milano", "rome", "roma", "turin", "torino"], regions: EUROPE },
  PL: { names: ["poland", "polska"], cities: ["warsaw", "warszawa", "krakow", "kraków", "wroclaw", "wrocław", "gdansk", "poznan"], regions: EUROPE },
  AT: { names: ["austria", "österreich"], cities: ["vienna", "wien", "graz", "linz"], regions: EUROPE },
  CH: { names: ["switzerland", "schweiz", "suisse"], cities: ["zurich", "zürich", "geneva", "genève", "basel", "lausanne", "bern"], regions: EUROPE.filter((r) => r !== "eu" && r !== "european union") },
  SE: { names: ["sweden", "sverige"], cities: ["stockholm", "gothenburg", "malmö", "malmo"], regions: EUROPE },
  DK: { names: ["denmark", "danmark"], cities: ["copenhagen", "københavn", "aarhus"], regions: EUROPE },
  FI: { names: ["finland", "suomi"], cities: ["helsinki", "espoo", "tampere"], regions: EUROPE },
  GH: { names: ["ghana"], cities: ["accra", "kumasi"], regions: [...AFRICA, "west africa"] },
  KE: { names: ["kenya"], cities: ["nairobi", "mombasa"], regions: [...AFRICA, "east africa"] },
  ZA: { names: ["south africa"], cities: ["cape town", "johannesburg", "durban", "pretoria"], regions: AFRICA },
  EG: { names: ["egypt"], cities: ["cairo", "alexandria"], regions: [...AFRICA, ...MIDEAST] },
  UG: { names: ["uganda"], cities: ["kampala"], regions: [...AFRICA, "east africa"] },
  TZ: { names: ["tanzania"], cities: ["dar es salaam", "dodoma"], regions: [...AFRICA, "east africa"] },
  RW: { names: ["rwanda"], cities: ["kigali"], regions: [...AFRICA, "east africa"] },
  MX: { names: ["mexico", "méxico"], cities: ["mexico city", "ciudad de méxico", "guadalajara", "monterrey"], regions: [...AMERICAS, ...LATAM] },
  BR: { names: ["brazil", "brasil"], cities: ["são paulo", "sao paulo", "rio de janeiro", "belo horizonte", "curitiba"], regions: [...AMERICAS, ...LATAM] },
  AE: { names: ["united arab emirates", "uae"], cities: ["dubai", "abu dhabi"], regions: MIDEAST },
  SA: { names: ["saudi arabia", "ksa"], cities: ["riyadh", "jeddah"], regions: MIDEAST },
  QA: { names: ["qatar"], cities: ["doha"], regions: MIDEAST },
  KW: { names: ["kuwait"], cities: ["kuwait city"], regions: MIDEAST },
  OM: { names: ["oman"], cities: ["muscat"], regions: MIDEAST },
  BH: { names: ["bahrain"], cities: ["manama"], regions: MIDEAST },
  IN: { names: ["india"], cities: ["bangalore", "bengaluru", "mumbai", "delhi", "new delhi", "gurugram", "gurgaon", "hyderabad", "pune", "chennai", "noida"], regions: [...APAC, "ist"] },
  SG: { names: ["singapore"], cities: ["singapore"], regions: APAC },
  AU: { names: ["australia"], cities: ["sydney", "melbourne", "brisbane", "perth", "adelaide"], regions: [...APAC, "anz"] },
  NZ: { names: ["new zealand"], cities: ["auckland", "wellington", "christchurch"], regions: [...APAC, "anz"] },
};

/** Other countries / regions that commonly appear as remote restrictions. */
const OTHER_PLACES = [
  "argentina", "colombia", "chile", "peru", "uruguay", "costa rica", "philippines", "indonesia", "vietnam", "thailand",
  "malaysia", "japan", "tokyo", "china", "shanghai", "beijing", "hong kong", "taiwan", "korea", "seoul", "israel",
  "tel aviv", "turkey", "istanbul", "ukraine", "romania", "bulgaria", "serbia", "croatia", "greece", "athens",
  "cyprus", "czech", "czechia", "prague", "hungary", "budapest", "slovakia", "lithuania", "vilnius", "latvia", "riga",
  "estonia", "tallinn", "norway", "oslo", "pakistan", "bangladesh", "sri lanka", "nepal", "morocco", "tunisia",
  ...LATAM, ...APAC, "asia",
];

const ALL_REGION_WORDS = new Set([...EUROPE, ...AMERICAS, ...LATAM, ...APAC, ...AFRICA, ...MIDEAST, "benelux", "anz"]);
// timezone-ish tokens are too noisy to treat as a restriction on their own
const NOISY = new Set(["est", "pst", "cst", "gmt", "bst", "cet", "cest", "ist", "wat", "eu", "amer", "us time", "uk time", "european time"]);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phraseRe = new Map<string, RegExp>();
function hasPhrase(text: string, phrase: string): boolean {
  let re = phraseRe.get(phrase);
  if (!re) {
    re = new RegExp(`(^|[^\\p{L}])${esc(phrase)}($|[^\\p{L}])`, "iu");
    phraseRe.set(phrase, re);
  }
  return re.test(text);
}
/** ISO codes only count in upper case ("NL", "US") to avoid matching words like "in"/"us". */
function hasCode(text: string, code: string): boolean {
  return new RegExp(`(^|[^A-Za-z])${code}($|[^A-Za-z])`).test(text);
}

function countryMatches(text: string, code: string, includeRegions: boolean): string | undefined {
  const g = GEO[code];
  if (hasCode(text, code) && !(code === "IN" || code === "IT")) return code;
  if (code === "GB" && hasCode(text, "UK")) return "UK";
  if (!g) return undefined;
  for (const w of [...g.names, ...g.cities]) if (hasPhrase(text, w)) return w;
  if (includeRegions) for (const w of g.regions) if (!NOISY.has(w) && hasPhrase(text, w)) return w;
  // "EU"/"CET" only as a strong signal (upper case)
  if (includeRegions && g.regions.includes("eu") && /(^|[^A-Za-z])(EU|CET|CEST)($|[^A-Za-z])/.test(text)) return "EU";
  return undefined;
}

/** Every known place (other than the user's) mentioned in the text. */
function foreignPlaces(text: string, userCountries: string[]): string[] {
  const found: string[] = [];
  for (const [code, g] of Object.entries(GEO)) {
    if (userCountries.includes(code)) continue;
    if (code !== "IN" && code !== "IT" && hasCode(text, code)) found.push(code);
    for (const w of [...g.names, ...g.cities]) if (hasPhrase(text, w)) found.push(w);
  }
  for (const w of [...OTHER_PLACES, ...ALL_REGION_WORDS]) if (!NOISY.has(w) && hasPhrase(text, w)) found.push(w);
  return [...new Set(found)];
}

const WORLDWIDE_RE = /\b(anywhere|worldwide|world ?wide|global(ly)?|all countries|any location|international)\b/i;

/** "US only", "must be based in the United States", "Americas only" … */
const REGION_ONLY_RE =
  /\b(?:(US|USA|U\.S\.A?\.?|United States|North America|Americas|Canada|LATAM|Latin America|APAC|Asia|India|Europe|EU|UK|EMEA)[- ]?(?:only|based only|residents only|citizens only)|(?:must|need to|required to) (?:be )?(?:located|based|reside|living|live) in (?:the )?(US|USA|United States|North America|Americas|Canada|LATAM|Latin America|APAC|India|Europe|EU|UK|United Kingdom)|(?:authori[sz]ed|eligible) to work in (?:the )?(US|USA|United States|Canada|UK|United Kingdom))\b/i;

const REGION_TO_COUNTRIES: Record<string, string[]> = {
  us: ["US"], usa: ["US"], "u.s.": ["US"], "u.s.a.": ["US"], "united states": ["US"],
  "north america": ["US", "CA", "MX"], americas: ["US", "CA", "MX", "BR"], canada: ["CA"],
  latam: ["MX", "BR"], "latin america": ["MX", "BR"], apac: ["IN", "SG", "AU", "NZ"], asia: ["IN", "SG"], india: ["IN"],
  europe: ["NL", "GB", "IE", "DE", "FR", "BE", "ES", "PT", "IT", "PL", "AT", "CH", "SE", "DK", "FI"],
  eu: ["NL", "IE", "DE", "FR", "BE", "ES", "PT", "IT", "PL", "AT", "SE", "DK", "FI"],
  uk: ["GB"], "united kingdom": ["GB"],
  emea: ["NL", "GB", "IE", "DE", "FR", "BE", "ES", "PT", "IT", "PL", "AT", "CH", "SE", "DK", "FI", "NG", "GH", "KE", "ZA", "EG", "AE", "SA"],
};

/** Returns the restriction phrase when the posting is limited to a region excluding all of the user's countries. */
export function regionRestriction(text: string, userCountries: string[]): string | undefined {
  const m = text.match(REGION_ONLY_RE);
  if (!m) return undefined;
  const region = (m[1] ?? m[2] ?? m[3] ?? "").toLowerCase().replace(/\.$/, ".");
  const allowed = REGION_TO_COUNTRIES[region] ?? REGION_TO_COUNTRIES[region.replace(/\.$/, "")];
  if (!allowed) return undefined;
  return allowed.some((c) => userCountries.includes(c)) ? undefined : m[0];
}

// ---------------------------------------------------------------- titles

const STOP = new Set(["and", "or", "of", "the", "a", "an", "for", "in", "at", "to", "with", "&", "/", "-",
  "senior", "sr", "junior", "jr", "mid", "level", "lead", "staff", "principal", "head", "i", "ii", "iii", "iv"]);

function stem(w: string): string {
  let s = w;
  for (let i = 0; i < 2; i++) {
    const before = s;
    if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
    else if (s.length > 5 && s.endsWith("ers")) s = s.slice(0, -3);
    else if (s.length > 4 && s.endsWith("er")) s = s.slice(0, -2);
    else if (s.length > 4 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
    if (s === before) break;
  }
  return s;
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/ui\s*\/\s*ux|ux\s*\/\s*ui|ui\s*&\s*ux|ux\s*&\s*ui|ux\s*\+\s*ui|ui\s*\+\s*ux/g, " ux ui ")
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}

function significant(role: string): string[] {
  return [...new Set(tokens(role).filter((t) => !STOP.has(t)).map(stem))];
}

const DESIGN_FAMILY_RE = /\b(ux|ui|user experience|user interface|interaction|product|digital|experience|web|app)\b[^,|]*\bdesign/i;
const DESIGN_FAMILY_RE2 = /\bdesign(er)?\b[^,|]*\b(ux|ui)\b/i;
const NON_DESIGN_RE = /\b(engineer|engineering|developer|architect|analyst|scientist|sales|account|recruit|marketing manager|technician|drafter|mechanical|electrical|instructional|interior|fashion|floral)\b/i;

/** True when the title fits one of the user's target roles (fuzzy). Empty roles = everything matches. */
export function titleMatches(title: string, roles: string[]): boolean {
  const cleanRoles = roles.map((r) => r.trim()).filter(Boolean);
  if (!cleanRoles.length) return true;
  const tTokens = new Set(tokens(title).map(stem));
  for (const role of cleanRoles) {
    const sig = significant(role);
    if (!sig.length) continue;
    const roleIsDesign = sig.includes("design");
    const roleHasNonDesign = NON_DESIGN_RE.test(role);
    if (roleIsDesign && !roleHasNonDesign && NON_DESIGN_RE.test(title)) continue;
    if (sig.every((w) => tTokens.has(w))) return true;
    // design family: a "Product Designer" search also accepts UX/UI / Product Design Lead titles
    if (roleIsDesign && /\b(product|ux|ui|user|interaction|experience|digital|web|app|visual)\b/i.test(role)) {
      if (DESIGN_FAMILY_RE.test(title) || DESIGN_FAMILY_RE2.test(title)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- seniority

const INTERN_RE = /\b(intern|internship|stagiair|werkstudent|working student|trainee|apprentice)\b/i;
const JUNIOR_RE = /\b(junior|jr\.?|entry[- ]level|graduate|new grad|associate(?! (director|vp|vice president|principal)))\b/i;
const SENIOR_RE = /\b(senior|sr\.?|lead|expert)\b/i;
const EXEC_RE = /\b(staff|principal|head of|head,|director|vp|vice president|chief|c[pd]o)\b/i;
const MID_RE = /\b(medior|mid[- ]?level|intermediate)\b/i;

export function seniorityReason(title: string, seniority: Settings["seniority"]): string | undefined {
  if (!seniority?.length) return undefined;
  const has = (s: string) => (seniority as string[]).includes(s);
  if (INTERN_RE.test(title)) return has("intern") ? undefined : "internship";
  if (JUNIOR_RE.test(title)) return has("junior") || has("intern") ? undefined : "junior level";
  if (EXEC_RE.test(title)) return has("lead") ? undefined : "staff/principal/head/director level";
  if (SENIOR_RE.test(title)) return has("senior") || has("lead") ? undefined : "senior level";
  if (MID_RE.test(title)) return has("mid") || has("senior") ? undefined : "mid level";
  // un-tagged titles are usually mid-level; keep unless the user only wants intern/junior or lead
  if (!has("mid") && !has("senior") && (has("intern") || has("junior"))) return undefined;
  return undefined;
}

// ---------------------------------------------------------------- salary

/** Rough USD value of one unit (static, good enough for a floor check). */
const TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.73, AUD: 0.66, NZD: 0.6, CHF: 1.13, SEK: 0.095, DKK: 0.145, NOK: 0.093,
  PLN: 0.25, INR: 0.012, SGD: 0.74, BRL: 0.18, MXN: 0.055, ZAR: 0.055, NGN: 0.00065, AED: 0.27,
};

export function toUsd(amount: number, currency: string): number | undefined {
  const r = TO_USD[currency.toUpperCase()];
  return r === undefined ? undefined : amount * r;
}

export function salaryReason(salary: RawJob["salary"], settings: Settings): string | undefined {
  if (!settings.minSalary || !salary) return undefined;
  const top = salary.max ?? salary.min;
  if (!top || top < 10_000) return undefined; // hourly / monthly / unclear
  if (salary.max === undefined) return undefined; // only "from X": can't rule it out
  const jobUsd = toUsd(salary.max, salary.currency);
  const minUsd = toUsd(settings.minSalary, settings.currency || "USD");
  if (jobUsd === undefined || minUsd === undefined) return undefined;
  return jobUsd < minUsd
    ? `salary max ${salary.currency} ${Math.round(salary.max).toLocaleString("en")} below minimum ${settings.currency} ${settings.minSalary.toLocaleString("en")}`
    : undefined;
}

// ---------------------------------------------------------------- location

export function locationReason(raw: RawJob, settings: Settings): string | undefined {
  const countries = (settings.countries ?? []).map((c) => c.toUpperCase());
  const cities = (settings.locations ?? []).map((l) => l.toLowerCase().trim()).filter(Boolean);
  const modes = settings.workModes ?? [];
  const wantsRemote = modes.includes("remote") || settings.remoteOnly;
  const wantsOnsite = !settings.remoteOnly && (modes.includes("onsite") || modes.includes("hybrid") || modes.length === 0);
  const loc = (raw.location ?? "").trim();
  const head = `${raw.title}\n${raw.description.slice(0, 2500)}`;

  const hasSpecificLocation = countries.length > 0 || cities.length > 0;

  if (!hasSpecificLocation) {
    if (raw.remote) return wantsRemote || !modes.length ? undefined : "remote job but remote not selected";
    return wantsOnsite ? undefined : "not remote";
  }

  // If candidate picked a specific location, broad worldwide postings that aren't specific to their location must be skipped
  if (WORLDWIDE_RE.test(loc) || loc.toLowerCase().includes("worldwide")) {
    return "worldwide posting, not specific to your chosen location";
  }

  // STRICT: the posting's location must explicitly match one of the user's countries or cities
  const strict = countries.some((c) => countryMatches(loc, c, false)) || cities.some((city) => loc.toLowerCase().includes(city));
  if (!strict) return loc ? `location "${truncLoc(loc)}" not in ${[...cities, ...countries].join("/")}` : "no location given";
  const places = loc.split(/[;|,]/).map((s) => s.trim()).filter(Boolean);
  if (places.length > 12) return "broad multi-region posting, not specific to your countries";

  // explicit "US only" style restriction anywhere near the top of the posting
  const restriction = regionRestriction(`${loc}\n${head}`, countries);
  if (restriction) return `restricted: "${restriction}"`;

  // work mode
  if (raw.remote && !wantsRemote) return "remote job but remote not selected";
  if (!raw.remote && !wantsOnsite) return "not remote";

  if (cities.length) {
    const prefs = cities;
    const lower = loc.toLowerCase();
    if (prefs.some((p) => lower.includes(p))) return undefined;
    // the posting names a specific city in the user's countries that isn't one of their cities
    const otherCity = countries.flatMap((c) => GEO[c]?.cities ?? []).find((city) => hasPhrase(loc, city));
    if (otherCity && !prefs.some((p) => p.includes(otherCity) || otherCity.includes(p))) return `city ${otherCity} not in preferred locations`;
  }
  return undefined;
}

const truncLoc = (s: string) => (s.length > 60 ? s.slice(0, 57) + "…" : s);

// ---------------------------------------------------------------- main

function containsWord(text: string, kw: string): boolean {
  const k = kw.trim();
  if (!k) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc(k)}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

function sameCompany(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const x = n(a), y = n(b);
  return !!x && !!y && (x === y || (y.length >= 4 && x.includes(y)));
}

export function hardFilter(raw: RawJob, settings: Settings): { keep: boolean; reason?: string } {
  const skip = (reason: string) => ({ keep: false, reason });

  if (settings.blockedCompanies?.some((b) => sameCompany(raw.company, b))) return skip(`blocked company ${raw.company}`);

  if (!titleMatches(raw.title, settings.roles ?? [])) return skip("title does not match target roles");

  const exclude = (settings.excludeKeywords ?? []).find((k) => containsWord(`${raw.title}\n${raw.description}`, k));
  if (exclude) return skip(`excluded keyword "${exclude}"`);

  const sen = seniorityReason(raw.title, settings.seniority ?? []);
  if (sen) return skip(sen);

  const loc = locationReason(raw, settings);
  if (loc) return skip(loc);

  const sal = salaryReason(raw.salary, settings);
  if (sal) return skip(sal);

  return { keep: true };
}
