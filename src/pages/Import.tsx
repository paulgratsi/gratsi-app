import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { Upload, ChevronRight, AlertCircle, CheckCircle, Download, Loader2 } from 'lucide-react'
import { ImportVIP } from './ImportVIP'

type StepType = 'upload' | 'preview' | 'map' | 'validate' | 'import' | 'results'

interface ParsedData {
  sheets: { [key: string]: any[][] }
  selectedSheet: string
  headers: string[]
}

interface FieldMapping {
  [key: string]: string | null
}

interface ValidationResult {
  rowIndex: number
  status: 'valid' | 'warning' | 'error'
  errors: string[]
}

const ACCOUNT_FIELDS = [
  'account_name',
  'account_type',
  'chain_name',
  'address',
  'street',
  'city',
  'state',
  'zip',
  'vip_outlet_id',
  'distributor_rep',
  'tier',
  'status',
  'price',
  'grocery_adjacency',
  'placement_locations',
  'pos_materials',
  'red_inventory',
  'white_inventory',
  'rose_inventory',
  'sku_count',
  'is_multi_location',
  'best_times_to_visit',
  'is_top_100',
  'tasting_needed',
  'good_for_tastings',
  'number_of_tastings',
  'last_check_in',
  'instagram',
  'monday_item_id',
  'monday_photo_floor_display',
  'monday_photo_shelf',
  'pole_floor_install_date',
  'notes',
  'tags',
]

const CONTACT_FIELDS = ['contact_first_name', 'contact_last_name', 'contact_title', 'contact_email', 'contact_phone']
const ORDER_FIELDS = ['order_date', 'product_name', 'nine_liter_equivs']

