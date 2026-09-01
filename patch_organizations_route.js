const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/api/v1/admin/organizations/route.ts');
let c = fs.readFileSync(file, 'utf8');

if (!c.includes('TenantStoreModel')) {
  c = c.replace(
    /import \{ AppUserModel, UserAssignmentModel, OrganizationModel \} from "@\/models\/ControlPlane";/,
    'import { AppUserModel, UserAssignmentModel, OrganizationModel, TenantStoreModel } from "@/models/ControlPlane";'
  );
}

c = c.replace(
  /const rows = await OrganizationModel\.find\(\{\}\)\.sort\(\{ createdAt: -1 \}\)\.lean\(\);/,
  `const rows = await OrganizationModel.find({}).sort({ createdAt: -1 }).lean();
    
    // Fetch stores count for each org
    const orgIds = rows.map(r => r.organizationId);
    const stores = await TenantStoreModel.find({ organizationId: { $in: orgIds } }).lean();
    
    for (const org of rows) {
      (org as any).stores = stores.filter(s => s.organizationId === org.organizationId);
    }`
);

fs.writeFileSync(file, c);
console.log("Patched organizations route");
