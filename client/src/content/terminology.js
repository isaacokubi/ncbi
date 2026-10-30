export const NAVIGATION_TERMS = Object.freeze({
  dashboard: 'Leadership overview', registrations: 'Registration authorisations', organisations: 'Governance and branch structure', users: 'System users and access', audit: 'Governance audit trail', memberPortal: 'Congregational member portal', security: 'Account security',
  members: 'Congregational membership', visitors: 'First-time guests and visitors', visitorFollowup: 'Guest welcome and follow-up', attendance: 'Worship service attendance', departments: 'Ministry department coordination',
  events: 'Church events and programmes', pastoral: 'Pastoral care and congregational support', missions: 'Mission and community outreach', discipleship: 'Discipleship and leadership development', services: 'Worship and service planning', leadership: 'Leadership and people administration',
  finance: 'Financial stewardship and administration', payments: 'M-Pesa collection requests', accounts: 'Chart of accounts', journals: 'General ledger and journals', budgets: 'Ministry and operational budgeting', reconciliation: 'Bank reconciliation', suppliers: 'Supplier and procurement management', reports: 'Management reports and performance insights',
  assets: 'Asset stewardship and property', projects: 'Church projects and development', documents: 'Institutional records and documents', announcements: 'Church communications', eventRegistrations: 'Programme registrations', sermons: 'Sermons and teaching resources', churchPlants: 'Church planting', sponsorships: 'Ministry sponsorships', pledges: 'Giving commitments', ministryReports: 'Ministry performance reports', welfare: 'Member welfare follow-up', discipline: 'Restricted pastoral conduct cases', counselling: 'Confidential counselling cases', safeguarding: 'Child safeguarding and consent', memberEnrolments: 'Member programme applications', memberNotifications: 'Member communications', volunteers: 'Volunteer coordination', training: 'Leadership and ministry training', property: 'Property administration', prayer: 'Prayer and pastoral follow-up', children: 'Children’s ministry', youth: 'Youth ministry', family: 'Family ministry', groups: 'Fellowship groups', sacraments: 'Baptisms and ceremonies', weddings: 'Marriage ceremonies', funerals: 'Funeral and memorial services', benevolence: 'Welfare assistance', facilities: 'Facilities and venue bookings', inventory: 'Inventory stewardship', procurement: 'Purchasing and procurement', communications: 'Communications planning', media: 'Media ministry', transport: 'Church transport', compliance: 'Governance and compliance', classes: 'Membership and discipleship classes', volunteerSchedule: 'Ministry service rosters'
});

export const ROLE_PRESENTATION = Object.freeze({
  super_admin: { title: 'Platform and governance administration', heading: 'International platform overview', description: 'Review authorised activity, governance and administration across the NCBI church network.' },
  international_executive: { title: 'International executive overview', heading: 'International ministry overview', description: 'Review church growth, leadership activity and stewardship across NCBI’s authorised international structure.' },
  national_admin: { title: 'National church administration', heading: 'National ministry overview', description: 'Coordinate national operations and review ministry activity across the church units within your reporting authority.' },
  regional_overseer: { title: 'Regional ministry oversight', heading: 'Regional leadership overview', description: 'Review congregational life, ministry activity and programme delivery across your region and its subordinate church units.' },
  district_pastor: { title: 'District leadership and coordination', heading: 'District ministry overview', description: 'Support congregations across your district through informed oversight of membership, attendance and ministry programmes.' },
  branch_pastor: { title: 'Branch administration and congregational life', heading: 'Congregational leadership overview', description: 'Lead your congregation with a clear view of membership, guest welcome, worship attendance and upcoming ministry programmes.' },
  branch_admin: { title: 'Branch administration and congregational life', heading: 'Branch operations overview', description: 'Coordinate local administration, membership services, guest follow-up, worship attendance and programme delivery.' },
  treasurer: { title: 'Financial stewardship and administration', heading: 'Financial stewardship overview', description: 'Oversee confirmed income and expenditure within your authorised church scope. Pending requests are excluded from completed financial totals.' },
  department_leader: { title: 'Ministry department coordination', heading: 'Ministry leadership overview', description: 'Coordinate your assigned ministry and review the attendance and operational information available to your role.' }
});

