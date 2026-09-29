import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from '@/hooks/useTheme'

const Toaster = (props: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme as 'light' | 'dark'}
      position="top-center"
      richColors
      expand
      {...props}
    />
  )
}

export { Toaster }
