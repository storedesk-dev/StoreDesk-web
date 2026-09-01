const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/admin/organizations/[orgId]/page.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace table headers for Store ID
content = content.replace(
  /<th className="px-8 py-5 font-semibold">Store ID<\/th>/,
  ''
);

content = content.replace(
  /<td className="px-8 py-5 font-mono text-\[11px\] text-gray-500">\{store\.storeId\}<\/td>/,
  ''
);

// Add Info tooltip to Store Name
content = content.replace(
  /<td className="px-8 py-5 font-medium text-gray-900">\{store\.name\}<\/td>/,
  `<td className="px-8 py-5 font-medium text-gray-900 flex items-center gap-2">
                            {store.name}
                            <div className="group relative flex items-center justify-center cursor-help" title={store.storeId}>
                              <div className="h-4 w-4 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-[10px] font-bold">i</div>
                            </div>
                          </td>`
);


// Replace Role Layout
const roleStart = content.indexOf('{/* Left Column: Role Selector & Roster */}');
const roleEnd = content.indexOf('{/* Right Column: Platform Tabs & Page/Feature Matrix */}');

if (roleStart > -1 && roleEnd > -1) {
  content = content.substring(0, roleStart) + content.substring(roleEnd);
  
  // Update the grid layout wrapper
  content = content.replace(
    /<div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-\[600px\] border-t border-gray-100">/,
    `<div className="flex flex-col min-h-[600px] border-t border-gray-100">`
  );
  
  // Update Right Column wrapper
  content = content.replace(
    /<div className="lg:col-span-8 bg-white border-l border-gray-100 flex flex-col min-h-\[600px\]">/,
    `<div className="bg-white flex flex-col min-h-[600px]">`
  );
  
  // Replace the Role Name header with a Dropdown
  const headerStart = content.indexOf('<div>\n                              <div className="flex items-center gap-2">\n                                <h4 className="text-lg font-bold text-gray-900">{activeRole.roleName}</h4>\n                                <code className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{activeRole.roleId}</code>\n                              </div>\n                            </div>');
  
  if (headerStart > -1) {
    const dropdownHtml = `<div>
                              <div className="flex items-center gap-3">
                                <label className="text-sm font-semibold text-gray-700">Role:</label>
                                <select 
                                  value={activeRole.roleId} 
                                  onChange={(e) => setSelectedRoleId(e.target.value)}
                                  className="form-select text-sm border-gray-300 rounded-lg shadow-sm font-medium py-2 pl-3 pr-10 focus:ring-[var(--sd-blue)] focus:border-[var(--sd-blue)]"
                                >
                                  {orgRoles.map(r => (
                                    <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                                  ))}
                                </select>
                              </div>
                            </div>`;
    content = content.substring(0, headerStart) + dropdownHtml + content.substring(headerStart + 438);
  }
}

fs.writeFileSync(file, content);
console.log('Patched layout');
