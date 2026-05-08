/**
 * Gratsi Data Import Script
 *
 * Imports the Account Data Export spreadsheet into Supabase.
 * Handles all 3 sheets: accounts, visit notes, and VIP order data.
 *
 * Usage:
 *   node scripts/import-data.mjs <path-to-xlsx> <supabase-service-role-key>
 *
 * The service_role key is in your Supabase dashboard:
 *   Settings > API > service_role (secret)
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'

const SUPABASE_URL = 'https://nzglfdffwchzlsfofwfj.supabase.co'

const xlsxPath = process.argv[2]
const serviceRoleKey = process.argv[3]

if (!xlsxPath || !serviceRoleKey) {
  console.error('Usage: node scripts/import-data.mjs <path-to-xlsx> <service-role-key>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

function cleanText(val) {
  if (val === undefined || val === null || val === '') return null
  return String(val).trim()
}

function parseAccountType(val) {
  if (!val) return null
  const v = String(val).toLowerCase().trim()
  if (v.includes('off')) return 'off_premise'
  if (v.includes('on')) return 'on_premise'
  return 'other'
}

function parseTier(val) {
  if (!val) return null
  const v = String(val).toLowerCase().trim()
  if (v.startsWith('a')) return 'a'
  if (v.startsWith('b')) return 'b'
  if (v.startsWith('c')) return 'c'
  return null
}

function parseBoolean(val) {
  if (!val) return false
  const v = String(val).toLowerCase().trim()
  return v === 'yes' || v === 'true' || v === 'v'
}

function parsePlacementLocations(val) {
  if (!val) return null
  return String(val).split(',').map(s => s.trim()).filter(Boolean)
}

function parsePOSMaterials(val) {
  if (!val) return null
  const v = String(val).trim()
  if (v === 'NO POS ALLOWED') return ['NO POS ALLOWED']
  return v.split(',').map(s => s.trim()).filter(Boolean)
}

function parsePhone(val) {
  if (!val) return null
  let num = typeof val === 'number' ? Math.round(val) : val
  let str = String(num).replace(/[^0-9]/g, '')
  if (str.length === 10) return str
  if (str.length === 11 && str.startsWith('1')) return str.slice(1)
  return str || null
}

function parseDate(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split('T')[0]
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
}

function parseDatetime(val) {
  if (!val) return null
  const str = String(val).trim()
  const match = str.match(/^(\d{1,2})\/(\w+)\/(\d{4})\s+(\d{2}:\d{2}:\d{2}\s+[AP]M)$/i)
  if (match) {
    const [, day, month, year, time] = match
    const d = new Date(`${month} ${day}, ${year} ${time}`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function isScheduleEntry(val) {
  if (!val) return true
  const v = String(val).toLowerCase().trim()
  return v.startsWith('week ') || v === 'sparkling white'
}

async function main() {
  console.log('Reading spreadsheet...')
  const buf = readFileSync(xlsxPath)
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true })
  console.log('Sheets found:', workbook.SheetNames)

  // ── 1. Import Accounts ────────────────────────────────────────

  const acctSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('account management'))
  if (!acctSheet) { console.error('No account management sheet found'); process.exit(1) }

  const acctRows = XLSX.utils.sheet_to_json(workbook.Sheets[acctSheet])
  console.log(`\nAccounts sheet: ${acctRows.length} rows`)

  const accounts = []
  const contactsMap = new Map()

  for (const row of acctRows) {
    const name = cleanText(row['Name'])
    if (!name) continue

    const distRep = cleanText(row['Distributor Rep'])

    accounts.push({
      account_name: name,
      account_type: parseAccountType(row['On/Off Premise']),
      address: cleanText(row['Street']),
      city: cleanText(row['City'])?.toUpperCase() || null,
      state: cleanText(row['State'])?.toUpperCase() || null,
      distributor_rep: distRep && !isScheduleEntry(distRep) ? distRep : null,
      tier: parseTier(row['Account Grade']),
      status: 'active',
      vip_outlet_id: row['VIP Outlet ID'] ? String(Math.round(Number(row['VIP Outlet ID']))) : null,
      price: row['Price'] ? Number(row['Price']) : null,
      grocery_adjacency: cleanText(row['Grocery Adjacency']),
      placement_locations: parsePlacementLocations(row['Placement Locations']),
      pos_materials: parsePOSMaterials(row['POS Materials']),
      red_inventory: row['Red Inventory'] ? Math.round(Number(row['Red Inventory'])) : null,
      white_inventory: row['White Inventory'] ? Math.round(Number(row['White Inventory'])) : null,
      rose_inventory: row['Rose Inventory'] ? Math.round(Number(row['Rose Inventory'])) : null,
      is_multi_location: parseBoolean(row['Do they own multiple stores?']),
      best_times_to_visit: cleanText(row['Best Times To Visit']),
      is_top_100: parseBoolean(row['Top 100?']),
      tasting_priority: parseBoolean(row['Tasting Priority?']),
      good_for_tastings: cleanText(row['Is this a good store for tastings?']),
      instagram: cleanText(row['Instagram']),
      last_check_in: parseDate(row['Last Check-In']),
      monday_item_id: row['Item ID (auto generated)'] ? String(row['Item ID (auto generated)']) : null,
      sku_count: row['SKU Count'] ? Math.round(Number(row['SKU Count'])) : null,
      number_of_tastings: row['Number of Tastings'] ? Math.round(Number(row['Number of Tastings'])) : null,
    })

    const buyerName = cleanText(row["Buyer's Name"])
    if (buyerName) {
      const parts = buyerName.split(/\s+/)
      contactsMap.set(name, {
        first_name: parts[0] || null,
        last_name: parts.slice(1).join(' ') || null,
        email: cleanText(row["Buyer's Email"]),
        phone: parsePhone(row["Buyer's Phone"]),
        title: 'Buyer',
      })
    }
  }

  console.log(`Inserting ${accounts.length} accounts...`)
  const accountIdMap = new Map()

  for (let i = 0; i < accounts.length; i += 100) {
    const batch = accounts.slice(i, i + 100)
    const { data, error } = await supabase.from('accounts').insert(batch).select('id, account_name')
    if (error) {
      console.error(`Batch ${i}-${i + 100} error:`, error.message)
      for (const acct of batch) {
        const { data: single, error: singleErr } = await supabase.from('accounts').insert(acct).select('id, account_name')
        if (singleErr) {
          console.error(`  Failed: ${acct.account_name} - ${singleErr.message}`)
        } else if (single?.[0]) {
          accountIdMap.set(single[0].account_name, single[0].id)
        }
      }
    } else if (data) {
      data.forEach(d => accountIdMap.set(d.account_name, d.id))
    }
    process.stdout.write(`  ${Math.min(i + 100, accounts.length)}/${accounts.length}\r`)
  }
  console.log(`\nInserted ${accountIdMap.size} accounts`)

  // Insert contacts
  const contacts = []
  for (const [acctName, contact] of contactsMap) {
    const acctId = accountIdMap.get(acctName)
    if (acctId) contacts.push({ account_id: acctId, ...contact })
  }

  if (contacts.length > 0) {
    console.log(`Inserting ${contacts.length} contacts...`)
    for (let i = 0; i < contacts.length; i += 100) {
      const { error } = await supabase.from('contacts').insert(contacts.slice(i, i + 100))
      if (error) console.error(`Contacts batch error:`, error.message)
    }
  }

  // ── 2. Import VIP order data ──────────────────────────────────

  const vipSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('vip'))
  if (vipSheet) {
    console.log('\nProcessing VIP order data...')
    const vipRaw = XLSX.utils.sheet_to_json(workbook.Sheets[vipSheet], { header: 1 })

    let headerIdx = -1
    for (let i = 0; i < Math.min(20, vipRaw.length); i++) {
      if (vipRaw[i] && String(vipRaw[i][0] || '').includes('Retail Account')) { headerIdx = i; break }
    }

    if (headerIdx === -1) {
      console.error('Could not find VIP header row')
    } else {
      const dataRows = vipRaw.slice(headerIdx + 1)

      const { data: products } = await supabase.from('products').select('id, product_name')
      const productNameMap = {}
      if (products) {
        for (const p of products) {
          const lower = p.product_name.toLowerCase()
          if (lower.includes('red')) productNameMap['Gratsi Red 3/3L'] = p.id
          if (lower.includes('white') && !lower.includes('sparkling')) productNameMap['Gratsi White 3/3L'] = p.id
          if (lower.includes('rosé') || lower.includes('rose')) {
            productNameMap['Gratsi Rose 3/3L'] = p.id
            productNameMap['Gratsi Rose 6/3L'] = p.id
          }
          if (lower.includes('sparkling')) productNameMap['Gratsi Sparkling White 6/750 ml'] = p.id
        }
      }

      const { data: allAccounts } = await supabase.from('accounts').select('id, vip_outlet_id').not('vip_outlet_id', 'is', null)
      const vipToAcctId = new Map()
      if (allAccounts) allAccounts.forEach(a => { if (a.vip_outlet_id) vipToAcctId.set(a.vip_outlet_id, a.id) })

      const orders = []
      const stubsCreated = new Set()

      for (const row of dataRows) {
        const itemName = String(row[5] || '').trim()
        const retailAccount = String(row[0] || '').trim()
        if (itemName === 'Total' || !itemName || retailAccount === 'Total' || !retailAccount) continue

        const vipId = row[4] ? String(row[4]).trim() : null
        if (!vipId) continue

        let accountId = vipToAcctId.get(vipId)

        if (!accountId && !stubsCreated.has(vipId)) {
          const { data: inserted, error } = await supabase.from('accounts').insert({
            account_name: retailAccount,
            address: cleanText(row[1]),
            city: cleanText(row[2])?.toUpperCase() || null,
            state: cleanText(row[3])?.toUpperCase() || null,
            vip_outlet_id: vipId,
            status: 'active',
            account_type: 'off_premise',
          }).select('id')

          if (error) {
            console.error(`  Stub failed: ${retailAccount} - ${error.message}`)
          } else if (inserted?.[0]) {
            accountId = inserted[0].id
            vipToAcctId.set(vipId, accountId)
          }
          stubsCreated.add(vipId)
        } else if (!accountId) {
          accountId = vipToAcctId.get(vipId)
        }

        const productId = productNameMap[itemName]
        const orderDate = parseDate(row[6])
        const nineL = Number(row[7]) || 0

        if (accountId && productId && orderDate) {
          orders.push({
            account_id: accountId,
            vip_outlet_id: vipId,
            product_id: productId,
            order_date: orderDate,
            nine_liter_equivs: nineL,
          })
        }
      }

      console.log(`Created ${stubsCreated.size} stub accounts from VIP data`)
      console.log(`Inserting ${orders.length} order records...`)

      for (let i = 0; i < orders.length; i += 200) {
        const { error } = await supabase.from('orders').insert(orders.slice(i, i + 200))
        if (error) console.error(`Orders batch ${i} error:`, error.message)
        process.stdout.write(`  ${Math.min(i + 200, orders.length)}/${orders.length}\r`)
      }
      console.log()
    }
  }

  // ── 3. Import Visit Notes as Activity Log ─────────────────────

  const notesSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('visit'))
  if (notesSheet) {
    console.log('\nProcessing visit notes...')
    const notesRaw = XLSX.utils.sheet_to_json(workbook.Sheets[notesSheet], { header: 1 })

    const activityRows = []
    let matched = 0, unmatched = 0

    for (let i = 2; i < notesRaw.length; i++) {
      const row = notesRaw[i]
      const itemName = String(row[1] || '').trim()
      const user = cleanText(row[4])
      const createdAt = parseDatetime(row[5])
      const content = cleanText(row[6])

      if (!itemName || !content) continue

      const acctId = accountIdMap.get(itemName)
      if (!acctId) { unmatched++; continue }
      matched++

      activityRows.push({
        account_id: acctId,
        activity_type: 'note',
        summary: content.length > 500 ? content.slice(0, 500) + '...' : content,
        details: user ? { source: 'monday.com', user } : { source: 'monday.com' },
        created_at: createdAt || undefined,
      })
    }

    console.log(`  Matched: ${matched}, Unmatched: ${unmatched}`)
    console.log(`  Inserting ${activityRows.length} activity records...`)

    for (let i = 0; i < activityRows.length; i += 100) {
      const { error } = await supabase.from('activity_log').insert(activityRows.slice(i, i + 100))
      if (error) console.error(`Activity batch ${i} error:`, error.message)
    }
  }

  // ── Summary ───────────────────────────────────────────────────

  const { count: c1 } = await supabase.from('accounts').select('*', { count: 'exact', head: true })
  const { count: c2 } = await supabase.from('contacts').select('*', { count: 'exact', head: true })
  const { count: c3 } = await supabase.from('orders').select('*', { count: 'exact', head: true })
  const { count: c4 } = await supabase.from('activity_log').select('*', { count: 'exact', head: true })
  const { count: c5 } = await supabase.from('products').select('*', { count: 'exact', head: true })

  console.log('\n===================================')
  console.log('  IMPORT COMPLETE')
  console.log('===================================')
  console.log(`  Accounts:  ${c1}`)
  console.log(`  Contacts:  ${c2}`)
  console.log(`  Products:  ${c5}`)
  console.log(`  Orders:    ${c3}`)
  console.log(`  Activity:  ${c4}`)
  console.log('===================================')
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1) })