export const ROLE_LABELS = Object.freeze({
  super_admin: 'Platform Administrator', international_executive: 'International Executive', national_admin: 'National Administrator',
  regional_overseer: 'Regional Overseer', district_pastor: 'District Pastor', branch_pastor: 'Branch Pastor',
  branch_admin: 'Branch Administrator', treasurer: 'Treasurer', department_leader: 'Ministry Department Leader', member: 'Congregational Member'
});

export const MODULE_PRESENTATION = Object.freeze({
  branding: { title: 'NCBI visual identity', description: 'Maintain the official emblem used across the public website and authenticated workspaces.' },
  websiteContent: { title: 'Public website content', description: 'Edit and publish approved public-page copy, navigation labels and programme introductions.' },
  registrations: { title: 'Registration authorisations', description: 'Review membership, visitor and church-official applications within your delegated organisational authority.' },
  organisations: { title: 'Governance and branch structure', description: 'Maintain the international, national, regional, district and local branch structure within your authority.' },
  users: { title: 'System users and access administration', description: 'Provision and administer accounts within your organisational scope and role-authorisation limits.' },
  audit: { title: 'Governance and security audit trail', description: 'Review recorded administrative and security events within your authorised organisational scope.' },
  members: { title: 'Congregational membership', description: 'Maintain an accurate congregational register, including member identity, household, status, branch affiliation and participation in church life.' },
  visitors: { title: 'First-time guests and visitors', description: 'Welcome guests, record their visit and coordinate a respectful, timely connection with the local church.' },
  attendance: { title: 'Worship service attendance', description: 'Record and review participation in worship services, ministry gatherings and church programmes.' },
  departments: { title: 'Ministry department coordination', description: 'Coordinate ministry teams, leadership responsibilities, departmental activity and resources across the NCBI church network.' },
  events: { title: 'Church events and programmes', description: 'Plan church gatherings, coordinate participants and teams, and maintain a clear programme record.' },
  pastoral: { title: 'Pastoral care and congregational support', description: 'Coordinate pastoral follow-up, prayer, member welfare and confidential care within approved access boundaries.' },
  missions: { title: 'Mission and community outreach', description: 'Coordinate evangelism, mission activity, outreach teams and church-planting progress.' },
  discipleship: { title: 'Discipleship and leadership development', description: 'Coordinate learning programmes, discipleship pathways and ministerial development.' },
  services: { title: 'Worship and service planning', description: 'Prepare worship services, assign ministry teams and maintain the order of service.' },
  leadership: { title: 'Leadership and people administration', description: 'Maintain leadership appointments, responsibilities, development and service history within your authority.' },
  finance: { title: 'Financial stewardship and administration', description: 'Record church income and expenditure with accountable review, authorisation, confirmation and ledger posting.' },
  payments: { title: 'M-Pesa collection requests', description: 'Initiate payment requests and review their provider-confirmed status. A request is not recorded as received income until verified.' },
  accounts: { title: 'Chart of accounts', description: 'Maintain the organisation’s account classifications used to record and report financial activity.' },
  journals: { title: 'General ledger and journal entries', description: 'Submit balanced double-entry journals for independent review and posting to the general ledger.' },
  budgets: { title: 'Ministry and operational budgeting', description: 'Prepare annual or periodic allocations against expense accounts and route proposals for independent authorisation.' },
  suppliers: { title: 'Suppliers and accounts payable', description: 'Maintain supplier records, authorise purchase requests, review supplier invoices and record verified payments with ledger controls.' },
  reconciliation: { title: 'Bank reconciliation', description: 'Compare statement balances with posted ledger activity and record the outcome of an authorised reconciliation.' },
  reports: { title: 'Management reports and performance insights', description: 'Review scope-aware church activity and posted-ledger financial statements without blending currencies.' },
  documents: { title: 'Institutional records and document repository', description: 'Register and securely maintain church records, supporting documents and version history.' },
  memberPortal: { title: 'Congregational member portal', description: 'Access your membership information, worship attendance, programmes, giving history and church communications.' },
  security: { title: 'Account security', description: 'Maintain your sign-in security and review account protection options.' },
  assets: { title: 'Asset stewardship and property', description: 'Maintain records of church property, equipment, location, condition and accountable custody.' },
  projects: { title: 'Church projects and development', description: 'Coordinate project proposals, responsibilities, progress and supporting records.' },
  announcements: { title: 'Church communications and notices', description: 'Prepare and publish authorised notices for the intended church audience.' },
  eventRegistrations: { title: 'Programme registrations', description: 'Coordinate delegate registration and participation records for church programmes.' },
  sermons: { title: 'Sermons and teaching resources', description: 'Organise sermon series, teaching notes and ministry resources for authorised use.' },
  churchPlants: { title: 'Church planting', description: 'Track outreach locations, launch teams and the progress of new congregations.' },
  sponsorships: { title: 'Ministry sponsorships', description: 'Coordinate sponsorship commitments and maintain records of their fulfilment.' },
  pledges: { title: 'Giving commitments', description: 'Record voluntary giving commitments and track fulfilment without treating pledges as received funds.' },
  ministryReports: { title: 'Ministry performance reports', description: 'Collect activity and performance reports from authorised ministry and branch leaders.' },
  welfare: { title: 'Member welfare follow-up', description: 'Coordinate welfare visits and pastoral support within restricted access boundaries.' },
  discipline: { title: 'Restricted pastoral conduct cases', description: 'Maintain access-controlled case administration for authorised pastoral leaders.' },
  counselling: { title: 'Confidential counselling cases', description: 'Coordinate restricted counselling administration; sensitive case notes require approved privacy controls.' },
  safeguarding: { title: 'Child safeguarding and consent', description: 'Record purpose-specific guardian consent and review safeguarding actions within authorised roles.' },
  memberEnrolments: { title: 'Member programme applications', description: 'Review member requests to join branch learning and fellowship programmes.' },
  memberNotifications: { title: 'Member communications', description: 'Prepare an in-app message for a verified member account within the authorised branch.' },
  volunteers: { title: 'Volunteer coordination', description: 'Coordinate volunteer roles, availability and service assignments.' },
  training: { title: 'Leadership and ministry training', description: 'Plan development programmes and maintain authorised training records.' },
  property: { title: 'Property administration', description: 'Maintain records relating to church land, buildings, location and stewardship.' },
  prayer: { title: 'Prayer and pastoral follow-up', description: 'Coordinate confidential prayer requests and pastoral follow-up within authorised access boundaries.' },
  children: { title: 'Children’s ministry', description: 'Coordinate children’s programmes, classes, attendance and authorised ministry teams.' },
  youth: { title: 'Youth ministry', description: 'Coordinate youth groups, programmes, mentorship and leadership development.' },
  family: { title: 'Family ministry', description: 'Coordinate marriage, parenting and family support programmes.' },
  groups: { title: 'Fellowship groups', description: 'Coordinate small groups, study gatherings, leaders and meeting schedules.' },
  sacraments: { title: 'Baptisms and ceremonies', description: 'Maintain preparation and ceremony records with appropriate access controls.' },
  weddings: { title: 'Marriage ceremonies', description: 'Coordinate marriage service administration and preparation records.' },
  funerals: { title: 'Funeral and memorial services', description: 'Coordinate funeral and memorial service administration with appropriate care.' },
  benevolence: { title: 'Welfare assistance', description: 'Administer restricted assistance records for authorised pastoral leadership.' },
  facilities: { title: 'Facilities and venue bookings', description: 'Coordinate rooms, venues and equipment bookings for church activities.' },
  inventory: { title: 'Inventory stewardship', description: 'Maintain records of ministry supplies, stock and equipment movements.' },
  procurement: { title: 'Purchasing and procurement', description: 'Coordinate purchase requests, supplier information and procurement review.' },
  communications: { title: 'Communications planning', description: 'Plan authorised communication activity and maintain its audience and publication record.' },
  media: { title: 'Media ministry', description: 'Coordinate media production, service support and approved content resources.' },
  transport: { title: 'Church transport', description: 'Coordinate vehicle and transport schedules for authorised church activities.' },
  compliance: { title: 'Governance and compliance', description: 'Track governance actions, policy reviews and assigned compliance responsibilities.' },
  classes: { title: 'Membership and discipleship classes', description: 'Coordinate orientation and learning programmes for new members and believers.' },
  volunteerSchedule: { title: 'Ministry service rosters', description: 'Prepare and maintain ministry team schedules and service assignments.' }
});

