import { DOCS } from "@/lib/site";

/**
 * The four apps, one entry each: the overview at /product and the pages under it read from here.
 *
 * Every line is checked against the app it describes (store-desk-electron, store-desk-mobile,
 * store-desk-server, store-desk-lottery) and the user guide. "Not built yet" lists only work that is
 * actually planned, and says plainly what is not done.
 */

export type ProductKey = "desktop" | "mobile" | "service" | "lottery";

export type ProductEntry = {
  key: ProductKey;
  name: string;
  href: string;
  /** One line: what it is. */
  line: string;
  who: string;
  jobs: readonly string[];
  connects: readonly string[];
  needs: readonly string[];
  notYet: readonly string[];
  guide: string;
};

export const PRODUCTS: Record<ProductKey, ProductEntry> = {
  desktop: {
    key: "desktop",
    name: "StoreDesk Desktop",
    href: "/product/desktop",
    line: "The back office, on the Windows PC in your store.",
    who: "The owner and managers. Each person sees only the screens their role allows.",
    jobs: [
      "Dashboard: today's sales, tax, fuel and cash expected.",
      "Price book: every PLU from the register. Search, edit an item, add one, change a group together.",
      "Supplier costs: each supplier's price per unit, cheapest first, with the margin.",
      "Register changes: send an item change to the register. Checked first, read back after.",
      "Sales: daily, shift and monthly reports, single transactions, each item's sales history.",
      "Fuel: grades, pump prices and what each grade sold.",
      "Deals: the multi-buys running on your register.",
      "Sales tax: the Georgia ST-3 worked out, as a file you upload yourself.",
      "Google Sheet: daily sales written to a sheet you own.",
      "Users and roles: staff accounts, and which screens each role opens.",
      "Lottery: the days StoreDesk Lottery sent, if the store runs it."
    ],
    connects: ["Talks to StoreDesk Service on the same PC.", "Needs no internet to run the store."],
    needs: ["Windows 10 or later.", "Comes with StoreDesk Service, in one installer.", "One licence per store."],
    notYet: [
      "Sending deal and fuel price changes to the register. Change them on the register for now.",
      "Supplier invoices by EDI, so costs arrive without typing. Planned."
    ],
    guide: DOCS.desktop
  },
  mobile: {
    key: "mobile",
    name: "StoreDesk Mobile",
    href: "/product/mobile",
    line: "Prices, sales and scanning on an Android phone, in the aisle or away from the store. iPhone coming soon.",
    who: "Staff on the shop floor, and the owner away from the store.",
    jobs: [
      "Scan a barcode: shelf price, what you paid, margin and the cheapest supplier.",
      "Search the price book and open any item.",
      "Today's sales and analytics from the register.",
      "Transactions, line by line, with tax and payment.",
      "Fuel prices, deals, reports and the sales tax figures.",
      "Save an item change and send it, if your role allows."
    ],
    connects: [
      "Reaches StoreDesk Service on the store PC through a secure tunnel.",
      "On the store Wi-Fi it can connect directly, once an admin turns on local network access.",
      "Each person signs in with the org tag and the sign-in their manager gives them. There is no sign-up on this website."
    ],
    needs: ["Android 5.0 or later, from Google Play.", "The internet, when away from the store."],
    notYet: ["The iPhone app: coming soon on the App Store.", "Lottery screens on the phone."],
    guide: DOCS.mobile
  },
  service: {
    key: "service",
    name: "StoreDesk Service",
    href: "/product/service",
    line: "The background program on the store PC. It keeps your data and talks to the register.",
    who: "Nobody uses it directly. You install it once, and StoreDesk Desktop shows that it is running.",
    jobs: [
      "Keeps the price book, costs and sales history in one database on the store PC.",
      "Reads the Verifone Commander over the store network: PLUs, reports and transactions.",
      "Sends an item change to the register only when a person sends it.",
      "Checks sign-ins on the PC, so staff can sign in with the internet down.",
      "Serves StoreDesk Desktop and StoreDesk Mobile, and takes in the days StoreDesk Lottery sends.",
      "Writes the daily Google Sheet, and catches up on days it missed.",
      "Starts by itself after a restart, and keeps the PC from sleeping.",
      "Backs up its database on the PC before each update."
    ],
    connects: [
      "Your store's database stays on this PC.",
      "Your StoreDesk account holds only the store, its licence, its PC and its people."
    ],
    needs: [
      "A Windows 10 or later PC in the back office, left on.",
      "That PC must reach the Verifone Commander on the store network.",
      "A setup key, emailed when we set up your store.",
      "One licence per store, covering one store PC."
    ],
    notYet: ["Sending deals and fuel prices, once tested on a real register."],
    guide: DOCS.service
  },
  lottery: {
    key: "lottery",
    name: "StoreDesk Lottery",
    href: "/product/lottery",
    line: "The instant-ticket rack and the shift close, on the lottery counter PC.",
    who: "Clerks close the shift. Owners and managers check reports, correct days and set up the rack.",
    jobs: [
      "Rack: every box, what is in it, and how far through each pack is.",
      "Receive packs by scanning each one into stock.",
      "Put a pack out in a box, from stock or straight off the truck.",
      "Close a shift by scanning the ticket showing in each box.",
      "Correct a closed day. Each correction is a new version with a reason.",
      "Settle the packs that are due, in one click.",
      "Shift report with Print, a daily report, and what to order."
    ],
    connects: [
      "Runs on its own, with its own installer and database.",
      "With StoreDesk, each closed day's lottery cash goes to StoreDesk Service. Packs and games stay on the lottery PC."
    ],
    needs: [
      "A Windows PC at the lottery counter: the store PC or another.",
      "A barcode scanner.",
      "Georgia Lottery instant tickets.",
      "A StoreDesk sign-in for each person."
    ],
    notYet: ["Shift reports by email. Coming soon."],
    guide: DOCS.lottery
  }
};

export const PRODUCT_ORDER: ProductKey[] = ["desktop", "mobile", "service", "lottery"];
