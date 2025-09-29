import prisma from './prisma.js';

// Initialize database tables (not needed with Prisma migrations)
export async function initDatabase() {
  try {
    // Test connection
    await prisma.$connect();
    console.log('Database connection successful');
    return { success: true, message: 'Database connection successful' };
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
}

// User operations
export async function createUser(username, passwordHash) {
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
    },
    select: {
      id: true,
      username: true,
      createdAt: true,
    },
  });
  return user;
}

export async function getUserByUsername(username) {
  const user = await prisma.user.findUnique({
    where: { username },
  });
  return user;
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      createdAt: true,
    },
  });
  return user;
}

// Trade operations
export async function getTradesByUserId(userId) {
  const trades = await prisma.trade.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return trades;
}

export async function createTrade(userId, tradeData) {
  const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = tradeData;
  
  const trade = await prisma.trade.create({
    data: {
      userId,
      symbol,
      shares,
      buyPrice,
      buyDate: new Date(buyDate),
      sellPrice: sellPrice || null,
      sellDate: sellDate ? new Date(sellDate) : null,
      notes: notes || null,
    },
  });
  return trade;
}

export async function updateTrade(tradeId, userId, tradeData) {
  const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = tradeData;
  
  const trade = await prisma.trade.update({
    where: { 
      id: tradeId,
      userId: userId, // Ensure user owns the trade
    },
    data: {
      symbol,
      shares,
      buyPrice,
      buyDate: new Date(buyDate),
      sellPrice: sellPrice || null,
      sellDate: sellDate ? new Date(sellDate) : null,
      notes: notes || null,
    },
  });
  return trade;
}

export async function deleteTrade(tradeId, userId) {
  const trade = await prisma.trade.delete({
    where: { 
      id: tradeId,
      userId: userId, // Ensure user owns the trade
    },
  });
  return { id: trade.id };
}

export async function getTradeById(tradeId, userId) {
  const trade = await prisma.trade.findFirst({
    where: { 
      id: tradeId,
      userId: userId, // Ensure user owns the trade
    },
  });
  return trade;
}
