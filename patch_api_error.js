const fs = require('fs');
const path = require('path');

const routeFile = path.join(__dirname, 'src/app/api/v1/admin/organizations/[organizationId]/app-users/route.ts');
let content = fs.readFileSync(routeFile, 'utf8');

// Insert detailed Zod handling
content = content.replace(
  /const parsed = CreateAppUserSchema\.parse\(body\);/,
  `let parsed;
    try {
      parsed = CreateAppUserSchema.parse(body);
    } catch (zodError: any) {
      return NextResponse.json({ error: { message: zodError.errors[0]?.message || "Validation failed", code: "VALIDATION_FAILED" } }, { status: 400 });
    }`
);

fs.writeFileSync(routeFile, content);
console.log("Patched route.ts");
