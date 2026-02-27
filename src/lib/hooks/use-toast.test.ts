// Tests for use-toast

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  },
}))

describe('toast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toast.success calls sonner toast.success', async () => {
    const { toast: sonnerToast } = await import('sonner')
    const { toast } = await import('./use-toast')
    toast.success('Saved!')
    expect(sonnerToast.success).toHaveBeenCalledWith('Saved!', { duration: 4000, description: undefined })
  })

  it('toast.success passes custom options', async () => {
    const { toast: sonnerToast } = await import('sonner')
    const { toast } = await import('./use-toast')
    toast.success('Done', { duration: 2000, description: 'Record saved' })
    expect(sonnerToast.success).toHaveBeenCalledWith('Done', { duration: 2000, description: 'Record saved' })
  })

  it('toast.error calls sonner toast.error', async () => {
    const { toast: sonnerToast } = await import('sonner')
    const { toast } = await import('./use-toast')
    toast.error('Failed!')
    expect(sonnerToast.error).toHaveBeenCalledWith('Failed!', { duration: 4000, description: undefined })
  })

  it('toast.info calls sonner toast.info', async () => {
    const { toast: sonnerToast } = await import('sonner')
    const { toast } = await import('./use-toast')
    toast.info('Info message')
    expect(sonnerToast.info).toHaveBeenCalledWith('Info message', { duration: 4000, description: undefined })
  })

  it('toast.warning calls sonner toast.warning', async () => {
    const { toast: sonnerToast } = await import('sonner')
    const { toast } = await import('./use-toast')
    toast.warning('Warning!')
    expect(sonnerToast.warning).toHaveBeenCalledWith('Warning!', { duration: 4000, description: undefined })
  })

  it('toast.dismiss calls sonner dismiss with id', async () => {
    const { toast: sonnerToast } = await import('sonner')
    const { toast } = await import('./use-toast')
    toast.dismiss('toast-1')
    expect(sonnerToast.dismiss).toHaveBeenCalledWith('toast-1')
  })

  it('toast.dismiss calls sonner dismiss without args', async () => {
    const { toast: sonnerToast } = await import('sonner')
    const { toast } = await import('./use-toast')
    toast.dismiss()
    expect(sonnerToast.dismiss).toHaveBeenCalledWith()
  })
})

describe('useToast', () => {
  it('returns the toast object', async () => {
    const { useToast, toast } = await import('./use-toast')
    const { toast: returnedToast } = useToast()
    expect(returnedToast).toBe(toast)
  })
})
