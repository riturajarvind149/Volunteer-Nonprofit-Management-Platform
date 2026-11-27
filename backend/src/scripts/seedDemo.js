require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { migrate } = require('../db/migrate');
const { validatePasswordStrength } = require('../services/authService');

/**
 * Demo data for showcasing ServeHub: Bengaluru NGOs, coordinators, volunteers and events.
 *
 *   DEMO_PASSWORD='Choose-a-pass1' npm run seed:demo           add (or refresh) the demo data
 *   npm run seed:demo:remove                                     delete all demo data
 *
 * Options (environment):
 *   DEMO_PASSWORD  required to seed: password of every demo account (never stored in the repo)
 *   DEMO_START     first day of the demo window, YYYY-MM-DD (default 2026-11-30). One event is
 *                  scheduled on each of the 8 days from this date, so whichever day the demo is,
 *                  there is an event that day; completed events sit in the months before it.
 *
 * Every demo account uses an @demo.servehub.test address (that domain can never receive mail)
 * with email notifications off, and every demo NGO uses one as its contact email. That is how
 * the data is found again: re-running the seed replaces it, and --remove deletes only it.
 * In production the script needs --yes, so it can't be run there by accident.
 */

const DEMO_DOMAIN = 'demo.servehub.test';
const DEFAULT_START = '2026-11-30';
const DEMO_DAYS = 8;

const email = (name) => `${name}@${DEMO_DOMAIN}`;

// ---------------------------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------------------------

const COORDINATORS = [
  { key: 'arjun', full_name: 'Arjun Rao', phone: '+91 98450 21034', location: 'Indiranagar, Bengaluru', bio: 'Runs weekend lake and tree drives across east Bengaluru.' },
  { key: 'kavya', full_name: 'Kavya Murthy', phone: '+91 98861 44120', location: 'Jayanagar, Bengaluru', bio: 'Coordinates tree planting and park clean-ups.' },
  { key: 'deepa', full_name: 'Deepa Srinivas', phone: '+91 97411 30982', location: 'Koramangala, Bengaluru', bio: 'Former teacher, now runs after-school learning centres.' },
  { key: 'suresh', full_name: 'Suresh Babu', phone: '+91 99001 56713', location: 'Shivajinagar, Bengaluru', bio: 'Food bank operations and community kitchens.' },
  { key: 'nisha', full_name: 'Nisha Thomas', phone: '+91 96320 77458', location: 'Hebbal, Bengaluru', bio: 'Animal rescue, adoption drives and shelter care.' },
  { key: 'ramesh', full_name: 'Ramesh Kumar', phone: '+91 90084 61290', location: 'HSR Layout, Bengaluru', bio: 'Setting up visits and companionship for senior citizens.' },
];

const VOLUNTEERS = [
  { key: 'priya', full_name: 'Priya Sharma', phone: '+91 98455 10231', location: 'Indiranagar, Bengaluru', dob: '1999-03-14', ec: ['Anil Sharma', '+91 98450 99231'], id: ['AADHAAR', '4821'], skills: ['Teaching', 'First aid', 'Kannada'], bio: 'Product designer who spends weekends outdoors and teaching kids.', status: 'VERIFIED' },
  { key: 'rahul', full_name: 'Rahul Nair', phone: '+91 97400 22198', location: 'Koramangala, Bengaluru', dob: '1997-08-02', ec: ['Lekha Nair', '+91 97400 55120'], id: ['PAN', '7K2Q'], skills: ['Logistics', 'Driving'], bio: 'Software engineer, happy to lift heavy boxes.', status: 'VERIFIED' },
  { key: 'ananya', full_name: 'Ananya Iyer', phone: '+91 99860 31427', location: 'Jayanagar, Bengaluru', dob: '2001-11-23', ec: ['Ramya Iyer', '+91 99860 77310'], id: ['AADHAAR', '1093'], skills: ['Teaching', 'Art'], bio: 'Final-year B.Ed student.', status: 'VERIFIED' },
  { key: 'karthik', full_name: 'Karthik Reddy', phone: '+91 96060 48812', location: 'Whitefield, Bengaluru', dob: '1995-05-30', ec: ['Swathi Reddy', '+91 96060 11290'], id: ['DRIVING_LICENCE', '6614'], skills: ['Photography', 'Gardening'], bio: 'Photographer and weekend gardener.', status: 'VERIFIED' },
  { key: 'sneha', full_name: 'Sneha Patil', phone: '+91 98804 66320', location: 'HSR Layout, Bengaluru', dob: '1998-01-17', ec: ['Mahesh Patil', '+91 98804 23001'], id: ['AADHAAR', '3370'], skills: ['Cooking', 'Hindi', 'Event planning'], bio: 'Loves running community kitchens.', status: 'VERIFIED' },
  { key: 'vikram', full_name: 'Vikram Gowda', phone: '+91 97319 54401', location: 'Malleshwaram, Bengaluru', dob: '1993-09-09', ec: ['Shilpa Gowda', '+91 97319 88003'], id: ['VOTER_ID', 'X2B9'], skills: ['Driving', 'Kannada'], bio: 'Bank analyst who volunteers on Sundays.', status: 'VERIFIED' },
  { key: 'meera', full_name: 'Meera Krishnan', phone: '+91 90360 27715', location: 'Basavanagudi, Bengaluru', dob: '2000-06-21', ec: ['Gopal Krishnan', '+91 90360 40218'], id: ['AADHAAR', '9052'], skills: ['First aid', 'Animal care'], bio: 'Vet nursing trainee.', status: 'VERIFIED' },
  { key: 'aditya', full_name: 'Aditya Menon', phone: '+91 99459 81036', location: 'Electronic City, Bengaluru', dob: '1996-12-05', ec: ['Nandini Menon', '+91 99459 30027'], id: ['PASSPORT', '5T81'], skills: ['Data entry', 'Logistics'], bio: 'Ops lead at a startup.', status: 'VERIFIED' },
  { key: 'divya', full_name: 'Divya Shetty', phone: '+91 97425 63390', location: 'Yelahanka, Bengaluru', dob: '2002-04-11', ec: ['Prakash Shetty', '+91 97425 10045'], id: ['AADHAAR', '2286'], skills: ['Art', 'Social media'], bio: 'Design student.', status: 'VERIFIED' },
  { key: 'rohan', full_name: 'Rohan Kulkarni', phone: '+91 98868 14502', location: 'BTM Layout, Bengaluru', dob: '1999-10-28', ec: ['Asha Kulkarni', '+91 98868 70031'], id: ['PAN', '8M4D'], skills: ['Teaching', 'Maths'], bio: 'Tutors maths in his free time.', status: 'UNVERIFIED' },
  { key: 'lakshmi', full_name: 'Lakshmi Hegde', phone: '+91 90085 39917', location: 'Rajajinagar, Bengaluru', dob: '1994-02-15', ec: ['Venkatesh Hegde', '+91 90085 22140'], id: ['AADHAAR', '6741'], skills: ['Cooking', 'Elder care'], bio: 'Nurse, volunteers at food drives.', status: 'VERIFIED' },
  { key: 'farhan', full_name: 'Farhan Ali', phone: '+91 96118 70263', location: 'Frazer Town, Bengaluru', dob: '2000-07-03', ec: ['Ayesha Ali', '+91 96118 41290'], id: ['AADHAAR', '1508'], skills: ['Urdu', 'Logistics', 'Animal care'], bio: 'Commerce graduate, cat person.', status: 'UNVERIFIED' },
];

// ---------------------------------------------------------------------------------------------
// NGOs
// ---------------------------------------------------------------------------------------------