export const ACTION_TERMS = Object.freeze({
  create: { members: 'Register a congregant', visitors: 'Register a first-time guest', attendance: 'Record service attendance', departments: 'Establish a ministry department', events: 'Schedule a church programme', announcements: 'Publish a news announcement', budgets: 'Prepare a budget proposal', finance: 'Record a financial transaction', payments: 'Initiate a payment request', journals: 'Prepare a journal entry', reconciliation: 'Start a bank reconciliation' },
  save: { members: 'Save membership details', visitors: 'Save guest details', finance: 'Submit financial transaction', budgets: 'Submit budget proposal', attendance: 'Record attendance', journals: 'Submit journal for review', events: 'Save programme details' }
});

export const EMPTY_STATES = Object.freeze({
  members: 'No congregational registrations are currently available in this branch. Register a congregant to begin a verified membership record.',
  visitors: 'No guest records are available in this branch. Record a first-time guest to begin a follow-up journey.',
  attendance: 'No worship or ministry attendance has been recorded for this view. Choose another page or record service attendance.',
  departments: 'No ministry departments are registered in this organisational scope.',
  events: 'No church events or programmes match this view. Adjust the search or schedule a programme.',
  finance: 'No financial transactions match this view. Submitted requests will appear here for authorised review.',
  budgets: 'No budget proposals are available in this scope. Prepare a proposal and submit it for independent authorisation.',
  reconciliation: 'No bank reconciliations are available in this scope.',
  documents: 'No institutional records match this view. Register a document to begin its controlled record history.',
  default: 'No matching records are available. Adjust the search criteria or create a record if your role permits.'
});

