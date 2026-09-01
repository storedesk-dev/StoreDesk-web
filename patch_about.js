const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/about/AboutClient.tsx');
let content = fs.readFileSync(file, 'utf8');

const oldText = `<p className="mt-4 text-[var(--muted)] leading-relaxed">
              Created by the StoreDesk team, StoreDesk runs on your store computer with a desktop dashboard for management and a fast mobile app for floor staff — keeping all your pricing data fast, local, and accurate.
            </p>`;

const newText = `<p className="mt-4 text-[var(--muted)] leading-relaxed">
              The journey started out of real frustration. While managing a high-volume convenience store, our founder Trupal Patel spent countless hours every week trying to manually reconcile shifting wholesale costs from multiple vendors, calculate true profit margins, and keep the register accurately updated.
            </p>
            <p className="mt-4 text-[var(--muted)] leading-relaxed">
              We realized there had to be a way to simplify this problem and eliminate the guesswork. Created by the StoreDesk team, StoreDesk runs directly on your store computer with a powerful desktop dashboard for management and a fast mobile app for floor staff — keeping all your pricing data fast, local, and accurate.
            </p>`;

content = content.replace(oldText, newText);

fs.writeFileSync(file, content);
console.log('Patched AboutClient.tsx');
