import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import api from '../lib/api'
import { useToast } from '../components/Toast'
import DOMPurify from 'dompurify'

export default function PostEditor() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const editingPost = location.state?.post // Get post data if editing
  
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [cover, setCover] = useState(null)
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [coverPreview, setCoverPreview] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [showPreview, setShowPreview] = useState(false)
  const [categories, setCategories] = useState([])
  const [autoSaveStatus, setAutoSaveStatus] = useState('')
  const [lastSaved, setLastSaved] = useState(null)
  
  // Load existing post data if editing
  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title || '')
      setContent(editingPost.content || '')
      setSummary(editingPost.summary || '')
      setCategory(editingPost.category || '')
      setTags(editingPost.tags?.join(', ') || '')
      setCoverImageUrl(editingPost.coverImageUrl || '')
    }
  }, [editingPost])

  // Calculate reading time and word count
  const contentStats = useMemo(() => {
    const plainText = content.replace(/<[^>]*>/g, '').trim()
    const words = plainText.split(/\s+/).filter(Boolean).length
    const characters = plainText.length
    const readingTime = Math.max(1, Math.ceil(words / 200)) // 200 words per minute
    
    return { words, characters, readingTime }
  }, [content])

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    const draft = {
      title,
      content,
      summary,
      category,
      tags,
      timestamp: new Date().toISOString()
    }
    
    localStorage.setItem('blog_draft', JSON.stringify(draft))
    setAutoSaveStatus('Saved')
    setLastSaved(new Date())
    
    setTimeout(() => setAutoSaveStatus(''), 3000)
  }, [title, content, summary, category, tags])

  // Load draft from localStorage
  const loadDraft = useCallback(() => {
    const savedDraft = localStorage.getItem('blog_draft')
    if (savedDraft) {
      const draft = JSON.parse(savedDraft)
      setTitle(draft.title || '')
      setContent(draft.content || '')
      setSummary(draft.summary || '')
      setCategory(draft.category || '')
      setTags(draft.tags || '')
      toast.showSuccess('Draft loaded successfully!')
    }
  }, [toast])

  // Clear draft
  const clearDraft = useCallback(() => {
    localStorage.removeItem('blog_draft')
    setTitle('')
    setContent('')
    setSummary('')
    setCategory('')
    setTags('')
    setCover(null)
    setCoverPreview('')
    toast.showSuccess('Draft cleared!')
  }, [toast])

  // Remove cover image
  const removeCoverImage = () => {
    setCover(null)
    setCoverPreview('')
    setCoverImageUrl('')
    toast.showSuccess('Cover image removed!')
  }

  // Auto-generate summary if empty
  const generateSummary = useCallback(() => {
    if (summary) return // Don't overwrite existing summary
    
    const plainText = content.replace(/<[^>]*>/g, '').trim()
    const sentences = plainText.split(/[.!?]+/).filter(Boolean)
    const firstSentences = sentences.slice(0, 2).join('. ')
    const autoSummary = firstSentences.length > 150 
      ? firstSentences.substring(0, 150) + '...'
      : firstSentences
    
    if (autoSummary) {
      setSummary(autoSummary)
      toast.showSuccess('Summary auto-generated from your content!')
    }
  }, [content, summary, toast])

  // Load categories for dropdown
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data } = await api.get('/categories')
        setCategories(data.categories || [])
      } catch (e) {
        console.error('Failed to load categories:', e)
      }
    }
    loadCategories()
  }, [])

  // Auto-save draft functionality
  useEffect(() => {
    if (!title && !content) return // Don't save empty content
    
    const autoSaveTimer = setTimeout(() => {
      saveDraft()
    }, 30000) // Auto-save every 30 seconds

    return () => clearTimeout(autoSaveTimer)
  }, [title, content, summary, category, tags, saveDraft])

  // Handle cover image preview
  useEffect(() => {
    if (cover) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setCoverPreview(reader.result)
      }
      reader.readAsDataURL(cover)
    } else {
      setCoverPreview('')
    }
  }, [cover])

  const onUpload = async () => {
    if (!cover) {
      console.log('No cover file to upload')
      return null
    }
    try {
      console.log('Uploading cover image:', cover.name)
      const fd = new FormData()
      fd.append('file', cover)
      const { data } = await api.post('/upload/image', fd)
      console.log('Upload successful! URL:', data.url)
      return data.url
    } catch (error) {
      console.error('Upload error:', error)
      console.error('Error response:', error.response?.data)
      throw new Error('Failed to upload image: ' + (error.response?.data?.message || error.message))
    }
  }

  const onGenerate = async () => {
    // Validate prompt
    const trimmedPrompt = aiPrompt?.trim()
    
    if (!trimmedPrompt) {
      toast.showWarning('Please enter a prompt for AI generation')
      return
    }
    
    if (trimmedPrompt.length < 10) {
      toast.showWarning('Please provide a more detailed prompt (at least 10 characters)')
      return
    }
    
    if (trimmedPrompt.length > 1000) {
      toast.showWarning('Prompt is too long. Please keep it under 1000 characters.')
      return
    }
    
    setLoading(true)
    setErrors({})
    
    try {
      console.log('📤 Sending AI generation request...')
      console.log('📝 Prompt:', trimmedPrompt.substring(0, 100) + (trimmedPrompt.length > 100 ? '...' : ''))
      
      const { data } = await api.post('/ai/generate', { prompt: trimmedPrompt })
      console.log('📥 Received AI response:', data)
      
      const r = data.data || {}

      if (!r || Object.keys(r).length === 0) {
  throw new Error("No AI data received from server");
}
      
      // Comprehensive validation of AI response
      console.log('🔍 Validating AI response fields:', {
        hasTitle: !!r.title,
        hasContent: !!r.content,
        hasSummary: !!r.summary,
        hasCategory: !!r.category,
        hasTags: Array.isArray(r.tags) && r.tags.length > 0
      })
      
      // Ensure minimum required fields
      if (!r.title && !r.content) {
        throw new Error('AI response is incomplete. Please try again with a different prompt.')
      }
      
      // Track what was generated
      const generatedFields = []
      
      // Set generated content with validation
      if (r.title && r.title.trim()) {
        console.log('✅ Setting title:', r.title)
        setTitle(r.title.trim())
        generatedFields.push('Title')
      } else {
        console.warn('⚠️ Title is missing or empty')
      }
      
      if (r.content && r.content.trim()) {
        console.log('✅ Setting content (length:', r.content.length, 'chars)')
        setContent(r.content)
        generatedFields.push('Content')
      } else {
        console.warn('⚠️ Content is missing or empty')
      }
      
      if (r.summary && r.summary.trim()) {
        console.log('✅ Setting summary:', r.summary.substring(0, 100) + '...')
        setSummary(r.summary.trim())
        generatedFields.push('Summary')
      } else {
        console.warn('⚠️ Summary is missing - will need to be added manually')
      }
      
      if (r.category && r.category.trim()) {
        console.log('✅ Setting category:', r.category)
        setCategory(r.category.trim())
        generatedFields.push('Category')
      } else {
        console.warn('⚠️ Category is missing - defaulting to General')
        setCategory('General')
      }
      
      // Handle tags - ensure it's properly formatted
      if (r.tags) {
        let tagString = ''
        
        if (Array.isArray(r.tags) && r.tags.length > 0) {
          // Filter out empty tags and join
          const validTags = r.tags.filter(t => t && String(t).trim())
          if (validTags.length > 0) {
            tagString = validTags.map(t => String(t).trim()).join(', ')
          }
        } else if (typeof r.tags === 'string' && r.tags.trim()) {
          tagString = r.tags.trim()
        }
        
        if (tagString) {
          console.log('✅ Setting tags:', tagString)
          setTags(tagString)
          generatedFields.push('Tags')
        } else {
          console.warn('⚠️ Tags are empty or invalid')
        }
      } else {
        console.warn('⚠️ No tags provided in AI response')
      }
      
      // Handle metaDescription if provided (optional field for SEO)
      if (r.metaDescription) {
        console.log('✅ Meta description received:', r.metaDescription.substring(0, 100))
        // You can add a metaDescription field to your form if needed
      }
      
      // Clear the prompt after successful generation
      setAiPrompt('')
      
      // Show detailed success message with what was generated
      const fieldsGenerated = generatedFields.length > 0 
        ? `✅ ${generatedFields.join('\n✅ ')}` 
        : 'Content generated'
      
      const missingFields = []
      if (!r.title || !r.title.trim()) missingFields.push('Title')
      if (!r.content || !r.content.trim()) missingFields.push('Content')  
      if (!r.summary || !r.summary.trim()) missingFields.push('Summary')
      if (!r.category || !r.category.trim()) missingFields.push('Category')
      if (!r.tags || (Array.isArray(r.tags) && r.tags.length === 0)) missingFields.push('Tags')
      
      const missingInfo = missingFields.length > 0 
        ? `\n\n⚠️ Please manually add: ${missingFields.join(', ')}` 
        : ''
      
      toast.showSuccess(
        `✨ AI Generation Successful!\n\n${fieldsGenerated}${missingInfo}\n\nReview and edit before publishing.`, 
        6000
      )
      
      console.log('✅ AI generation complete:', {
        fieldsGenerated: generatedFields,
        missingFields: missingFields,
        titleLength: r.title?.length || 0,
        contentLength: r.content?.length || 0,
        summaryLength: r.summary?.length || 0,
        categorySet: !!r.category,
        tagsCount: Array.isArray(r.tags) ? r.tags.length : 0
      })
      
    } catch (e) {
      console.error('❌ AI generation error:', e)
      console.error('Error details:', {
        message: e.message,
        response: e.response?.data,
        status: e.response?.status
      })
      
      let errorMsg = 'AI generation failed'
      let errorTitle = '❌ AI Generation Failed'
      
      const backendMsg = e.response?.data?.message || ''
      
      // Check for specific error types
      if (backendMsg.includes('overloaded') || backendMsg.includes('503') || backendMsg.includes('Service Unavailable')) {
        errorTitle = '⏳ AI Service Temporarily Unavailable'
        errorMsg = 'The AI service is currently experiencing high demand. Please wait a moment and try again.\n\nThe service should be available shortly.'
      } else if (e.response?.status === 400) {
        errorMsg = backendMsg || 'Invalid prompt. Please provide more details and try again.'
      } else if (e.response?.status === 401) {
        errorMsg = 'Your session has expired. Please log in again.'
      } else if (e.response?.status === 500) {
        errorMsg = backendMsg || 'Server error occurred. Please try again or write manually.'
      } else if (backendMsg.includes('quota') || backendMsg.includes('RESOURCE_EXHAUSTED')) {
        errorTitle = '⚠️ API Quota Exceeded'
        errorMsg = 'The AI service quota has been exceeded. Please try again later or write your post manually.'
      } else if (backendMsg.includes('Rate limit')) {
        errorTitle = '⏰ Rate Limit Reached'
        errorMsg = 'Too many requests. Please wait 30 seconds and try again.'
      } else if (backendMsg) {
        errorMsg = backendMsg
      } else if (e.message) {
        errorMsg = e.message
      }
      
      toast.showError(
        `${errorTitle}\n\n${errorMsg}\n\n💡 Tip: You can write your post manually or try again in a moment.`, 
        8000
      )
    } finally { 
      setLoading(false) 
    }
  }

  const validateForm = () => {
    const newErrors = {}
    if (!title.trim()) {
      newErrors.title = 'Title is required'
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters'
    } else if (title.trim().length > 200) {
      newErrors.title = 'Title must not exceed 200 characters'
    }
    
    const plainText = content.replace(/<[^>]*>/g, '').trim()
    if (!plainText) {
      newErrors.content = 'Content is required'
    } else if (plainText.length < 50) {
      newErrors.content = 'Content must be at least 50 characters'
    }
    
    if (summary && summary.length > 500) {
      newErrors.summary = 'Summary must not exceed 500 characters'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const onSaveDraft = async () => {
    if (!title.trim() && !content.trim()) {
      toast.showWarning('Please add some content before saving')
      return
    }

    setLoading(true)
    try {
      console.log('Saving draft. Cover file selected:', !!cover, cover?.name)
      const newCoverUrl = cover ? await onUpload() : null
      console.log('New cover URL after upload:', newCoverUrl)
      console.log('Existing cover image URL:', coverImageUrl)
      
      // Determine final cover URL: prioritize new upload, then existing URL
      const finalCoverUrl = newCoverUrl || coverImageUrl || null
      
      console.log('Final cover URL to be sent:', finalCoverUrl)
      
      const body = { 
        title: title.trim() || 'Untitled Draft', 
        content: content.trim() || '<p>Draft content</p>', 
        summary: summary.trim() || undefined, 
        category: category.trim() || undefined, 
        tags: tags.split(',').map(t => t.trim()).filter(Boolean), 
        coverImageUrl: finalCoverUrl, 
        status: 'draft'
      }
      
      console.log('Request body:', body)
      
      if (editingPost) {
        await api.put(`/posts/${editingPost.slug}`, body)
        toast.showSuccess('Draft updated successfully!')
      } else {
        await api.post('/posts', body)
        toast.showSuccess('Draft saved successfully!')
      }
      
      // Clear localStorage draft
      localStorage.removeItem('blog_draft')
      
      setTimeout(() => navigate('/dashboard'), 1000)
    } catch (e) {
      toast.showError('Failed to save draft: ' + (e.response?.data?.message || e.message))
    } finally {
      setLoading(false)
    }
  }

  const onPublish = async () => {
    if (!validateForm()) {
      toast.showWarning('Please fix the form errors before publishing')
      return
    }

    setLoading(true)
    try {
      // Only upload cover if a new file was selected
      console.log('Publishing post. Cover file selected:', !!cover, cover?.name)
      const newCoverUrl = cover ? await onUpload() : null
      console.log('New cover URL after upload:', newCoverUrl)
      console.log('Existing cover image URL:', coverImageUrl)
      
      // Determine final cover URL: prioritize new upload, then existing URL
      const finalCoverUrl = newCoverUrl || coverImageUrl || null
      
      console.log('Final cover URL to be sent:', finalCoverUrl)
      
      const body = { 
        title: title.trim(), 
        content: content.trim(), 
        summary: summary.trim() || undefined, 
        category: category.trim() || undefined, 
        tags: tags.split(',').map(t => t.trim()).filter(Boolean), 
        coverImageUrl: finalCoverUrl, 
        status: 'published'
      }
      
      console.log('Request body:', body)
      
      let response
      if (editingPost) {
        // Update existing post
        response = await api.put(`/posts/${editingPost.slug}`, body)
        toast.showSuccess('Post updated successfully! Redirecting...')
      } else {
        // Create new post
        response = await api.post('/posts', body)
        toast.showSuccess('Post published successfully! Redirecting...')
      }
      
      // Clear localStorage draft
      localStorage.removeItem('blog_draft')
      
      // Redirect after successful operation
      setTimeout(() => {
        if (editingPost) {
          navigate(`/post/${response.data.post.slug}`)
        } else {
          navigate('/dashboard')
        }
      }, 1000)
    } catch (e) {
      const errorMsg = e.response?.data?.message || e.message || `Failed to ${editingPost ? 'update' : 'create'} post`
      toast.showError('Error: ' + errorMsg)
      console.error(`Post ${editingPost ? 'update' : 'creation'} error:`, e)
    } finally { setLoading(false) }
  }

  // Enhanced Rich Text Editor Modules
  const quillModules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image', 'video'],
      ['clean']
    ]
  }), [])

  return (
    <div className="space-y-3 md:space-y-4 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-lg shadow">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {editingPost ? '✏️ Edit Post' : '✍️ Create New Post'}
          </h1>
          {editingPost && (
            <p className="text-sm text-gray-600 mt-1">Editing: {editingPost.title}</p>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          {autoSaveStatus && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              ✓ {autoSaveStatus}
              {lastSaved && ` - ${lastSaved.toLocaleTimeString()}`}
            </span>
          )}
          <button
            onClick={saveDraft}
            className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            💾 Save Draft
          </button>
          {!editingPost && localStorage.getItem('blog_draft') && (
            <>
              <button
                onClick={loadDraft}
                className="text-sm px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors font-medium"
              >
                📂 Load
              </button>
              <button
                onClick={clearDraft}
                className="text-sm px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors font-medium"
              >
                🗑️ Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 md:p-4 rounded-lg border border-blue-200">
        <div className="flex flex-wrap gap-3 md:gap-5 text-sm items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">📝 Words:</span>
            <span className="text-gray-900 font-medium">{contentStats.words}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">🔤 Characters:</span>
            <span className="text-gray-900 font-medium">{contentStats.characters}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">⏱️ Read Time:</span>
            <span className="text-gray-900 font-medium">{contentStats.readingTime} min</span>
          </div>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="ml-auto px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-colors text-sm font-semibold border border-gray-300 shadow-sm"
          >
            {showPreview ? '✏️ Edit Mode' : '👁️ Preview'}
          </button>
        </div>
      </div>

      {/* Main Editor */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow space-y-5">
        {!showPreview ? (
          <>
            {/* Title Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-gray-500 font-medium">
                  {title.length}/200 characters
                </span>
              </div>
              <input 
                className={`w-full border-2 p-3 rounded-lg text-base md:text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter an engaging title for your post..." 
                value={title} 
                onChange={e => { setTitle(e.target.value); setErrors({...errors, title: ''}) }}
                maxLength={200}
              />
              {errors.title && <p className="text-red-500 text-sm mt-1.5">⚠️ {errors.title}</p>}
            </div>
            
            {/* Rich Text Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Content <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="prose-editor">
                <ReactQuill 
                  theme="snow"
                  value={content} 
                  onChange={(val) => { setContent(val); setErrors({...errors, content: ''}) }}
                  modules={quillModules}
                  className="bg-white min-h-[400px]"
                  placeholder="Write your amazing content here... Use the toolbar above for formatting."
                />
              </div>
              {errors.content && <p className="text-red-500 text-sm mt-2">⚠️ {errors.content}</p>}
            </div>
          </>
        ) : (
          /* Preview Mode */
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{title || 'Untitled Post'}</h1>
            {summary && (
              <p className="text-lg text-gray-600 italic border-l-4 border-blue-500 pl-4">{summary}</p>
            )}
            {(coverPreview || coverImageUrl) && (
              <div className="relative">
                <img 
                  src={coverPreview || coverImageUrl} 
                  alt="Cover" 
                  className="w-full h-64 md:h-96 object-cover rounded-lg"
                />
                <button
                  onClick={removeCoverImage}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-all transform hover:scale-110"
                  title="Remove cover image"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
            <div 
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content || '<p class="text-gray-400">No content yet...</p>') }}
            />
            <div className="flex flex-wrap gap-2">
              {category && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  📁 {category}
                </span>
              )}
              {tags.split(',').filter(Boolean).map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  #{tag.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metadata Section */}
      {!showPreview && (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow space-y-5">
          <h3 className="text-lg md:text-xl font-bold text-gray-900 border-b-2 border-gray-200 pb-3">📋 Post Metadata</h3>
          
          {/* Summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">Summary</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">{summary.length}/500 characters</span>
                {content && !summary && (
                  <button
                    onClick={generateSummary}
                    className="text-xs px-2.5 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors font-medium"
                  >
                    ✨ Auto-generate
                  </button>
                )}
              </div>
            </div>
            <textarea
              className={`w-full border-2 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none leading-relaxed ${
                errors.summary ? 'border-red-500' : 'border-gray-300'
              }`}
              rows="2"
              placeholder="Write a brief summary of your post (optional)..." 
              value={summary} 
              onChange={e => setSummary(e.target.value)}
              maxLength={500}
            />
            {errors.summary && <p className="text-red-500 text-sm mt-1.5">⚠️ {errors.summary}</p>}
          </div>
        
          {/* Category and Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Category Dropdown */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Category</label>
              {categories.length > 0 && category !== '_custom' ? (
                <select
                  className="w-full border-2 border-gray-300 p-3 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="">Select a category...</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                  ))}
                  <option value="_custom">+ Add Custom Category</option>
                </select>
              ) : (
                <>
                  <input 
                    className="w-full border-2 border-gray-300 p-3 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="e.g., Technology, Health, Travel..." 
                    value={category === '_custom' ? '' : category} 
                    onChange={e => setCategory(e.target.value)} 
                  />
                  {category === '_custom' && categories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCategory('')}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      ← Back to category list
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Tags Input */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Tags</label>
              <input 
                className="w-full border-2 border-gray-300 p-3 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                placeholder="react, javascript, tutorial (comma separated)" 
                value={tags} 
                onChange={e => setTags(e.target.value)} 
              />
              <p className="text-xs text-gray-500 mt-1.5 font-medium">
                💡 Tip: Use comma-separated tags for better discoverability
              </p>
            </div>
          </div>
          
          {/* Cover Image Upload */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Cover Image</label>
            
            {/* Image Preview */}
            {(coverPreview || coverImageUrl) && (
              <div className="mb-3 relative">
                <img 
                  src={coverPreview || coverImageUrl} 
                  alt="Cover preview" 
                  className="h-48 md:h-64 w-full object-cover rounded-lg border-2 border-gray-300" 
                />
                <button
                  onClick={removeCoverImage}
                  className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-all transform hover:scale-110"
                  title="Remove cover image"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
                <p className="text-xs text-gray-500 mt-2 font-medium">
                  {coverPreview ? '📸 New cover image selected' : '🖼️ Current cover image'}
                </p>
              </div>
            )}
            
            {/* File Input */}
            <div className="relative">
              <input 
                type="file" 
                accept="image/*"
                onChange={e => setCover(e.target.files?.[0])} 
                className="block w-full text-sm text-gray-500 
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-gradient-to-r file:from-blue-500 file:to-blue-600
                  file:text-white
                  hover:file:from-blue-600 hover:file:to-blue-700
                  file:cursor-pointer file:transition-all
                  cursor-pointer"
                id="cover-upload"
              />
            </div>
            
            {cover && (
              <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                <span className="text-green-600">✓ Selected: {cover.name}</span>
                <span className="text-gray-500">({(cover.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
            
            {coverImageUrl && cover && (
              <p className="text-xs text-orange-600 mt-2 font-medium">
                ⚠️ This will replace your current cover image
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t-2 border-gray-200">
            <button 
              onClick={onPublish} 
              disabled={loading} 
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3.5 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base font-bold shadow-lg transition-all transform hover:scale-[1.02] active:scale-95"
            >
              {loading ? '⏳ Processing...' : (editingPost ? '💾 Update Post' : '📝 Publish Post')}
            </button>
            
            <button 
              onClick={onSaveDraft} 
              disabled={loading} 
              className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3.5 rounded-lg hover:from-gray-600 hover:to-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base font-bold shadow-lg transition-all transform hover:scale-[1.02] active:scale-95"
            >
              {loading ? '⏳ Saving...' : '💾 Save as Draft'}
            </button>
            
            {editingPost && (
              <button 
                onClick={() => navigate(`/post/${editingPost.slug}`)} 
                disabled={loading}
                className="sm:w-auto w-full bg-red-500 text-white px-6 py-3.5 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base font-bold shadow-lg transition-all transform hover:scale-[1.02] active:scale-95"
              >
                ❌ Cancel
              </button>
            )}
          </div>
        </div>
      )}
      {/* AI Assistant Section */}
      <div className="relative bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-2xl shadow-xl border border-indigo-100 overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-200/20 to-indigo-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                AI Writing Assistant
              </h3>
              <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                Describe your topic, and our AI will craft a complete blog post draft with title, content, summary, and optimized tags.
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Prompt Input */}
            <div className="relative">
              <textarea 
                className="w-full border-2 border-indigo-200 bg-white/80 backdrop-blur-sm p-4 md:p-5 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all text-sm md:text-base text-gray-800 placeholder-gray-400 shadow-sm hover:border-indigo-300 resize-none" 
                rows="4" 
                placeholder="Example: Write a comprehensive blog post about the benefits of machine learning in healthcare, including real-world applications, challenges, and future prospects..." 
                value={aiPrompt} 
                onChange={e => setAiPrompt(e.target.value)}
                maxLength={1000}
              />
              <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                {aiPrompt.length}/1000
              </div>
            </div>
            
            {/* Generate Button */}
            <button 
              onClick={onGenerate} 
              disabled={loading || !aiPrompt.trim()} 
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white px-6 py-4 rounded-xl font-semibold text-sm md:text-base shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generating with AI...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Generate Draft with AI</span>
                </>
              )}
            </button>
            
            {/* Tips Section */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 md:p-5 border border-indigo-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-800 text-sm md:text-base">Tips for better AI-generated content</h4>
              </div>
              <ul className="space-y-2.5 text-xs md:text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span>Be specific about your topic and target audience</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span>Mention the tone (professional, casual, technical, etc.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span>Include key points you want to cover</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span>Review and edit the generated content before publishing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Writing Tips Section */}
      <div className="bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-200 rounded-xl p-5 md:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
          </div>
          <h4 className="font-bold text-slate-900 text-base md:text-lg">Writing Tips</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-100">
            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm">
              <span className="font-semibold text-gray-900">Engaging Titles:</span>
              <span className="text-gray-600"> Use numbers, questions, or power words</span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-100">
            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm">
              <span className="font-semibold text-gray-900">Clear Structure:</span>
              <span className="text-gray-600"> Use headings, lists, and short paragraphs</span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-100">
            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm">
              <span className="font-semibold text-gray-900">Good Summary:</span>
              <span className="text-gray-600"> 1-2 sentences that hook readers</span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-100">
            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm">
              <span className="font-semibold text-gray-900">SEO Tags:</span>
              <span className="text-gray-600"> 3-5 relevant keywords for discoverability</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


