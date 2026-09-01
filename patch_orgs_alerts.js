const fs = require('fs');
const path = require('path');

const pageFile = path.join(__dirname, 'src/app/admin/organizations/page.tsx');
let content = fs.readFileSync(pageFile, 'utf8');

if (!content.includes('useToast')) {
  content = content.replace(
    /import \{ useFormStatus \} from "react-dom";/,
    'import { useFormStatus } from "react-dom";\nimport { useToast } from "@/components/ToastContext";'
  );
  
  content = content.replace(
    /export default function OrganizationsPage\(\) \{/,
    'export default function OrganizationsPage() {\n  const { toast } = useToast();'
  );
}

content = content.replace(/alert\((data\.error) \|\| (.*?)\);/g, 'toast($1?.message || typeof $1 === "string" ? $1 : ($1?.code || $2), "error");');
content = content.replace(/alert\((.*?)\);/g, 'toast($1, "error");');

fs.writeFileSync(pageFile, content);
console.log("Patched alerts in organizations page");
