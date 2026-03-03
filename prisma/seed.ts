import { prisma } from "../src/lib/prisma";
import bcrypt from "bcrypt";
import config from "../src/config";
import { Plan, Role } from "../src/generated/prisma/enums";

async function main() {
  console.log("Seed starting...");

  const superAdminTenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-000000000000" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000000",
      name: config.super_admin.name as string,
      plan: config.super_admin.plan as Plan,
      isBanned: false,
    },
  });

  console.log("Tenant created:", superAdminTenant.id);

  const existing = await prisma.user.findUnique({
    where: { email: config.super_admin.email },
  });

  console.log("Existing user:", existing);

  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email: config.super_admin.email,
        password: await bcrypt.hash(config.super_admin.password, 10),
        role: config.super_admin.role as Role,
        tenantId: superAdminTenant.id,
      },
    });
    console.log("✅ SuperAdmin created:", user.email);
  } else {
    console.log("⚠️ SuperAdmin already exists");
  }
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });