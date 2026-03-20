import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addDays, format, startOfWeek, subDays } from 'date-fns'

function iso(date) {
  return format(date, 'yyyy-MM-dd')
}

function shellCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

function runWrangler(args) {
  execFileSync(shellCommand(), ['wrangler', ...args], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
}

function sqlString(value) {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL'
  }

  return `'${String(value).replaceAll("'", "''")}'`
}

function buildInsert(table, rows) {
  if (!rows.length) {
    return ''
  }

  const columns = Object.keys(rows[0])
  const values = rows
    .map((row) => {
      const tuple = columns.map((column) => sqlString(row[column])).join(', ')
      return `(${tuple})`
    })
    .join(',\n')

  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values};`
}

function travelMinutes(fromApartment, toApartment) {
  if (fromApartment.id === toApartment.id) {
    return 0
  }

  if (fromApartment.building_id === toApartment.building_id) {
    return 4
  }

  const toRadians = (value) => (value * Math.PI) / 180
  const latDistance = toRadians(toApartment.latitude - fromApartment.latitude)
  const lngDistance = toRadians(toApartment.longitude - fromApartment.longitude)
  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(toRadians(fromApartment.latitude)) *
      Math.cos(toRadians(toApartment.latitude)) *
      Math.sin(lngDistance / 2) *
      Math.sin(lngDistance / 2)
  const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.max(6, Math.round((distanceKm / 28) * 60 + 6))
}

function booking({ id, apartmentId, guestName, checkOut, nights }) {
  return {
    id,
    apartment_id: apartmentId,
    source: 'seed',
    external_ref: `${id}-ref`,
    guest_name: guestName,
    check_in: iso(subDays(checkOut, nights)),
    check_out: iso(checkOut),
    nights,
    raw_ical_uid: `${id}@stayclean.local`,
    raw_hash: `seed-${id}`,
    updated_at: iso(new Date()),
  }
}

const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
const nextWeekStart = addDays(currentWeekStart, 7)

const apartments = [
  {
    id: 'apt-atlantic-101',
    name: 'Atlantic Point 101',
    building_id: 'atlantic-point',
    address: 'Atlantic Point, Green Point',
    latitude: -33.9062,
    longitude: 18.4069,
    ical_url: null,
    is_external: 0,
    notes: 'Near the stadium',
  },
  {
    id: 'apt-atlantic-203',
    name: 'Atlantic Point 203',
    building_id: 'atlantic-point',
    address: 'Atlantic Point, Green Point',
    latitude: -33.9061,
    longitude: 18.4071,
    ical_url: null,
    is_external: 0,
    notes: 'Second-floor unit',
  },
  {
    id: 'apt-atlantic-305',
    name: 'Atlantic Point 305',
    building_id: 'atlantic-point',
    address: 'Atlantic Point, Green Point',
    latitude: -33.906,
    longitude: 18.4072,
    ical_url: null,
    is_external: 0,
    notes: 'Balcony clean takes longer',
  },
  {
    id: 'apt-greenmarket',
    name: 'Greenmarket Loft',
    building_id: 'greenmarket-house',
    address: 'Greenmarket Square, CBD',
    latitude: -33.9253,
    longitude: 18.4232,
    ical_url: null,
    is_external: 0,
    notes: 'Tight parking',
  },
  {
    id: 'apt-camps-bay',
    name: 'Camps Bay Studio',
    building_id: 'camps-bay-studio',
    address: 'Camps Bay Drive, Camps Bay',
    latitude: -33.9519,
    longitude: 18.3773,
    ical_url: null,
    is_external: 0,
    notes: 'Long stay test apartment',
  },
  {
    id: 'apt-sea-point',
    name: 'Sea Point Nest',
    building_id: 'sea-point-nest',
    address: 'Main Road, Sea Point',
    latitude: -33.9154,
    longitude: 18.3887,
    ical_url: null,
    is_external: 0,
    notes: 'Often late check-outs',
  },
]

const cleaners = [
  {
    id: 'cleaner-sis-nolu',
    name: 'Sis Nolu',
    color_hex: '#C89C75',
    is_active: 1,
  },
  {
    id: 'cleaner-lovey',
    name: 'Lovey',
    color_hex: '#8FBCB1',
    is_active: 1,
  },
  {
    id: 'cleaner-thando',
    name: 'Thando',
    color_hex: '#B9A3D1',
    is_active: 1,
  },
]

const availabilityMap = new Map()
for (const cleaner of cleaners) {
  for (const date of Array.from({ length: 14 }, (_, index) => iso(addDays(currentWeekStart, index)))) {
    availabilityMap.set(`${cleaner.id}:${date}`, {
      id: `availability-${cleaner.id}-${date}`,
      cleaner_id: cleaner.id,
      date,
      status: 'available',
    })
  }
}

availabilityMap.set(`cleaner-sis-nolu:${iso(addDays(currentWeekStart, 3))}`, {
  id: `availability-cleaner-sis-nolu-${iso(addDays(currentWeekStart, 3))}`,
  cleaner_id: 'cleaner-sis-nolu',
  date: iso(addDays(currentWeekStart, 3)),
  status: 'off',
})
availabilityMap.set(`cleaner-thando:${iso(addDays(nextWeekStart, 0))}`, {
  id: `availability-cleaner-thando-${iso(addDays(nextWeekStart, 0))}`,
  cleaner_id: 'cleaner-thando',
  date: iso(addDays(nextWeekStart, 0)),
  status: 'off',
})

const availability = [...availabilityMap.values()]

const bookings = [
  booking({
    id: 'booking-atlantic-101-current',
    apartmentId: 'apt-atlantic-101',
    guestName: 'Maya Peterson',
    checkOut: addDays(currentWeekStart, 2),
    nights: 3,
  }),
  booking({
    id: 'booking-atlantic-203-current',
    apartmentId: 'apt-atlantic-203',
    guestName: 'Jonah Ellis',
    checkOut: addDays(currentWeekStart, 2),
    nights: 2,
  }),
  booking({
    id: 'booking-atlantic-305-current',
    apartmentId: 'apt-atlantic-305',
    guestName: 'Lerato Mokoena',
    checkOut: addDays(currentWeekStart, 2),
    nights: 4,
  }),
  booking({
    id: 'booking-greenmarket-current',
    apartmentId: 'apt-greenmarket',
    guestName: 'Cleo Adams',
    checkOut: addDays(currentWeekStart, 2),
    nights: 2,
  }),
  booking({
    id: 'booking-camps-bay-current',
    apartmentId: 'apt-camps-bay',
    guestName: 'Noah Brooks',
    checkOut: addDays(currentWeekStart, 4),
    nights: 10,
  }),
  booking({
    id: 'booking-sea-point-current',
    apartmentId: 'apt-sea-point',
    guestName: 'Ella Grant',
    checkOut: addDays(currentWeekStart, 4),
    nights: 3,
  }),
  booking({
    id: 'booking-atlantic-101-next',
    apartmentId: 'apt-atlantic-101',
    guestName: 'Mila West',
    checkOut: addDays(nextWeekStart, 0),
    nights: 2,
  }),
  booking({
    id: 'booking-greenmarket-next',
    apartmentId: 'apt-greenmarket',
    guestName: 'Theo Simon',
    checkOut: addDays(nextWeekStart, 1),
    nights: 3,
  }),
  booking({
    id: 'booking-camps-bay-next',
    apartmentId: 'apt-camps-bay',
    guestName: 'Amara Stone',
    checkOut: addDays(nextWeekStart, 3),
    nights: 8,
  }),
  booking({
    id: 'booking-sea-point-next',
    apartmentId: 'apt-sea-point',
    guestName: 'Kai Dawson',
    checkOut: addDays(nextWeekStart, 5),
    nights: 4,
  }),
]

const manualRequests = [
  {
    id: 'manual-clifton-villa',
    label: 'External client: Clifton Villa',
    apartment_id: null,
    task_date: null,
    weekday: 0,
    is_recurring: 1,
    notes: 'Linen refresh + restock',
    is_active: 1,
  },
  {
    id: 'manual-saturday-window-check',
    label: 'Atlantic Point window check',
    apartment_id: 'apt-atlantic-305',
    task_date: iso(addDays(currentWeekStart, 5)),
    weekday: null,
    is_recurring: 0,
    notes: 'Quick exterior wipe',
    is_active: 1,
  },
]

const distanceMatrix = apartments.flatMap((fromApartment) =>
  apartments.map((toApartment) => ({
    from_apartment_id: fromApartment.id,
    to_apartment_id: toApartment.id,
    minutes: travelMinutes(fromApartment, toApartment),
  })),
)

const syncEvents = [
  {
    id: 'sync-seed-initial',
    sync_type: 'mock-seed',
    status: 'ok',
    details_json: JSON.stringify({
      seededAt: new Date().toISOString(),
      apartments: apartments.length,
      cleaners: cleaners.length,
      bookings: bookings.length,
      note: 'Local mock data ready',
    }),
  },
]

const cleanupSql = [
  'DELETE FROM schedule_change_sets;',
  'DELETE FROM schedule_assignments;',
  'DELETE FROM schedule_runs;',
  'DELETE FROM clean_tasks;',
  'DELETE FROM cleaner_availability;',
  'DELETE FROM manual_clean_requests;',
  'DELETE FROM bookings;',
  'DELETE FROM distance_matrix;',
  'DELETE FROM push_subscriptions;',
  'DELETE FROM sync_events;',
  'DELETE FROM cleaners;',
  'DELETE FROM apartments;',
]

const sql = [
  ...cleanupSql,
  buildInsert('apartments', apartments),
  buildInsert('cleaners', cleaners),
  buildInsert('cleaner_availability', availability),
  buildInsert('bookings', bookings),
  buildInsert('manual_clean_requests', manualRequests),
  buildInsert('distance_matrix', distanceMatrix),
  buildInsert('sync_events', syncEvents),
].join('\n\n')

const tempDir = mkdtempSync(join(tmpdir(), 'stayclean-seed-'))
const sqlFile = join(tempDir, 'seed.sql')

try {
  writeFileSync(sqlFile, sql)
  runWrangler(['d1', 'migrations', 'apply', 'stay-clean', '--local'])
  runWrangler(['d1', 'execute', 'stay-clean', '--local', '--file', sqlFile])
  console.log('\nMock data seeded into local D1.')
  console.log(`Current week starts: ${iso(currentWeekStart)}`)
  console.log(`Next week starts: ${iso(nextWeekStart)}`)
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