const ORGS = [
  {
    key: 'green', name: 'Namma Bengaluru Green Trust', owner: 'arjun', coordinators: ['kavya'],
    registration_type: 'TRUST', registration_number: 'KA/2017/0118402', status: 'APPROVED',
    description: 'Citizen-led trust restoring Bengaluru’s lakes and tree cover through weekend drives with residents, schools and companies.',
    phone: '080 4112 7720', website: 'https://example.org/namma-green', address: '12, 100 Feet Road, Indiranagar, Bengaluru 560038',
  },
  {
    key: 'akshara', name: 'Akshara Learning Foundation', owner: 'deepa', coordinators: [],
    registration_type: 'SECTION_8', registration_number: 'U85300KA2015NPL081234', status: 'APPROVED',
    description: 'After-school learning centres for children from government schools in south Bengaluru — reading, maths and art.',
    phone: '080 2553 9014', website: 'https://example.org/akshara', address: '4th Block, Koramangala, Bengaluru 560034',
  },
  {
    key: 'annapurna', name: 'Annapurna Food Bank Bengaluru', owner: 'suresh', coordinators: [],
    registration_type: 'SOCIETY', registration_number: 'KA/SOC/2012/2291', status: 'APPROVED',
    description: 'Collects surplus food from restaurants and hostels and serves hot meals across central Bengaluru.',
    phone: '080 2286 4410', website: null, address: 'Commercial Street, Shivajinagar, Bengaluru 560001',
  },
  {
    key: 'paws', name: 'Paws & Claws Bengaluru', owner: 'nisha', coordinators: [],
    registration_type: 'TRUST', registration_number: 'KA/2019/0230987', status: 'APPROVED',
    description: 'Rescue, treatment and adoption of street animals in north Bengaluru. Volunteers walk, feed and socialise our shelter dogs and cats.',
    phone: '080 2362 5508', website: 'https://example.org/paws-claws', address: 'Kodigehalli Main Road, Hebbal, Bengaluru 560092',
  },
  {
    key: 'sahaya', name: 'Sahaya Elder Care Society', owner: 'ramesh', coordinators: [],
    registration_type: 'SOCIETY', registration_number: null, status: 'PENDING',
    description: 'Weekly visits, companionship and help with errands for senior citizens living alone in HSR Layout and Bellandur.',
    phone: '080 4950 3321', website: null, address: 'Sector 2, HSR Layout, Bengaluru 560102',
  },
];

// ---------------------------------------------------------------------------------------------
// Events. `day` is relative to DEMO_START (0 = first day of the demo window).
// ---------------------------------------------------------------------------------------------

// Completed events in the months before the demo: rosters, attendance and verified hours.
const PAST_EVENTS = [
  { org: 'green', day: -82, title: 'Tree planting at Lalbagh Botanical Garden', category: 'Environment', start: '07:00', end: '11:00', location: 'Lalbagh Botanical Garden', address: 'Mavalli, Bengaluru 560004', capacity: 25, hours: 4, volunteers: ['priya', 'rahul', 'karthik', 'vikram', 'divya', 'aditya'] },
  { org: 'akshara', day: -68, title: 'Weekend reading circle for Class 4 kids', category: 'Education', start: '10:00', end: '13:00', location: 'Akshara Centre, Koramangala', address: '4th Block, Koramangala, Bengaluru 560034', capacity: 10, hours: 3, volunteers: ['priya', 'ananya', 'rohan', 'divya'] },
  { org: 'annapurna', day: -55, title: 'Community lunch at Shivajinagar', category: 'Hunger & Food', start: '11:00', end: '15:00', location: 'Annapurna Kitchen, Shivajinagar', address: 'Commercial Street, Shivajinagar, Bengaluru 560001', capacity: 15, hours: 4, volunteers: ['sneha', 'lakshmi', 'rahul', 'vikram', 'priya'] },
  { org: 'green', day: -41, title: 'Ulsoor Lake shoreline plastic clean-up', category: 'Environment', start: '07:00', end: '10:30', location: 'Ulsoor Lake', address: 'Kensington Road, Halasuru, Bengaluru 560008', capacity: 30, hours: 3.5, volunteers: ['priya', 'karthik', 'aditya', 'farhan', 'divya', 'rahul', 'meera'] },
  { org: 'paws', day: -27, title: 'Shelter dog walking and socialising', category: 'Animal Welfare', start: '08:00', end: '11:00', location: 'Paws & Claws Shelter, Hebbal', address: 'Kodigehalli Main Road, Hebbal, Bengaluru 560092', capacity: 12, hours: 3, volunteers: ['meera', 'farhan', 'priya', 'karthik'] },
  { org: 'akshara', day: -16, title: 'Paint a school mural in Jayanagar', category: 'Arts & Culture', start: '09:30', end: '14:30', location: 'Government Primary School, Jayanagar', address: '9th Block, Jayanagar, Bengaluru 560069', capacity: 12, hours: 5, volunteers: ['divya', 'ananya', 'priya', 'karthik', 'sneha'] },
  // Most recent: hours still waiting for the coordinator, so the review queue has work in it.
  { org: 'annapurna', day: -5, title: 'Sorting donations at the food bank', category: 'Hunger & Food', start: '16:00', end: '19:00', location: 'Annapurna Warehouse, Frazer Town', address: 'Mosque Road, Frazer Town, Bengaluru 560005', capacity: 10, hours: 3, volunteers: ['priya', 'sneha', 'lakshmi', 'aditya', 'rohan'], review: true },
  { org: 'green', day: -2, title: 'Sankey Tank walkway clean-up', category: 'Environment', start: '07:00', end: '10:00', location: 'Sankey Tank', address: 'Sankey Road, Malleshwaram, Bengaluru 560003', capacity: 20, hours: 3, volunteers: ['vikram', 'rahul', 'karthik', 'farhan'], review: true },
];

