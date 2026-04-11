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
      // Race with timeout to prevent hanging on RLS/network issues
      const result = await Promise.race([
        query.maybeSingle(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000))
      ])
      const { data, error } = result
      if (error) throw error
      if (!data) throw new Error('Key not found: ' + key)
      return { key: data.key, value: data.value, shared: data.shared }
    } catch (e) {
      console.warn('[storage.get] Supabase failed for', key, ':', e?.message || e, '— trying localStorage')
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
          const { error: upErr } = await supabase.from('kv_store').update({ value: strValue, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          if (upErr) throw upErr
        } else {
          const { error: insErr } = await supabase.from('kv_store').insert({ key, value: strValue, user_id: userId, shared: true })
          if (insErr) throw insErr
        }
      } else {
        // Upsert user-specific
        const { data: existing } = await supabase.from('kv_store')
          .select('id').eq('key', key).eq('user_id', userId).eq('shared', false).maybeSingle()
        if (existing) {
          const { error: upErr } = await supabase.from('kv_store').update({ value: strValue, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          if (upErr) throw upErr
        } else {
          const { error: insErr } = await supabase.from('kv_store').insert({ key, value: strValue, user_id: userId, shared: false })
          if (insErr) throw insErr
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
      const result = await Promise.race([
        query,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase list timeout')), 8000))
      ])
      const { data, error } = result
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
// Video Storage — Supabase Storage
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

// =============================================
// Photo Storage — Supabase Storage (NEW!)
// Photos are stored as files, not base64 in DB
// =============================================

/**
 * Upload a photo to Supabase Storage.
 * Accepts a File object OR a base64 data URL string.
 * Returns { path, url } — the URL can be stored in profile data.
 */
export async function uploadPhoto(fileOrBase64, projectId, profileId, index = 0) {
  let file
  let ext = 'jpg'

  if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:')) {
    // Convert base64 data URL to File
    const res = await fetch(fileOrBase64)
    const blob = await res.blob()
    const mimeMatch = fileOrBase64.match(/data:image\/(\w+)/)
    ext = mimeMatch ? mimeMatch[1].replace('jpeg', 'jpg') : 'jpg'
    file = new File([blob], `photo.${ext}`, { type: blob.type })
  } else if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
    file = fileOrBase64
    ext = file.name?.split('.').pop() || 'jpg'
  } else {
    throw new Error('uploadPhoto: invalid input — expected File or base64 string')
  }

  const path = `${FIXED_USER_ID}/${projectId}/${profileId}_${index}_${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('photos')
    .upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
    })

  if (error) {
    console.error('[uploadPhoto] Error:', error.message)
    throw error
  }

  const { data: urlData } = supabase.storage
    .from('photos')
    .getPublicUrl(path)

  return {
    path,
    url: urlData.publicUrl,
  }
}

/**
 * Delete a photo from Supabase Storage by its path.
 */
export async function deletePhoto(path) {
  const { error } = await supabase.storage
    .from('photos')
    .remove([path])

  if (error) {
    console.error('[deletePhoto] Error:', error.message)
    throw error
  }
  return true
}

/**
 * Migrate a base64 photo to Supabase Storage.
 * Returns the public URL, or the original string if it's already a URL.
 */
export async function migratePhotoIfNeeded(photoStr, projectId, profileId, index = 0) {
  // Already a URL — no migration needed
  if (!photoStr || photoStr.startsWith('http://') || photoStr.startsWith('https://')) {
    return photoStr
  }
  // It's a base64 string — upload to Supabase
  if (photoStr.startsWith('data:')) {
    try {
      const { url } = await uploadPhoto(photoStr, projectId, profileId, index)
      console.log('[migratePhoto] Migrated base64 to URL:', url)
      return url
    } catch (e) {
      console.error('[migratePhoto] Failed, keeping base64:', e.message)
      return photoStr
    }
  }
  return photoStr
}

// =============================================
// Storage Usage — Combined videos + photos
// =============================================

export async function getStorageUsage() {
  try {
    let totalSize = 0
    const countFiles = async (bucket, prefix) => {
      const { data: files } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
      if (!files) return
      for (const f of files) {
        if (f.metadata?.size) totalSize += f.metadata.size
        else if (f.id === null) {
          // It's a folder, recurse
          await countFiles(bucket, prefix + '/' + f.name)
        }
      }
    }
    await countFiles('videos', FIXED_USER_ID)
    await countFiles('photos', FIXED_USER_ID)

    return {
      usedBytes: totalSize,
      usedMB: Math.round(totalSize / 1024 / 1024 * 10) / 10,
      maxMB: 100 * 1024, // 100GB Pro plan
      percentage: Math.round(totalSize / (100 * 1024 * 1024 * 1024) * 100),
    }
  } catch (e) {
    return { usedBytes: 0, usedMB: 0, maxMB: 100 * 1024, percentage: 0 }
  }
}

export default storage
