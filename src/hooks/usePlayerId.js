import { useState, useEffect } from 'react'

export default function usePlayerId() {
  const [playerId, setPlayerId] = useState(null)
  const [playerName, setPlayerName] = useState('')

  useEffect(() => {
    let id = localStorage.getItem('pente_player_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('pente_player_id', id)
    }
    setPlayerId(id)
    setPlayerName(localStorage.getItem('pente_player_name') || '')
  }, [])

  const updateName = (name) => {
    setPlayerName(name)
    localStorage.setItem('pente_player_name', name)
  }

  return { playerId, playerName, setPlayerName: updateName }
}