export const SUCCESS_MESSAGES = Object.freeze({
  members: 'Membership details have been recorded successfully.',
  visitors: 'Guest details have been recorded for follow-up.',
  attendance: 'Service attendance has been recorded.',
  finance: 'The financial request was submitted and is awaiting independent authorisation.',
  payments: 'The payment request was initiated. It will appear as received only after provider verification.',
  budgets: 'The budget proposal was submitted and is awaiting review by an authorised approver.',
  journals: 'The journal entry was submitted for independent review.',
  events: 'The programme details have been saved successfully.',
  announcements: 'The news announcement has been published to the public website.',
  departments: 'The ministry department details have been saved successfully.',
  documents: 'The institutional record has been saved successfully.'
});

export const DEFAULT_SITE_CONTENT = {
  navigation: { about: 'About NCBI', mission: 'Our mission', ministries: 'Ministries', branches: 'Our branches', programmes: 'Programmes and events', news: 'News and announcements', contact: 'Contact us', register: 'Become part of NCBI', signIn: 'Member and staff portal' },
  pages: {
    home: {
      kicker: 'NEW CHURCH BELIEVERS INTERNATIONAL',
      titleLine1: 'One Church.',
      titleLine2: 'One Vision.',
      description: 'A Christ-centred church family committed to proclaiming the Gospel, nurturing believers and serving communities with faith, integrity and compassion. Discover our work and connect with an NCBI congregation.',
      branchesCta: 'Explore our branches',
      registerCta: 'Connect with NCBI',
      workspaceCta: 'Member and staff portal',
      motto: 'FAITH IN ACTION. SERVICE WITH PURPOSE.',
      heroCaptionTitle: 'Rooted in faith. United in purpose.',
      heroCaptionText: 'Growing together in Christ and serving people with compassion.',
      strapline: ['GROUNDED IN THE WORD', 'UNITED IN CHRIST', 'COMMITTED TO SERVICE']
    },
    about: {
      eyebrow: 'ABOUT NEW CHURCH BELIEVERS INTERNATIONAL',
      titleLine1: 'A people of faith,',
      titleLine2: 'called to make a difference.',
      body: 'New Church Believers International (NCBI) is a Christian church family bringing congregations together in a shared commitment to faith in Jesus Christ, biblical teaching and service to others. Across our church community, we seek to create places where people can worship, grow as disciples, build meaningful relationships and put Christian faith into practice. We value servant-hearted leadership, strong local congregations and a united vision for sharing the love and hope of Christ.'
    },
    mission: {
      eyebrow: 'OUR MISSION AND VALUES',
      title: 'Faith in Christ. A life of purpose. A commitment to serve.',
      subtitle: 'Our calling is expressed through biblical worship, intentional discipleship, compassionate ministry and responsible service in the communities where God has placed us.',
      cards: [
        { eyebrow: '01 / WORSHIP', title: 'Worship centred on Christ', body: 'We gather to honour God through prayer, praise, the teaching of Scripture and fellowship, cultivating a faith that shapes every part of life.' },
        { eyebrow: '02 / DISCIPLESHIP', title: 'Forming mature disciples', body: 'We encourage every believer to grow in the knowledge of God, develop Christlike character and use their gifts faithfully in the service of others.' },
        { eyebrow: '03 / COMMUNITY', title: 'Compassion in action', body: 'We respond to the needs of our neighbours with dignity, practical care and a commitment to strengthen families and communities.' },
        { eyebrow: '04 / LEADERSHIP', title: 'Serving with integrity', body: 'We pursue accountable, transparent and servant-hearted leadership that equips people and strengthens the mission of the Church.' }
      ]
    },
    ministries: {
      eyebrow: 'MINISTRIES AND CONGREGATIONAL LIFE',
      titleLine1: 'Discover your place.',
      titleLine2: 'Grow, belong and serve.',
      body: 'NCBI provides opportunities for people at every stage of their faith journey to worship, learn, build relationships and serve. Our branches coordinate ministry activities in response to the needs of their congregations and communities. Speak with your local church to learn about current teams, ministry opportunities and programmes.',
      cta: 'Explore our branches',
      cards: [
        { title: 'Worship and fellowship', body: 'Participate in meaningful worship, prayer and fellowship that encourage believers and strengthen the life of the congregation.' },
        { title: 'Biblical teaching and discipleship', body: 'Develop a lasting foundation for Christian living through Scripture, mentoring, learning and spiritual formation.' },
        { title: 'Pastoral care and family support', body: 'Find prayer, guidance and compassionate support through the pastoral ministry and care structures of the local church.' },
        { title: 'Evangelism and community outreach', body: 'Share the message of Christ and demonstrate God’s love through outreach, mission and practical service to our neighbours.' },
        { title: 'Children, youth and family ministry', body: 'Encourage the faith, wellbeing and participation of children, young people and families through age-appropriate ministry.' },
        { title: 'Leadership and volunteer development', body: 'Identify, equip and support people to serve responsibly in ministry, leadership and the wider life of the Church.' }
      ]
    },
    branches: {
      eyebrow: 'OUR CHURCH NETWORK',
      title: 'Find an NCBI congregation',
      subtitle: 'Connect with a local church for worship, fellowship, pastoral support and opportunities to serve. Branch information shown here is maintained by authorised NCBI administrators.',
      empty: 'Our public branch directory is currently being updated. Please use the contact or registration options to express your interest, and the NCBI team will help direct your enquiry to the appropriate congregation.'
    },
    programmes: {
      eyebrow: 'UPCOMING GATHERINGS AND ACTIVITIES',
      title: 'Programmes, events and training',
      subtitle: 'Explore conferences, worship gatherings, leadership development, discipleship programmes and community activities officially published by NCBI branches and ministry teams.',
      empty: 'There are no upcoming public programmes currently listed. New events will appear here when they have been confirmed and published by an authorised NCBI office. For local service times and ministry schedules, please contact your nearest congregation.'
    },
    news: {
      eyebrow: 'OFFICIAL NCBI COMMUNICATIONS',
      title: 'News, announcements and notices',
      subtitle: 'Stay informed about official church announcements, ministry developments, important notices and updates published by NCBI leadership and local branches.',
      empty: 'There are no public announcements available at this time. Official updates will be published here when they are approved for public release. Please check back for the latest information.'
    },
    contact: {
      eyebrow: 'WE WOULD BE GLAD TO HEAR FROM YOU',
      titleLine1: 'Connect with our church family.',
      titleLine2: 'There is a place for you.',
      body: 'Whether you are looking for a congregation, seeking prayer, enquiring about membership or wishing to learn more about our ministries, we welcome your enquiry. Explore the branch directory to connect with a local church, or use the member and staff portal if you already have an NCBI account.',
      branchesCta: 'Find a congregation',
      signInCta: 'Access the NCBI portal', contactEmail: '', phone: '', whatsapp: '', physicalAddress: '', postalAddress: '', officeHours: ''
    }
  },
  footer: { brand: 'NEW CHURCH BELIEVERS INTERNATIONAL', strapline: 'ONE CHURCH. ONE VISION. UNITED IN CHRIST AND COMMITTED TO SERVICE.', motto: 'FAITH IN ACTION. SERVICE WITH PURPOSE.' }
};