export function Import() {
  const [importMode, setImportMode] = useState<'accounts' | 'vip'>('accounts')
  const [step, setStep] = useState<StepType>('upload')
  const [parsed, setParsed] = useState<ParsedData | null>(null)
  const [fieldMap, setFieldMap] = useState<FieldMapping>({})
  const [validation, setValidation] = useState<ValidationResult[]>([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{ imported: number; skipped: number; errors: number; errorLog: string[] }>({
    imported: 0,
    skipped: 0,
    errors: 0,
    errorLog: [],
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result as ArrayBuffer
        const workbook = XLSX.read(data, { type: 'array' })
        const sheets: { [key: string]: any[][] } = {}

        workbook.SheetNames.forEach((name) => {
          const sheet = workbook.Sheets[name]
          const parsed = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
          sheets[name] = parsed
        })

        const selectedSheet = workbook.SheetNames[0]
        const headers = sheets[selectedSheet][0] as string[]

        setParsed({ sheets, selectedSheet, headers })
        setStep('preview')
      } catch (error) {
        alert('Failed to parse file: ' + (error instanceof Error ? error.message : 'Unknown error'))
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        'account_name',
        'account_type',
        'chain_name',
        'address',
        'city',
        'state',
        'zip',
        'vip_outlet_id',
        'distributor_rep',
        'tier',
        'status',
        'contact_first_name',
        'contact_last_name',
        'contact_email',
        'contact_phone',
        'order_date',
        'product_name',
        'nine_liter_equivs',
      ],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'gratsi-import-template.xlsx')
  }

  const autoMapFields = () => {
    if (!parsed) return
    const newMap: FieldMapping = {}
    const allFields = [...ACCOUNT_FIELDS, ...CONTACT_FIELDS, ...ORDER_FIELDS]

    // Known aliases from the Monday.com / VIP export column names
    const aliases: Record<string, string | null> = {
      'name': 'account_name',
      'on/off premise': 'account_type',
      'address': 'address',
      'street': 'street',
      'account grade': 'tier',
      'vip outlet id': 'vip_outlet_id',
      'distributor rep': 'distributor_rep',
      'grocery adjacency': 'grocery_adjacency',
      'placement locations': 'placement_locations',
      'pos materials': 'pos_materials',
      'red inventory': 'red_inventory',
      'white inventory': 'white_inventory',
      'rose inventory': 'rose_inventory',
      'sku count': 'sku_count',
      'do they own multiple stores?': 'is_multi_location',
      'best times to visit': 'best_times_to_visit',
      'top 100?': 'is_top_100',
      'tasting needed?': 'tasting_needed',
      'tasting priority?': 'tasting_needed',
      'is this a good store for tastings?': 'good_for_tastings',
      'number of tastings': 'number_of_tastings',
      'last check-in': 'last_check_in',
      'item id (auto generated)': 'monday_item_id',
      'take photo of floor display': 'monday_photo_floor_display',
      'take photo of shelf': 'monday_photo_shelf',
      'pole/floor install date': 'pole_floor_install_date',
      "buyer's name": 'contact_first_name',
      "buyer's email": 'contact_email',
      "buyer's phone": 'contact_phone',
      'account manager': null,  // skip — no text field, assigned_to is UUID
      'subitems': null,
      'link to tastings': null,
      'distributor rep.1': null,
    }

    parsed.headers.forEach((header) => {
      const normalized = header.toLowerCase().trim()

      // Check aliases first
      if (normalized in aliases) {
        newMap[header] = aliases[normalized]
        return
      }

      // Then try exact/underscore match
      const match = allFields.find((field) =>
        field.toLowerCase() === normalized ||
        field.toLowerCase().replace(/_/g, ' ') === normalized
      )
      newMap[header] = match || null
    })

    setFieldMap(newMap)
  }

  const handleValidate = () => {
    if (!parsed || !fieldMap) return

    const data = parsed.sheets[parsed.selectedSheet].slice(1)
    const validationResults: ValidationResult[] = []

    data.forEach((row, rowIndex) => {
      const result: ValidationResult = {
        rowIndex,
        status: 'valid',
        errors: [],
      }

      const rowData: { [key: string]: any } = {}
      parsed.headers.forEach((header, colIndex) => {
        rowData[fieldMap[header] || ''] = row[colIndex]
      })

      if (!rowData['account_name'] || rowData['account_name'] === '') {
        result.status = 'error'
        result.errors.push('Missing account_name')
      }

      validationResults.push(result)
    })

    setValidation(validationResults)
    setStep('validate')
  }

  const handleImport = async () => {
    if (!parsed) return
    setImporting(true)

    try {
      const data = parsed.sheets[parsed.selectedSheet].slice(1)
      let imported = 0
      let skipped = 0
      const errorLog: string[] = []

      for (let i = 0; i < data.length; i += 100) {
        const batch = data.slice(i, i + 100)
        const accountRows: any[] = []
        const contactRows: any[] = []
        const orderRows: any[] = []

        batch.forEach((row, batchIndex) => {
          const rowIndex = i + batchIndex
          const rowData: { [key: string]: any } = {}

          parsed.headers.forEach((header, colIndex) => {
            const field = fieldMap[header]
            if (field) rowData[field] = row[colIndex]
          })

          if (!rowData['account_name']) {
            skipped++
            return
          }

          // Helper functions for data type conversion
          const toText = (v: any) => v != null && v !== '' ? String(v).trim() : null
          const toNumber = (v: any) => { const n = Number(v); return isNaN(n) ? null : n }
          const toInt = (v: any) => { const n = Number(v); return isNaN(n) ? null : Math.round(n) }
          const toBool = (v: any) => {
            if (!v) return false
            const s = String(v).toLowerCase().trim()
            return s === 'yes' || s === 'true' || s === 'v' || s === '1'
          }
          const toArray = (v: any) => {
            if (!v) return null
            return String(v).split(',').map((s: string) => s.trim()).filter(Boolean)
          }
          const toDate = (v: any) => {
            if (!v) return null
            if (v instanceof Date) return v.toISOString().split('T')[0]
            const d = new Date(v)
            return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
          }
          const parseAccountType = (v: any) => {
            if (!v) return null
            const s = String(v).toLowerCase()
            if (s.includes('off')) return 'off_premise'
            if (s.includes('on')) return 'on_premise'
            return 'other'
          }
          const parseTier = (v: any) => {
            if (!v) return null
            const s = String(v).toLowerCase().trim()
            if (s.startsWith('a')) return 'a'
            if (s.startsWith('b')) return 'b'
            if (s.startsWith('c')) return 'c'
            return null
          }
          const parseVipId = (v: any) => {
            if (!v || v === '') return null
            return String(typeof v === 'number' ? Math.round(v) : v).trim()
          }
          const parsePhone = (v: any) => {
            if (!v) return null
            const str = String(typeof v === 'number' ? Math.round(v) : v).replace(/[^0-9]/g, '')
            return str || null
          }

          const accountRow: any = {
            account_name: toText(rowData['account_name']),
            account_type: parseAccountType(rowData['account_type']),
            chain_name: toText(rowData['chain_name']),
            address: toText(rowData['address']),
            street: toText(rowData['street']),
            city: toText(rowData['city'])?.toUpperCase() || null,
            state: toText(rowData['state'])?.toUpperCase() || null,
            zip: toText(rowData['zip']),
            vip_outlet_id: parseVipId(rowData['vip_outlet_id']),
            distributor_rep: toText(rowData['distributor_rep']),
            tier: parseTier(rowData['tier']),
            status: rowData['status'] ? String(rowData['status']).toLowerCase().trim() : 'active',
            price: toNumber(rowData['price']),
            grocery_adjacency: toText(rowData['grocery_adjacency']),
            placement_locations: toArray(rowData['placement_locations']),
            pos_materials: toArray(rowData['pos_materials']),
            red_inventory: toInt(rowData['red_inventory']),
            white_inventory: toInt(rowData['white_inventory']),
            rose_inventory: toInt(rowData['rose_inventory']),
            sku_count: toInt(rowData['sku_count']),
            is_multi_location: toBool(rowData['is_multi_location']),
            best_times_to_visit: toText(rowData['best_times_to_visit']),
            is_top_100: toBool(rowData['is_top_100']),
            tasting_needed: toBool(rowData['tasting_needed']),
            good_for_tastings: toText(rowData['good_for_tastings']),
            number_of_tastings: toInt(rowData['number_of_tastings']),
            last_check_in: toDate(rowData['last_check_in']),
            instagram: toText(rowData['instagram']),
            monday_item_id: toText(rowData['monday_item_id']),
            monday_photo_floor_display: toText(rowData['monday_photo_floor_display']),
            monday_photo_shelf: toText(rowData['monday_photo_shelf']),
            pole_floor_install_date: toDate(rowData['pole_floor_install_date']),
            notes: toText(rowData['notes']),
          }

          // Remove null keys to avoid overwriting defaults
          Object.keys(accountRow).forEach(k => { if (accountRow[k] === null || accountRow[k] === undefined) delete accountRow[k] })

          accountRows.push({ ...accountRow, temp_row_id: rowIndex })

          if (rowData['contact_first_name'] || rowData['contact_email']) {
            contactRows.push({
              first_name: toText(rowData['contact_first_name']),
              last_name: toText(rowData['contact_last_name']),
              title: toText(rowData['contact_title']) || 'Buyer',
              email: toText(rowData['contact_email']),
              phone: parsePhone(rowData['contact_phone']),
              temp_row_id: rowIndex,
            })
          }

          if (rowData['order_date'] && rowData['product_name']) {
            orderRows.push({
              order_date: rowData['order_date'],
              product_name: rowData['product_name'],
              nine_liter_equivs: rowData['nine_liter_equivs'] || 0,
              temp_row_id: rowIndex,
            })
          }
        })

        if (accountRows.length > 0) {
          const accountMap: { [key: number]: string } = {}

          // Try batch insert first
          const { data: insertedAccounts, error: accountError } = await supabase
            .from('accounts')
            .insert(accountRows.map(({ temp_row_id, ...acc }) => acc))
            .select()

          if (!accountError && insertedAccounts) {
            // Batch succeeded
            insertedAccounts.forEach((acc, idx) => {
              if (accountRows[idx]) accountMap[accountRows[idx].temp_row_id] = acc.id
            })
            imported += insertedAccounts.length
          } else {
            // Batch failed — fall back to inserting one row at a time
            const batchErrMsg = (accountError as any)?.message || 'Unknown batch error'
            errorLog.push(`Batch failed (${batchErrMsg}), retrying individually...`)

            for (const row of accountRows) {
              const { temp_row_id, ...acct } = row
              const { data: single, error: singleErr } = await supabase
                .from('accounts')
                .insert(acct)
                .select()

              if (singleErr) {
                const msg = (singleErr as any)?.message || 'Unknown'
                errorLog.push(`Row "${acct.account_name}": ${msg}`)
                skipped++
              } else if (single?.[0]) {
                accountMap[temp_row_id] = single[0].id
                imported++
              }
            }
          }

          // Insert contacts for successfully imported accounts
          if (contactRows.length > 0) {
            const contactsToInsert = contactRows
              .map(({ temp_row_id, ...contact }) => ({
                ...contact,
                account_id: accountMap[temp_row_id],
              }))
              .filter((c) => c.account_id)

            if (contactsToInsert.length > 0) {
              const { error: contactError } = await supabase
                .from('contacts')
                .insert(contactsToInsert)

              if (contactError) {
                errorLog.push(`Contacts: ${(contactError as any)?.message || 'Unknown'}`)
              }
            }
          }

          // Insert orders for successfully imported accounts
          if (orderRows.length > 0) {
            const { data: products } = await supabase.from('products').select('id, product_name')
            const productMap: { [key: string]: string } = {}
            products?.forEach((p) => { productMap[p.product_name] = p.id })

            const ordersToInsert = orderRows
              .map(({ temp_row_id, product_name, ...order }) => ({
                ...order,
                account_id: accountMap[temp_row_id],
                product_id: productMap[product_name],
              }))
              .filter((o) => o.account_id && o.product_id)

            if (ordersToInsert.length > 0) {
              const { error: orderError } = await supabase.from('orders').insert(ordersToInsert)
              if (orderError) {
                errorLog.push(`Orders: ${(orderError as any)?.message || 'Unknown'}`)
              }
            }
          }
        }
      }

      // ── Auto-import visit notes if the sheet exists ────────────
      let visitNotesImported = 0
      const visitNotesSheet = Object.keys(parsed.sheets).find(
        (name) => name.toLowerCase().includes('visit') && name.toLowerCase().includes('note')
      )

      if (visitNotesSheet) {
        try {
          // First build a monday_item_id → account_id lookup from the DB
          const { data: acctLookup } = await supabase
            .from('accounts')
            .select('id, monday_item_id')
            .not('monday_item_id', 'is', null)

          const mondayIdToAcctId: Record<string, string> = {}
          acctLookup?.forEach((a) => {
            if (a.monday_item_id) mondayIdToAcctId[a.monday_item_id] = a.id
          })

          const notesRows = parsed.sheets[visitNotesSheet]
          // Row 0 is column labels from Monday: Item ID, Item Name, Content Type, ..., User, Created At, Update Content
          // Data starts at row 2 (row 1 has the actual header text)
          const activityBatch: any[] = []

          for (let i = 2; i < notesRows.length; i++) {
            const row = notesRows[i]
            const mondayItemId = row[0] ? String(row[0]).trim() : null
            const userName = row[4] ? String(row[4]).trim() : null
            const createdAtRaw = row[5] ? String(row[5]).trim() : null
            const content = row[6] ? String(row[6]).trim() : null

            if (!mondayItemId || !content) continue

            const accountId = mondayIdToAcctId[mondayItemId]
            if (!accountId) continue

            // Parse Monday.com date format: "30/September/2024  06:23:31 PM"
            let createdAt: string | undefined
            if (createdAtRaw) {
              const match = createdAtRaw.match(/^(\d{1,2})\/(\w+)\/(\d{4})\s+(\d{2}:\d{2}:\d{2}\s+[AP]M)$/i)
              if (match) {
                const d = new Date(`${match[2]} ${match[1]}, ${match[3]} ${match[4]}`)
                if (!isNaN(d.getTime())) createdAt = d.toISOString()
              }
            }

            activityBatch.push({
              account_id: accountId,
              activity_type: 'note',
              summary: content.length > 500 ? content.slice(0, 500) + '...' : content,
              details: { source: 'monday.com', user: userName },
              ...(createdAt ? { created_at: createdAt } : {}),
            })
          }

          // Insert in batches
          for (let i = 0; i < activityBatch.length; i += 100) {
            const batch = activityBatch.slice(i, i + 100)
            const { error: actErr } = await supabase.from('activity_log').insert(batch)
            if (actErr) errorLog.push(`Visit notes batch error: ${actErr.message}`)
            else visitNotesImported += batch.length
          }
        } catch (err) {
          errorLog.push(`Visit notes import error: ${err instanceof Error ? err.message : 'Unknown'}`)
        }
      }

      setResults({
        imported,
        skipped,
        errors: errorLog.length,
        errorLog,
        ...(visitNotesImported > 0 ? {} : {}),
      })
      // Store visit notes count for display
      ;(window as any).__visitNotesImported = visitNotesImported
      setStep('results')
    } catch (error) {
      alert('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setImporting(false)
    }
  }

  const steps: { step: StepType; label: string }[] = [
    { step: 'upload', label: 'Upload' },
    { step: 'preview', label: 'Preview' },
    { step: 'map', label: 'Map' },
    { step: 'validate', label: 'Validate' },
    { step: 'import', label: 'Import' },
    { step: 'results', label: 'Results' },
  ]

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Import Data</h1>

      {/* Import Mode Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setImportMode('accounts')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            importMode === 'accounts'
              ? 'bg-[#1a1a2e] text-white'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Accounts &amp; Contacts
        </button>
        <button
          onClick={() => setImportMode('vip')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            importMode === 'vip'
              ? 'bg-[#1a1a2e] text-white'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          VIP Sales Data
        </button>
      </div>

      {importMode === 'vip' ? (
        <ImportVIP />
      ) : (
      <>
      <p className="text-gray-600 mb-8">Import accounts, contacts, and visit notes from a spreadsheet</p>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {steps.map((s, idx) => (
          <div key={s.step} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step === s.step
                  ? 'bg-[#e94560] text-white'
                  : steps.findIndex((x) => x.step === step) > idx
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
              }`}
            >
              {steps.findIndex((x) => x.step === step) > idx ? '✓' : idx + 1}
            </div>
            <span
              className={`text-sm font-medium hidden sm:inline ${
                step === s.step ? 'text-[#e94560]' : 'text-gray-600'
              }`}
            >
              {s.label}
            </span>
            {idx < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 hidden sm:block" />}
          </div>
        ))}
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <div className="text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Choose a file</h2>
            <p className="text-gray-600 mb-6">Upload an Excel or CSV file with your data</p>

            <label className="inline-flex items-center gap-2 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-6 py-3 font-medium cursor-pointer transition-colors mb-4">
              <Upload className="w-4 h-4" />
              Choose File
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
            </label>

            <div className="flex gap-2 justify-center">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && parsed && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">File Preview</h2>
            <p className="text-sm text-gray-600 mb-4">
              Sheet: <span className="font-bold">{parsed.selectedSheet}</span> | Rows:{' '}
              <span className="font-bold">{parsed.sheets[parsed.selectedSheet].length - 1}</span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {parsed.headers.map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-bold text-gray-900">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.sheets[parsed.selectedSheet].slice(1, 11).map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    {parsed.headers.map((h, colIdx) => (
                      <td key={colIdx} className="px-3 py-2 text-gray-600">
                        {row[colIdx] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => {
              autoMapFields()
              setStep('map')
            }}
            className="w-full bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2.5 font-medium transition-colors"
          >
            Continue to Mapping
          </button>
        </div>
      )}

      {/* Map Step */}
      {step === 'map' && parsed && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Map Columns to Fields</h2>
          <p className="text-sm text-gray-600 mb-4">Select which spreadsheet column maps to each data field</p>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {parsed.headers.map((header) => (
              <div key={header} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{header}</p>
                </div>
                <select
                  value={fieldMap[header] || ''}
                  onChange={(e) => setFieldMap({ ...fieldMap, [header]: e.target.value || null })}
                  className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
                >
                  <option value="">Skip this column</option>
                  <optgroup label="Account Fields">
                    {ACCOUNT_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Contact Fields">
                    {CONTACT_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Order Fields">
                    {ORDER_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            ))}
          </div>

          <button
            onClick={handleValidate}
            className="w-full bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2.5 font-medium transition-colors"
          >
            Validate Data
          </button>
        </div>
      )}

      {/* Validate Step */}
      {step === 'validate' && validation.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Validation Results</h2>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 border border-green-100 rounded-lg p-3">
              <p className="text-xs text-green-600 font-medium">VALID</p>
              <p className="text-2xl font-bold text-green-900">
                {validation.filter((v) => v.status === 'valid').length}
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
              <p className="text-xs text-yellow-600 font-medium">WARNINGS</p>
              <p className="text-2xl font-bold text-yellow-900">
                {validation.filter((v) => v.status === 'warning').length}
              </p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs text-red-600 font-medium">ERRORS</p>
              <p className="text-2xl font-bold text-red-900">
                {validation.filter((v) => v.status === 'error').length}
              </p>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {validation.slice(0, 20).map((v) => (
              <div
                key={v.rowIndex}
                className={`p-3 rounded-lg flex gap-2 ${
                  v.status === 'error'
                    ? 'bg-red-50 border border-red-100'
                    : v.status === 'warning'
                      ? 'bg-yellow-50 border border-yellow-100'
                      : 'bg-green-50 border border-green-100'
                }`}
              >
                {v.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-gray-900">Row {v.rowIndex + 2}</p>
                  {v.errors.length > 0 && <p className="text-sm text-gray-600">{v.errors.join(', ')}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep('map')}
              className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-medium hover:bg-gray-50 transition-colors"
            >
              Back to Mapping
            </button>
            <button
              onClick={() => setStep('import')}
              className="flex-1 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2.5 font-medium transition-colors"
              disabled={validation.filter((v) => v.status === 'error').length > 0}
            >
              Proceed to Import
            </button>
          </div>
        </div>
      )}

      {/* Import Step */}
      {step === 'import' && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center space-y-4">
          {importing ? (
            <>
              <Loader2 className="w-12 h-12 text-[#e94560] animate-spin mx-auto" />
              <h2 className="text-lg font-bold text-gray-900">Importing your data...</h2>
              <p className="text-gray-600">This may take a few moments</p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900">Ready to import?</h2>
              <p className="text-gray-600">
                {parsed ? `${parsed.sheets[parsed.selectedSheet].length - 1} rows will be imported` : 'No data'}
              </p>
              <button
                onClick={handleImport}
                className="bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-6 py-3 font-medium transition-colors inline-block"
              >
                Start Import
              </button>
            </>
          )}
        </div>
      )}

      {/* Results Step */}
      {step === 'results' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Import Complete</h2>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <p className="text-xs text-green-600 font-medium">IMPORTED</p>
              <p className="text-3xl font-bold text-green-900">{results.imported}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
              <p className="text-xs text-yellow-600 font-medium">SKIPPED</p>
              <p className="text-3xl font-bold text-yellow-900">{results.skipped}</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <p className="text-xs text-red-600 font-medium">ERRORS</p>
              <p className="text-3xl font-bold text-red-900">{results.errors}</p>
            </div>
          </div>

          {(window as any).__visitNotesImported > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-xs text-blue-600 font-medium">VISIT NOTES IMPORTED</p>
              <p className="text-2xl font-bold text-blue-900">{(window as any).__visitNotesImported}</p>
              <p className="text-xs text-blue-600 mt-1">Historical notes from Monday.com matched via Item ID</p>
            </div>
          )}

          {results.errorLog.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <p className="font-bold text-red-900 mb-2">Error Log</p>
              <div className="space-y-1 text-sm text-red-700">
                {results.errorLog.slice(0, 10).map((error, idx) => (
                  <p key={idx}>{error}</p>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2.5 font-medium transition-colors"
          >
            Back to Accounts
          </button>
        </div>
      )}
      </>
      )}
    </div>
  )
}
