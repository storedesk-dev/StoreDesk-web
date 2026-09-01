const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/api/v1/admin/organizations/[organizationId]/app-users/route.ts');
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /catch \(zodError: unknown\) \{\n\s*return NextResponse\.json\(\{ error: \{ message: zodError\.errors\[0\]\?\.message \|\| "Validation failed", code: "VALIDATION_FAILED" \} \}, \{ status: 400 \}\);\n\s*\}/,
  `catch (zodError: unknown) {
      const err = zodError as { errors?: { message: string }[] };
      return NextResponse.json({ error: { message: err.errors?.[0]?.message || "Validation failed", code: "VALIDATION_FAILED" } }, { status: 400 });
    }`
);

fs.writeFileSync(file, c);
console.log("Fixed zod any");
