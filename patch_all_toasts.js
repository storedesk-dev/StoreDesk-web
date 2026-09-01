const fs = require('fs');
const path = require('path');

const p1 = path.join(__dirname, 'src/app/admin/organizations/[orgId]/page.tsx');
let c1 = fs.readFileSync(p1, 'utf8');
c1 = c1.replace(
  /export default function AdminOrganizationDetailPage\(\) \{/,
  'export default function AdminOrganizationDetailPage() {\n  const { toast } = useToast();'
);
if (!c1.includes('import { useToast }')) {
  c1 = 'import { useToast } from "@/components/ToastContext";\n' + c1;
}
fs.writeFileSync(p1, c1);

const p2 = path.join(__dirname, 'src/app/admin/organizations/[orgId]/stores/[storeId]/page.tsx');
let c2 = fs.readFileSync(p2, 'utf8');
c2 = c2.replace(
  /export default function AdminStoreDetailPage\(\) \{/,
  'export default function AdminStoreDetailPage() {\n  const { toast } = useToast();'
);
if (!c2.includes('import { useToast }')) {
  c2 = 'import { useToast } from "@/components/ToastContext";\n' + c2;
}
fs.writeFileSync(p2, c2);

const p3 = path.join(__dirname, 'src/app/admin/organizations/page.tsx');
let c3 = fs.readFileSync(p3, 'utf8');
c3 = c3.replace(
  /export default function AdminOrganizationsPage\(\) \{/,
  'export default function AdminOrganizationsPage() {\n  const { toast } = useToast();'
);
if (!c3.includes('import { useToast }')) {
  c3 = 'import { useToast } from "@/components/ToastContext";\n' + c3;
}
fs.writeFileSync(p3, c3);

console.log("Patched all pages for useToast");
