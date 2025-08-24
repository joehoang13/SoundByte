import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'


export default function RequireAuth({ children }: { children: React.ReactElement }) {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('sb_token') : null
    const loc = useLocation()
    if (!token) return <Navigate to="/login" state={{ from: loc }} replace />
    return children
}