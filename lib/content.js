// ETI Bingo square pool: 36 squares, each card holds 24 of them (center is the free yETI square).
// Simulated with 70 players: first line ~draw 9, two lines ~draw 16, first full card ~draw 32.
//
// label   = name on the big screen when drawn
// tile    = text on the 5x5 card; soft hyphens (­) mark where long words may break
// caption = one line shown under the drawn square on the big screen
//
// Mix: 22 projects (shipped in 2026, in flight and 2027) and 14 "ETI life" squares for laughs.
// Sources: the 2026 celebration video project cards and the 2027 Enterprise Portfolio & Delivery plan.
// Captions are DRAFT: review before Nov 18.

export const SQUARES = [
  // Shipped in 2026
  { id: 'varonis', label: 'Varonis MDDR', caption: 'Managed data detection and response, enterprise-wide.' },
  { id: 'ninjaone', label: 'NinjaOne', caption: 'One standard for endpoint visibility, patching and remote support.' },
  { id: 'yeti', label: 'yETI', caption: 'A governed AI assistant grounded in GDI knowledge.' },
  { id: 'intranet', label: 'Enterprise Intranet', tile: 'Enter­prise Intranet', caption: 'One source for news, policy and self-service across every brand.' },
  { id: 'callcenter', label: 'Call Center Optimization', tile: 'Call Center Opti­mization', caption: 'Speed-to-lead, the Hatch SMS program and the 2027 CCaaS selection.' },
  { id: 'etitools', label: 'ETI Tools', caption: 'Capacity Log, Budget App and Resource Hub, built in-house.' },
  { id: 'bc', label: 'Business Central', caption: 'One guided application over a single job record for Leafguard.' },
  { id: 'vendo', label: 'Vendo', caption: 'Visualization, contracts and financing on the iPad for Champion.' },
  { id: 'lighthouse', label: 'Lighthouse', tile: 'Light­house', caption: 'GDI analytics consolidated on Databricks, report by report.' },
  { id: 'leadhub', label: 'Lead Hub', caption: 'Dispositioning, rep assignment, consent and a cross-brand customer view.' },
  { id: 'folio', label: 'Folio 2.0', caption: 'Guided selling and CPQ for Leafguard, Sunrooms and the enterprise.' },
  { id: 'costco', label: 'Costco Program', caption: 'Centah integration, WinGen scheduling, the Costco relay and DocuSign.' },
  { id: 'magic', label: 'Sunsetting Magic', tile: 'Sunset­ting Magic', caption: 'The Windows 95-era Magic server, retired into WebCP.' },
  { id: 'lakehouse', label: 'Data Lakehouse', tile: 'Data Lake­house', caption: 'New sources ingested, conformed and published into the GDI lakehouse.' },
  // In flight and 2027
  { id: 'salesforce', label: 'Salesforce', tile: 'Sales­force', caption: 'The enterprise CRM for lead intake and appointments, Leafguard first.' },
  { id: 'golive', label: 'Feb 1 Go-Live', caption: 'Salesforce and Folio 2.0 go live together for Leafguard on Feb 1, 2027.' },
  { id: 'five9', label: 'Five9', caption: 'One contact-center platform for every brand.' },
  { id: 'm365', label: 'Microsoft 365', tile: 'Micro­soft 365', caption: 'One tenant, one identity, MFA everywhere.' },
  { id: 'freshservice', label: 'Freshservice', tile: 'Fresh­service', caption: 'The Service Desk, rebuilt around ITIL best practice.' },
  { id: 'win11', label: 'Windows 11', caption: 'Every supported endpoint moved off Windows 10.' },
  { id: 'compass', label: 'Technology Compass', tile: 'Tech­nology Com­pass', caption: 'Portfolio value in one place, live in 2027.' },
  { id: 'copilot', label: 'Copilot', caption: 'Every GDI employee on at least the free version of Copilot in 2027.' },
  // ETI life
  { id: 'hours', label: 'Did you enter your hours?', caption: 'Friday, 4:59 PM. You know who you are.' },
  { id: 'charter', label: 'Where is the charter?', caption: 'Asked at every kickoff since the PMO was founded.' },
  { id: 'pcms', label: 'PCMS is down', caption: 'Have you tried refreshing? Have you tried refreshing again?' },
  { id: 'mute', label: "You're on mute", caption: 'Still the most-said sentence in ETI.' },
  { id: 'screen', label: 'Can you see my screen?', caption: 'We can see your inbox. All of it.' },
  { id: 'ticket', label: 'Did you put in a ticket?', caption: "If it's not in Freshservice, it didn't happen." },
  { id: 'restart', label: 'Did you restart it?', caption: 'Off and on again. It works more often than we admit.' },
  { id: 'offline', label: "Let's take this offline", caption: 'Where one meeting becomes three more meetings.' },
  { id: 'smartsheet', label: 'Is it in Smartsheet?', tile: 'Is it in Smart­sheet?', caption: "If it's not in the plan, it's not happening." },
  { id: 'scope', label: 'Is that in scope?', caption: 'Great idea. Phase 2.' },
  { id: 'capex', label: 'CapEx or OpEx?', caption: 'Ask Finance. Then ask Finance again.' },
  { id: 'mfa', label: 'Approve the MFA prompt', caption: "Your phone just buzzed. Yes, it's really us." },
  { id: 'hardstop', label: 'I have a hard stop', caption: 'Said at minute 58 of a 30-minute meeting.' },
  { id: 'replyall', label: 'Reply-all storm', caption: 'Four hundred replies, all saying "please remove me from this list."' },
];

for (const s of SQUARES) s.tile = s.tile || s.label;
if (SQUARES.length !== 36) throw new Error('ETI Bingo expects 36 squares, found ' + SQUARES.length);
if (new Set(SQUARES.map((s) => s.id)).size !== SQUARES.length) throw new Error('Duplicate square id');
