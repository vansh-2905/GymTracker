import { useAuth } from './auth/AuthContext'
import SignInScreen from './auth/SignInScreen'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <SignInScreen />

  return <div className="min-h-screen bg-gray-950 text-white">Logged in as {user.displayName}</div>
}
