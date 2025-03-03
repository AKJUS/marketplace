import React from 'react'
import { Network } from '@dcl/schemas'

export type Props = {
  open: boolean
  headerTitle?: string
  content?: React.ReactNode | string
  loading?: boolean
  network: Network
  disabled?: boolean
  error?: string | null
  valueToConfirm: string
  onCancel: () => void
  onConfirm: () => void
}
