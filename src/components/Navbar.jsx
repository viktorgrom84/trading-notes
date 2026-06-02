import React, { useMemo } from 'react'
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
  ThemeIcon,
  UnstyledButton,
  Divider
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
  IconBrain,
  IconChartCandle,
  IconReportMoney,
  IconWorld,
  IconRocket,
  IconChartLine,
  IconArrowsExchange,
} from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import { checkAdminAccess } from '../utils/admin'

const Navbar = ({ user, onLogout }) => {
  const location = useLocation()
  const [opened, { toggle, close }] = useDisclosure(false)

  const hasAdminAccess = useMemo(() => checkAdminAccess(user), [user?.username])

  // Standalone nav links
  const standaloneItems = [
    { path: '/',        label: 'Dashboard',     icon: IconHome },
    { path: '/trades',  label: 'Trading Notes', icon: IconBook },
    { path: '/calendar',label: 'Calendar',      icon: IconCalendar },
    { path: '/options', label: 'Options',        icon: IconArrowsExchange },
  ]

  // "Markets" dropdown
  const marketItems = [
    { path: '/earnings',          label: 'Earnings',          icon: IconReportMoney },
    { path: '/economic-events',   label: 'Economic Events',   icon: IconWorld },
    { path: '/ipos',              label: 'Upcoming IPOs',     icon: IconRocket },
    { path: '/market-indicators', label: 'Market Indicators', icon: IconChartLine },
  ]

  // "Analysis" dropdown
  const analysisItems = [
    { path: '/statistics',     label: 'Statistics',       icon: IconChartBar },
    { path: '/ai-analysis',    label: 'AI Analysis',      icon: IconBrain },
    { path: '/tradingview-mcp',label: 'TradingView MCP',  icon: IconChartCandle },
  ]

  // All items flat (for mobile drawer)
  const allItems = [
    ...standaloneItems,
    ...marketItems,
    ...analysisItems,
    ...(hasAdminAccess ? [{ path: '/admin', label: 'Admin', icon: IconShield }] : []),
  ]

  const isActive = (path) => location.pathname === path
  const groupActive = (items) => items.some(i => location.pathname === i.path)

  const NavLink = ({ item, onClick }) => (
    <UnstyledButton
      component={Link}
      to={item.path}
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: '8px',
        backgroundColor: isActive(item.path) ? 'var(--mantine-color-blue-0)' : 'transparent',
        color: isActive(item.path) ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-gray-7)',
        fontWeight: isActive(item.path) ? 600 : 400,
        transition: 'all 0.2s',
      }}
    >
      <Group gap="sm">
        <item.icon size={18} />
        <Text size="sm">{item.label}</Text>
      </Group>
    </UnstyledButton>
  )

  // Dropdown nav group for desktop
  const NavDropdown = ({ label, items }) => {
    const active = groupActive(items)
    return (
      <Menu shadow="sm" width={200} offset={4}>
        <Menu.Target>
          <UnstyledButton
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: active ? 'var(--mantine-color-blue-0)' : 'transparent',
              color: active ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-gray-7)',
              fontWeight: active ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            <Group gap={4}>
              <Text size="sm">{label}</Text>
              <IconChevronDown size={13} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          {items.map(item => (
            <Menu.Item
              key={item.path}
              component={Link}
              to={item.path}
              leftSection={<item.icon size={15} />}
              style={{ fontWeight: isActive(item.path) ? 600 : 400 }}
            >
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
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
            {standaloneItems.map(item => (
              <NavLink key={item.path} item={item} />
            ))}
            <NavDropdown label="Markets" items={marketItems} />
            <NavDropdown label="Analysis" items={analysisItems} />
            {hasAdminAccess && (
              <NavLink item={{ path: '/admin', label: 'Admin', icon: IconShield }} />
            )}
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

      {/* Mobile Drawer — flat list, all items */}
      <Drawer
        opened={opened}
        onClose={close}
        size="280px"
        title="Menu"
        hiddenFrom="sm"
        zIndex={1000000}
      >
        <Stack gap="xs">
          {standaloneItems.map(item => (
            <NavLink key={item.path} item={item} onClick={close} />
          ))}

          <Divider label="Markets" labelPosition="left" my={4} />
          {marketItems.map(item => (
            <NavLink key={item.path} item={item} onClick={close} />
          ))}

          <Divider label="Analysis" labelPosition="left" my={4} />
          {analysisItems.map(item => (
            <NavLink key={item.path} item={item} onClick={close} />
          ))}

          {hasAdminAccess && (
            <>
              <Divider my={4} />
              <NavLink item={{ path: '/admin', label: 'Admin', icon: IconShield }} onClick={close} />
            </>
          )}

          <div style={{ borderTop: '1px solid var(--mantine-color-gray-2)', paddingTop: '16px', marginTop: '16px' }}>
            <Group gap="sm" p="sm">
              <Avatar size="sm" color="blue">
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
              <Text size="sm" fw={500}>{user?.username}</Text>
            </Group>
            <Button
              variant="subtle"
              leftSection={<IconLogout size={16} />}
              onClick={() => { onLogout(); close() }}
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
