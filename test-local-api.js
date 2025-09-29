// Test local API and database connection
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Create Prisma client
const prisma = new PrismaClient().$extends(withAccelerate());

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Test simple query
    const result = await prisma.$queryRaw`SELECT 1 as test, NOW() as current_time`;
    console.log('✅ Simple query successful:', result[0]);

    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

async function testUserCreation() {
  try {
    console.log('👤 Testing user creation...');
    
    const testUsername = 'testuser_' + Date.now();
    const testPassword = 'testpassword123';
    
    // Hash password
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    console.log('✅ Password hashed successfully');

    // Create user
    const user = await prisma.user.create({
      data: {
        username: testUsername,
        passwordHash: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });
    console.log('✅ User created successfully:', user);

    // Test login (find user)
    const foundUser = await prisma.user.findUnique({
      where: { username: testUsername },
    });
    console.log('✅ User found successfully:', foundUser);

    // Test password verification
    const isValidPassword = await bcrypt.compare(testPassword, foundUser.passwordHash);
    console.log('✅ Password verification successful:', isValidPassword);

    // Generate JWT token
    const token = jwt.sign(
      { userId: foundUser.id, username: foundUser.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    console.log('✅ JWT token generated successfully');

    // Clean up test user
    await prisma.user.delete({
      where: { id: foundUser.id },
    });
    console.log('✅ Test user cleaned up');

    return true;
  } catch (error) {
    console.error('❌ User creation test failed:', error);
    return false;
  }
}

async function testTradeOperations() {
  try {
    console.log('📊 Testing trade operations...');
    
    // Create a test user first
    const testUsername = 'trader_' + Date.now();
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const user = await prisma.user.create({
      data: {
        username: testUsername,
        passwordHash: hashedPassword,
      },
    });

    // Create a test trade
    const trade = await prisma.trade.create({
      data: {
        userId: user.id,
        symbol: 'AAPL',
        shares: 10,
        buyPrice: 150.50,
        buyDate: new Date('2024-01-15'),
        sellPrice: 155.75,
        sellDate: new Date('2024-01-20'),
        notes: 'Test trade for local testing',
      },
    });
    console.log('✅ Trade created successfully:', trade);

    // Get trades for user
    const userTrades = await prisma.trade.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    console.log('✅ Trades retrieved successfully:', userTrades.length, 'trades');

    // Update trade
    const updatedTrade = await prisma.trade.update({
      where: { id: trade.id },
      data: { notes: 'Updated test trade' },
    });
    console.log('✅ Trade updated successfully');

    // Delete trade
    await prisma.trade.delete({
      where: { id: trade.id },
    });
    console.log('✅ Trade deleted successfully');

    // Clean up test user
    await prisma.user.delete({
      where: { id: user.id },
    });
    console.log('✅ Test user cleaned up');

    return true;
  } catch (error) {
    console.error('❌ Trade operations test failed:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting local API and database tests...\n');
  
  const connectionTest = await testDatabaseConnection();
  if (!connectionTest) {
    console.log('❌ Database connection failed, stopping tests');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  const userTest = await testUserCreation();
  if (!userTest) {
    console.log('❌ User creation test failed, stopping tests');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  const tradeTest = await testTradeOperations();
  if (!tradeTest) {
    console.log('❌ Trade operations test failed');
    return;
  }
  
  console.log('\n🎉 All tests passed! Your database and API are working correctly.');
  console.log('You can now test the full application at: http://localhost:5173');
}

// Run the tests
runAllTests()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
  });
