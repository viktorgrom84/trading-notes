import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Table,
  Button,
  Group,
  Text,
  Badge,
  ActionIcon,
  Modal,
  Stack,
  Alert,
  Loader,
  Center,
  ThemeIcon,
  Card,
  Grid,
  Divider
} from '@mantine/core';
import {
  IconUsers,
  IconTrash,
  IconAlertCircle,
  IconShield,
  IconCalendar,
  IconId
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import apiClient from '../api';

const Admin = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersData = await apiClient.getUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch users',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      setDeleting(true);
      await apiClient.deleteUser(userToDelete.id);
      
      setUsers(users.filter(user => user.id !== userToDelete.id));
      setDeleteModalOpen(false);
      setUserToDelete(null);
      
      notifications.show({
        title: 'Success',
        message: `User ${userToDelete.username} deleted successfully`,
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete user',
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const utcDate = new Date(dateString)
      if (isNaN(utcDate.getTime())) return '-'
      return utcDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return '-'
    }
  };

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Center>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="md">
            <ThemeIcon size="xl" variant="gradient" gradient={{ from: 'red', to: 'orange' }}>
              <IconShield size={24} />
            </ThemeIcon>
            <div>
              <Title order={1}>Admin Panel</Title>
              <Text c="dimmed">Manage users and system administration</Text>
            </div>
          </Group>
          <Badge size="lg" variant="light" color="red">
            Admin Only
          </Badge>
        </Group>

        {/* Stats Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder>
              <Group gap="md">
                <ThemeIcon size="lg" variant="light" color="blue">
                  <IconUsers size={20} />
                </ThemeIcon>
                <div>
                  <Text size="sm" c="dimmed">Total Users</Text>
                  <Text size="xl" fw={700}>{users.length}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder>
              <Group gap="md">
                <ThemeIcon size="lg" variant="light" color="green">
                  <IconCalendar size={20} />
                </ThemeIcon>
                <div>
                  <Text size="sm" c="dimmed">New This Week</Text>
                  <Text size="xl" fw={700}>
                    {users.filter(user => {
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return new Date(user.created_at) > weekAgo;
                    }).length}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Users Table */}
        <Paper withBorder>
          <div style={{ padding: '1rem' }}>
            <Group justify="space-between" mb="md">
              <Title order={3}>All Users</Title>
              <Button
                variant="light"
                leftSection={<IconUsers size={16} />}
                onClick={fetchUsers}
              >
                Refresh
              </Button>
            </Group>

            {users.length === 0 ? (
              <Center py="xl">
                <Stack align="center" gap="md">
                  <ThemeIcon size="xl" variant="light" color="gray">
                    <IconUsers size={32} />
                  </ThemeIcon>
                  <Text c="dimmed">No users found</Text>
                </Stack>
              </Center>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>ID</Table.Th>
                    <Table.Th>Username</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {users.map((user) => (
                    <Table.Tr key={user.id}>
                      <Table.Td>
                        <Group gap="xs">
                          <ThemeIcon size="sm" variant="light" color="blue">
                            <IconId size={14} />
                          </ThemeIcon>
                          {user.id}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{user.username}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {formatDate(user.created_at)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => handleDeleteUser(user)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </div>
        </Paper>
      </Stack>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete User"
        centered
      >
        <Stack gap="md">
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Warning"
            color="red"
            variant="light"
          >
            This action cannot be undone. The user and all their data will be permanently deleted.
          </Alert>
          
          <Text>
            Are you sure you want to delete user <strong>{userToDelete?.username}</strong>?
          </Text>

          <Group justify="flex-end" gap="sm">
            <Button
              variant="light"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={confirmDelete}
              loading={deleting}
              leftSection={<IconTrash size={16} />}
            >
              Delete User
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default Admin;