// One event on every day of the demo window, so there is always something happening "today".
const DEMO_EVENTS = [
  { org: 'green', day: 0, title: 'Bellandur Lake shoreline clean-up', category: 'Environment', start: '07:00', end: '10:00', location: 'Bellandur Lake (Yamalur side)', address: 'Yamalur, Bellandur, Bengaluru 560037', capacity: 30, volunteers: ['priya', 'rahul', 'karthik', 'aditya', 'divya'], skills: ['Gloves provided', 'Comfortable shoes'] },
  { org: 'akshara', day: 1, title: 'Maths games for Class 5 students', category: 'Education', start: '15:30', end: '18:00', location: 'Akshara Centre, Koramangala', address: '4th Block, Koramangala, Bengaluru 560034', capacity: 8, volunteers: ['ananya', 'rohan', 'priya'], skills: ['Teaching', 'Maths'] },
  // Full, with a waitlist.
  { org: 'paws', day: 2, title: 'Weekend adoption drive at Cubbon Park', category: 'Animal Welfare', start: '09:00', end: '13:00', location: 'Cubbon Park (Bandstand)', address: 'Kasturba Road, Bengaluru 560001', capacity: 6, volunteers: ['meera', 'farhan', 'karthik', 'divya', 'rahul', 'vikram'], waitlist: ['priya', 'sneha'], skills: ['Animal care'] },
  // Finishes after midnight.
  { org: 'annapurna', day: 3, title: 'Night food distribution near Majestic', category: 'Hunger & Food', start: '21:00', end: '01:00', location: 'Kempegowda Bus Station (Majestic)', address: 'Gandhi Nagar, Bengaluru 560009', capacity: 15, volunteers: ['sneha', 'lakshmi', 'vikram', 'priya'], skills: ['Hindi', 'Kannada'] },
  { org: 'green', day: 4, title: 'Tree planting along Outer Ring Road', category: 'Environment', start: '07:30', end: '11:30', location: 'ORR median, Marathahalli', address: 'Outer Ring Road, Marathahalli, Bengaluru 560037', capacity: 40, volunteers: ['karthik', 'aditya', 'rahul'], skills: ['Gardening'] },
  { org: 'akshara', day: 5, title: 'Storytelling hour in Kannada and English', category: 'Education', start: '10:00', end: '12:00', location: 'Akshara Centre, BTM Layout', address: '2nd Stage, BTM Layout, Bengaluru 560076', capacity: 10, volunteers: ['priya', 'ananya'], skills: ['Kannada', 'Storytelling'] },
  { org: 'annapurna', day: 6, title: 'Blood donation camp volunteers', category: 'Health & Wellness', start: '09:00', end: '14:00', location: 'Annapurna Community Hall, Shivajinagar', address: 'Commercial Street, Shivajinagar, Bengaluru 560001', capacity: 12, volunteers: ['lakshmi', 'meera', 'aditya'], skills: ['First aid'] },
  { org: 'paws', day: 7, title: 'Shelter clean-up and cat socialising', category: 'Animal Welfare', start: '08:00', end: '11:00', location: 'Paws & Claws Shelter, Hebbal', address: 'Kodigehalli Main Road, Hebbal, Bengaluru 560092', capacity: 10, volunteers: ['farhan', 'meera'], skills: ['Animal care'] },
];

