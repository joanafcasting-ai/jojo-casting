import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vtnymqhobztjtxhwtfeb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0bnltcWhvYnp0anR4aHd0ZmViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjcyNTYsImV4cCI6MjA4Nzk0MzI1Nn0.lmLxV9YEsuy5340wY6JNhT5TeLZeTGOAu3EHatuaYXU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function getUserId() {
  try {
    const raw = localStorage.getItem('_currentUserId')
    return raw || 'anonymous'
  } catch { return 'anonymous' }
}

export function setCurrentUserId(id) {
  try { localStorage.setItem('_currentUserId', id || 'anonymous') } catch {}
}

const storage = {
  _real: true,

  async get(key, shared = false) {
    try {
      let query = supabase.from('kv_store').select('key, value, shared')
      if (shared) {
        query = query.eq('key', key).eq('shared', true)
      } else {
        query = query.eq('key', key).eq('user_id', getUserId()).eq('shared', false)
      }
      const { data, error } = await query.maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Key not found: ' + key)
      return { key: data.key, value: data.value, shared: data.shared }
    } catch (e) {
      const prefix = shared ? 'shared:' : ''
      const val = localStorage.getItem(prefix + key)
      if (val === null) throw new Error('Key not found: ' + key)
      return { key, value: val, shared }
    }
  },

  async set(key, value, shared = false) {
    const strValue = typeof value === 'string' ? value : JSON.stringify(value)
    const userId = getUserId()
    try {
      if (shared) {
        const { data: existing } = await supabase.from('kv_store')
          .select('id').eq('key', key).eq('shared', true).maybeSingle()
        if (existing) {
          await supabase.from('kv_store').update({ value: strValue, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase.from('kv_store').insert({ key, value: strValue, user_id: userId, shared: true })
        }
      } else {
        const { data: existing } = await supabase.from('kv_store')
          .select('id').eq('key', key).eq('user_id', userId).eq('shared', false).maybeSingle()
        if (existing) {
          await supabase.from('kv_store').update({ value: strValue, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase.from('kv_store').insert({ key, value: strValue, user_id: userId, shared: false })
        }
      }
      const prefix = shared ? 'shared:' : ''
      try { localStorage.setItem(prefix + key, strValue) } catch {}
      return { key, value: strValue, shared }
    } catch (e) {
      const prefix = shared ? 'shared:' : ''
      localStorage.setItem(prefix + key, strValue)
      return { key, value: strValue, shared }
    }
  },

  async delete(key, shared = false) {
    try {
      if (shared) {
        await supabase.from('kv_store').delete().eq('key', key).eq('shared', true)
      } else {
        await supabase.from('kv_store').delete().eq('key', key).eq('user_id', getUserId()).eq('shared', false)
      }
      const prefix = shared ? 'shared:' : ''
      try { localStorage.removeItem(prefix + key) } catch {}
      return { key, deleted: true, shared }
    } catch (e) {
      const prefix = shared ? 'shared:' : ''
      localStorage.removeItem(prefix + key)
      return { key, deleted: true, shared }
    }
  },

  async list(prefix = '', shared = false) {
    try {
      let query = supabase.from('kv_store').select('key')
      if (shared) {
        query = query.eq('shared', true)
      } else {
        query = query.eq('user_id', getUserId()).eq('shared', false)
      }
      if (prefix) {
        query = query.like('key', prefix + '%')
      }
      const { data, error } = await query
      if (error) throw error
      return { keys: (data || []).map(d => d.key), prefix, shared }
    } catch (e) {
      const storePrefix = shared ? 'shared:' : ''
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (shared) {
          if (k.startsWith('shared:' + prefix)) keys.push(k.replace('shared:', ''))
        } else {
          if (!k.startsWith('shared:') && k.startsWith(prefix)) keys.push(k)
        }
      }
      return { keys, prefix, shared }
    }
  }
}

window.storage = storage

export default storage
