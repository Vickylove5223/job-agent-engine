// Creates (or resets) a LOCAL emulator login for the e2e test user so the dashboard can show its data.
// Writes the credentials to data/emulator-test-login.txt (gitignored). Emulator only.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { firestore } from "../db";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("Emulator only.");
firestore();
const uid = "e2e-test-user";
const email = "e2e@example.test";
const password = "test-" + randomBytes(6).toString("hex");
const auth = getAuth();
try {
  await auth.updateUser(uid, { email, password });
} catch {
  await auth.createUser({ uid, email, password });
}
const out = path.resolve(import.meta.dirname, "../../../data/emulator-test-login.txt");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `Local emulator test login (http://localhost:5182)\nemail: ${email}\npassword: ${password}\n`);
console.log(`Login saved to ${out}`);
process.exit(0);
