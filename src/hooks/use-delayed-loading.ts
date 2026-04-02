import { useEffect, useState } from "react"

export function useDelayedLoading(loading: boolean, delay = 450) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!loading) { setShow(false); return }
    const id = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(id)
  }, [loading, delay])

  return show
}
