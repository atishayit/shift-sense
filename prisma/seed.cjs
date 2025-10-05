// prisma/seed.cjs
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const org = await db.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "ShiftSense Demo", slug: "demo" },
  });

  const loc = await db.location.upsert({
    where: { id: `${org.id}-loc1` },
    update: {},
    create: { id: `${org.id}-loc1`, orgId: org.id, name: "Camberwell" },
  });

  const team = await db.team.upsert({
    where: { id: `${org.id}-team-store` },
    update: {},
    create: { id: `${org.id}-team-store`, orgId: org.id, locationId: loc.id, name: "Store" },
  });

  const role = await db.role.upsert({
    where: { id: `${org.id}-role-cashier` },
    update: {},
    create: { id: `${org.id}-role-cashier`, orgId: org.id, teamId: team.id, name: "Cashier" },
  });

  // Build employees and insert with skipDuplicates
  const employees = Array.from({ length: 12 }).map((_, i) => ({
    orgId: org.id,
    teamId: team.id,
    roleId: role.id,
    code: `EMP${String(i + 1).padStart(3, "0")}`,
    firstName: `Emp${i + 1}`,
    lastName: "Demo",
    employmentType: (i + 1) % 2 ? "PART_TIME" : "CASUAL",
    hourlyCost: "28.50",
    maxWeeklyHours: 30,
  }));

  await db.employee.createMany({ data: employees, skipDuplicates: true });

  await db.shiftDemandTemplate.createMany({
    data: [1, 2, 3, 4, 5].map(weekday => ({
      locationId: loc.id, roleId: role.id, weekday, startTime: "09:00", endTime: "17:00", required: 2
    })),
    skipDuplicates: true
  });


  console.log("Seeded/updated.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
