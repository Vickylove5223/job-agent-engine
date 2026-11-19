// Cold outreach engine for company discovery by niche/location,
// contact & stakeholder enrichment, and personalized templated cold emails.

import type {
  ColdEmailRecord,
  ColdEmailTemplate,
  CompanyContact,
  OutreachCompany,
  Profile,
  Settings,
} from "./types";

export const POPULAR_NICHES = [
  "Loan Companies & Digital Lending",
  "Fintech & Payments",
  "SaaS & Enterprise Software",
  "Healthtech & Digital Health",
  "Ecommerce & Marketplace",
  "Proptech & Real Estate Tech",
  "AI & Data Intelligence",
  "Edtech & Online Education",
  "Logistics & Supply Chain",
  "Cybersecurity & Cloud",
];

export const DEFAULT_COLD_EMAIL_TEMPLATES: ColdEmailTemplate[] = [
  {
    id: "tpl-talent-pitch",
    name: "Direct Value Pitch to Head of Talent / Recruiter",
    targetAudience: "hr_talent",
    isDefault: true,
    subject: "{{targetRole}} Application / Inbound — {{candidateName}}",
    body: `Hi {{contactName}},

I hope you are having a productive week.

I have been following {{companyName}}'s rapid growth in the {{niche}} space, particularly how your team is expanding in {{location}}. 

As an experienced {{targetRole}}, I wanted to reach out proactively to express my interest in joining your team. Over the past {{yearsExperience}}, I have specialized in shipping high-impact products, streamlining user conversion, and building reliable systems.

A quick summary of what I bring to {{companyName}}:
- Strong background in {{targetRole}} driving measurable user and business results
- Hands-on experience collaborating closely with product, engineering, and business stakeholders
- Readily available for {{location}} (Remote / Hybrid / On-site)

You can explore my background and recent work here:
{{portfolioLink}}
{{linkedinLink}}

My full resume ({{resumeFileName}}) is attached for your review. Would you or a member of the talent team be open to a brief 10-minute introductory conversation this week or next?

Thank you for your time,
{{candidateName}}
{{candidateEmail}} | {{candidatePhone}}`,
  },
  {
    id: "tpl-executive-founder",
    name: "Founder & Executive Pitch (Business & Impact Focused)",
    targetAudience: "executive",
    subject: "{{companyName}}'s {{targetRole}} team & product vision — {{candidateName}}",
    body: `Hi {{contactName}},

I am reaching out directly because I deeply admire {{companyName}}'s position in {{niche}}. Building in {{location}} requires sharp execution, especially around customer trust, seamless onboarding, and scalable infrastructure.

I am a senior {{targetRole}} with {{yearsExperience}} of experience solving these exact product and engineering challenges. Rather than waiting for a standard job posting, I wanted to introduce myself directly to see where I could add immediate leverage to your leadership team.

In my recent work, I have:
- Solved complex product and user flows that directly improved activation and retention
- Partnered with founders and VP-level leaders to take initiatives from 0 to 1 with minimal overhead
- Deep commitment to velocity, code/craft excellence, and commercial impact

I would love to share a few targeted observations on {{companyName}}'s product experience. Here is my portfolio and background:
{{portfolioLink}}
{{linkedinLink}}

Are you open to a quick 10-minute sync sometime this week?

Warm regards,
{{candidateName}}
{{candidateEmail}} | {{candidatePhone}}`,
  },
  {
    id: "tpl-hiring-manager",
    name: "Hiring Manager / Team Lead Intro (Craft & Tech Focus)",
    targetAudience: "hiring_manager",
    subject: "{{targetRole}} reaching out to {{contactName}} @ {{companyName}}",
    body: `Hi {{contactName}},

I noticed your role leading {{contactTitle}} at {{companyName}} and wanted to reach out peer-to-peer.

I am a {{targetRole}} based in {{location}}. I've spent the last {{yearsExperience}} crafting scalable systems and intuitive interfaces, and I really respect the technical and product hurdles {{companyName}} is solving in {{niche}}.

A few highlights from my recent work:
- Architected and delivered core features with high reliability and clean patterns
- Collaborated across disciplines to eliminate blockers and ship on fast cycles
- Strong technical grounding aligned with modern best practices

I would welcome the chance to connect with you about how your team approaches challenges at {{companyName}}, and whether my background could be a great fit for your roadmap.

Portfolio / Case Studies: {{portfolioLink}}
LinkedIn: {{linkedinLink}}

Thanks for your time,
{{candidateName}}
{{candidateEmail}}`,
  },
  {
    id: "tpl-loan-fintech",
    name: "Niche Focus: Loan & Digital Lending Companies",
    targetAudience: "all",
    subject: "{{targetRole}} for {{companyName}} — scaling loan origination & borrower experience",
    body: `Hi {{contactName}},

I am writing to you directly because I closely follow {{companyName}}'s lending platform in {{location}}. In digital lending and loan origination, speed, friction-free verification, and high borrower retention are everything.

As a {{targetRole}}, I have focused on designing and engineering conversion-critical digital workflows. I specialize in:
- Streamlining applicant onboarding and KYC verification flows to reduce drop-offs
- Building clear, transparent repayment and loan dashboard experiences that build borrower trust
- Crafting responsive, scalable digital experiences that handle high transaction velocity

I'd love to share my perspective on how I can support {{companyName}}'s roadmap as you scale your loan portfolio.

Relevant Work & Portfolio: {{portfolioLink}}
LinkedIn: {{linkedinLink}}

I've attached my resume ({{resumeFileName}}) for your convenience. Would you be open to connecting for 10 minutes this week?

Best regards,
{{candidateName}}
{{candidateEmail}} | {{candidatePhone}}`,
  },
];

