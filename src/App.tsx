import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from './auth/AuthContext'
import SignInScreen from './auth/SignInScreen'
import ConsentScreen from './auth/ConsentScreen'
import BottomNav from './components/BottomNav'

const TodayScreen = lazy(() => import('./screens/TodayScreen'))
const ActiveWorkoutScreen = lazy(() => import('./screens/ActiveWorkoutScreen'))
const CalendarScreen = lazy(() => import('./screens/CalendarScreen'))
const ExercisesScreen = lazy(() => import('./screens/ExercisesScreen'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'))
const CoachScreen = lazy(() => import('./screens/CoachScreen'))
const OnboardingScreen = lazy(() => import('./screens/OnboardingScreen'))

function Spinner() {
  return (
    <div className="min-h-screen bg-iron-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-acid border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const { user, loading, needsConsent, needsOnboarding, completeOnboarding } = useAuth()

  if (loading) return <Spinner />

  if (!user) return <SignInScreen />

  if (needsConsent) return <ConsentScreen />

  return (
    <Suspense fallback={<div className="min-h-screen bg-iron-950" />}>
      {needsOnboarding ? (
        <OnboardingScreen onComplete={completeOnboarding} />
      ) : (
        <BrowserRouter>
          <div className="min-h-screen bg-iron-950 text-white pb-20">
            <Routes>
              <Route path="/" element={<TodayScreen />} />
              <Route path="/workout/:date" element={<ActiveWorkoutScreen />} />
              <Route path="/calendar" element={<CalendarScreen />} />
              <Route path="/exercises" element={<ExercisesScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/chat" element={<CoachScreen />} />
            </Routes>
            <BottomNav />
          </div>
        </BrowserRouter>
      )}
    </Suspense>
  )
}
