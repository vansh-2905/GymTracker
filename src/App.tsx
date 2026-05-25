import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import SignInScreen from './auth/SignInScreen'
import BottomNav from './components/BottomNav'
import TodayScreen from './screens/TodayScreen'
import ActiveWorkoutScreen from './screens/ActiveWorkoutScreen'
import CalendarScreen from './screens/CalendarScreen'
import ExercisesScreen from './screens/ExercisesScreen'
import SettingsScreen from './screens/SettingsScreen'
import CoachScreen from './screens/CoachScreen'
import OnboardingScreen from './screens/OnboardingScreen'

export default function App() {
  const { user, loading, needsOnboarding, completeOnboarding } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <SignInScreen />
  if (needsOnboarding) return <OnboardingScreen onComplete={completeOnboarding} />

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-iron-950 text-white pb-20">
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/workout/:date" element={<ActiveWorkoutScreen />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/exercises" element={<ExercisesScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/coach" element={<CoachScreen />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
