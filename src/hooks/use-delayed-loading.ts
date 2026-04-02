import { useEffect, useState } from "react"

// Returns true while loading, but keeps true for at least `minDuration`ms
// so skeletons always show and never flash away instantly
export function useDelayedLoading(loading: boolean, minDuration = 450) {
  const [show, setShow] = useState(loading)

  useEffect(() => {
    if (loading) {
      setShow(true)
      return
    }
    const id = setTimeout(() => setShow(false), minDuration)
    return () => clearTimeout(id)
  }, [loading, minDuration])

  return show
}
