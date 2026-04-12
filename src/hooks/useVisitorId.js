import { useState, useEffect } from 'react'

export default function useVisitorId() {
  const [visitorId, setVisitorId] = useState(null)
  const [visitorName, setVisitorName] = useState('')

  useEffect(() => {
    let id = localStorage.getItem('intake_visitor_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('intake_visitor_id', id)
    }
    setVisitorId(id)
    setVisitorName(localStorage.getItem('intake_visitor_name') || '')
  }, [])

  const updateName = (name) => {
    setVisitorName(name)
    localStorage.setItem('intake_visitor_name', name)
  }

  return { visitorId, visitorName, setVisitorName: updateName }
}