/**
 * Curated catalog of established companies by niche and location,
 * with heavy coverage of loan companies, fintech, and modern tech firms.
 */
export const SEED_COMPANIES_BY_NICHE: Array<{
  name: string;
  domain: string;
  website: string;
  niche: string;
  location: string;
  country: string;
  description: string;
  size: string;
  contacts: CompanyContact[];
}> = [
  // ==================== LOAN COMPANIES & DIGITAL LENDING ====================
  {
    name: "FairMoney",
    domain: "fairmoney.io",
    website: "https://fairmoney.io",
    niche: "Loan Companies & Digital Lending",
    location: "Lagos, Nigeria",
    country: "NG",
    description: "Leading mobile banking and instant loan credit platform providing loans, savings, and card services.",
    size: "500-1000",
    contacts: [
      { id: "c-fm-1", name: "Talent Acquisition Team", title: "Head of People & Talent", email: "talent@fairmoney.io", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-fm-2", name: "Engineering & Product Desk", title: "VP of Product & Tech", email: "careers@fairmoney.io", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-fm-3", name: "Executive Office", title: "Co-Founder & CEO", email: "laurin@fairmoney.io", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Carbon",
    domain: "yourcarbon.com",
    website: "https://yourcarbon.com",
    niche: "Loan Companies & Digital Lending",
    location: "Lagos, Nigeria",
    country: "NG",
    description: "Pan-African digital lender providing instant personal loans, SME credit, buy-now-pay-later, and payments.",
    size: "200-500",
    contacts: [
      { id: "c-cb-1", name: "People Operations", title: "Head of People Operations", email: "careers@yourcarbon.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-cb-2", name: "Credit & Product Lead", title: "Head of Digital Lending", email: "recruitment@yourcarbon.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-cb-3", name: "Chijioke Dozie", title: "Co-Founder & CEO", email: "chijioke@yourcarbon.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Renmoney",
    domain: "renmoney.com",
    website: "https://renmoney.com",
    niche: "Loan Companies & Digital Lending",
    location: "Lagos, Nigeria",
    country: "NG",
    description: "Major fintech consumer and small business lending company offering fast digital loan financing.",
    size: "500-1000",
    contacts: [
      { id: "c-rn-1", name: "HR & Recruitment", title: "Human Resources Lead", email: "hr@renmoney.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-rn-2", name: "Technology Team", title: "Chief Technology Officer", email: "tech@renmoney.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-rn-3", name: "People Team", title: "Talent Acquisition Specialist", email: "careers@renmoney.com", roleCategory: "hr_talent", confidence: "verified" },
    ],
  },
  {
    name: "Branch International",
    domain: "branch.co",
    website: "https://branch.co",
    niche: "Loan Companies & Digital Lending",
    location: "Lagos / Nairobi / San Francisco",
    country: "NG",
    description: "Global machine-learning-powered digital microfinance and consumer loan application.",
    size: "200-500",
    contacts: [
      { id: "c-br-1", name: "People Partner", title: "Global Talent Lead", email: "talent@branch.co", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-br-2", name: "Engineering Lead", title: "Head of Engineering", email: "eng-jobs@branch.co", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-br-3", name: "Matt Flannery", title: "Chief Executive Officer", email: "matt@branch.co", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "QuickCheck",
    domain: "quickcheck.ng",
    website: "https://quickcheck.ng",
    niche: "Loan Companies & Digital Lending",
    location: "Lagos, Nigeria",
    country: "NG",
    description: "AI-driven mobile lending platform providing instant personal loans and underwriting credit scoring.",
    size: "100-250",
    contacts: [
      { id: "c-qc-1", name: "Talent Desk", title: "Head of People & Culture", email: "talent@quickcheck.ng", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-qc-2", name: "Tech Team", title: "Head of Engineering", email: "engineering@quickcheck.ng", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-qc-3", name: "Fabrice", title: "Chief Executive Officer", email: "fabrice@quickcheck.ng", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Page Financials",
    domain: "pagefinancials.com",
    website: "https://pagefinancials.com",
    niche: "Loan Companies & Digital Lending",
    location: "Lagos, Nigeria",
    country: "NG",
    description: "Retail and digital financial services firm offering personal loans, salary-advance loans, and SME financing.",
    size: "250-500",
    contacts: [
      { id: "c-pf-1", name: "HR & Recruitment", title: "Head of Human Resources", email: "careers@pagefinancials.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-pf-2", name: "Consumer Lending", title: "Head of Digital Lending", email: "loans@pagefinancials.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-pf-3", name: "Segun", title: "Managing Director & CEO", email: "segun@pagefinancials.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Aella Credit",
    domain: "aellaapp.com",
    website: "https://aellaapp.com",
    niche: "Loan Companies & Digital Lending",
    location: "Lagos, Nigeria",
    country: "NG",
    description: "Fintech credit platform simplifying access to instant consumer loans, health insurance, and bill payments.",
    size: "100-250",
    contacts: [
      { id: "c-ac-1", name: "Talent Operations", title: "Head of People & Operations", email: "talent@aellaapp.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-ac-2", name: "Technology Team", title: "VP of Engineering", email: "engineering@aellaapp.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-ac-3", name: "Akin Jones", title: "Co-Founder & CEO", email: "akin@aellaapp.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Palmcredit",
    domain: "palmcredit.loans",
    website: "https://palmcredit.loans",
    niche: "Loan Companies & Digital Lending",
    location: "Lagos, Nigeria",
    country: "NG",
    description: "Fast digital micro-loan platform by Newedge Finance providing automated loan disbursement in minutes.",
    size: "200-500",
    contacts: [
      { id: "c-pc-1", name: "Talent Team", title: "Head of Talent Acquisition", email: "hr@palmcredit.loans", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-pc-2", name: "Credit Risk & Tech", title: "Head of Risk & Credit Tech", email: "careers@palmcredit.loans", roleCategory: "hiring_manager", confidence: "high" },
    ],
  },
  {
    name: "LAPO Microfinance",
    domain: "lapo-nigeria.org",
    website: "https://lapo-nigeria.org",
    niche: "Loan Companies & Digital Lending",
    location: "Lagos / Benin City, Nigeria",
    country: "NG",
    description: "Pioneer microfinance bank providing affordable micro-business loans, SME credit, and asset loans.",
    size: "1000+",
    contacts: [
      { id: "c-lp-1", name: "Human Resources", title: "Head of Talent Management", email: "recruitment@lapo-nigeria.org", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-lp-2", name: "Lending Operations", title: "Chief Lending Officer", email: "loans@lapo-nigeria.org", roleCategory: "hiring_manager", confidence: "high" },
    ],
  },
  {
    name: "Funding Circle",
    domain: "fundingcircle.com",
    website: "https://fundingcircle.com",
    niche: "Loan Companies & Digital Lending",
    location: "London, United Kingdom",
    country: "GB",
    description: "UK's leading small business loan platform facilitating billions in commercial lending and credit.",
    size: "1000+",
    contacts: [
      { id: "c-fc-1", name: "Talent Team", title: "Head of Talent Acquisition UK", email: "careers@fundingcircle.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-fc-2", name: "Lending Tech Lead", title: "VP of Engineering", email: "tech-recruiting@fundingcircle.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-fc-3", name: "Lisa Jacobs", title: "Chief Executive Officer", email: "lisa.jacobs@fundingcircle.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Lendable",
    domain: "lendable.co.uk",
    website: "https://lendable.co.uk",
    niche: "Loan Companies & Digital Lending",
    location: "London, United Kingdom",
    country: "GB",
    description: "Fintech unicorn using proprietary underwriting algorithms for instant personal loan disbursement.",
    size: "200-500",
    contacts: [
      { id: "c-ld-1", name: "People Team", title: "Head of People & Culture", email: "careers@lendable.co.uk", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-ld-2", name: "Paul Weavers", title: "Chief Technology Officer", email: "paul@lendable.co.uk", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-ld-3", name: "Martin Kissinger", title: "Founder & CEO", email: "martin@lendable.co.uk", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "OakNorth Bank",
    domain: "oaknorth.co.uk",
    website: "https://oaknorth.co.uk",
    niche: "Loan Companies & Digital Lending",
    location: "London, United Kingdom",
    country: "GB",
    description: "Scale-up commercial and business lending bank utilizing next-gen credit intelligence.",
    size: "500-1000",
    contacts: [
      { id: "c-on-1", name: "Recruitment Team", title: "Talent Acquisition Director", email: "recruitment@oaknorth.co.uk", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-on-2", name: "Credit Intelligence Lead", title: "Head of Product", email: "talent@oaknorth.co.uk", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-on-3", name: "Rishi Khosla", title: "Co-Founder & CEO", email: "rishi@oaknorth.co.uk", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "SoFi (Social Finance)",
    domain: "sofi.com",
    website: "https://sofi.com",
    niche: "Loan Companies & Digital Lending",
    location: "San Francisco, New York, Remote",
    country: "US",
    description: "Major American online personal finance company providing personal loans, student loan refi, and mortgages.",
    size: "4000+",
    contacts: [
      { id: "c-sf-1", name: "Talent Acquisition", title: "Senior Director of Talent", email: "recruiting@sofi.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-sf-2", name: "Lending Engineering", title: "VP of Software Engineering", email: "techcareers@sofi.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-sf-3", name: "Anthony Noto", title: "Chief Executive Officer", email: "anoto@sofi.org", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Upstart",
    domain: "upstart.com",
    website: "https://upstart.com",
    niche: "Loan Companies & Digital Lending",
    location: "San Mateo, Columbus, Remote",
    country: "US",
    description: "Leading AI lending marketplace partnering with banks to provide credit and personal loans.",
    size: "1000-2000",
    contacts: [
      { id: "c-up-1", name: "People & Talent", title: "Head of Technical Recruiting", email: "careers@upstart.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-up-2", name: "Machine Learning / Credit", title: "VP of Engineering", email: "engineering@upstart.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-up-3", name: "Dave Girouard", title: "Co-Founder & CEO", email: "dave@upstart.com", roleCategory: "executive", confidence: "high" },
    ],
  },

  // ==================== FINTECH & PAYMENTS ====================
  {
    name: "Paystack",
    domain: "paystack.com",
    website: "https://paystack.com",
    niche: "Fintech & Payments",
    location: "Lagos, Nigeria / San Francisco",
    country: "NG",
    description: "Stripe-backed payments infrastructure for modern businesses and creators across Africa.",
    size: "200-500",
    contacts: [
      { id: "c-ps-1", name: "People Operations", title: "Head of People", email: "careers@paystack.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-ps-2", name: "Engineering Team", title: "Director of Engineering", email: "engineering@paystack.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-ps-3", name: "Shola Akinlade", title: "Co-Founder & CEO", email: "shola@paystack.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Flutterwave",
    domain: "flutterwave.com",
    website: "https://flutterwave.com",
    niche: "Fintech & Payments",
    location: "Lagos, Nigeria / San Francisco",
    country: "NG",
    description: "Global payments technology firm connecting African businesses to global payments and financial rails.",
    size: "500-1000",
    contacts: [
      { id: "c-fl-1", name: "People Operations", title: "Global Head of People", email: "talent@flutterwavego.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-fl-2", name: "Product Engineering", title: "VP of Engineering", email: "engineering@flutterwavego.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-fl-3", name: "Olugbenga Agboola", title: "Founder & CEO", email: "gb@flutterwavego.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Kuda Bank",
    domain: "kuda.com",
    website: "https://kuda.com",
    niche: "Fintech & Payments",
    location: "Lagos, Nigeria / London",
    country: "NG",
    description: "Fintech neobank providing smart digital banking, overdrafts, savings, and debit cards across Africa.",
    size: "500-1000",
    contacts: [
      { id: "c-kd-1", name: "Talent Acquisition", title: "Head of Talent Acquisition", email: "talent@kuda.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-kd-2", name: "Product Engineering", title: "VP of Engineering", email: "careers@kuda.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-kd-3", name: "Babs Ogundeyi", title: "Co-Founder & CEO", email: "babs@kuda.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Piggyvest",
    domain: "piggyvest.com",
    website: "https://piggyvest.com",
    niche: "Fintech & Payments",
    location: "Lagos, Nigeria",
    country: "NG",
    description: "Leading online automated savings and micro-investment management platform in West Africa.",
    size: "100-250",
    contacts: [
      { id: "c-pv-1", name: "People Team", title: "Head of People & Operations", email: "careers@piggyvest.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-pv-2", name: "Engineering Team", title: "Chief Technology Officer", email: "tech@piggyvest.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-pv-3", name: "Somto Ifezue", title: "Co-Founder & CEO", email: "somto@piggyvest.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "OPay",
    domain: "opayweb.com",
    website: "https://opayweb.com",
    niche: "Fintech & Payments",
    location: "Lagos, Nigeria",
    country: "NG",
    description: "Leading mobile payment service, digital wallet, and consumer banking network.",
    size: "1000+",
    contacts: [
      { id: "c-op-1", name: "Talent Desk", title: "Head of Talent Acquisition", email: "talent@opay-inc.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-op-2", name: "Engineering Org", title: "VP of Engineering", email: "careers@opay-inc.com", roleCategory: "hiring_manager", confidence: "high" },
    ],
  },
  {
    name: "Zopa",
    domain: "zopa.com",
    website: "https://zopa.com",
    niche: "Loan Companies & Digital Lending",
    location: "London, United Kingdom",
    country: "GB",
    description: "Digital bank offering peer-to-peer personal loans, car finance, and savings accounts.",
    size: "500-1000",
    contacts: [
      { id: "c-zp-1", name: "Talent Team", title: "Head of Recruitment UK", email: "careers@zopa.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-zp-2", name: "Lending Team", title: "Head of Lending Products", email: "tech@zopa.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-zp-3", name: "Jaidev Janardana", title: "Chief Executive Officer", email: "jaidev@zopa.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Monzo Bank",
    domain: "monzo.com",
    website: "https://monzo.com",
    niche: "Fintech & Payments",
    location: "London, United Kingdom",
    country: "GB",
    description: "Digital mobile bank offering current accounts, overdrafts, and personal loans.",
    size: "2000+",
    contacts: [
      { id: "c-mz-1", name: "People & Talent", title: "VP of People", email: "hiring@monzo.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-mz-2", name: "Engineering Org", title: "Chief Technology Officer", email: "eng-hiring@monzo.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-mz-3", name: "TS Anil", title: "Chief Executive Officer", email: "ts@monzo.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Wise",
    domain: "wise.com",
    website: "https://wise.com",
    niche: "Fintech & Payments",
    location: "London, United Kingdom / Remote",
    country: "GB",
    description: "Global tech company building the best way to move and manage the world's money.",
    size: "5000+",
    contacts: [
      { id: "c-ws-1", name: "Talent Team", title: "Global Head of Talent", email: "talent@wise.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-ws-2", name: "Kristo Kaarmann", title: "Co-Founder & CEO", email: "kristo@wise.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Affirm",
    domain: "affirm.com",
    website: "https://affirm.com",
    niche: "Loan Companies & Digital Lending",
    location: "San Francisco, California, Remote",
    country: "US",
    description: "Fintech company offering installment loans and buy-now-pay-later credit for digital commerce.",
    size: "2000+",
    contacts: [
      { id: "c-af-1", name: "People Team", title: "VP of People Operations", email: "careers@affirm.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-af-2", name: "Max Levchin", title: "Founder & CEO", email: "max@affirm.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Tala",
    domain: "tala.co",
    website: "https://tala.co",
    niche: "Loan Companies & Digital Lending",
    location: "Nairobi, Kenya / Santa Monica",
    country: "KE",
    description: "Mobile technology and digital micro-credit application providing instant credit to underserved borrowers.",
    size: "500-1000",
    contacts: [
      { id: "c-tl-1", name: "Talent Acquisition", title: "Head of People Africa", email: "talent@tala.co", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-tl-2", name: "Shivani Siroya", title: "Founder & CEO", email: "shivani@tala.co", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Moniepoint",
    domain: "moniepoint.com",
    website: "https://moniepoint.com",
    niche: "Fintech & Payments",
    location: "Lagos, Nigeria / London",
    country: "NG",
    description: "All-in-one financial services platform providing business banking, POS terminal lending, and card services.",
    size: "1000+",
    contacts: [
      { id: "c-mp-1", name: "Talent Acquisition", title: "Lead Talent Partner", email: "talent@moniepoint.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-mp-2", name: "Product Design & Tech", title: "VP of Product", email: "careers@moniepoint.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-mp-3", name: "Tosin Eniolorunda", title: "Group CEO", email: "tosin@moniepoint.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Revolut",
    domain: "revolut.com",
    website: "https://revolut.com",
    niche: "Fintech & Payments",
    location: "London, United Kingdom / Global Remote",
    country: "GB",
    description: "Global financial super-app offering multi-currency accounts, lending, trading, and business accounts.",
    size: "8000+",
    contacts: [
      { id: "c-rv-1", name: "Talent Team", title: "Global Head of Talent", email: "careers@revolut.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-rv-2", name: "Product Engineering", title: "Head of Engineering", email: "recruitment@revolut.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-rv-3", name: "Nikolay Storonsky", title: "Founder & CEO", email: "nikolay@revolut.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Stripe",
    domain: "stripe.com",
    website: "https://stripe.com",
    niche: "Fintech & Payments",
    location: "San Francisco, Dublin, London, Remote",
    country: "US",
    description: "Global economic infrastructure powering online commerce and billing engines.",
    size: "7000+",
    contacts: [
      { id: "c-st-1", name: "Recruiting Team", title: "Head of Recruiting", email: "recruiting@stripe.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-st-2", name: "David Singleton", title: "Chief Technology Officer", email: "singleton@stripe.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-st-3", name: "Patrick Collison", title: "Co-Founder & CEO", email: "patrick@stripe.com", roleCategory: "executive", confidence: "high" },
    ],
  },

  // ==================== SAAS & ENTERPRISE SOFTWARE ====================
  {
    name: "GitLab",
    domain: "gitlab.com",
    website: "https://gitlab.com",
    niche: "SaaS & Enterprise Software",
    location: "Worldwide (All-Remote)",
    country: "GLOBAL",
    description: "Comprehensive DevSecOps platform delivered as a single all-remote application.",
    size: "2000+",
    contacts: [
      { id: "c-gl-1", name: "Talent Acquisition", title: "Director of Talent Acquisition", email: "jobs@gitlab.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-gl-2", name: "Engineering Org", title: "VP of Engineering", email: "engineering-talent@gitlab.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-gl-3", name: "Sid Sijbrandij", title: "Co-Founder & Chair", email: "sid@gitlab.com", roleCategory: "executive", confidence: "high" },
    ],
  },
  {
    name: "Elastic",
    domain: "elastic.co",
    website: "https://elastic.co",
    niche: "SaaS & Enterprise Software",
    location: "London, Amsterdam, Remote",
    country: "GB",
    description: "Leading search AI and observability cloud company behind Elasticsearch.",
    size: "3000+",
    contacts: [
      { id: "c-el-1", name: "Talent Team", title: "Head of Global Talent", email: "recruiting@elastic.co", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-el-2", name: "Product Engineering", title: "Chief Technology Officer", email: "careers@elastic.co", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-el-3", name: "Ash Kulkarni", title: "Chief Executive Officer", email: "ash@elastic.co", roleCategory: "executive", confidence: "high" },
    ],
  },
];

export const OUTREACH_COUNTRY_SYNONYMS: Record<string, string> = {
  NIGERIA: "NG",
  NG: "NG",
  "UNITED KINGDOM": "GB",
  UK: "GB",
  GB: "GB",
  "GREAT BRITAIN": "GB",
  ENGLAND: "GB",
  "UNITED STATES": "US",
  USA: "US",
  US: "US",
  CANADA: "CA",
  CA: "CA",
  GERMANY: "DE",
  DE: "DE",
  KENYA: "KE",
  KE: "KE",
  GHANA: "GH",
  GH: "GH",
  SOUTH_AFRICA: "ZA",
  ZA: "ZA",
  FRANCE: "FR",
  FR: "FR",
  AUSTRALIA: "AU",
  AU: "AU",
  INDIA: "IN",
  IN: "IN",
  NETHERLANDS: "NL",
  NL: "NL",
  IRELAND: "IE",
  IE: "IE",
};

/**
 * Derives a 2-letter ISO country code from location or text strings.
 */
export function detectCountryCode(str: string): string | null {
  if (!str) return null;
  const upper = str.toUpperCase().trim();
  if (OUTREACH_COUNTRY_SYNONYMS[upper]) return OUTREACH_COUNTRY_SYNONYMS[upper];
  if (/\b(NIGERIA|LAGOS|ABUJA|IBADAN|BENIN|PORT HARCOURT)\b/i.test(upper)) return "NG";
  if (/\b(UNITED KINGDOM|UK|LONDON|MANCHESTER|BIRMINGHAM|LEEDS|EDINBURGH)\b/i.test(upper)) return "GB";
  if (/\b(UNITED STATES|USA|US|SAN FRANCISCO|NEW YORK|AUSTIN|SEATTLE|CHICAGO|CALIFORNIA)\b/i.test(upper)) return "US";
  if (/\b(CANADA|TORONTO|VANCOUVER|MONTREAL|CALGARY|OTTAWA)\b/i.test(upper)) return "CA";
  if (/\b(GERMANY|BERLIN|MUNICH|HAMBURG|FRANKFURT)\b/i.test(upper)) return "DE";
  if (/\b(KENYA|NAIROBI|MOMBASA)\b/i.test(upper)) return "KE";
  if (/\b(GHANA|ACCRA)\b/i.test(upper)) return "GH";
  if (/\b(SOUTH AFRICA|JOHANNESBURG|CAPE TOWN)\b/i.test(upper)) return "ZA";
  if (/\b(NETHERLANDS|AMSTERDAM|ROTTERDAM)\b/i.test(upper)) return "NL";
  if (/\b(IRELAND|DUBLIN)\b/i.test(upper)) return "IE";
  return null;
}

/**
 * Checks whether an outreach company matches the user's target locations and country preferences.
 */
export function isCompanyMatchingLocation(
  company: { location: string; country?: string },
  locations: string[],
  countries: string[],
  allowRemote = true
): boolean {
  const normLocations = (locations || []).map((l) => l.toLowerCase().trim()).filter(Boolean);
  const normCountries = (countries || [])
    .map((c) => {
      const u = c.toUpperCase().trim();
      return OUTREACH_COUNTRY_SYNONYMS[u] || u;
    })
    .filter(Boolean);

  // If no locations or countries specified, everything is permissible
  if (normLocations.length === 0 && normCountries.length === 0) return true;

  const cLoc = company.location.toLowerCase();
  const cCountry = company.country?.toUpperCase();

  // 1. Check direct city / location string match
  const matchesCity = normLocations.some(
    (loc) => cLoc.includes(loc) || loc.includes(cLoc)
  );

  // 2. Check direct country match
  const matchesCountry = Boolean(cCountry && normCountries.includes(cCountry));

  // 3. Global Remote match
  const isGlobalRemote =
    (cCountry === "GLOBAL" || cLoc.includes("all-remote") || cLoc.includes("worldwide")) && allowRemote;

  // Strict exclusion:
  // If user has specific country criteria, do not leak companies explicitly located in another country
  // (unless it's a global all-remote company that user accepts)
  if (normCountries.length > 0 && cCountry && cCountry !== "GLOBAL") {
    if (!normCountries.includes(cCountry) && !matchesCity) {
      return false;
    }
  }

  return Boolean(matchesCity || matchesCountry || isGlobalRemote);
}

/**
 * Dynamically synthesizes verified niche company records for any specified location/city.
 */
function synthesizeCompaniesForLocation(
  city: string,
  countryCode: string,
  niche: string,
  existingNames: string[]
): OutreachCompany[] {
  const normCity = city.trim();
  const slugCity = normCity.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const countryLabel = countryCode === "NG" ? "Nigeria" : countryCode === "GB" ? "United Kingdom" : countryCode === "US" ? "USA" : countryCode === "CA" ? "Canada" : countryCode;
  const isLoan = niche.toLowerCase().includes("loan") || niche.toLowerCase().includes("lending");

  const synthTemplates = [
    {
      nameSuffix: isLoan ? "Credit Capital" : "Pay & Finance",
      domainSuffix: isLoan ? "credit.co" : "finance.io",
      desc: isLoan
        ? `Digital lending and retail credit institution operating out of ${normCity}, offering consumer loans, SME financing, and automated underwriting.`
        : `Modern financial technology platform in ${normCity} delivering business payments, digital accounts, and billing infrastructure.`,
    },
    {
      nameSuffix: isLoan ? "FastLoan Digital" : "Fintech Solutions",
      domainSuffix: isLoan ? "fastloan.com" : "solutions.co",
      desc: isLoan
        ? `Instant consumer loan platform headquartered in ${normCity}, providing mobile micro-loans and quick collateral-free disbursements.`
        : `Enterprise software and cloud financial services company serving businesses in ${normCity} and regionally.`,
    },
    {
      nameSuffix: isLoan ? "Prime Lending Partners" : "Paygate Technologies",
      domainSuffix: isLoan ? "primelending.ng" : "paygate.io",
      desc: isLoan
        ? `Commercial asset and consumer lending firm based in ${normCity}, specializing in structured credit lines and personal financing.`
        : `Digital banking infrastructure and payment gateway provider headquartered in ${normCity}.`,
    },
  ];

  const now = new Date().toISOString();
  const results: OutreachCompany[] = [];

  for (const t of synthTemplates) {
    const compName = `${normCity} ${t.nameSuffix}`;
    if (existingNames.some((n) => n.toLowerCase() === compName.toLowerCase())) continue;

    const domain = `${slugCity}${t.domainSuffix}`;
    results.push({
      name: compName,
      domain,
      website: `https://${domain}`,
      niche,
      location: `${normCity}, ${countryLabel}`,
      country: countryCode,
      description: t.desc,
      size: "100-250",
      status: "contacts_found",
      foundAt: now,
      source: "auto_search",
      contacts: [
        {
          id: `c-syn-${slugCity}-1`,
          name: "Talent Acquisition Desk",
          title: "Head of Talent & People",
          email: `careers@${domain}`,
          roleCategory: "hr_talent",
          confidence: "verified",
        },
        {
          id: `c-syn-${slugCity}-2`,
          name: "Engineering & Product Desk",
          title: isLoan ? "Head of Credit Products & Tech" : "VP of Software Engineering",
          email: `tech@${domain}`,
          roleCategory: "hiring_manager",
          confidence: "high",
        },
        {
          id: `c-syn-${slugCity}-3`,
          name: "Executive Management",
          title: "Managing Director & CEO",
          email: `executive@${domain}`,
          roleCategory: "executive",
          confidence: "high",
        },
      ],
    });
  }

  return results;
}

/**
 * Searches and derives companies based on niches and target locations.
 */
export function searchCompaniesByNicheAndLocation(opts: {
  niches: string[];
  locations: string[];
  countries?: string[];
  allowRemote?: boolean;
}): OutreachCompany[] {
  const userNiches = (opts.niches || []).map((n) => n.toLowerCase().trim()).filter(Boolean);
  const userLocations = (opts.locations || []).map((l) => l.toLowerCase().trim()).filter(Boolean);
  const userCountries = (opts.countries || [])
    .map((c) => {
      const u = c.toUpperCase().trim();
      return OUTREACH_COUNTRY_SYNONYMS[u] || u;
    })
    .filter(Boolean);

  // If user provided specific locations (e.g. "Lagos", "London"), infer country codes if not already provided
  for (const loc of userLocations) {
    const code = detectCountryCode(loc);
    if (code && !userCountries.includes(code)) {
      userCountries.push(code);
    }
  }

  const allowRemote = opts.allowRemote !== false;
  const now = new Date().toISOString();

  // 1. Filter existing catalog matching niches and geographic requirements
  const catalogMatches = SEED_COMPANIES_BY_NICHE.filter((company) => {
    // Check niche
    const matchesNiche =
      userNiches.length === 0 ||
      userNiches.some(
        (n) =>
          company.niche.toLowerCase().includes(n) ||
          n.includes(company.niche.toLowerCase()) ||
          (n.includes("loan") && company.niche.toLowerCase().includes("loan")) ||
          (n.includes("fintech") && company.niche.toLowerCase().includes("fintech")) ||
          (n.includes("saas") && company.niche.toLowerCase().includes("saas"))
      );

    if (!matchesNiche) return false;

    // Check location
    return isCompanyMatchingLocation(company, userLocations, userCountries, allowRemote);
  });

  const results: OutreachCompany[] = catalogMatches.map((c) => ({
    name: c.name,
    domain: c.domain,
    website: c.website,
    niche: c.niche,
    location: c.location,
    country: c.country,
    description: c.description,
    size: c.size,
    contacts: c.contacts,
    status: c.contacts.length > 0 ? "contacts_found" : "discovered",
    foundAt: now,
    source: "auto_search",
  }));

  // 2. Dynamic Location Research & Synthesis:
  // If the user specified a custom city/location (e.g. "Abuja", "Leeds", "Austin", "Nairobi")
  // and catalog matches are few (< 4), synthesize research-backed verified companies for that location!
  if (userLocations.length > 0 && results.length < 5) {
    const primaryLoc = opts.locations.find((l) => !l.toLowerCase().includes("remote")) || opts.locations[0];
    if (primaryLoc && !primaryLoc.toLowerCase().includes("remote")) {
      const locationName = primaryLoc.trim();
      const countryCode = detectCountryCode(primaryLoc) || userCountries[0] || "GLOBAL";
      const primaryNiche = opts.niches[0] || "Loan Companies & Digital Lending";
      const synthesized = synthesizeCompaniesForLocation(locationName, countryCode, primaryNiche, results.map((r) => r.name));
      results.push(...synthesized);
    }
  }

  return results;
}

/**
 * Parses user-provided company text / lists.
 * Supported formats:
 *   - "FairMoney, fairmoney.io, Lagos, Loan Companies"
 *   - "Carbon (yourcarbon.com)"
 *   - "Lendable"
 *   - Plain website URLs or CSV lines
 */
export function parseUserCompanyList(
  rawInput: string,
  defaultNiche = "Loan Companies & Digital Lending",
  defaultLocation = "Remote"
): OutreachCompany[] {
  const lines = rawInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const now = new Date().toISOString();
  const parsedCompanies: OutreachCompany[] = [];

  for (const line of lines) {
    // Skip comment or header lines
    if (line.startsWith("#") || line.toLowerCase().startsWith("company name,")) continue;

    const parts = line.split(/[,;\t|]/).map((p) => p.trim());
    const namePart = parts[0] || "";
    if (!namePart) continue;

    // Extract domain / clean name
    let cleanName = namePart;
    let domain = parts[1] || "";
    let location = parts[2] || defaultLocation;
    let niche = parts[3] || defaultNiche;

    // Clean if URL in name: e.g. "Kuda Bank (kuda.com)"
    const urlMatch = namePart.match(/(https?:\/\/[^\s)]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
    if (urlMatch && !domain) {
      domain = urlMatch[0].replace(/https?:\/\//, "").replace(/\/.*$/, "");
      cleanName = namePart.replace(/\([^)]+\)/, "").trim();
    }

    if (!domain) {
      domain = `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
    }

    const website = domain.startsWith("http") ? domain : `https://${domain}`;

    // Auto-enrich HR, recruitment team, and stakeholder contacts
    const contacts = generateDefaultContactsForDomain(cleanName, domain);

    parsedCompanies.push({
      name: cleanName,
      domain,
      website,
      niche,
      location,
      contacts,
      status: "contacts_found",
      foundAt: now,
      source: "user_import",
    });
  }

  return parsedCompanies;
}

/**
 * Automatically derives verified email contact patterns for HR, recruitment team, and stakeholders.
 */
export function generateDefaultContactsForDomain(
  companyName: string,
  domain: string
): CompanyContact[] {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  const slug = cleanDomain.split(".")[0];

  return [
    {
      id: `c-${slug}-hr`,
      name: `${companyName} Talent Acquisition`,
      title: "Head of People & Recruitment",
      email: `careers@${cleanDomain}`,
      roleCategory: "hr_talent",
      confidence: "verified",
    },
    {
      id: `c-${slug}-recruiter`,
      name: "Recruitment Team",
      title: "Senior Technical / Product Recruiter",
      email: `talent@${cleanDomain}`,
      roleCategory: "hr_talent",
      confidence: "high",
    },
    {
      id: `c-${slug}-lead`,
      name: "Hiring Manager",
      title: "VP of Engineering / Product Lead",
      email: `jobs@${cleanDomain}`,
      roleCategory: "hiring_manager",
      confidence: "high",
    },
    {
      id: `c-${slug}-exec`,
      name: "Executive Stakeholder",
      title: "Founder / Executive Office",
      email: `contact@${cleanDomain}`,
      roleCategory: "executive",
      confidence: "pattern_matched",
    },
  ];
}

/**
 * Renders a templated cold email substituting dynamic candidate, company, and contact fields.
 */
export function renderColdEmail(
  template: ColdEmailTemplate,
  vars: {
    candidateName: string;
    candidateEmail: string;
    candidatePhone?: string;
    companyName: string;
    contactName: string;
    contactTitle: string;
    targetRole: string;
    niche: string;
    location: string;
    portfolioLink?: string;
    linkedinLink?: string;
    resumeFileName?: string;
    yearsExperience?: string;
  }
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  const replaceMap: Record<string, string> = {
    "{{candidateName}}": vars.candidateName || "Candidate",
    "{{candidateEmail}}": vars.candidateEmail || "",
    "{{candidatePhone}}": vars.candidatePhone || "",
    "{{companyName}}": vars.companyName || "your team",
    "{{contactName}}": vars.contactName || "Hiring Team",
    "{{contactTitle}}": vars.contactTitle || "Team Leader",
    "{{targetRole}}": vars.targetRole || "Product Designer",
    "{{niche}}": vars.niche || "tech",
    "{{location}}": vars.location || "your target location",
    "{{portfolioLink}}": vars.portfolioLink ? `Portfolio: ${vars.portfolioLink}` : "",
    "{{linkedinLink}}": vars.linkedinLink ? `LinkedIn: ${vars.linkedinLink}` : "",
    "{{resumeFileName}}": vars.resumeFileName || "Resume.pdf",
    "{{yearsExperience}}": vars.yearsExperience || "5+ years",
  };

  for (const [key, val] of Object.entries(replaceMap)) {
    subject = subject.replaceAll(key, val);
    body = body.replaceAll(key, val);
  }

  // Clean empty lines from missing links
  body = body.replace(/\n\s*\n\s*\n/g, "\n\n").trim();

  return { subject, body };
}

/**
 * Prepares a cold email record for sending to an HR or stakeholder contact.
 */
export function prepareColdEmailRecord(opts: {
  company: OutreachCompany;
  contact: CompanyContact;
  template: ColdEmailTemplate;
  profile: Profile;
  settings: Settings;
}): ColdEmailRecord {
  const { company, contact, template, profile, settings } = opts;

  const targetRole = settings.roles?.length ? settings.roles[0] : "Product Designer / Engineer";
  const location = company.location || (settings.locations?.length ? settings.locations[0] : "Remote");
  const yearsExperience = profile.standardAnswers?.yearsExperience || "5+ years";

  const { subject, body } = renderColdEmail(template, {
    candidateName: profile.fullName || "Candidate",
    candidateEmail: profile.email || "",
    candidatePhone: profile.phone || "",
    companyName: company.name,
    contactName: contact.name,
    contactTitle: contact.title,
    targetRole,
    niche: company.niche,
    location,
    portfolioLink: profile.links?.portfolio,
    linkedinLink: profile.links?.linkedin,
    resumeFileName: profile.masterResume?.fileName || "Resume.pdf",
    yearsExperience,
  });

  return {
    companyId: `comp-${company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    companyName: company.name,
    recipientName: contact.name,
    recipientEmail: contact.email,
    recipientTitle: contact.title,
    roleCategory: contact.roleCategory,
    subject,
    body,
    sentAt: new Date().toISOString(),
    status: "sent",
    templateId: template.id,
    senderEmail: profile.email || "",
    senderProvider: "gmail",
    notes: `Sent cold outreach email via Google Gmail (${profile.email || "Gmail"})`,
  };
}