// After the demo window: upcoming, a draft and a cancelled event.
const LATER_EVENTS = [
  { org: 'green', day: 11, title: 'Agara Lake bird count and clean-up', category: 'Environment', start: '06:30', end: '09:30', location: 'Agara Lake', address: 'Agara, HSR Layout, Bengaluru 560102', capacity: 25, volunteers: ['karthik', 'priya'], skills: ['Photography'] },
  { org: 'akshara', day: 13, title: 'Winter art camp for kids', category: 'Arts & Culture', start: '10:00', end: '15:00', location: 'Government Primary School, Jayanagar', address: '9th Block, Jayanagar, Bengaluru 560069', capacity: 15, volunteers: ['divya', 'ananya'], skills: ['Art'] },
  { org: 'annapurna', day: 20, title: 'New Year community kitchen', category: 'Hunger & Food', start: '11:00', end: '16:00', location: 'Annapurna Kitchen, Shivajinagar', address: 'Commercial Street, Shivajinagar, Bengaluru 560001', capacity: 20, volunteers: ['sneha'], skills: ['Cooking'] },
  { org: 'paws', day: 16, title: 'Street dog vaccination drive (planning)', category: 'Animal Welfare', start: '08:00', end: '12:00', location: 'Yelahanka New Town', address: 'Yelahanka, Bengaluru 560064', capacity: 10, status: 'DRAFT' },
  { org: 'green', day: 9, title: 'Cubbon Park heritage walk clean-up', category: 'Community Support', start: '07:00', end: '09:30', location: 'Cubbon Park', address: 'Kasturba Road, Bengaluru 560001', capacity: 20, volunteers: ['rahul'], status: 'CANCELLED', cancellation_reason: 'The park authority has closed the walkway for repairs that week.' },
];

// ---------------------------------------------------------------------------------------------

const addDays = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Timestamp `days` from the demo start at a local time, as an ISO string (IST). */
const at = (start, days, time = '09:00') => `${addDays(start, days)}T${time}:00+05:30`;

const checkInCode = () => crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();

/** Delete every demo NGO (with its events, rosters and hours) and every demo account. */
const removeDemo = async (client = pool) => {
  const like = `%@${DEMO_DOMAIN}`;
  const orgs = await client.query('DELETE FROM organizations WHERE email LIKE $1', [like]);
  const users = await client.query('DELETE FROM users WHERE email LIKE $1', [like]);
  return { organizations: orgs.rowCount, users: users.rowCount };
};

const resolveStart = (value) => {
  const start = (value || DEFAULT_START).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(`${start}T00:00:00Z`))) {
    throw new Error(`DEMO_START must be a date in YYYY-MM-DD format (got "${start}")`);
  }
  return start;
};

/**
 * Replace the demo data. Runs in one transaction.
 * @returns {Promise<Object>} counts and the demo window, for the log
 */
