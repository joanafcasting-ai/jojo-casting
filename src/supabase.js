import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vtnymqhobztjtxhwtfeb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0bnltcWhvYnp0anR4aHd0ZmViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjcyNTYsImV4cCI6MjA4Nzk0MzI1Nn0.lmLxV9YEsuy5340wY6JNhT5TeLZeTGOAu3EHatuaYXU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// =============================================
// Storage adapter: replaces window.storage
// Uses Supabase as primary, localStorage as fallback
// =============================================

// Single user — always the same ID so data is always found
const FIXED_USER_ID = 'joana_casting_director'

function getUserId() {
  return FIXED_USER_ID
}

export function setCurrentUserId(id) {
  // No-op — single user mode
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
      // Fallback to localStorage
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
        // Upsert shared
        const { data: existing } = await supabase.from('kv_store')
          .select('id').eq('key', key).eq('shared', true).maybeSingle()
        if (existing) {
          await supabase.from('kv_store').update({ value: strValue, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase.from('kv_store').insert({ key, value: strValue, user_id: userId, shared: true })
        }
      } else {
        // Upsert user-specific
        const { data: existing } = await supabase.from('kv_store')
          .select('id').eq('key', key).eq('user_id', userId).eq('shared', false).maybeSingle()
        if (existing) {
          await supabase.from('kv_store').update({ value: strValue, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase.from('kv_store').insert({ key, value: strValue, user_id: userId, shared: false })
        }
      }
      // Also save to localStorage as cache
      const prefix = shared ? 'shared:' : ''
      try { localStorage.setItem(prefix + key, strValue) } catch {}
      return { key, value: strValue, shared }
    } catch (e) {
      // Fallback: localStorage only
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
      // Fallback: scan localStorage
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

// Install globally
window.storage = storage

// =============================================
// Video Storage — Supabase Storage (1GB free)
// =============================================

export async function uploadVideo(file, projectId, profileId) {
  const ext = file.name.split('.').pop() || 'mp4'
  const path = `${FIXED_USER_ID}/${projectId}/${profileId}_${Date.now()}.${ext}`
  
  const { data, error } = await supabase.storage
    .from('videos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
  
  if (error) throw error
  
  const { data: urlData } = supabase.storage
    .from('videos')
    .getPublicUrl(path)
  
  return {
    path,
    url: urlData.publicUrl,
    name: file.name,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

export async function deleteVideo(path) {
  const { error } = await supabase.storage
    .from('videos')
    .remove([path])
  
  if (error) throw error
  return true
}

export async function getStorageUsage() {
  try {
    const { data, error } = await supabase.storage
      .from('videos')
      .list(FIXED_USER_ID, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
    
    if (error) throw error
    
    let totalSize = 0
    const countFiles = async (prefix) => {
      const { data: files } = await supabase.storage.from('videos').list(prefix, { limit: 1000 })
      if (!files) return
      for (const f of files) {
        if (f.metadata?.size) totalSize += f.metadata.size
        else if (f.id === null) {
          // It's a folder, recurse
          await countFiles(prefix + '/' + f.name)
        }
      }
    }
    await countFiles(FIXED_USER_ID)
    
    return {
      usedBytes: totalSize,
      usedMB: Math.round(totalSize / 1024 / 1024 * 10) / 10,
      maxMB: 1024, // 1GB free
      percentage: Math.round(totalSize / (1024 * 1024 * 1024) * 100),
    }
  } catch (e) {
    return { usedBytes: 0, usedMB: 0, maxMB: 1024, percentage: 0 }
  }
}

export default storage