// Upgrade the original starter copy without overwriting text that an NCBI editor
// has deliberately customised in the website content manager.
const LEGACY_PUBLIC_COPY = {
  navigation: { branches: 'Find a branch', programmes: 'Programmes', news: 'News and notices', register: 'Connect with NCBI', signIn: 'Member and staff sign in' },
  pages: {
    home: { description: 'A Christian community serving God and neighbours through worship, fellowship, discipleship and practical care. Discover an NCBI congregation and find a place to connect.', motto: 'A CALL TO SERVE', heroCaptionTitle: 'Faith expressed in service.', heroCaptionText: 'Worship, grow and serve with your local congregation.', strapline: ['GROWING IN FAITH', 'SERVING WITH COMPASSION', 'CONNECTED IN COMMUNITY'] },
    about: { eyebrow: 'WHO WE ARE', titleLine1: 'A church family,', titleLine2: 'united in faith and service.', body: 'New Church Believers International is a Christian church community with congregations serving in their local contexts. NCBI brings people together for worship, fellowship, biblical learning and practical service. Our shared identity is expressed in the call to serve God and care for our neighbours.' },
    mission: { eyebrow: 'OUR SHARED PURPOSE', title: 'Faith that forms a life of service.', subtitle: 'Worship, discipleship and care for our communities shape the way we serve together.', cards: [{ eyebrow: '01 / WORSHIP', title: 'Worship together', body: 'Gather as a church family for prayer, praise, teaching and fellowship.' }, { eyebrow: '02 / DISCIPLESHIP', title: 'Grow in faith', body: 'Encourage learning, spiritual formation and faithful service throughout life.' }, { eyebrow: '03 / COMMUNITY', title: 'Care for our neighbours', body: 'Put compassion into practice through local ministry, outreach and support.' }] },
    ministries: { eyebrow: 'LIFE TOGETHER', titleLine1: 'Many ways to worship,', titleLine2: 'learn and serve.', body: 'NCBI congregations bring people together through worship, discipleship, pastoral care and community outreach. Contact a local branch to learn which ministries and programmes are available in your area.', cta: 'Find a local congregation', cards: [{ title: 'Worship and fellowship', body: 'Gather with a congregation for worship, encouragement and shared life.' }, { title: 'Discipleship and teaching', body: 'Build a foundation for Christian life through learning and mentoring.' }, { title: 'Pastoral care', body: 'Offer prayer, practical support and compassionate care within the church community.' }, { title: 'Outreach and service', body: 'Serve local communities and share the Christian message with care and respect.' }] },
    branches: { eyebrow: 'FIND YOUR CHURCH FAMILY', title: 'NCBI congregations', subtitle: 'Explore active branches and connect with a local congregation.', empty: 'The branch directory is being updated. Please contact the NCBI office for help finding a congregation.' },
    programmes: { eyebrow: 'GATHER · LEARN · SERVE', title: 'Church programmes and events', subtitle: 'See programmes published by NCBI branches and ministry teams.', empty: 'No public programmes are listed at present. Check again later or contact a local branch for its programme schedule.' },
    news: { eyebrow: 'CHURCH NEWS AND NOTICES', title: 'Updates from NCBI', subtitle: 'Read notices that NCBI branches and authorised leaders have chosen to publish.', empty: 'There are no public notices at present.' },
    contact: { eyebrow: 'CONNECT WITH NCBI', titleLine1: 'Find a place', titleLine2: 'to worship and serve.', body: 'Contact a local congregation to ask about worship, programmes, membership or ways to get involved. For account access, use the member and staff sign-in.', branchesCta: 'Find a branch', signInCta: 'Member and staff sign in' }
  },
  footer: { strapline: 'ONE CHURCH. ONE VISION. A CALL TO SERVE.', motto: 'A CALL TO SERVE' }
};
function mergeTypedContent(defaultValue, savedValue) {
  if (Array.isArray(defaultValue)) {
    if (!Array.isArray(savedValue)) return defaultValue;
    if (!defaultValue.length) return savedValue.filter(item => item == null || ['string', 'number', 'boolean'].includes(typeof item));
    const template = defaultValue[0];
    return savedValue.map(item => mergeTypedContent(template, item));
  }
  if (defaultValue && typeof defaultValue === 'object') {
    if (!savedValue || typeof savedValue !== 'object' || Array.isArray(savedValue)) return defaultValue;
    return Object.fromEntries(Object.entries(defaultValue).map(([key, fallback]) => [
      key,
      mergeTypedContent(fallback, savedValue[key])
    ]));
  }
  return typeof savedValue === typeof defaultValue && savedValue !== null ? savedValue : defaultValue;
}

