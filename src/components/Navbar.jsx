import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  AppShell,
  Group, 
  Text, 
  Button, 
  Burger, 
  Drawer, 
  Stack, 
  Avatar, 
  Menu,
  ActionIcon,
  ThemeIcon,
  UnstyledButton
} from '@mantine/core'
import { 
  IconTrendingUp, 
  IconHome, 
  IconBook, 
  IconChartBar, 
  IconCalendar,
  IconLogout, 
  IconUser,
  IconChevronDown,
  IconShield,
  IconBrain
} from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import { checkAdminAccess } from '../utils/admin'

const Navbar = ({ user, onLogout }) => {
  const location = useLocation()
  const [opened, { toggle, close }] = useDisclosure(false)

  // Debug logging
  console.log('Navbar Debug:', {
    user,
    username: user?.username,
    adminUsername: import.meta.env.VITE_ADMIN_USERNAME,
    isAdmin: checkAdminAccess(user)
  })

  const navItems = [
    { path: '/', label: 'Dashboard', icon: IconHome },
    { path: '/trades', label: 'Trading Notes', icon: IconBook },
    { path: '/statistics', label: 'Statistics', icon: IconChartBar },
    { path: '/ai-analysis', label: 'AI Analysis', icon: IconBrain, adminOnly: true },
    { path: '/calendar', label: 'Calendar', icon: IconCalendar },
    { path: '/admin', label: 'Admin', icon: IconShield, adminOnly: true }
  ]

  const NavLink = ({ item, onClick }) => {
    const isActive = location.pathname === item.path
    return (
      <UnstyledButton
        component={Link}
        to={item.path}
        onClick={onClick}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          backgroundColor: isActive ? 'var(--mantine-color-blue-0)' : 'transparent',
          color: isActive ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-gray-7)',
          fontWeight: isActive ? 600 : 400,
          transition: 'all 0.2s',
        }}
        className="hover:bg-gray-100"
      >
        <Group gap="sm">
          <item.icon size={18} />
          <Text size="sm">{item.label}</Text>
        </Group>
      </UnstyledButton>
    )
  }

  return (
    <>
      <AppShell.Header p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Group justify="space-between" h="100%">
          {/* Logo */}
          <Group gap="sm">
            <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'blue', to: 'purple' }}>
              <IconTrendingUp size={20} />
            </ThemeIcon>
            <Text fw={700} size="lg" c="dark">
              TradingNotes
            </Text>
          </Group>

              {/* Desktop Navigation */}
              <Group gap="xs" visibleFrom="sm">
                {navItems
                  .filter(item => !item.adminOnly || checkAdminAccess(user))
                  .map((item) => (
                    <NavLink key={item.path} item={item} />
                  ))}
              </Group>

          {/* Desktop User Menu */}
          <Group gap="sm" visibleFrom="sm">
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button variant="subtle" leftSection={<IconUser size={16} />} rightSection={<IconChevronDown size={14} />}>
                  {user?.username}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconLogout size={14} />} onClick={onLogout}>
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          {/* Mobile Menu Button */}
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
        </Group>
      </AppShell.Header>

      {/* Mobile Drawer */}
      <Drawer
        opened={opened}
        onClose={close}
        size="280px"
        title="Menu"
        hiddenFrom="sm"
        zIndex={1000000}
      >
            <Stack gap="xs">
              {navItems
                .filter(item => !item.adminOnly || checkAdminAccess(user))
                .map((item) => (
                  <NavLink key={item.path} item={item} onClick={close} />
                ))}
          
          <div style={{ borderTop: '1px solid var(--mantine-color-gray-2)', paddingTop: '16px', marginTop: '16px' }}>
            <Group gap="sm" p="sm">
              <Avatar size="sm" color="blue">
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
              <Text size="sm" fw={500}>
                {user?.username}
              </Text>
            </Group>
            <Button
              variant="subtle"
              leftSection={<IconLogout size={16} />}
              onClick={() => {
                onLogout()
                close()
              }}
              fullWidth
              justify="flex-start"
            >
              Logout
            </Button>
          </div>
        </Stack>
      </Drawer>
    </>
  )
}

export default Navbar