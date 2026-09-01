const fs = require('fs');
const path = require('path');

const pageFile = path.join(__dirname, 'src/app/admin/organizations/[orgId]/page.tsx');
let content = fs.readFileSync(pageFile, 'utf8');

// The original handleCreateUser has:
// const handleCreateUser = async (e: React.FormEvent) => {
//   e.preventDefault();
//   setCreateUserBusy(true);
//   try {

content = content.replace(
  /const handleCreateUser = async \(e: React\.FormEvent\) => \{\n\s*e\.preventDefault\(\);\n\s*setCreateUserBusy\(true\);\n\s*try \{/,
  `const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserPassword.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    if (!/\\d/.test(newUserPassword)) {
      toast("Password must include a number", "error");
      return;
    }
    setCreateUserBusy(true);
    try {`
);

fs.writeFileSync(pageFile, content);
console.log("Patched client side validation");
