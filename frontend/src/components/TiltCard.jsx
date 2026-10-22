import { useRef } from 'react'
import './TiltCard.css'

const MAX_TILT = 8

// Pointer-tracked 3D tilt. Updates CSS variables directly so moving the pointer never re-renders React.
// Children marked with .tilt-layer sit forward in depth. Inert for touch input and reduced motion (see CSS).
function TiltCard({ as: Tag = 'div', className = '', children, ...props }) {
  const ref = useRef(null)

  const handleMove = (e) => {
    if (e.pointerType !== 'mouse') return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const style = ref.current.style
    style.setProperty('--tilt-x', `${(0.5 - y) * MAX_TILT * 2}deg`)
    style.setProperty('--tilt-y', `${(x - 0.5) * MAX_TILT * 2}deg`)
    style.setProperty('--glare-x', `${x * 100}%`)
    style.setProperty('--glare-y', `${y * 100}%`)
    ref.current.dataset.tilting = 'true'
  }

  const handleLeave = () => {
    const style = ref.current.style
    style.setProperty('--tilt-x', '0deg')
    style.setProperty('--tilt-y', '0deg')
    delete ref.current.dataset.tilting
  }

  return (
    <Tag ref={ref} className={`tilt ${className}`} onPointerMove={handleMove} onPointerLeave={handleLeave} {...props}>
      <div className="tilt-inner">{children}</div>
    </Tag>
  )
}

export default TiltCard
