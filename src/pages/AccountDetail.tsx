import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Account, Contact, Product, AccountProduct, Order, ActivityLog } from '@/types'
import { ArrowLeft, Edit2, Plus, Loader2, Phone, Mail, ExternalLink } from 'lucide-react'

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

type TabType = 'info' | 'contacts' | 'products' | 'orders' | 'activity'

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
  const [activeTab, setActiveTab] = useState<TabType>('info')

  const [showContactForm, setShowContactForm] = useState(false)
  const [newContact, setNewContact] = useState({ first_name: '', last_name: '', title: '', email: '', phone: '' })

  const [showActivityForm, setShowActivityForm] = useState(false)
  const [newActivity, setNewActivity] = useState({ activity_type: 'note' as string, summary: '' })

  const [showLinkProduct, setShowLinkProduct] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')

  useEffect(() => { if (id) fetchAll() }, [id])

  async function fetchAll() {
    try {
      setLoading(true)
      const [acctRes, contRes, apRes, ordRes, actRes, prodRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('id', id).single(),
        supabase.from('contacts').select('*').eq('account_id', id),
        supabase.from('account_products').select('*, product:products(*)').eq('account_id', id),
        supabase.from('orders').select('*, product:products(*)').eq('account_id', id).order('order_date', { ascending: false }),
        supabase.from('activity_log').select('*').eq('account_id', id).order('created_at', { ascending: false }).limit(50),
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

  return (
    <div className="max-w-4xl mx-auto p-4">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[#e94560] hover:text-[#d63d56] mb-4">
        <ArrowLeft className="w-5 h-5" />Back to Accounts
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{account.account_name}</h1>
          <div className="flex gap-2 mt-2 flex-wrap">
            {account.tier && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierColors[account.tier] || ''}`}>Tier {account.tier.toUpperCase()}</span>}
            {account.status && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[account.status] || ''}`}>{account.status}</span>}
            {account.account_type && <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">{account.account_type.replace('_', ' ')}</span>}
            {account.vip_outlet_id && <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">VIP {account.vip_outlet_id}</span>}
          </div>
        </div>
        <Link to={`/accounts/${id}/edit`} className="flex items-center gap-2 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2.5 font-medium transition-colors flex-shrink-0">
          <Edit2 className="w-4 h-4" />Edit
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex gap-6 min-w-max">
          {(['info','contacts','products','orders','activity'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? 'text-[#e94560] border-[#e94560]' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
              {tab}{tab === 'orders' ? ` (${orders.length})` : tab === 'contacts' ? ` (${contacts.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* INFO TAB */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: 'ADDRESS', value: account.address },
              { label: 'CITY, STATE', value: [account.city, account.state].filter(Boolean).join(', ') },
              { label: 'DISTRIBUTOR REP', value: account.distributor_rep },
              { label: 'PRICE', value: account.price ? `$${account.price}` : null },
              { label: 'GROCERY ADJACENCY', value: account.grocery_adjacency },
              { label: 'BEST TIMES TO VISIT', value: account.best_times_to_visit },
              { label: 'LAST CHECK-IN', value: account.last_check_in ? new Date(account.last_check_in).toLocaleDateString() : null },
              { label: 'INSTAGRAM', value: account.instagram },
            ].filter(f => f.value).map(f => (
              <div key={f.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 font-medium mb-1">{f.label}</p>
                <p className="text-gray-900">{f.value}</p>
              </div>
            ))}
          </div>

          {(account.red_inventory || account.white_inventory || account.rose_inventory) ? (
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Shelf Inventory</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 rounded-xl border border-red-100 p-4 text-center">
                  <p className="text-xs text-red-600 font-medium">RED</p>
                  <p className="text-2xl font-bold text-red-900">{account.red_inventory || 0}</p>
                </div>
                <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 text-center">
                  <p className="text-xs text-amber-600 font-medium">WHITE</p>
                  <p className="text-2xl font-bold text-amber-900">{account.white_inventory || 0}</p>
                </div>
                <div className="bg-pink-50 rounded-xl border border-pink-100 p-4 text-center">
                  <p className="text-xs text-pink-600 font-medium">ROSÉ</p>
                  <p className="text-2xl font-bold text-pink-900">{account.rose_inventory || 0}</p>
                </div>
              </div>
            </div>
          ) : null}

          {account.placement_locations && account.placement_locations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-medium mb-2">PLACEMENT LOCATIONS</p>
              <div className="flex flex-wrap gap-2">
                {account.placement_locations.map((loc, i) => <span key={i} className="bg-blue-100 text-blue-800 rounded-full px-2.5 py-0.5 text-xs">{loc}</span>)}
              </div>
            </div>
          )}
          {account.pos_materials && account.pos_materials.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-medium mb-2">POS MATERIALS</p>
              <div className="flex flex-wrap gap-2">
                {account.pos_materials.map((m, i) => <span key={i} className="bg-green-100 text-green-800 rounded-full px-2.5 py-0.5 text-xs">{m}</span>)}
              </div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {account.is_top_100 && <span className="bg-amber-100 text-amber-800 rounded-full px-3 py-1 text-xs font-medium">Top 100</span>}
            {account.tasting_needed && <span className="bg-purple-100 text-purple-800 rounded-full px-3 py-1 text-xs font-medium">Tasting Needed</span>}
            {account.is_multi_location && <span className="bg-indigo-100 text-indigo-800 rounded-full px-3 py-1 text-xs font-medium">Multi-Location</span>}
          </div>
          {account.notes && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-medium mb-1">NOTES</p>
              <p className="text-gray-900 whitespace-pre-wrap">{account.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* CONTACTS TAB */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {contacts.length === 0 && !showContactForm && <p className="text-gray-500 text-center py-8">No contacts yet</p>}
          {contacts.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="font-bold text-gray-900">{c.first_name} {c.last_name}</h3>
              {c.title && <p className="text-sm text-gray-600">{c.title}</p>}
              <div className="flex gap-4 mt-2 flex-wrap">
                {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-[#e94560] text-sm"><Phone className="w-4 h-4" />{c.phone}</a>}
                {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-[#e94560] text-sm"><Mail className="w-4 h-4" />{c.email}</a>}
              </div>
            </div>
          ))}
          {!showContactForm ? (
            <button onClick={() => setShowContactForm(true)} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-medium hover:bg-gray-50"><Plus className="w-4 h-4" />Add Contact</button>
          ) : (
            <form onSubmit={handleAddContact} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="First Name" value={newContact.first_name} onChange={e => setNewContact({...newContact, first_name: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" required />
                <input placeholder="Last Name" value={newContact.last_name} onChange={e => setNewContact({...newContact, last_name: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" />
              </div>
              <input placeholder="Title (e.g. Wine Buyer)" value={newContact.title} onChange={e => setNewContact({...newContact, title: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" />
              <input type="email" placeholder="Email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" />
              <input type="tel" placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2 font-medium">Save</button>
                <button type="button" onClick={() => setShowContactForm(false)} className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {accountProducts.length === 0 && !showLinkProduct && <p className="text-gray-500 text-center py-8">No products linked yet</p>}
          {accountProducts.map(ap => (
            <div key={ap.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="font-bold text-gray-900">{ap.product?.product_name}</h3>
              <p className="text-sm text-gray-600">{ap.product?.format} — {ap.product?.varietal}</p>
              <div className="flex gap-2 mt-2">
                <span className="bg-green-100 text-green-800 rounded-full px-2.5 py-0.5 text-xs font-medium">{ap.status}</span>
                {ap.date_placed && <span className="text-xs text-gray-500">Placed {new Date(ap.date_placed).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
          {!showLinkProduct ? (
            <button onClick={() => setShowLinkProduct(true)} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-medium hover:bg-gray-50"><Plus className="w-4 h-4" />Link Product</button>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none">
                <option value="">Select a product...</option>
                {allProducts.map(p => <option key={p.id} value={p.id}>{p.product_name} ({p.format})</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={handleLinkProduct} className="flex-1 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2 font-medium">Link</button>
                <button onClick={() => setShowLinkProduct(false)} className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-xs text-gray-500 font-medium">TOTAL 9L EQUIV</p>
                <p className="text-2xl font-bold text-gray-900">{totalNineL.toFixed(1)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-xs text-gray-500 font-medium">ORDERS</p>
                <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-xs text-gray-500 font-medium">LAST ORDER</p>
                <p className="text-sm font-bold text-gray-900">{new Date(orders[0].order_date).toLocaleDateString()}</p>
              </div>
            </div>
          )}
          {orders.length === 0 ? <p className="text-gray-500 text-center py-8">No order data</p> : (
            <div className="space-y-2">
              {orders.map(o => (
                <div key={o.id} className="bg-white rounded-xl border border-gray-100 p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{o.product?.product_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{new Date(o.order_date).toLocaleDateString()}</p>
                  </div>
                  <p className="font-bold text-gray-900">{o.nine_liter_equivs} 9L</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACTIVITY TAB */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {activity.length === 0 && !showActivityForm && <p className="text-gray-500 text-center py-8">No activity yet</p>}
          {activity.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-[#e94560] mt-2 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 capitalize text-sm">{a.activity_type}</p>
                  <p className="text-gray-600 text-sm">{a.summary}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
          {!showActivityForm ? (
            <button onClick={() => setShowActivityForm(true)} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-medium hover:bg-gray-50"><Plus className="w-4 h-4" />Log Activity</button>
          ) : (
            <form onSubmit={handleAddActivity} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <select value={newActivity.activity_type} onChange={e => setNewActivity({...newActivity, activity_type: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none">
                <option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="visit">Visit</option>
              </select>
              <textarea placeholder="What happened?" value={newActivity.summary} onChange={e => setNewActivity({...newActivity, summary: e.target.value})} rows={3} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none" />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2 font-medium">Save</button>
                <button type="button" onClick={() => setShowActivityForm(false)} className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
