import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

interface VIPOrder {
  retailAccount: string
  address: string
  city: string
  state: string
  vipOutletId: string
  itemName: string
  date: string
  nineLiterEquivs: number
}

interface ImportResults {
  ordersImported: number
  ordersSkipped: number
  newAccountsCreated: number
  unmatchedAccounts: string[]
  errors: string[]
}

export function ImportVIP() {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'results'>('upload')
  const [orders, setOrders] = useState<VIPOrder[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResults>({
    ordersImported: 0,
    ordersSkipped: 0,
    newAccountsCreated: 0,
    unmatchedAccounts: [],
    errors: [],
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result as ArrayBuffer
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })

        // Find the VIP sheet — look for one containing "vip" or just use the first/only sheet
        let sheetName = workbook.SheetNames.find(
          (n) => n.toLowerCase().includes('vip')
        ) || workbook.SheetNames[0]

        const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as any[][]

        // Find the header row: look for "Retail Accounts" in column 0
        let headerIdx = -1
        for (let i = 0; i < Math.min(20, raw.length); i++) {
          const cell = String(raw[i]?.[0] || '').trim()
          if (cell.includes('Retail Account') || cell === 'Retail Accounts') {
            headerIdx = i
            break
          }
        }

        if (headerIdx === -1) {
          alert('Could not find the VIP data header row. Expected a row starting with "Retail Accounts".')
          return
        }

        // Parse data rows, skip subtotals (where Item Names = "Total")
        const parsed: VIPOrder[] = []
        for (let i = headerIdx + 1; i < raw.length; i++) {
          const row = raw[i]
          if (!row || !row[0]) continue

          const retailAccount = String(row[0]).trim()
          const itemName = String(row[5] || '').trim()

          // Skip total/subtotal rows
          if (retailAccount === 'Total' || itemName === 'Total' || !itemName) continue

          const vipId = row[4] ? String(row[4]).trim() : ''
          if (!vipId) continue

          // Parse date
          let dateStr = ''
          if (row[6] instanceof Date) {
            dateStr = row[6].toISOString().split('T')[0]
          } else if (row[6]) {
            const d = new Date(row[6])
            dateStr = isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]
          }

          if (!dateStr) continue

          parsed.push({
            retailAccount,
            address: String(row[1] || '').trim(),
            city: String(row[2] || '').trim().toUpperCase(),
            state: String(row[3] || '').trim().toUpperCase(),
            vipOutletId: vipId,
            itemName,
            date: dateStr,
            nineLiterEquivs: Number(row[7]) || 0,
          })
        }

        setOrders(parsed)
        setStep('preview')
      } catch (err) {
        alert('Failed to parse file: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    setImporting(true)
    setStep('importing')

    const errors: string[] = []
    let ordersImported = 0
    let ordersSkipped = 0
    let newAccountsCreated = 0
    const unmatchedAccounts: string[] = []

    try {
      // 1. Build VIP Outlet ID → account_id map from existing accounts
      const { data: existingAccounts, error: acctErr } = await supabase
        .from('accounts')
        .select('id, vip_outlet_id')
        .not('vip_outlet_id', 'is', null)

      if (acctErr) {
        errors.push(`Failed to fetch accounts: ${(acctErr as any)?.message}`)
      }

      const vipToAcctId: Record<string, string> = {}
      existingAccounts?.forEach((a) => {
        if (a.vip_outlet_id) vipToAcctId[a.vip_outlet_id] = a.id
      })

      // 2. Build product name map
      const { data: products } = await supabase.from('products').select('id, product_name')
      const productNameMap: Record<string, string> = {}
      if (products) {
        for (const p of products) {
          const lower = p.product_name.toLowerCase()
          if (lower.includes('red') && !lower.includes('sparkling')) productNameMap['Gratsi Red 3/3L'] = p.id
          if (lower.includes('white') && !lower.includes('sparkling')) productNameMap['Gratsi White 3/3L'] = p.id
          if (lower.includes('rosé') || (lower.includes('rose') && !lower.includes('sparkling'))) {
            productNameMap['Gratsi Rose 3/3L'] = p.id
            productNameMap['Gratsi Rose 6/3L'] = p.id
          }
          if (lower.includes('sparkling')) productNameMap['Gratsi Sparkling White 6/750 ml'] = p.id
        }
      }

      // 3. Process orders — create stub accounts for unknown VIP IDs
      const stubsAttempted = new Set<string>()
      const orderBatch: any[] = []

      for (const order of orders) {
        let accountId = vipToAcctId[order.vipOutletId]

        // Create stub account if not found
        if (!accountId && !stubsAttempted.has(order.vipOutletId)) {
          stubsAttempted.add(order.vipOutletId)
          const { data: newAcct, error: stubErr } = await supabase
            .from('accounts')
            .insert({
              account_name: order.retailAccount,
              address: order.address || null,
              city: order.city || null,
              state: order.state || null,
              vip_outlet_id: order.vipOutletId,
              status: 'active',
              account_type: 'off_premise',
            })
            .select('id')

          if (stubErr) {
            // Might be a dup — try fetching it
            const { data: existing } = await supabase
              .from('accounts')
              .select('id')
              .eq('vip_outlet_id', order.vipOutletId)
              .single()

            if (existing) {
              accountId = existing.id
              vipToAcctId[order.vipOutletId] = existing.id
            } else {
              unmatchedAccounts.push(`${order.retailAccount} (VIP: ${order.vipOutletId})`)
            }
          } else if (newAcct?.[0]) {
            accountId = newAcct[0].id
            vipToAcctId[order.vipOutletId] = newAcct[0].id
            newAccountsCreated++
          }
        } else if (!accountId) {
          // Already attempted stub creation and it failed
          accountId = vipToAcctId[order.vipOutletId]
        }

        const productId = productNameMap[order.itemName]

        if (accountId && productId) {
          orderBatch.push({
            account_id: accountId,
            vip_outlet_id: order.vipOutletId,
            product_id: productId,
            order_date: order.date,
            nine_liter_equivs: order.nineLiterEquivs,
          })
        } else {
          ordersSkipped++
          if (!productId && order.itemName) {
            errors.push(`Unknown product: "${order.itemName}"`)
          }
        }
      }

      // 4. Insert orders in batches
      for (let i = 0; i < orderBatch.length; i += 200) {
        const batch = orderBatch.slice(i, i + 200)
        const { error: insertErr } = await supabase.from('orders').insert(batch)
        if (insertErr) {
          errors.push(`Order batch ${i}: ${(insertErr as any)?.message}`)
        } else {
          ordersImported += batch.length
        }
      }
    } catch (err) {
      errors.push(`Fatal: ${err instanceof Error ? err.message : 'Unknown'}`)
    }

    // Dedupe errors
    const uniqueErrors = [...new Set(errors)]

    setResults({ ordersImported, ordersSkipped, newAccountsCreated, unmatchedAccounts, errors: uniqueErrors })
    setStep('results')
    setImporting(false)
  }

  // Get unique accounts and products for preview
  const uniqueAccounts = new Set(orders.map((o) => o.vipOutletId)).size
  const uniqueProducts = new Set(orders.map((o) => o.itemName)).size
  const totalNineL = orders.reduce((s, o) => s + o.nineLiterEquivs, 0)
  const dateRange = orders.length > 0
    ? `${orders.reduce((min, o) => o.date < min ? o.date : min, orders[0].date)} to ${orders.reduce((max, o) => o.date > max ? o.date : max, orders[0].date)}`
    : ''

  return (
    <div className="space-y-6">
      {/* Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Upload VIP Sales Export</h2>
          <p className="text-gray-600 mb-6">Upload the .xlsx file exactly as exported from VIP. The system will automatically find the data, skip headers and subtotals, and match orders to accounts by VIP Outlet ID.</p>

          <label className="inline-flex items-center gap-2 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-6 py-3 font-medium cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            Choose VIP Export File
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      )}

      {/* Preview */}
      {step === 'preview' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">VIP Data Preview</h2>
          <p className="text-sm text-gray-600">File: <span className="font-medium">{fileName}</span></p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">ORDER LINES</p>
              <p className="text-xl font-bold text-gray-900">{orders.length.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">ACCOUNTS</p>
              <p className="text-xl font-bold text-gray-900">{uniqueAccounts.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">PRODUCTS</p>
              <p className="text-xl font-bold text-gray-900">{uniqueProducts}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">TOTAL 9L EQUIV</p>
              <p className="text-xl font-bold text-gray-900">{totalNineL.toLocaleString()}</p>
            </div>
          </div>

          {dateRange && (
            <p className="text-sm text-gray-600">Date range: <span className="font-medium">{dateRange}</span></p>
          )}

          {/* Sample rows */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-bold">Account</th>
                  <th className="text-left px-3 py-2 font-bold">VIP ID</th>
                  <th className="text-left px-3 py-2 font-bold">Product</th>
                  <th className="text-left px-3 py-2 font-bold">Date</th>
                  <th className="text-right px-3 py-2 font-bold">9L Equiv</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 10).map((o, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-900">{o.retailAccount}</td>
                    <td className="px-3 py-2 text-gray-600">{o.vipOutletId}</td>
                    <td className="px-3 py-2 text-gray-600">{o.itemName}</td>
                    <td className="px-3 py-2 text-gray-600">{o.date}</td>
                    <td className="px-3 py-2 text-gray-900 text-right">{o.nineLiterEquivs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orders.length > 10 && (
            <p className="text-xs text-gray-500">Showing first 10 of {orders.length.toLocaleString()} rows</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setStep('upload'); setOrders([]) }}
              className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-medium hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              className="flex-1 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2.5 font-medium transition-colors"
            >
              Import {orders.length.toLocaleString()} Orders
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Loader2 className="w-12 h-12 text-[#e94560] animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900">Importing VIP sales data...</h2>
          <p className="text-gray-600">Matching orders to accounts and inserting records</p>
        </div>
      )}

      {/* Results */}
      {step === 'results' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">VIP Import Complete</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <p className="text-xs text-green-600 font-medium">ORDERS IMPORTED</p>
              <p className="text-2xl font-bold text-green-900">{results.ordersImported.toLocaleString()}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
              <p className="text-xs text-yellow-600 font-medium">SKIPPED</p>
              <p className="text-2xl font-bold text-yellow-900">{results.ordersSkipped}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-xs text-blue-600 font-medium">NEW ACCOUNTS</p>
              <p className="text-2xl font-bold text-blue-900">{results.newAccountsCreated}</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <p className="text-xs text-red-600 font-medium">ERRORS</p>
              <p className="text-2xl font-bold text-red-900">{results.errors.length}</p>
            </div>
          </div>

          {results.newAccountsCreated > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                {results.newAccountsCreated} new account records were auto-created for VIP outlets not yet in your system.
              </p>
            </div>
          )}

          {results.errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <p className="font-bold text-red-900 mb-2">Errors</p>
              <div className="space-y-1 text-sm text-red-700 max-h-40 overflow-y-auto">
                {results.errors.map((err, i) => <p key={i}>{err}</p>)}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setStep('upload'); setOrders([]); setResults({ ordersImported: 0, ordersSkipped: 0, newAccountsCreated: 0, unmatchedAccounts: [], errors: [] }) }}
              className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-medium hover:bg-gray-50 transition-colors"
            >
              Import Another File
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="flex-1 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2.5 font-medium transition-colors"
            >
              Back to Accounts
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
