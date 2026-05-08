import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Account, Contact, Product, AccountProduct, Order, ActivityLog } from '@/types'
import { ArrowLeft, Edit2, Plus, Loader2, Phone, Mail, ChevronDown, ChevronUp } from 'lucide-react'

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  prospect: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-600',
  lost: 'bg-red-100 text-red-800',
}
const tierColors: Record<string, string> = {
  a: 'bg-amber-100 text-amber-800',
  b: 'bg-gray-200 text-gray-700',
  c: 'bg-orange-100 text-orange-800',
}

export function AccountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [account, setAccount] = useState<Account | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [accountProducts, setAccountProducts] = useState<(AccountProduct & { product?: Product })[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<(Order & { product?: Product })[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const [showContactForm, setShowContactForm] = useState(false)
  const [newContact, setNewContact] = useState({ first_name: '', last_name: '', title: '', email: '', phone: '' })

  const [showActivityForm, setShowActivityForm] = useState(false)
  const [newActivity, setNewActivity] = useState({ activity_type: 'note' as string, summary: '' })

  const [showLinkProduct, setShowLinkProduct] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')

  const [showAllOrders, setShowAllOrders] = useState(false)
  const [showAllActivity, setShowAllActivity] = useState(false)

  useEffect(() => { if (id) fetchAll() }, [id])

  async function fetchAll() {
    try {
      setLoading(true)
      const [acctRes, contRes, apRes, ordRes, actRes, prodRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('id', id).single(),
        supabase.from('contacts').select('*').eq('account_id', id),
        supabase.from('account_products').select('*, product:products(*)').eq('account_id', id),
        supabase.from('orders').select('*, product:products(*)').eq('account_id', id).order('order_date', { ascending: false }),
        supabase.from('activity_log').select('*').eq('account_id', id).order('created_at', { ascending: false }).limit(100),
        supabase.from('products').select('*').eq('status', 'active'),
      ])
      if (acctRes.error) throw acctRes.error
      setAccount(acctRes.data)
      setContacts(contRes.data || [])
      setAccountProducts(apRes.data || [])
      setOrders(ordRes.data || [])
      setActivity(actRes.data || [])
      setAllProducts(prodRes.data || [])
    } catch (err) {
      console.error('Failed to load account:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault()
    try {
      const { error } = await supabase.from('contacts').insert([{ account_id: id, ...newContact }])
      if (error) throw error
      setNewContact({ first_name: '', last_name: '', title: '', email: '', phone: '' })
      setShowContactForm(false)
      fetchAll()
    } catch (err) { console.error('Failed to add contact:', err) }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault()
    try {
      const { error } = await supabase.from('activity_log').insert([{
        account_id: id,
        user_id: user?.id,
        activity_type: newActivity.activity_type,
        summary: newActivity.summary,
      }])
      if (error) throw error
      setNewActivity({ activity_type: 'note', summary: '' })
      setShowActivityForm(false)
      fetchAll()
    } catch (err) { console.error('Failed to add activity:', err) }
  }

  async function handleLinkProduct() {
    if (!selectedProductId) return
    try {
      const { error } = await supabase.from('account_products').insert([{
        account_id: id,
        product_id: selectedProductId,
        status: 'active',
        date_placed: new Date().toISOString().split('T')[0],
      }])
      if (error) throw error
      setSelectedProductId('')
      setShowLinkProduct(false)
      fetchAll()
    } catch (err) { console.error('Failed to link product:', err) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[#e94560] animate-spin" /></div>
  if (!account) return (
    <div className="max-w-4xl mx-auto p-4">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[#e94560] mb-6"><ArrowLeft className="w-5 h-5" />Back</button>
      <p className="text-gray-600">Account not found</p>
    </div>
  )

  const totalNineL = orders.reduce((s, o) => s + (o.nine_liter_equivs || 0), 0)
  const visibleOrders = showAllOrders ? orders : orders.slice(0, 5)
  const visibleActivity = showAllActivity ? activity : activity.slice(0, 5)

  const detailFields = [
    { label: 'Street', value: account.street },
    { label: 'Full address', value: account.address },
    { label: 'City, state', value: [account.city, account.state].filter(Boolean).join(', ') },
    { label: 'Price', value: account.price ? `$${account.price}` : null },
    { label: 'Distributor rep', value: account.distributor_rep },
    { label: 'Grocery adjacency', value: account.grocery_adjacency },
    { label: 'Best times to visit', value: account.best_times_to_visit },
    { label: 'Last check-in', value: account.last_check_in ? new Date(account.last_check_in).toLocaleDateString() : null },
    { label: 'Pole/floor install date', value: (account as any).pole_floor_install_date ? new Date((account as any).pole_floor_install_date).toLocaleDateString() : null },
    { label: 'SKU count', value: account.sku_count },
    { label: 'Number of tastings', value: account.number_of_tastings },
    { label: 'Instagram', value: account.instagram },
    { label: 'Good for tastings', value: account.good_for_tastings },
    { label: 'Monday Item ID', value: account.monday_item_id },
  ].filter(f => f.value)

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-3">
      {/* Back button */}
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[#e94560] hover:text-[#d63d56] mb-2">
        <ArrowLeft className="w-5 h-5" />Back to Accounts
      </button>

      {/* ── HEADER ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{account.account_name}</h1>
            {(account.street || account.city) && (
              <p className="text-sm text-gray-500 mt-1">{[account.street, account.city, account.state].filter(Boolean).join(', ')}</p>
            )}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {account.tier && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierColors[account.tier]}`}>Tier {account.tier.toUpperCase()}</span>}
              {account.status && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[account.status]}`}>{account.status}</span>}
              {account.account_type && <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">{account.account_type.replace('_', ' ')}</span>}
              {account.vip_outlet_id && <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">VIP {account.vip_outlet_id}</span>}
              {account.is_top_100 && <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">Top 100</span>}
              {account.tasting_needed && <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">Tasting needed</span>}
              {account.is_multi_location && <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800">Multi-location</span>}
            </div>
          </div>
          <Link to={`/accounts/${id}/edit`} className="flex items-center gap-2 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex-shrink-0">
            <Edit2 className="w-4 h-4" />Edit
          </Link>
        </div>
      </div>

      {/* ── SALES SUMMARY ── */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 font-medium">YTD sales (9L)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalNineL.toFixed(1)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 font-medium">Orders</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{orders.length}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 font-medium">Last order</p>
            <p className="text-sm font-bold text-gray-900 mt-1">{new Date(orders[0].order_date).toLocaleDateString()}</p>
          </div>
        </div>
      )}

      {/* ── SHELF INVENTORY ── */}
      {(account.red_inventory || account.white_inventory || account.rose_inventory) ? (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium mb-3">Shelf inventory</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xs text-red-700 font-medium">Red</p>
              <p className="text-2xl font-bold text-red-900">{account.red_inventory || 0}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xs text-amber-700 font-medium">White</p>
              <p className="text-2xl font-bold text-amber-900">{account.white_inventory || 0}</p>
            </div>
            <div className="bg-pink-50 rounded-lg p-3 text-center">
              <p className="text-xs text-pink-700 font-medium">Rosé</p>
              <p className="text-2xl font-bold text-pink-900">{account.rose_inventory || 0}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── ACCOUNT DETAILS ── */}
      {detailFields.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 font-medium">Account details</p>
            <Link to={`/accounts/${id}/edit`} className="flex items-center gap-1 text-[#e94560] hover:text-[#d63d56] text-xs font-medium">
              <Edit2 className="w-3 h-3" />Edit
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            {detailFields.map(f => (
              <div key={f.label}>
                <p className="text-xs text-gray-400">{f.label}</p>
                <p className="text-sm text-gray-900 mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PLACEMENT & POS ── */}
      {((account.placement_locations && account.placement_locations.length > 0) || (account.pos_materials && account.pos_materials.length > 0)) && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          {account.placement_locations && account.placement_locations.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 font-medium mb-2">Placement locations</p>
              <div className="flex flex-wrap gap-1.5">
                {account.placement_locations.map((loc, i) => <span key={i} className="bg-blue-100 text-blue-800 rounded-full px-2.5 py-0.5 text-xs">{loc}</span>)}
              </div>
            </div>
          )}
          {account.pos_materials && account.pos_materials.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">POS materials</p>
              <div className="flex flex-wrap gap-1.5">
                {account.pos_materials.map((m, i) => <span key={i} className="bg-green-100 text-green-800 rounded-full px-2.5 py-0.5 text-xs">{m}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BUYER CONTACTS ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500 font-medium">Buyer contacts ({contacts.length})</p>
          <button onClick={() => setShowContactForm(!showContactForm)} className="flex items-center gap-1 text-[#e94560] hover:text-[#d63d56] text-xs font-medium">
            <Plus className="w-3 h-3" />Add
          </button>
        </div>

        {contacts.length === 0 && !showContactForm && <p className="text-sm text-gray-400">No contacts yet</p>}

        <div className="space-y-3">
          {contacts.map(c => (
            <div key={c.id} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 text-xs font-medium flex-shrink-0">
                {(c.first_name?.[0] || '').toUpperCase()}{(c.last_name?.[0] || '').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{c.first_name} {c.last_name}</p>
                {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {c.phone && <a href={`tel:${c.phone}`} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"><Phone className="w-3.5 h-3.5" /></a>}
                {c.email && <a href={`mailto:${c.email}`} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"><Mail className="w-3.5 h-3.5" /></a>}
              </div>
            </div>
          ))}
        </div>

        {showContactForm && (
          <form onSubmit={handleAddContact} className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="First name" value={newContact.first_name} onChange={e => setNewContact({...newContact, first_name: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" required />
              <input placeholder="Last name" value={newContact.last_name} onChange={e => setNewContact({...newContact, last_name: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" />
            </div>
            <input placeholder="Title (e.g. Wine Buyer)" value={newContact.title} onChange={e => setNewContact({...newContact, title: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" />
            <input type="email" placeholder="Email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" />
            <input type="tel" placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2 text-sm font-medium">Save</button>
              <button type="button" onClick={() => setShowContactForm(false)} className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* ── PRODUCTS ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500 font-medium">Products ({accountProducts.length})</p>
          <button onClick={() => setShowLinkProduct(!showLinkProduct)} className="flex items-center gap-1 text-[#e94560] hover:text-[#d63d56] text-xs font-medium">
            <Plus className="w-3 h-3" />Link
          </button>
        </div>

        {accountProducts.length === 0 && !showLinkProduct && <p className="text-sm text-gray-400">No products linked yet</p>}

        <div className="space-y-2">
          {accountProducts.map(ap => (
            <div key={ap.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{ap.product?.product_name}</p>
                <p className="text-xs text-gray-500">{ap.product?.format}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-green-100 text-green-800 rounded-full px-2 py-0.5 text-xs">{ap.status}</span>
                {ap.date_placed && <span className="text-xs text-gray-400">{new Date(ap.date_placed).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>

        {showLinkProduct && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none">
              <option value="">Select a product...</option>
              {allProducts.map(p => <option key={p.id} value={p.id}>{p.product_name} ({p.format})</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={handleLinkProduct} className="flex-1 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2 text-sm font-medium">Link</button>
              <button onClick={() => setShowLinkProduct(false)} className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ── RECENT ORDERS ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-500 font-medium mb-3">Recent orders</p>

        {orders.length === 0 ? <p className="text-sm text-gray-400">No order data</p> : (
          <>
            <div className="space-y-0">
              {visibleOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.product?.product_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{new Date(o.order_date).toLocaleDateString()}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{o.nine_liter_equivs} 9L</p>
                </div>
              ))}
            </div>
            {orders.length > 5 && (
              <button onClick={() => setShowAllOrders(!showAllOrders)} className="flex items-center gap-1 text-[#e94560] text-xs font-medium mt-2">
                {showAllOrders ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />View all {orders.length} orders</>}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── RECENT ACTIVITY ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500 font-medium">Activity ({activity.length})</p>
          <button onClick={() => setShowActivityForm(!showActivityForm)} className="flex items-center gap-1 text-[#e94560] hover:text-[#d63d56] text-xs font-medium">
            <Plus className="w-3 h-3" />Log
          </button>
        </div>

        {showActivityForm && (
          <form onSubmit={handleAddActivity} className="mb-3 pb-3 border-b border-gray-100 space-y-2">
            <select value={newActivity.activity_type} onChange={e => setNewActivity({...newActivity, activity_type: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none">
              <option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="visit">Visit</option>
            </select>
            <textarea placeholder="What happened?" value={newActivity.summary} onChange={e => setNewActivity({...newActivity, summary: e.target.value})} rows={3} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2 text-sm font-medium">Save</button>
              <button type="button" onClick={() => setShowActivityForm(false)} className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        )}

        {activity.length === 0 && !showActivityForm && <p className="text-sm text-gray-400">No activity yet</p>}

        <div className="space-y-3">
          {visibleActivity.map(a => (
            <div key={a.id} className="flex gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#e94560] mt-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{a.summary}</p>
                <p className="text-xs text-gray-400 mt-1">
                  <span className="capitalize">{a.activity_type}</span>
                  {a.details && typeof a.details === 'object' && (a.details as any).user && <> · {(a.details as any).user}</>}
                  {' · '}{new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {activity.length > 5 && (
          <button onClick={() => setShowAllActivity(!showAllActivity)} className="flex items-center gap-1 text-[#e94560] text-xs font-medium mt-3">
            {showAllActivity ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />View all {activity.length} notes</>}
          </button>
        )}
      </div>

      {/* ── NOTES ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-500 font-medium mb-2">Notes</p>
        <p className="text-sm text-gray-900 whitespace-pre-wrap">{account.notes || 'No notes on this account yet.'}</p>
      </div>
    </div>
  )
}
