import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/types'
import { Plus, Search, Loader2 } from 'lucide-react'

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DC','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','MA','MD','ME','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

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

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ state: '', tier: '', status: '', accountType: '' })
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    fetchAccounts(true)
  }, [debouncedSearch, filters])

  async function fetchAccounts(reset = false) {
    try {
      setLoading(true)
      let query = supabase.from('accounts').select('*', { count: 'exact' }).order('account_name')

      if (debouncedSearch) {
        query = query.ilike('account_name', `%${debouncedSearch}%`)
      }
      if (filters.state) query = query.eq('state', filters.state)
      if (filters.tier) query = query.eq('tier', filters.tier)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.accountType) query = query.eq('account_type', filters.accountType)

      const start = reset ? 0 : offset
      const { data, error, count } = await query.range(start, start + 49)

      if (error) throw error

      if (reset) {
        setAccounts(data || [])
        setOffset(50)
      } else {
        setAccounts(prev => [...prev, ...(data || [])])
        setOffset(prev => prev + 50)
      }
      setTotal(count || 0)
      setHasMore((data?.length || 0) === 50)
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Accounts</h1>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={filters.state} onChange={e => setFilters({ ...filters, state: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none">
            <option value="">All States</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.tier} onChange={e => setFilters({ ...filters, tier: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none">
            <option value="">All Tiers</option>
            <option value="a">A</option><option value="b">B</option><option value="c">C</option>
          </select>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none">
            <option value="">All Statuses</option>
            <option value="active">Active</option><option value="prospect">Prospect</option>
            <option value="inactive">Inactive</option><option value="lost">Lost</option>
          </select>
          <select value={filters.accountType} onChange={e => setFilters({ ...filters, accountType: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none">
            <option value="">All Types</option>
            <option value="on_premise">On Premise</option><option value="off_premise">Off Premise</option>
            <option value="chain">Chain</option><option value="other">Other</option>
          </select>
        </div>
      </div>

      {total > 0 && (
        <p className="text-gray-600 text-sm mb-4">
          Showing {accounts.length} of {total} accounts
        </p>
      )}

      {loading && accounts.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#e94560] animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <p className="text-gray-600 mb-2">No accounts found</p>
          <p className="text-gray-400 text-sm">Try adjusting your search or filters, or import accounts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <Link key={account.id} to={`/accounts/${account.id}`}
              className="block bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">{account.account_name}</h3>
                  {(account.city || account.state) && (
                    <p className="text-sm text-gray-600">
                      {account.city}{account.city && account.state ? ', ' : ''}{account.state}
                    </p>
                  )}
                  {account.distributor_rep && (
                    <p className="text-sm text-gray-500">Rep: {account.distributor_rep}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap justify-end flex-shrink-0">
                  {account.tier && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierColors[account.tier] || 'bg-gray-100 text-gray-600'}`}>
                      {account.tier.toUpperCase()}
                    </span>
                  )}
                  {account.status && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[account.status] || 'bg-gray-100 text-gray-600'}`}>
                      {account.status}
                    </span>
                  )}
                  {account.vip_outlet_id && (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">VIP</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <button onClick={() => fetchAccounts(false)}
          className="w-full mt-6 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-medium hover:bg-gray-50 transition-colors">
          Load More
        </button>
      )}

      <Link to="/accounts/new"
        className="fixed bottom-24 md:bottom-8 right-4 w-14 h-14 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-full flex items-center justify-center shadow-lg transition-colors">
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  )
}
