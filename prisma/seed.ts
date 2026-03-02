import { prisma } from "../src/lib/prisma";
import bcrypt from "bcrypt";
async function main() {
  console.log("Seed starting...");

  const superAdminTenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-000000000000" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000000",
      name: "System",
      plan: "DIAMOND",
      isBanned: false,
    },
  });

  console.log("Tenant created:", superAdminTenant.id);

  const existing = await prisma.user.findUnique({
    where: { email: "superadmin@filevault.com" },
  });

  console.log("Existing user:", existing);

  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email: "superadmin@filevault.com",
        password: await bcrypt.hash("SuperSecret123@", 10),
        role: "SUPER_ADMIN",
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