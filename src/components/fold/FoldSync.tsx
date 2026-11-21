import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { useFoldChoice, useFoldLayout } from '@/hooks/useFoldMode'
import { isFoldChoice, readFoldChoice, saveFoldChoice } from '@/lib/fold-mode'
import { startNativePosture } from '@/native/ios-posture'

/** `?fold=` wins so screenshots and QA can force a pose. Otherwise the layout is automatic. */
export function FoldSync() {
  const location = useLocation()
  const choice = useFoldChoice()
  const layout = useFoldLayout()

  useEffect(() => startNativePosture(), [])

  useEffect(() => {
    const raw = new URLSearchParams(location.search).get('fold')
    if (raw == null || raw === '') {
      if (readFoldChoice() !== 'auto') saveFoldChoice('auto')
      return
    }
    if (isFoldChoice(raw) && readFoldChoice() !== raw) saveFoldChoice(raw)
  }, [location.search])

  useEffect(() => {
    const html = document.documentElement
    html.dataset.foldChoice = choice
    html.dataset.foldLayout = layout
    return () => {
      delete html.dataset.foldChoice
      delete html.dataset.foldLayout
    }
  }, [choice, layout])

  return null
}
