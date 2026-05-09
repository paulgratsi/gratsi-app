import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const TOOLS = [
  {
    name: 'search_accounts',
    description: 'Search accounts by name, state, tier, status, or other criteria. Returns up to 20 matching accounts with key fields.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Partial account name to search (case-insensitive)' },
        state: { type: 'string', description: 'Two-letter state code (e.g., CT, NJ, MD)' },
        tier: { type: 'string', enum: ['a', 'b', 'c'], description: 'Account tier' },
        status: { type: 'string', enum: ['active', 'prospect', 'inactive', 'lost'] },
        has_vip: { type: 'boolean', description: 'Only accounts with a VIP Outlet ID' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_account_detail',
    description: 'Get full details for a specific account by ID, including contacts, recent orders, and recent activity notes.',
    input_schema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'The account UUID' },
      },
      required: ['account_id'],
    },
  },
  {
    name: 'get_sales_data',
    description: 'Query aggregated sales data. Can filter by state, account name, product, or date range. Returns order totals in 9-liter equivalents.',
    input_schema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Filter by state code' },
        account_name: { type: 'string', description: 'Filter by partial account name' },
        product_name: { type: 'string', description: 'Filter by product name (e.g., "Red", "White", "Rose")' },
        date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        group_by: { type: 'string', enum: ['account', 'product', 'state', 'month'], description: 'How to group results' },
        order_by: { type: 'string', enum: ['volume_desc', 'volume_asc', 'date_desc'], description: 'Sort order' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'search_activity',
    description: 'Search activity notes and visit history across accounts. Useful for finding visit notes mentioning specific topics.',
    input_schema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Filter to a specific account' },
        search_text: { type: 'string', description: 'Text to search for in activity summaries' },
        activity_type: { type: 'string', enum: ['note', 'call', 'email', 'visit'] },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_accounts_needing_attention',
    description: 'Find accounts that may need follow-up: no recent orders, old last check-in dates, or no activity. Useful for prioritizing visits.',
    input_schema: {
      type: 'object',
      properties: {
        days_since_last_order: { type: 'number', description: 'Accounts with no orders in this many days (default 30)' },
        state: { type: 'string', description: 'Filter by state' },
        tier: { type: 'string', enum: ['a', 'b', 'c'], description: 'Filter by tier' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
];

async function executeTool(name, input) {
  const lim = input.limit || 20;

  if (name === 'search_accounts') {
    let query = supabase.from('accounts').select('id, account_name, city, state, tier, status, vip_outlet_id, distributor_rep, price, last_check_in, red_inventory, white_inventory, rose_inventory');
    if (input.name) query = query.ilike('account_name', `%${input.name}%`);
    if (input.state) query = query.eq('state', input.state.toUpperCase());
    if (input.tier) query = query.eq('tier', input.tier);
    if (input.status) query = query.eq('status', input.status);
    if (input.has_vip) query = query.not('vip_outlet_id', 'is', null);
    const { data, error } = await query.order('account_name').limit(lim);
    if (error) return { error: error.message };
    return { accounts: data, count: data?.length || 0 };
  }

  if (name === 'get_account_detail') {
    const { data: account, error: acctErr } = await supabase.from('accounts').select('*').eq('id', input.account_id).single();
    if (acctErr) return { error: acctErr.message };

    const [contacts, orders, activity] = await Promise.all([
      supabase.from('contacts').select('*').eq('account_id', input.account_id),
      supabase.from('orders').select('*, product:products(product_name)').eq('account_id', input.account_id).order('order_date', { ascending: false }).limit(20),
      supabase.from('activity_log').select('*').eq('account_id', input.account_id).order('created_at', { ascending: false }).limit(10),
    ]);

    return {
      account,
      contacts: contacts.data || [],
      recent_orders: orders.data || [],
      recent_activity: activity.data || [],
    };
  }

  if (name === 'get_sales_data') {
    let query = supabase.from('orders').select('account_id, order_date, nine_liter_equivs, vip_outlet_id, product:products(product_name), account:accounts(account_name, city, state, tier)');
    if (input.date_from) query = query.gte('order_date', input.date_from);
    if (input.date_to) query = query.lte('order_date', input.date_to);
    if (input.product_name) query = query.ilike('product.product_name', `%${input.product_name}%`);

    const { data, error } = await query.order('order_date', { ascending: false }).limit(500);
    if (error) return { error: error.message };

    let filtered = data || [];
    if (input.state) {
      filtered = filtered.filter(o => o.account?.state === input.state.toUpperCase());
    }
    if (input.account_name) {
      const search = input.account_name.toLowerCase();
      filtered = filtered.filter(o => o.account?.account_name?.toLowerCase().includes(search));
    }

    if (input.group_by === 'account') {
      const grouped = {};
      filtered.forEach(o => {
        const key = o.account?.account_name || 'Unknown';
        if (!grouped[key]) grouped[key] = { account_name: key, state: o.account?.state, total_9l: 0, order_count: 0 };
        grouped[key].total_9l += o.nine_liter_equivs || 0;
        grouped[key].order_count++;
      });
      let results = Object.values(grouped);
      if (input.order_by === 'volume_desc') results.sort((a, b) => b.total_9l - a.total_9l);
      else if (input.order_by === 'volume_asc') results.sort((a, b) => a.total_9l - b.total_9l);
      return { grouped_by: 'account', results: results.slice(0, lim), total_orders: filtered.length };
    }

    if (input.group_by === 'product') {
      const grouped = {};
      filtered.forEach(o => {
        const key = o.product?.product_name || 'Unknown';
        if (!grouped[key]) grouped[key] = { product_name: key, total_9l: 0, order_count: 0 };
        grouped[key].total_9l += o.nine_liter_equivs || 0;
        grouped[key].order_count++;
      });
      let results = Object.values(grouped);
      results.sort((a, b) => b.total_9l - a.total_9l);
      return { grouped_by: 'product', results: results.slice(0, lim) };
    }

    if (input.group_by === 'state') {
      const grouped = {};
      filtered.forEach(o => {
        const key = o.account?.state || 'Unknown';
        if (!grouped[key]) grouped[key] = { state: key, total_9l: 0, order_count: 0, account_count: new Set() };
        grouped[key].total_9l += o.nine_liter_equivs || 0;
        grouped[key].order_count++;
        grouped[key].account_count.add(o.account_id);
      });
      let results = Object.values(grouped).map(g => ({ ...g, account_count: g.account_count.size }));
      results.sort((a, b) => b.total_9l - a.total_9l);
      return { grouped_by: 'state', results: results.slice(0, lim) };
    }

    if (input.group_by === 'month') {
      const grouped = {};
      filtered.forEach(o => {
        const key = o.order_date?.slice(0, 7) || 'Unknown';
        if (!grouped[key]) grouped[key] = { month: key, total_9l: 0, order_count: 0 };
        grouped[key].total_9l += o.nine_liter_equivs || 0;
        grouped[key].order_count++;
      });
      let results = Object.values(grouped);
      results.sort((a, b) => a.month.localeCompare(b.month));
      return { grouped_by: 'month', results };
    }

    const total9L = filtered.reduce((s, o) => s + (o.nine_liter_equivs || 0), 0);
    return { orders: filtered.slice(0, lim), total_9l: total9L, total_orders: filtered.length };
  }

  if (name === 'search_activity') {
    let query = supabase.from('activity_log').select('*, account:accounts(account_name)');
    if (input.account_id) query = query.eq('account_id', input.account_id);
    if (input.activity_type) query = query.eq('activity_type', input.activity_type);
    if (input.search_text) query = query.ilike('summary', `%${input.search_text}%`);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(lim);
    if (error) return { error: error.message };
    return { activities: data, count: data?.length || 0 };
  }

  if (name === 'get_accounts_needing_attention') {
    const days = input.days_since_last_order || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    let acctQuery = supabase.from('accounts').select('id, account_name, city, state, tier, status, vip_outlet_id, last_check_in');
    if (input.state) acctQuery = acctQuery.eq('state', input.state.toUpperCase());
    if (input.tier) acctQuery = acctQuery.eq('tier', input.tier);
    acctQuery = acctQuery.eq('status', 'active');
    const { data: accounts, error } = await acctQuery.order('account_name').limit(200);
    if (error) return { error: error.message };

    const results = [];
    for (const acct of (accounts || [])) {
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('order_date')
        .eq('account_id', acct.id)
        .order('order_date', { ascending: false })
        .limit(1);

      const lastOrderDate = lastOrder?.[0]?.order_date;
      if (!lastOrderDate || lastOrderDate < cutoffStr) {
        results.push({
          ...acct,
          last_order_date: lastOrderDate || 'Never',
          days_since_order: lastOrderDate ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / 86400000) : null,
        });
      }
      if (results.length >= lim) break;
    }

    return { accounts_needing_attention: results, count: results.length, criteria: `No orders since ${cutoffStr}` };
  }

  return { error: `Unknown tool: ${name}` };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history = [], account_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let systemPrompt = `You are the Gratsi AI assistant — a helpful, concise assistant for Gratsi's wine sales team. You have access to their accounts database, sales/order data, contact info, and visit history.

Key context about Gratsi:
- Gratsi sells boxed wine (Red, White, Rosé in 3L boxes, plus Sparkling White in 750ml)
- Sales are tracked in 9-liter equivalents (9L equiv)
- Accounts are retail stores (liquor stores, wine shops, grocery stores) across CT, NJ, MD, DE, DC, and expanding markets
- Accounts have tiers: A (top 30%), B (top 50%), C (bottom 50%)
- VIP Outlet ID links accounts to the distributor sales tracking system
- The team does merchandising visits to check displays, shelf placement, and POS materials

Guidelines:
- Be concise and direct. Sales reps are checking this on their phones between store visits.
- When showing lists, format them clearly with the most important info first.
- When asked about trends, pull data by month to show direction.
- If you're unsure about something, say so rather than guessing.
- Always use the tools to get current data — never make up numbers.`;

    if (account_id) {
      systemPrompt += `\n\nThe user is currently viewing account ID: ${account_id}. If they ask a question without specifying an account, assume they mean this one.`;
    }

    const messages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    let response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    // Tool use loop — keep going until Claude gives a text response
    let loopCount = 0;
    while (response.stop_reason === 'tool_use' && loopCount < 5) {
      loopCount++;
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });
    }

    const textBlock = response.content.find(b => b.type === 'text');
    const reply = textBlock?.text || 'I wasn\'t able to generate a response. Please try again.';

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
