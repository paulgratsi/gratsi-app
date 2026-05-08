import { useAuthStore } from '@/stores/authStore'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function Settings() {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-4">
        {/* User Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Account</h2>

          {profile && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">NAME</p>
                <p className="text-gray-900">{profile.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">EMAIL</p>
                <p className="text-gray-900">{profile.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">ROLE</p>
                <p className="text-gray-900 capitalize">{profile.role}</p>
              </div>

              {profile.assigned_states && profile.assigned_states.length > 0 && (
                <div>
                  <p className="text-xs text-gray-600 font-medium mb-1">ASSIGNED STATES</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.assigned_states.map((state) => (
                      <span
                        key={state}
                        className="bg-blue-100 text-blue-800 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      >
                        {state}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* App Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">About</h2>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">APP NAME</p>
              <p className="text-gray-900">Gratsi Account Manager</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">VERSION</p>
              <p className="text-gray-900">1.0.0</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">TYPE</p>
              <p className="text-gray-900">Progressive Web App (PWA)</p>
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg px-4 py-3 font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
