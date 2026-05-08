import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/types'
import { ArrowLeft, Loader2, X } from 'lucide-react'

const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']

export function AccountForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Account>>({
    account_name: '',
    account_type: 'on_premise',
    tier: 'b',
    status: 'prospect',
    placement_locations: [],
    pos_materials: [],
  })

  useEffect(() => {
    if (id) {
      fetchAccount()
    } else {
      setLoading(false)
    }
  }, [id])

  async function fetchAccount() {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setForm(data)
    } catch (error) {
      console.error('Failed to fetch account:', error)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (id) {
        const { error } = await supabase
          .from('accounts')
          .update(form)
          .eq('id', id)

        if (error) throw error
        navigate(`/accounts/${id}`)
      } else {
        const { data, error } = await supabase
          .from('accounts')
          .insert([form])
          .select()
          .single()

        if (error) throw error
        navigate(`/accounts/${data.id}`)
      }
    } catch (error) {
      console.error('Failed to save account:', error)
      alert('Failed to save account')
    } finally {
      setSaving(false)
    }
  }

  const addPlacement = (text: string) => {
    if (text.trim()) {
      setForm({
        ...form,
        placement_locations: [...(form.placement_locations || []), text.trim()],
      })
    }
  }

  const removePlacement = (index: number) => {
    setForm({
      ...form,
      placement_locations: form.placement_locations?.filter((_, i) => i !== index),
    })
  }

  const addPosMaterial = (text: string) => {
    if (text.trim()) {
      setForm({
        ...form,
        pos_materials: [...(form.pos_materials || []), text.trim()],
      })
    }
  }

  const removePosMaterial = (index: number) => {
    setForm({
      ...form,
      pos_materials: form.pos_materials?.filter((_, i) => i !== index),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 text-[#e94560] animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[#e94560] hover:text-[#d63d56] mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        {id ? 'Edit Account' : 'New Account'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Name *
            </label>
            <input
              type="text"
              value={form.account_name || ''}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Type
              </label>
              <select
                value={form.account_type || 'on_premise'}
                onChange={(e) => setForm({ ...form, account_type: e.target.value as any })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              >
                <option value="on_premise">On Premise</option>
                <option value="off_premise">Off Premise</option>
                <option value="chain">Chain</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chain Name
              </label>
              <input
                type="text"
                value={form.chain_name || ''}
                onChange={(e) => setForm({ ...form, chain_name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Address</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street Address
            </label>
            <input
              type="text"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={form.city || ''}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <select
                value={form.state || ''}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              >
                <option value="">Select State</option>
                {US_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code
              </label>
              <input
                type="text"
                value={form.zip || ''}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Account Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tier
              </label>
              <div className="flex gap-2">
                {(['a', 'b', 'c'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setForm({ ...form, tier })}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                      form.tier === tier
                        ? 'bg-[#e94560] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tier.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={form.status || 'prospect'}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              >
                <option value="active">Active</option>
                <option value="prospect">Prospect</option>
                <option value="inactive">Inactive</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Distributor Rep
              </label>
              <input
                type="text"
                value={form.distributor_rep || ''}
                onChange={(e) => setForm({ ...form, distributor_rep: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                VIP Outlet ID
              </label>
              <input
                type="text"
                value={form.vip_outlet_id || ''}
                onChange={(e) => setForm({ ...form, vip_outlet_id: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Red Inventory
              </label>
              <input
                type="number"
                value={form.red_inventory || ''}
                onChange={(e) => setForm({ ...form, red_inventory: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                White Inventory
              </label>
              <input
                type="number"
                value={form.white_inventory || ''}
                onChange={(e) => setForm({ ...form, white_inventory: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rose Inventory
              </label>
              <input
                type="number"
                value={form.rose_inventory || ''}
                onChange={(e) => setForm({ ...form, rose_inventory: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Placement & Materials */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Placement & Materials</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Placement Locations
            </label>
            <div className="flex gap-2 mb-2">
              {(form.placement_locations || []).map((loc, i) => (
                <span
                  key={i}
                  className="bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-sm flex items-center gap-2"
                >
                  {loc}
                  <button
                    type="button"
                    onClick={() => removePlacement(i)}
                    className="hover:opacity-70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                id="placement-input"
                placeholder="Add location"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const input = e.currentTarget
                    addPlacement(input.value)
                    input.value = ''
                  }
                }}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('placement-input') as HTMLInputElement
                  if (input) {
                    addPlacement(input.value)
                    input.value = ''
                  }
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              POS Materials
            </label>
            <div className="flex gap-2 flex-wrap mb-2">
              {(form.pos_materials || []).map((mat, i) => (
                <span
                  key={i}
                  className="bg-purple-100 text-purple-800 rounded-full px-3 py-1 text-sm flex items-center gap-2"
                >
                  {mat}
                  <button
                    type="button"
                    onClick={() => removePosMaterial(i)}
                    className="hover:opacity-70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                id="material-input"
                placeholder="Add material"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const input = e.currentTarget
                    addPosMaterial(input.value)
                    input.value = ''
                  }
                }}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('material-input') as HTMLInputElement
                  if (input) {
                    addPosMaterial(input.value)
                    input.value = ''
                  }
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Additional Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Best Times to Visit
            </label>
            <input
              type="text"
              value={form.best_times_to_visit || ''}
              onChange={(e) => setForm({ ...form, best_times_to_visit: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              placeholder="e.g., Tuesday-Thursday 10am-2pm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              rows={4}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 sticky bottom-0 bg-gray-50 p-4 -mx-4 -mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2.5 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Account'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
