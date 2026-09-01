const fs = require('fs');
const path = require('path');

const productFile = path.join(__dirname, 'src/app/product/ProductClient.tsx');
let productContent = fs.readFileSync(productFile, 'utf8');
productContent = productContent.replace(
  /<MarketingShell title="Product Everything at the counter built for real store operations">/,
  '<MarketingShell title="Everything at the counter built for real store operations">'
);
fs.writeFileSync(productFile, productContent);

const howItWorksFile = path.join(__dirname, 'src/app/how-it-works/HowItWorksClient.tsx');
let howItWorksContent = fs.readFileSync(howItWorksFile, 'utf8');
howItWorksContent = howItWorksContent.replace(
  /<MarketingShell title="How it works How StoreDesk powers your store">/,
  '<MarketingShell title="How StoreDesk powers your store">'
);
fs.writeFileSync(howItWorksFile, howItWorksContent);

const aboutFile = path.join(__dirname, 'src/app/about/AboutClient.tsx');
let aboutContent = fs.readFileSync(aboutFile, 'utf8');
aboutContent = aboutContent.replace(
  /<MarketingShell title="About Why we built StoreDesk for convenience store operators">/,
  '<MarketingShell title="Why we built StoreDesk for convenience store operators">'
);
fs.writeFileSync(aboutFile, aboutContent);

console.log("Patched UI titles correctly");
