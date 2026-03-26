import { useEffect, useState } from 'react'
import api from '../lib/api'
import Notifications from '../components/Notifications'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmDialog'

export default function Admin() {
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const { showConfirm } = useConfirm()
  const [pending, setPending] = useState([])
  const [stats, setStats] = useState({ totalUsers: 0, totalPosts: 0, totalComments: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [users, setUsers] = useState([])
  const [usersTotal, setUsersTotal] = useState(0)
  const usersLimit = 10
  const [usersPage, setUsersPage] = useState(1)

  const loadAdminData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [pendingRes, postsRes, commentsRes, usersRes] = await Promise.all([
        api.get('/posts', { params: { status: 'pending', limit: 50 } }),
        api.get('/posts', { params: { limit: 1 } }),
        api.get('/comments', { params: { limit: 1 } }),
        api.get('/users', { params: { limit: usersLimit, page: usersPage } }),
      ])
      
      setPending(pendingRes.data.data)
      
      // Calculate stats
      const totalPosts = postsRes.data.total || 0
      const totalComments = commentsRes.data.total || commentsRes.data.comments?.length || 0
      const totalUsers = usersRes.data.total || 0
      
      setStats({ totalUsers, totalPosts, totalComments })
      setUsers(usersRes.data.users || [])
      setUsersTotal(usersRes.data.total || 0)
    } catch (e) {
      console.error('Failed to load admin data:', e)
      const errorMsg = e.response?.data?.message || 'Failed to load admin data'
      setError(errorMsg)
      toast.showError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAdminData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersPage])

  const setStatus = async (slug, status) => {
    setLoading(true)
    try {
      await api.put(`/posts/${slug}/status`, { status })
      setPending(p => p.filter(x => x.slug !== slug))
      toast.showSuccess(`Post ${status === 'published' ? 'approved' : 'rejected'} successfully!`)
    } catch (e) {
      console.error('Failed to update post status:', e)
      toast.showError('Failed to update post status: ' + (e.response?.data?.message || e.message))
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId, role) => {
    if (!userId) return
    if (currentUser?.id === userId) {
      toast.showWarning('You cannot change your own role.')
      return
    }

    const confirmed = await showConfirm({
      title: 'Change User Role?',
      message: `Are you sure you want to change this user to "${role}"?`,
      confirmText: 'Change Role',
      cancelText: 'Cancel',
      confirmColor: 'blue',
      icon: '🛡️',
    })

    if (!confirmed) return

    setLoading(true)
    try {
      const res = await api.patch(`/users/${userId}/role`, { role })
      const updatedUser = res.data.user
      setUsers(prev => prev.map(u => (u._id === userId ? updatedUser : u)))
      toast.showSuccess('Role updated successfully!')
    } catch (e) {
      console.error('Failed to update user role:', e)
      toast.showError('Failed to update user role: ' + (e.response?.data?.message || e.message))
    } finally {
      setLoading(false)
    }
  }

  const deleteUser = async (userId) => {
    if (!userId) return
    if (currentUser?.id === userId) {
      toast.showWarning('You cannot delete yourself.')
      return
    }

    const confirmed = await showConfirm({
      title: 'Delete User?',
      message: 'This will delete the user and cascade their posts/comments.',
      confirmText: 'Delete User',
      cancelText: 'Cancel',
      confirmColor: 'red',
      icon: '🗑️',
    })

    if (!confirmed) return

    setLoading(true)
    try {
      await api.delete(`/users/${userId}`)
      setUsers(prev => prev.filter(u => u._id !== userId))
      setUsersTotal(prev => Math.max(0, prev - 1))
      toast.showSuccess('User deleted successfully!')
    } catch (e) {
      console.error('Failed to delete user:', e)
      toast.showError('Failed to delete user: ' + (e.response?.data?.message || e.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold">Admin Dashboard</h1>
        <Notifications />
      </div>

      {/* Admin Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white p-4 md:p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-xl md:text-2xl">👥</span>
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 md:p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-xl md:text-2xl">📝</span>
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Posts</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.totalPosts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 md:p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-xl md:text-2xl">💬</span>
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Comments</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.totalComments}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Moderation Queue */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 md:p-6 border-b">
          <h2 className="text-lg md:text-xl font-semibold">Moderation Queue ({pending.length})</h2>
        </div>
        
        {pending.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No posts pending moderation.</p>
          </div>
        ) : (
          <div className="divide-y">
            {pending.map(post => (
              <div key={post.slug} className="p-4 md:p-6 hover:bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 md:gap-6">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">{post.title}</h3>
                    <p className="text-xs md:text-sm text-gray-600 mb-3 line-clamp-2">
                      {post.summary || 'No summary available'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500">
                      <span>By {post.author?.name}</span>
                      <span>•</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{post.readingTimeMinutes} min read</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <button 
                      onClick={() => setStatus(post.slug, 'published')}
                      disabled={loading}
                      className="px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs md:text-sm flex-1 sm:flex-initial"
                    >
                      ✓ Approve
                    </button>
                    <button 
                      onClick={() => setStatus(post.slug, 'rejected')}
                      disabled={loading}
                      className="px-3 md:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-xs md:text-sm flex-1 sm:flex-initial"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Management */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 md:p-6 border-b">
          <h2 className="text-lg md:text-xl font-semibold">
            User Management ({users.length})
          </h2>
          {usersTotal ? (
            <p className="text-xs text-gray-500 mt-1">Total: {usersTotal}</p>
          ) : null}
        </div>

        {loading && users.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No users found.</p>
          </div>
        ) : (
          <div className="divide-y">
            {users.map(u => (
              <div key={u._id} className="p-4 md:p-6 hover:bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{u.name}</div>
                    <div className="text-xs text-gray-600 truncate">{u.email}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {u.role}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {u.role !== 'admin' ? (
                      <button
                        onClick={() => updateUserRole(u._id, 'admin')}
                        disabled={loading || currentUser?.id === u._id}
                        className="px-3 md:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-xs md:text-sm"
                      >
                        Make admin
                      </button>
                    ) : (
                      <button
                        onClick={() => updateUserRole(u._id, 'user')}
                        disabled={loading || currentUser?.id === u._id}
                        className="px-3 md:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-xs md:text-sm"
                      >
                        Make user
                      </button>
                    )}

                    <button
                      onClick={() => deleteUser(u._id)}
                      disabled={loading || currentUser?.id === u._id}
                      className="px-3 md:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-xs md:text-sm"
                      title="Delete user"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Users pagination */}
        {usersTotal > usersLimit && (
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <button
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
                disabled={usersPage <= 1 || loading}
                onClick={() => setUsersPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <div className="text-xs md:text-sm text-gray-600">
                Page <span className="font-medium">{usersPage}</span> of{' '}
                <span className="font-medium">{Math.max(1, Math.ceil(usersTotal / usersLimit))}</span>
              </div>
              <button
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
                disabled={usersPage >= Math.ceil(usersTotal / usersLimit) || loading}
                onClick={() => setUsersPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