export function mergeSiteContent(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const savedPages = source.pages && typeof source.pages === 'object' && !Array.isArray(source.pages) ? source.pages : {};
  const pages = Object.fromEntries(Object.entries(DEFAULT_SITE_CONTENT.pages).map(([key, defaults]) => {
    const saved = savedPages[key] && typeof savedPages[key] === 'object' && !Array.isArray(savedPages[key]) ? { ...savedPages[key] } : {};
    const legacy = LEGACY_PUBLIC_COPY.pages[key] || {};
    for (const [field, oldValue] of Object.entries(legacy)) {
      if (JSON.stringify(saved[field]) === JSON.stringify(oldValue)) delete saved[field];
    }
    return [key, mergeTypedContent(defaults, saved)];
  }));
  const savedNavigation = source.navigation && typeof source.navigation === 'object' && !Array.isArray(source.navigation) ? { ...source.navigation } : {};
  for (const [key, oldValue] of Object.entries(LEGACY_PUBLIC_COPY.navigation)) if (savedNavigation[key] === oldValue) delete savedNavigation[key];
  const navigation = mergeTypedContent(DEFAULT_SITE_CONTENT.navigation, savedNavigation);
  const savedFooter = source.footer && typeof source.footer === 'object' && !Array.isArray(source.footer) ? { ...source.footer } : {};
  for (const [key, oldValue] of Object.entries(LEGACY_PUBLIC_COPY.footer)) if (savedFooter[key] === oldValue) delete savedFooter[key];
  const footer = mergeTypedContent(DEFAULT_SITE_CONTENT.footer, savedFooter);
  return { navigation, pages, footer };
}
