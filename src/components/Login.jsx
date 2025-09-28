import { useState } from 'react'
import { 
  Container, 
  Paper, 
  TextInput, 
  PasswordInput, 
  Button, 
  Title, 
  Text, 
  Group, 
  Stack,
  Center,
  Box,
  ThemeIcon,
  Alert
} from '@mantine/core'
import { IconTrendingUp, IconEye, IconEyeOff, IconAlertCircle } from '@tabler/icons-react'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import apiClient from '../api'

const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  const form = useForm({
    initialValues: {
      username: '',
      password: '',
      confirmPassword: ''
    },
    validate: {
      username: (value) => (value.length < 3 ? 'Username must be at least 3 characters' : null),
      password: (value) => (value.length < 6 ? 'Password must be at least 6 characters' : null),
      confirmPassword: (value, values) => 
        !isLogin && value !== values.password ? 'Passwords do not match' : null,
    },
  })

  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      let response
      if (isLogin) {
        response = await apiClient.login(values.username, values.password)
      } else {
        response = await apiClient.register(values.username, values.password)
      }

      notifications.show({
        title: 'Success!',
        message: isLogin ? 'Welcome back!' : 'Account created successfully!',
        color: 'green',
      })

      onLogin(response.user)
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'An error occurred',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box 
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <Container size={420} my={40}>
        <Paper withBorder shadow="xl" p={40} radius="md">
          <Center mb="xl">
            <ThemeIcon size={60} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'purple' }}>
              <IconTrendingUp size={30} />
            </ThemeIcon>
          </Center>
          
          <Title ta="center" mb="md">
            {isLogin ? 'Welcome back' : 'Create account'}
          </Title>
          
          <Text c="dimmed" size="sm" ta="center" mb="xl">
            {isLogin 
              ? 'Sign in to continue to your trading dashboard' 
              : 'Start tracking your trading performance'
            }
          </Text>

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label="Username"
                placeholder="Enter your username"
                required
                {...form.getInputProps('username')}
              />

              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                required
                {...form.getInputProps('password')}
              />

              {!isLogin && (
                <PasswordInput
                  label="Confirm Password"
                  placeholder="Confirm your password"
                  required
                  {...form.getInputProps('confirmPassword')}
                />
              )}

              <Button 
                type="submit" 
                fullWidth 
                loading={loading}
                size="md"
                variant="gradient"
                gradient={{ from: 'blue', to: 'purple' }}
              >
                {isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </Stack>
          </form>

          <Text ta="center" mt="md">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                setIsLogin(!isLogin)
                form.reset()
              }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </Button>
          </Text>
        </Paper>
      </Container>
    </Box>
  )
}

export default Login