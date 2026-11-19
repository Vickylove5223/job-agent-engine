// Spot-check real AI answers on tricky Greenhouse questions: npx tsx --env-file-if-exists=.env src/ai/fieldcheck.ts
import { ai } from "./index";
import type { Job, Profile } from "@shared/types";

const profile: Profile = {
  fullName: "Test Candidate", email: "test@example.com", phone: "+234 800 000 0000", location: "Lagos", country: "NG",
  links: { linkedin: "https://linkedin.com/in/test", portfolio: "https://example.com" },
  standardAnswers: { workAuthorization: "Nigerian citizen; requires visa sponsorship to work in the Netherlands", needsSponsorship: "Yes", yearsExperience: "5" },
};
const facts = ["Lives in: Lagos, Nigeria", "Needs visa sponsorship: Yes", "Work authorization: Nigerian citizen; requires visa sponsorship to work in the Netherlands", "Target roles: Product Designer"];
const job = { title: "Sr. Product Designer", company: "Databricks", location: "Amsterdam, Netherlands", description: "Product designer role in Amsterdam." } as unknown as Job;

const fields = [
  { label: "Please confirm whether any of the below applies to you. Select all that apply. Note: This information will only be used to ensure compliance with U.S. sanctions and export controls.", type: "checkbox" as const, required: true,
    options: ["Citizen or permanent resident of Cuba, Iran, North Korea, or Syria", "Ordinarily a resident of Cuba, Iran, North Korea, Syria or the Crimea, Donetsk, Luhansk, Zaporizhzhia, or Kherson regions of Ukraine", "Ordinarily a resident of Russia or Belarus and not willing to relocate for a Databricks role", "None of the above"] },
  { label: "If you selected a response to the prior question other than “none of the above,” please confirm whether any of the following also applies to you. Select all that apply.", type: "checkbox" as const, required: true,
    options: ["U.S. citizen", "U.S. permanent resident (Green Card holder)", "None of these apply to me", "Not applicable (i.e., I selected “none of the above” for the prior question)"] },
  { label: "Are you legally authorized to work in the country in which you are applying?", type: "select" as const, required: true, options: ["Yes", "No"] },
  { label: "Do you now or will you in the future need sponsorship for employment visa status in the country in which you are applying?", type: "select" as const, required: true, options: ["Yes", "No"] },
  { label: "Do you currently or have you previously worked for Databricks in the past?", type: "select" as const, required: true, options: ["Yes", "No"] },
];
for (const f of fields) {
  const a = await ai.answerField({ field: f, profile, facts, job });
  console.log(`${f.label.slice(0, 70)}…\n  → ${JSON.stringify(a.answer)}  (confidence ${a.confidence})\n`);
}