const seedDemo = async ({ password, start: startInput } = {}) => {
  validatePasswordStrength(password);
  const start = resolveStart(startInput);
  const passwordHash = await bcrypt.hash(password, 12);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await removeDemo(client);

    // ---- Accounts ----
    const userId = {};
    for (const c of COORDINATORS) {
      const { rows } = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, phone, location, bio,
                            email_verified_at, email_notifications, created_at)
         VALUES ($1, $2, $3, 'COORDINATOR', $4, $5, $6, $7, FALSE, $7)
         RETURNING id`,
        [c.full_name, email(c.key), passwordHash, c.phone, c.location, c.bio, at(start, -120)]
      );
      userId[c.key] = rows[0].id;
    }
    for (const [i, v] of VOLUNTEERS.entries()) {
      const joined = at(start, -110 + i * 4);
      const { rows } = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, phone, location, bio, skills,
                            date_of_birth, emergency_contact_name, emergency_contact_phone, id_type, id_last4,
                            details_updated_at, verification_status, verified_at,
                            email_verified_at, email_notifications, created_at)
         VALUES ($1, $2, $3, 'VOLUNTEER', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $13, FALSE, $13)
         RETURNING id`,
        [
          v.full_name, email(v.key), passwordHash, v.phone, v.location, v.bio, v.skills,
          v.dob, v.ec[0], v.ec[1], v.id[0], v.id[1], joined, v.status,
          v.status === 'VERIFIED' ? at(start, -100 + i * 4) : null,
        ]
      );
      userId[v.key] = rows[0].id;
    }

    // ---- NGOs and their teams ----
    const org = {};
    for (const o of ORGS) {
      const { rows } = await client.query(
        `INSERT INTO organizations (name, description, phone, email, website, address, city,
                                    registration_type, registration_number, verification_status,
                                    verified_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'Bengaluru', $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          o.name, o.description, o.phone, email(`contact.${o.key}`), o.website, o.address,
          o.registration_type, o.registration_number, o.status,
          o.status === 'APPROVED' ? at(start, -115) : null,
          o.status === 'APPROVED' ? at(start, -118) : at(start, -3),
        ]
      );
      org[o.key] = { id: rows[0].id, owner: o.owner };
      await client.query(
        "INSERT INTO organization_members (organization_id, user_id, role, created_at) VALUES ($1, $2, 'OWNER', $3)",
        [rows[0].id, userId[o.owner], at(start, -118)]
      );
      for (const c of o.coordinators) {
        await client.query(
          "INSERT INTO organization_members (organization_id, user_id, role, added_by, created_at) VALUES ($1, $2, 'COORDINATOR', $3, $4)",
          [rows[0].id, userId[c], userId[o.owner], at(start, -100)]
        );
      }
    }

    // ---- Events, rosters, waitlists and hours ----
    const counts = { opportunities: 0, signups: 0, waitlist: 0, hours: 0 };
    const createEvent = async (e, status) => {
      const { rows } = await client.query(
        `INSERT INTO opportunities (organization_id, title, description, category, event_date, start_time, end_time,
                                    location, address, capacity, status, skills_required, check_in_code,
                                    cancellation_reason, reminder_sent_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id`,
        [
          org[e.org].id, e.title,
          `${e.title}. Meet the coordinator at the entrance 10 minutes before the start. Water and snacks provided.`,
          e.category, addDays(start, e.day), e.start, e.end, e.location, e.address, e.capacity, status,
          e.skills || null, checkInCode(), e.cancellation_reason || null,
          // Past events already had their reminder.
          e.day < 0 ? at(start, e.day - 1) : null,
          at(start, Math.min(e.day, 0) - 21),
        ]
      );
      counts.opportunities += 1;
      return rows[0].id;
    };
    const register = async (oppId, volunteerKey, signedUpDay, attendance = {}) => {
      const { rows } = await client.query(
        `INSERT INTO signups (volunteer_id, opportunity_id, status, attendance_status, checked_in_at, created_at)
         VALUES ($1, $2, 'REGISTERED', $3, $4, $5) RETURNING id`,
        [userId[volunteerKey], oppId, attendance.status || null, attendance.checkedInAt || null, at(start, signedUpDay)]
      );
      counts.signups += 1;
      return rows[0].id;
    };

    for (const e of PAST_EVENTS) {
      const oppId = await createEvent(e, 'COMPLETED');
      const recorder = userId[org[e.org].owner];
      for (const [i, key] of e.volunteers.entries()) {
        const signupId = await register(oppId, key, e.day - 10 + i, {
          status: 'PRESENT',
          checkedInAt: at(start, e.day, e.start),
        });
        // Recent events: some hours still wait for review (self-reported or just recorded).
        const status = e.review ? (i % 2 === 0 ? 'PENDING' : 'RECORDED') : 'VERIFIED';
        const selfReported = Boolean(e.review) && i % 2 === 0;
        await client.query(
          `INSERT INTO volunteer_hours (signup_id, hours, status, recorded_by, notes, self_reported, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            signupId, e.hours, status, selfReported ? userId[key] : recorder,
            selfReported ? 'Stayed till the end to help pack up.' : null, selfReported,
            at(start, e.day + 1, '10:00'),
          ]
        );
        counts.hours += 1;
      }
    }

    for (const e of [...DEMO_EVENTS, ...LATER_EVENTS]) {
      const oppId = await createEvent(e, e.status || 'PUBLISHED');
      for (const [i, key] of (e.volunteers || []).entries()) {
        await register(oppId, key, -6 + i);
      }
      for (const [i, key] of (e.waitlist || []).entries()) {
        await client.query(
          'INSERT INTO waitlist_entries (opportunity_id, volunteer_id, created_at) VALUES ($1, $2, $3)',
          [oppId, userId[key], at(start, -2, `1${i}:00`)]
        );
        counts.waitlist += 1;
      }
    }

    // ---- A few in-app notifications so the bell isn't empty ----
    const notes = [
      ['priya', 'Hours Verified', 'Your 5 volunteer hours for Paint a school mural in Jayanagar have been verified!', 'HOURS', -14],
      ['priya', 'Registration Confirmed', `You successfully registered for Bellandur Lake shoreline clean-up on ${addDays(start, 0)}`, 'REGISTRATION', -6],
      ['priya', 'Upcoming volunteer shift', 'Reminder: Bellandur Lake shoreline clean-up starts at 07:00.', 'REMINDER', -1],
      ['rahul', 'Opportunity cancelled', 'Cubbon Park heritage walk clean-up has been cancelled.', 'EVENT_CANCELLED', -1],
      ['arjun', 'Hours awaiting review', 'Vikram Gowda logged 3 hours for Sankey Tank walkway clean-up.', 'HOURS', -1],
      ['suresh', 'Hours awaiting review', 'Priya Sharma logged 3 hours for Sorting donations at the food bank.', 'HOURS', -4],
    ];
    for (const [key, title, message, type, day] of notes) {
      await client.query(
        'INSERT INTO notifications (user_id, title, message, type, created_at) VALUES ($1, $2, $3, $4, $5)',
        [userId[key], title, message, type, at(start, day, '18:00')]
      );
    }

    await client.query('COMMIT');
    return {
      window: `${start} to ${addDays(start, DEMO_DAYS - 1)}`,
      accounts: COORDINATORS.length + VOLUNTEERS.length,
      organizations: ORGS.length,
      ...counts,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const printLogins = () => {
  console.log('\nDemo sign-ins (password: the DEMO_PASSWORD you chose)');
  console.log(`  Volunteer     ${email('priya')}   — hours, certificate, upcoming shifts, waitlist`);
  console.log(`  NGO admin     ${email('arjun')}   — Namma Bengaluru Green Trust (team, events, hours review)`);
  console.log(`  Coordinator   ${email('kavya')}   — same NGO, appointed coordinator`);
  console.log(`  NGO admin     ${email('suresh')}  — Annapurna Food Bank (night event, hours to review)`);
  console.log('  Platform admin: use your own admin account — "Sahaya Elder Care Society" is waiting for review.');
};

const run = async () => {
  const remove = process.argv.includes('--remove');
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--yes')) {
    throw new Error('This changes the production database. Re-run with --yes if that is what you want.');
  }
  await migrate({ log: () => {} });

  if (remove) {
    const removed = await removeDemo();
    console.log(`[seed:demo] Removed ${removed.organizations} demo NGOs and ${removed.users} demo accounts.`);
    return;
  }
  if (!process.env.DEMO_PASSWORD) {
    throw new Error("DEMO_PASSWORD is required, e.g. DEMO_PASSWORD='Demo-pass1' npm run seed:demo");
  }
  const result = await seedDemo({ password: process.env.DEMO_PASSWORD, start: process.env.DEMO_START });
  console.log(`[seed:demo] Demo data ready (one event a day from ${result.window}):`);
  console.log(
    `  ${result.organizations} NGOs, ${result.accounts} accounts, ${result.opportunities} events, ` +
      `${result.signups} registrations, ${result.waitlist} waitlisted, ${result.hours} hour entries`
  );
  printLogins();
};

if (require.main === module) {
  run()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error(`[seed:demo] ${err.message}`);
      try {
        await pool.end();
      } catch {
        // ignore
      }
      process.exit(1);
    });
}

module.exports = { seedDemo, removeDemo, DEMO_DOMAIN };
