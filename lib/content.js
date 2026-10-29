// ETI Bingo square pool. Every card holds all 24 squares in a unique arrangement
// (center is the free yETI square), so every draw matters to every player.
//
// Each square has two questions: qs[0] is used the first time the square is drawn,
// qs[1] is the "second chance" question used when a missed square is drawn again.
// `a` is the index of the correct option in `options` (options are shuffled per draw).
//
// Sources: the 2026 celebration video project cards and team rosters, the 2027
// Enterprise Portfolio & Delivery plan, and the GDI brand list (Sept 2026).
// DRAFT: review every question before Nov 18. Server-side only; never shipped to phones.

export const SQUARES = [
  {
    id: 'varonis', label: 'Varonis MDDR',
    qs: [
      { q: 'What does Varonis MDDR give GDI?', options: ['Managed data detection and response', 'Mobile device deployment and repair', 'Marketing data dashboards and reports', 'Multi-site disaster recovery'], a: 0, fact: 'Varonis MDDR brought managed data detection and response enterprise-wide in 2026.' },
      { q: 'Who led the Varonis MDDR rollout?', options: ['Jason Stopar', 'Jim Hobold', 'Adam Ksheer', 'Bryan Wilson'], a: 0, fact: 'Jason Stopar led Varonis MDDR with Kevin Schnupp and Dwayne Banks.' },
    ],
  },
  {
    id: 'yeti', label: 'yETI',
    qs: [
      { q: 'What is yETI?', options: ['A governed AI assistant grounded in GDI knowledge', 'The new ETI ticket queue', 'A Smartsheet project template', 'The Freshservice chatbot vendor'], a: 0, fact: 'yETI is a governed AI assistant grounded in GDI knowledge, launched in 2026.' },
      { q: 'Who was the executive sponsor of yETI?', options: ['Soo-Jin Behrstock', 'Brian Perry', 'Bob Nash', 'Liz Townsend'], a: 0, fact: 'Soo-Jin Behrstock sponsored yETI; Jordan Yoerger led the build team.' },
    ],
  },
  {
    id: 'intranet', label: 'Enterprise Intranet',
    qs: [
      { q: 'The new GDI Enterprise Intranet is built on which platform?', options: ['SharePoint', 'Confluence', 'WordPress', 'Salesforce Experience Cloud'], a: 0, fact: 'One source for news, policy and self-service across every brand, built on SharePoint.' },
      { q: 'Who led the Enterprise Intranet project?', options: ["Matthew O'Donnell", 'Zach Halbert', 'John Kosh', 'Christina Barkovic'], a: 0, fact: "Matthew O'Donnell led the intranet build, with Christina Barkovic on change management." },
    ],
  },
  {
    id: 'callcenter', label: 'Call Center Optimization',
    qs: [
      { q: 'Call Center Optimization included an SMS program from which vendor?', options: ['Hatch', 'Twilio', 'Podium', 'Birdeye'], a: 0, fact: 'Speed-to-lead, the Hatch SMS program and the 2027 CCaaS selection.' },
      { q: 'Who led Call Center Optimization?', options: ['Pedro Guimaraes', 'Ben Liu', 'Bryan Wilson', 'Damian Ferrer'], a: 0, fact: 'Pedro Guimaraes led it with the Data & Intelligence team.' },
    ],
  },
  {
    id: 'webcp', label: 'WebCP 3055',
    qs: [
      { q: 'Which brand orders through WebCP?', options: ['Champion', 'Leafguard', 'Englert', 'Stanek Windows'], a: 0, fact: 'WebCP version 3055 added new catalog products for Champion ordering.' },
      { q: 'WebCP was upgraded to which version this year?', options: ['3055', '2026', '5030', '3.0'], a: 0, fact: 'WebCP 3055, led by Adam Ksheer and sponsored by Brian Perry.' },
    ],
  },
  {
    id: 'bc', label: 'Business Central',
    qs: [
      { q: 'Business Central is the new ERP for which brand first?', options: ['Leafguard', 'Champion', 'Patio Enclosures', 'Universal Windows Direct'], a: 0, fact: 'One guided application over a single job record for Leafguard.' },
      { q: 'Who led the Business Central project?', options: ['Gwenne Hanzel', 'Kristie Dunson', 'Casi Meginnis', 'Naziya Hashmi'], a: 0, fact: 'Gwenne Hanzel led Business Central for Leafguard.' },
    ],
  },
  {
    id: 'vendo', label: 'Vendo',
    qs: [
      { q: 'Vendo puts visualization, contracts and financing on what device for Champion sales?', options: ['iPad', 'Laptop', 'In-store kiosk', 'Android phone'], a: 0, fact: 'Digital visualization, contracts and financing on the iPad for Champion.' },
      { q: 'Who led the Vendo project?', options: ['Casi Meginnis', 'Gwenne Hanzel', 'Kristie Dunson', 'Jim Hobold'], a: 0, fact: 'Casi Meginnis led Vendo for Champion sales.' },
    ],
  },
  {
    id: 'lighthouse', label: 'Lighthouse',
    qs: [
      { q: 'Lighthouse consolidates GDI analytics on which platform?', options: ['Databricks', 'Snowflake', 'Tableau', 'Google BigQuery'], a: 0, fact: 'GDI analytics consolidated on Databricks, report by report.' },
      { q: 'Who led Lighthouse?', options: ['Bryan Wilson', 'Ben Liu', 'Pedro Guimaraes', 'Suhas Cherukuri'], a: 0, fact: 'Bryan Wilson led Lighthouse with a nine-person core team.' },
    ],
  },
  {
    id: 'leadhub', label: 'Lead Hub',
    qs: [
      { q: 'Which of these is NOT part of Lead Hub Phase 1?', options: ['Payroll processing', 'Lead dispositioning', 'Rep assignment', 'Consent tracking'], a: 0, fact: 'Lead Hub Phase 1: dispositioning, rep assignment, consent and a cross-brand customer view.' },
      { q: 'Lead Hub gives GDI what kind of customer view?', options: ['Cross-brand', 'Single-branch', 'Vendor-only', 'Paper-based'], a: 0, fact: 'A cross-brand customer view is one of the four pillars of Lead Hub Phase 1.' },
    ],
  },
  {
    id: 'folio', label: 'Folio 2.0',
    qs: [
      { q: 'Folio 2.0 and Salesforce go live together for Leafguard on what date?', options: ['February 1, 2027', 'January 1, 2027', 'November 18, 2026', 'April 1, 2027'], a: 0, fact: 'Folio 2.0 and Salesforce share one Leafguard go-live: February 1, 2027.' },
      { q: 'Who leads Folio?', options: ['Kristie Dunson', 'Zoltan Szoke', 'Gwenne Hanzel', 'Adam Ksheer'], a: 0, fact: 'Kristie Dunson leads Folio 2.0, guided selling and CPQ for the field.' },
    ],
  },
  {
    id: 'salesforce', label: 'Salesforce',
    qs: [
      { q: 'Which brand goes first on Salesforce?', options: ['Leafguard', 'Champion', 'Englert', 'Stanek Windows'], a: 0, fact: 'Salesforce is the enterprise CRM for lead intake and appointments, Leafguard first.' },
      { q: 'By the end of 2027, the plan is one CRM for how many GDI brands?', options: ['All six', 'Two', 'Four', 'Ten'], a: 0, fact: 'The 2027 plan: one CRM for all six brands by the end of the year.' },
    ],
  },
  {
    id: 'five9', label: 'Five9',
    qs: [
      { q: 'What kind of platform is Five9?', options: ['Contact center (CCaaS)', 'Accounting (ERP)', 'Design and CAD', 'Payroll and HR'], a: 0, fact: 'Five9 is one contact-center platform for every brand.' },
      { q: 'Five9 went live first for which brand?', options: ['Universal Windows Direct', 'Leafguard', 'Champion', 'Patio Enclosures'], a: 0, fact: 'Five9 is live for Universal Windows Direct, with more brands to follow.' },
    ],
  },
  {
    id: 'm365', label: 'Microsoft 365',
    qs: [
      { q: 'Finish the Microsoft 365 goal: "One tenant, one identity, ___ everywhere."', options: ['MFA', 'VPN', 'Wi-Fi', 'Teams'], a: 0, fact: 'Microsoft 365: one tenant, one identity, MFA everywhere.' },
      { q: 'What does MFA stand for?', options: ['Multi-factor authentication', 'Managed file access', 'Microsoft federated account', 'Mobile first application'], a: 0, fact: 'Multi-factor authentication: a second proof that it is really you.' },
    ],
  },
  {
    id: 'freshservice', label: 'Freshservice',
    qs: [
      { q: 'Freshservice was rebuilt around which best-practice framework?', options: ['ITIL', 'PMBOK', 'Six Sigma', 'Scrum'], a: 0, fact: 'The Service Desk was rebuilt in Freshservice around ITIL best practice.' },
      { q: 'Who leads the Freshservice project?', options: ['Jim Hobold', 'Jesus Rodriguez', 'Joe Ebner', 'Justin Eaton'], a: 0, fact: 'Jim Hobold leads Freshservice, with the largest team of any ETI project.' },
    ],
  },
  {
    id: 'win11', label: 'Windows 11',
    qs: [
      { q: 'The Windows 11 project moves every supported endpoint off which version?', options: ['Windows 10', 'Windows 8.1', 'Windows 7', 'Windows XP'], a: 0, fact: 'Every supported endpoint moved off Windows 10.' },
      { q: 'Windows 11 runs on which part of the environment?', options: ['Endpoints (laptops and desktops)', 'Network switches', 'Phone lines', 'Printers'], a: 0, fact: 'Endpoints are the laptops and desktops people use every day.' },
    ],
  },
  {
    id: 'ninjaone', label: 'NinjaOne',
    qs: [
      { q: 'What did NinjaOne standardize for GDI?', options: ['Endpoint visibility, patching and remote support', 'Lead routing and dispositioning', 'Payroll and time off', 'Website hosting'], a: 0, fact: 'NinjaOne: one standard for endpoint visibility, patching and remote support.' },
      { q: 'NinjaOne is what kind of tool?', options: ['Device management', 'Video conferencing', 'E-signature', 'Graphic design'], a: 0, fact: 'NinjaOne is device management for every endpoint across the enterprise.' },
    ],
  },
  {
    id: 'magic', label: 'Sunsetting Magic',
    qs: [
      { q: 'The Magic server retired at Champion dates back to which era?', options: ['Windows 95', 'Windows 11', 'Windows Vista', 'Windows 8'], a: 0, fact: 'A Windows 95-era server, finally retired.' },
      { q: 'The Magic server was retired into which system?', options: ['WebCP', 'Salesforce', 'Business Central', 'Freshservice'], a: 0, fact: 'Magic was retired into WebCP for Champion.' },
    ],
  },
  {
    id: 'costco', label: 'Costco Program',
    qs: [
      { q: 'The Costco Program is for which GDI brand?', options: ['Leafguard', 'Champion', 'Stanek Windows', 'Englert'], a: 0, fact: 'The Costco Program connects Costco leads to Leafguard.' },
      { q: 'Which e-signature tool is part of the Costco Program?', options: ['DocuSign', 'Adobe Sign', 'PandaDoc', 'HelloSign'], a: 0, fact: 'Centah integration, WinGen scheduling, the Costco relay and DocuSign.' },
    ],
  },
  {
    id: 'etitools', label: 'ETI Tools',
    qs: [
      { q: 'Capacity Log, the Budget App and Resource Hub were built how?', options: ['In-house by ETI', 'Bought from Smartsheet', 'Outsourced to a consultant', 'Part of Microsoft 365'], a: 0, fact: 'The ETI Tools site and its apps were built in-house.' },
      { q: 'What does the ETI Capacity Log track?', options: ['Project time', 'Vacation balances', 'Printer usage', 'Lead volume'], a: 0, fact: 'Auditable project time for the whole ETI organization.' },
    ],
  },
  {
    id: 'adobe', label: 'Adobe',
    qs: [
      { q: 'The Adobe project consolidated GDI into how many enterprise tenants?', options: ['One', 'Two', 'Six', 'One per brand'], a: 0, fact: 'One enterprise Adobe tenant with SSO and provisioning.' },
      { q: 'Besides one tenant, the Adobe project added single sign-on and what?', options: ['Provisioning', 'Free stock photos', 'Printed manuals', 'A new logo'], a: 0, fact: 'SSO plus provisioning: access follows the person, not the license spreadsheet.' },
    ],
  },
  {
    id: 'd365', label: 'Dynamics 365 F&O',
    qs: [
      { q: 'The Dynamics 365 F&O project is at which plant?', options: ['Cincinnati', 'Walton Hills', 'Pittsburgh', 'Chicago'], a: 0, fact: 'Counting, receiving and procure-to-pay in D365, with scanners on the floor.' },
      { q: 'Who leads Dynamics 365 F&O?', options: ['Adam Ksheer', 'Gwenne Hanzel', 'Zoltan Szoke', 'Jim Hobold'], a: 0, fact: 'Adam Ksheer leads Dynamics 365 F&O for the Cincinnati plant.' },
    ],
  },
  {
    id: 'brands', label: 'GDI Brands',
    qs: [
      { q: 'How many brands are in the GDI family today?', options: ['Six', 'Four', 'Eight', 'Ten'], a: 0, fact: 'Patio Enclosures, Stanek Windows, Universal Windows Direct, Champion, Leafguard and Englert.' },
      { q: 'Which of these is a GDI brand?', options: ['Englert', 'Andersen', 'Pella', 'Marvin'], a: 0, fact: 'Englert joins Patio Enclosures, Stanek, UWD, Champion and Leafguard in the GDI family.' },
    ],
  },
  {
    id: 'eti', label: 'ETI',
    qs: [
      { q: 'What does ETI stand for?', options: ['Enterprise Technology & Intelligence', 'Enterprise Technology & Innovation', 'Engineering, Technology & IT', 'Enterprise Tools & Infrastructure'], a: 0, fact: 'Enterprise Technology & Intelligence. Never "Innovation."' },
      { q: "What is Soo-Jin Behrstock's title?", options: ['Chief Technology and Information Officer', 'Chief Financial Officer', 'VP of IT', 'Chief Marketing Officer'], a: 0, fact: 'Soo-Jin Behrstock is GDI\'s Chief Technology and Information Officer.' },
    ],
  },
  {
    id: 'copilot', label: 'Copilot',
    qs: [
      { q: 'The 2027 goal is every GDI employee on at least which version of Copilot?', options: ['The free version', 'Copilot Pro', 'GitHub Copilot', 'Copilot Studio'], a: 0, fact: 'Every employee on at least the free version of Copilot in 2027.' },
      { q: 'Microsoft Copilot is built into which suite GDI uses every day?', options: ['Microsoft 365', 'Google Workspace', 'Adobe Creative Cloud', 'Salesforce'], a: 0, fact: 'Copilot Chat comes with Microsoft 365, so everyone can start today.' },
    ],
  },
];

if (SQUARES.length !== 24) throw new Error('ETI Bingo needs exactly 24 squares, found ' + SQUARES.length);

// Tile text for the 5x5 card: soft hyphens (­) mark where long words may break.
const TILES = {
  callcenter: 'Call Center Opti­mization', magic: 'Sunset­ting Magic', freshservice: 'Fresh­service',
  lighthouse: 'Light­house', intranet: 'Enter­prise Intranet', m365: 'Micro­soft 365',
  salesforce: 'Sales­force', d365: 'Dyna­mics 365 F&O', costco: 'Costco Program', bc: 'Business Central',
};
for (const s of SQUARES) s.tile = TILES[s.id] || s.label;
