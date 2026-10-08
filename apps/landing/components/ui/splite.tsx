'use client'

import { Component, Suspense, lazy, type ReactNode } from 'react'
import type { Application } from '@splinetool/runtime'
const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
  // Added to the spec: fires once the scene has loaded.
  onLoad?: (app: Application) => void
  // Fires when the scene file cannot be fetched. The library rethrows that
  // error during render, which would otherwise blank the whole page.
  onError?: () => void
}

type BoundaryProps = {
  children: ReactNode
  onError: () => void
  fallback?: ReactNode
}

// react-spline catches a failed load(), stores the error, and throws it on the
// next render. This boundary is what stops that from becoming an application error.
export class SplineLoadBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(): void {
    this.props.onError()
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}

export function SplineScene({ scene, className, onLoad, onError }: SplineSceneProps) {
  return (
    <SplineLoadBoundary onError={onError ?? (() => {})} fallback={null}>
      <Suspense 
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <span className="loader"></span>
          </div>
        }
      >
        <Spline
          scene={scene}
          className={className}
          onLoad={onLoad}
        />
      </Suspense>
    </SplineLoadBoundary>
  )
}
