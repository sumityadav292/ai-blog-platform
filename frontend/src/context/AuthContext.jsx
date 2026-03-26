import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import api from '../lib/api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        return JSON.parse(storedUser)
      } catch {
        return null
      }
    }
    return null
  })
  const [authLoading, setAuthLoading] = useState(true)

  // Verify token on app start so protected routes aren't based on stale localStorage data.
  useEffect(() => {
    let isMounted = true

    const verify = async () => {
      if (!token) {
        if (isMounted) setAuthLoading(false)
        return
      }

      try {
        const { data } = await api.get('/auth/me')
        if (!isMounted) return
        setUser(data.user || null)
      } catch {
        if (!isMounted) return
        // Token is invalid/expired; clear local state.
        setToken(null)
        setUser(null)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      } finally {
        if (isMounted) setAuthLoading(false)
      }
    }

    verify()
    return () => {
      isMounted = false
    }
  }, []) // run once on mount

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
  }, [token])

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
    } else {
      localStorage.removeItem('user')
    }
  }, [user])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    setToken(data.token)
    setUser(data.user)
  }, [])

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password })
    setToken(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      // Clear httpOnly cookie on the backend.
      await api.post('/auth/logout')
    } catch {
      // If the request fails, we still clear local state.
    } finally {
      setToken(null)
      setUser(null)
      setAuthLoading(false)
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }, [])

  const value = useMemo(
    () => ({ token, user, authLoading, login, register, logout }),
    [token, user, authLoading, login, register, logout]
  )
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() { return useContext(AuthCtx) }


