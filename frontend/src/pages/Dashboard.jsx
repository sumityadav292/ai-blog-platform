import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import Notifications from '../components/Notifications'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { showConfirm } = useConfirm()
  const [posts, setPosts] = useState([])
  const [stats, setStats] = useState({ totalViews: 0, totalLikes: 0, totalComments: 0 })
  const [recentPosts, setRecentPosts] = useState([])
  const [deletingPostId, setDeletingPostId] = useState(null)

  const loadDashboardData = async () => {
    try {
      // Fetch user's posts
      const postsRes = await api.get('/users/me/posts')
      const userPosts = postsRes.data.posts
      
      setPosts(userPosts)
      setRecentPosts(userPosts)
      
      // Calculate stats from user's posts
      const totalViews = userPosts.reduce((sum, post) => sum + (post.views || 0), 0)
      const totalLikes = userPosts.reduce((sum, post) => sum + (post.likes?.length || 0), 0)
      const totalComments = userPosts.reduce((sum, post) => sum + (post.comments?.length || 0), 0)
      
      setStats({ totalViews, totalLikes, totalComments })
    } catch (e) {
      console.error('Failed to load dashboard data:', e)
      toast.showError('Failed to load dashboard data: ' + (e.response?.data?.message || e.message))
    }
  }

  useEffect(() => {
    loadDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleEdit = (post) => {
    navigate('/editor', { state: { post } })
  }

  const handleDelete = async (post) => {
    const confirmed = await showConfirm({
      title: 'Delete Post?',
      message: `Are you sure you want to delete "${post.title}"?\nThis action cannot be undone and will also delete all comments.`,
      confirmText: 'Delete Post',
      cancelText: 'Cancel',
      confirmColor: 'red',
      icon: '🗑️'
    })

    if (!confirmed) {
      return
    }

    setDeletingPostId(post._id)
    try {
      await api.delete(`/posts/${post.slug}`)
      toast.showSuccess('Post deleted successfully!')
      // Reload dashboard data
      await loadDashboardData()
    } catch (e) {
      console.error('Delete failed:', e)
      toast.showError('Failed to delete post: ' + (e.response?.data?.message || e.message))
    } finally {
      setDeletingPostId(null)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold">Welcome back, {user?.name?.split(' ')[0] || user?.name || 'Author'}!</h1>
        <div className="flex items-center gap-3 md:gap-4">
          <Notifications />
          <button onClick={logout} className="text-sm md:text-base text-red-600 hover:text-red-800">Logout</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white p-4 md:p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-xl md:text-2xl">👁️</span>
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Views</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.totalViews}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 md:p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-xl md:text-2xl">👍</span>
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Likes</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.totalLikes}</p>
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

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <Link 
          to="/editor" 
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-center text-sm md:text-base"
        >
          ✍️ Write New Post
        </Link>
        <Link 
          to="/" 
          className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors text-center text-sm md:text-base"
        >
          📖 Browse Posts
        </Link>
        {user?.role === 'admin' && (
          <Link 
            to="/admin" 
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors text-center text-sm md:text-base"
          >
            ⚙️ Admin Panel
          </Link>
        )}
      </div>

      {/* Recent Posts */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 md:p-6 border-b">
          <h2 className="text-lg md:text-xl font-semibold">Your Posts</h2>
        </div>
        <div className="divide-y">
          {posts.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>You haven't written any posts yet.</p>
              <Link to="/editor" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
                Start writing your first post →
              </Link>
            </div>
          ) : (
            posts.map(post => (
              <div key={post._id} className="p-4 md:p-6 hover:bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
                  <div className="flex-1 min-w-0">
                    <Link 
                      to={`/post/${post.slug}`}
                      className="text-base md:text-lg font-medium text-gray-900 hover:text-blue-600 block"
                    >
                      {post.title}
                    </Link>
                    <p className="text-xs md:text-sm text-gray-600 mt-1 line-clamp-2">
                      {post.summary || 'No summary available'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 text-xs md:text-sm text-gray-500">
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{post.views || 0} views</span>
                      <span>•</span>
                      <span>{post.likes?.length || 0} likes</span>
                    </div>
                  </div>
                  
                  {/* Status and Actions */}
                  <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                      {post.status}
                    </span>
                    <button
                      onClick={() => handleEdit(post)}
                      disabled={deletingPostId === post._id}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-xs md:text-sm"
                      title="Edit post"
                    >
                      ✏️ <span className="hidden sm:inline">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(post)}
                      disabled={deletingPostId === post._id}
                      className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 text-xs md:text-sm"
                      title="Delete post"
                    >
                      {deletingPostId === post._id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}


