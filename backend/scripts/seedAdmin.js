/**
 * Seed (or reset) a Beepr owner/admin account.
 *
 * Usage:
 *   node scripts/seedAdmin.js
 *
 * Optional env overrides:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME, SEED_ADMIN_PHONE
 *
 * The created user is role "owner", pre-verified, and linked to an
 * organization so it can immediately access the dashboard and admin APIs.
 */
import "../config/env.js";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import Organization from "../models/organization.model.js";
import Tenant from "../models/tenant.model.js";
import { hashPassword } from "../services/auth.service.js";

const EMAIL = (process.env.SEED_ADMIN_EMAIL || "admin@beepr.ai").toLowerCase();
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@Beepr123";
const NAME = process.env.SEED_ADMIN_NAME || "Beepr Admin";
const PHONE = process.env.SEED_ADMIN_PHONE || "+919000000000";

async function run() {
  await connectDB();

  const passwordHash = await hashPassword(PASSWORD);

  let user = await User.findOne({ email: EMAIL });
  if (user) {
    user.fullName = NAME;
    user.passwordHash = passwordHash;
    user.role = "owner";
    user.isPlatformAdmin = true;
    user.isEmailVerified = true;
    user.isActive = true;
    await user.save();
    console.log(`↻ Updated existing admin user: ${EMAIL}`);
  } else {
    user = await User.create({
      fullName: NAME,
      email: EMAIL,
      phone: PHONE,
      passwordHash,
      role: "owner",
      isPlatformAdmin: true,
      isEmailVerified: true,
      isActive: true,
    });
    console.log(`✓ Created admin user: ${EMAIL}`);
  }

  let org = await Organization.findOne({ ownerId: user._id });
  if (!org) {
    org = await Organization.create({
      name: "Beepr Admin Workspace",
      slug: `beepr-admin-${user._id.toString().slice(-6)}`,
      industry: "Internal",
      plan: "enterprise",
      ownerId: user._id,
      members: [{ userId: user._id, role: "owner" }],
    });
    console.log(`✓ Created organization: ${org.slug}`);
  }

  if (!user.organizationId || user.organizationId.toString() !== org._id.toString()) {
    user.organizationId = org._id;
    await user.save();
  }

  let tenant = await Tenant.findOne({ organizationId: org._id });
  if (!tenant) {
    tenant = await Tenant.create({
      orgName: org.name,
      industry: org.industry || "Internal",
      slug: `beepr-admin-${org._id.toString().slice(-6)}`,
      organizationId: org._id,
      plan: "enterprise",
    });
    console.log(`✓ Created tenant workspace: ${tenant.slug}`);
  }

  console.log("\n────────────────────────────────────────");
  console.log("  Beepr admin credentials");
  console.log("────────────────────────────────────────");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Role:     owner`);
  console.log("────────────────────────────────────────");
  console.log("  Log in at /login, then open /dashboard/admin");
  console.log("  (owner role required — no separate admin password)");
  console.log("────────────────────────────────────────\n");

  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("Seed failed:", err.message);
  try {
    await mongoose.connection.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
