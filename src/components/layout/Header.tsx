import { LogOut, User, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/services/auth'
import { useTheme } from '@/hooks/useTheme'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function Header() {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()

  const initials = user?.displayName
    ?.split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  async function handleSignOut() {
    await signOut()
  }

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card flex-shrink-0">
      <div />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggle} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          className="h-8 w-8 text-muted-foreground hover:text-foreground">
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL ?? undefined} alt={user?.displayName ?? 'User'} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {initials ?? <User className="w-4 h-4" />}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
