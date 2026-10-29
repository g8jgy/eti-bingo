// ETI Bingo square pool: 36 squares, each card holds 24 of them (center is the free yETI square).
// Simulated with 70 players: first line ~draw 9, two lines ~draw 16, first full card ~draw 32.
//
// label   = name on the big screen when drawn
// tile    = text on the 5x5 card; soft hyphens (­) mark where long words may break
// caption = one line shown under the drawn square on the big screen
//
// Sources: the 2026 celebration video project cards, the 2027 Enterprise Portfolio & Delivery plan,
// and the GDI brand list (Sept 2026). Captions are DRAFT: review before Nov 18.

export const SQUARES = [
  // Shipped in 2026
  { id: 'varonis', label: 'Varonis MDDR', caption: 'Managed data detection and response, enterprise-wide.' },
  { id: 'ninjaone', label: 'NinjaOne', caption: 'One standard for endpoint visibility, patching and remote support.' },
  { id: 'yeti', label: 'yETI', caption: 'A governed AI assistant grounded in GDI knowledge.' },
  { id: 'intranet', label: 'Enterprise Intranet', tile: 'Enter­prise Intranet', caption: 'One source for news, policy and self-service across every brand.' },
  { id: 'callcenter', label: 'Call Center Optimization', tile: 'Call Center Opti­mization', caption: 'Speed-to-lead, the Hatch SMS program and the 2027 CCaaS selection.' },
  { id: 'webcp', label: 'WebCP 3055', caption: 'Version 3055 plus new catalog products for Champion ordering.' },
  { id: 'etitools', label: 'ETI Tools', caption: 'Capacity Log, Budget App and Resource Hub, built in-house.' },
  { id: 'bc', label: 'Business Central', caption: 'One guided application over a single job record for Leafguard.' },
  { id: 'vendo', label: 'Vendo', caption: 'Visualization, contracts and financing on the iPad for Champion.' },
  { id: 'lighthouse', label: 'Lighthouse', tile: 'Light­house', caption: 'GDI analytics consolidated on Databricks, report by report.' },
  { id: 'leadhub', label: 'Lead Hub', caption: 'Dispositioning, rep assignment, consent and a cross-brand customer view.' },
  { id: 'folio', label: 'Folio 2.0', caption: 'Guided selling and CPQ for Leafguard, Sunrooms and the enterprise.' },
  { id: 'costco', label: 'Costco Program', caption: 'Centah integration, WinGen scheduling, the Costco relay and DocuSign.' },
  { id: 'magic', label: 'Sunsetting Magic', tile: 'Sunset­ting Magic', caption: 'The Windows 95-era Magic server, retired into WebCP.' },
  { id: 'lakehouse', label: 'Data Lakehouse', tile: 'Data Lake­house', caption: 'New sources ingested, conformed and published into the GDI lakehouse.' },
  { id: 'martech', label: 'Martech Platform', tile: 'Martech Plat­form', caption: 'The shared enterprise web platform, measurement and conversion tooling.' },
  { id: 'adobe', label: 'Adobe', caption: 'One enterprise Adobe tenant with SSO and provisioning.' },
  // In flight and 2027
  { id: 'salesforce', label: 'Salesforce', tile: 'Sales­force', caption: 'The enterprise CRM for lead intake and appointments, Leafguard first.' },
  { id: 'golive', label: 'Feb 1 Go-Live', caption: 'Salesforce and Folio 2.0 go live together for Leafguard on Feb 1, 2027.' },
  { id: 'five9', label: 'Five9', caption: 'One contact-center platform for every brand.' },
  { id: 'm365', label: 'Microsoft 365', tile: 'Micro­soft 365', caption: 'One tenant, one identity, MFA everywhere.' },
  { id: 'freshservice', label: 'Freshservice', tile: 'Fresh­service', caption: 'The Service Desk, rebuilt around ITIL best practice.' },
  { id: 'win11', label: 'Windows 11', caption: 'Every supported endpoint moved off Windows 10.' },
  { id: 'd365', label: 'Dynamics 365 F&O', tile: 'Dyna­mics 365 F&O', caption: 'Counting, receiving and procure-to-pay at the Cincinnati plant.' },
  { id: 'waltonhills', label: 'Walton Hills COE', caption: 'Plant-wide Wi-Fi, mobile workstations and FeneVision optimization.' },
  { id: 'printers', label: 'Printer Consolidation', tile: 'Printer Consoli­dation', caption: 'One vendor, one contract and a right-sized fleet across every location.' },
  { id: 'itam', label: 'IT Asset Inventory', caption: 'A full reconciliation of every IT asset in the enterprise.' },
  { id: 'infor', label: 'Infor Multi-Site', caption: 'Multi-site manufacturing on Infor.' },
  { id: 'compass', label: 'Technology Compass', tile: 'Tech­nology Compass', caption: 'Portfolio value in one place, live in 2027.' },
  { id: 'copilot', label: 'Copilot', caption: 'Every GDI employee on at least the free version of Copilot in 2027.' },
  // The GDI family
  { id: 'leafguard', label: 'Leafguard', tile: 'Leaf­guard', caption: 'Part of the GDI family of brands.' },
  { id: 'champion', label: 'Champion', caption: 'Part of the GDI family of brands.' },
  { id: 'englert', label: 'Englert', caption: 'Part of the GDI family of brands.' },
  { id: 'stanek', label: 'Stanek Windows', caption: 'Part of the GDI family of brands.' },
  { id: 'patio', label: 'Patio Enclosures', tile: 'Patio Enclo­sures', caption: 'Part of the GDI family of brands.' },
  { id: 'uwd', label: 'Universal Windows Direct', tile: 'Universal Windows Direct', caption: 'Part of the GDI family of brands.' },
];

for (const s of SQUARES) s.tile = s.tile || s.label;
if (SQUARES.length !== 36) throw new Error('ETI Bingo expects 36 squares, found ' + SQUARES.length);
if (new Set(SQUARES.map((s) => s.id)).size !== SQUARES.length) throw new Error('Duplicate square id');
