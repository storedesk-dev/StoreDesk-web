const fs = require('fs');
const path = require('path');

const pageFile = path.join(__dirname, 'src/app/admin/organizations/[orgId]/stores/[storeId]/page.tsx');
let content = fs.readFileSync(pageFile, 'utf8');

// Add import for useToast
if (!content.includes('useToast')) {
  content = content.replace(
    /import \{ useFormStatus \} from "react-dom";/,
    'import { useFormStatus } from "react-dom";\nimport { useToast } from "@/components/ToastContext";'
  );
  
  content = content.replace(
    /export default function StoreDetails\(\{ params \}: \{ params: \{ orgId: string; storeId: string \} \}\) \{/,
    'export default function StoreDetails({ params }: { params: { orgId: string; storeId: string } }) {\n  const { toast } = useToast();'
  );
}

// Extract error string from object if needed
content = content.replace(/alert\((data\.error) \|\| (.*?)\);/g, 'toast($1?.message || typeof $1 === "string" ? $1 : ($1?.code || $2), "error");');
content = content.replace(/alert\((.*?)\);/g, 'toast($1, "error");');

// Fix success toasts
content = content.replace(/toast\("Store updated successfully", "error"\);/g, 'toast("Store updated successfully", "success");');
content = content.replace(/toast\("Token copied to clipboard", "error"\);/g, 'toast("Token copied to clipboard", "success");');
content = content.replace(/toast\("Tunnel configuration deleted", "error"\);/g, 'toast("Tunnel configuration deleted", "success");');
content = content.replace(/toast\("Store deleted", "error"\);/g, 'toast("Store deleted", "success");');

fs.writeFileSync(pageFile, content);
console.log("Patched alerts in storeId page");
