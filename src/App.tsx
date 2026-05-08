import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import { Login } from '@/pages/Login'
import { Accounts } from '@/pages/Accounts'
import { AccountDetail } from '@/pages/AccountDetail'
import { AccountForm } from '@/pages/AccountForm'
import { Products } from '@/pages/Products'
import { Import } from '@/pages/Import'
import { Settings } from '@/pages/Settings'

function App() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Accounts />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/accounts/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <AccountDetail />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/accounts/new"
        element={
          <ProtectedRoute>
            <Layout>
              <AccountForm />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/accounts/:id/edit"
        element={
          <ProtectedRoute>
            <Layout>
              <AccountForm />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Layout>
              <Products />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/import"
        element={
          <ProtectedRoute>
            <Layout>
              <Import />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
