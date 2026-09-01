const fs = require('fs');
const path = require('path');

const pageFile = path.join(__dirname, 'src/app/admin/organizations/[orgId]/page.tsx');
let content = fs.readFileSync(pageFile, 'utf8');

// Add import for useToast
if (!content.includes('useToast')) {
  content = content.replace(
    /import \{ useFormStatus \} from "react-dom";/,
    'import { useFormStatus } from "react-dom";\nimport { useToast } from "@/components/ToastContext";'
  );
  
  // Also hook into component
  content = content.replace(
    /export default function OrganizationDetails\(\{ params \}: \{ params: \{ orgId: string \} \}\) \{/,
    'export default function OrganizationDetails({ params }: { params: { orgId: string } }) {\n  const { toast } = useToast();'
  );
}

// Replace alert with toast and extract error message if data.error is an object
content = content.replace(/alert\((data\.error) \|\| (.*?)\);/g, 'toast($1?.message || typeof $1 === "string" ? $1 : ($1?.code || $2), "error");');
content = content.replace(/alert\((.*?)\);/g, 'toast($1, "error");');

fs.writeFileSync(pageFile, content);
console.log("Patched alerts in orgId page");
