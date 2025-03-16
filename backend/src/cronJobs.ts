// src/cronJobs.ts
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { Expo } from 'expo-server-sdk';

const prisma = new PrismaClient();
const expo = new Expo();

// Direct implementation of notification functionality
async function sendPushNotification(token: string, title: string, body: string, data = {}) {
  try {
    if (!Expo.isExpoPushToken(token)) {
      console.error(`Invalid Expo push token: ${token}`);
      return false;
    }
    
    const message = {
      to: token,
      sound: 'default',
      title,
      body,
      data
    };
    
    const chunks = expo.chunkPushNotifications([message]);
    
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
        console.log('Push notification sent successfully');
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return false;
  }
}

// Example cron job for payment reminders
cron.schedule('0 9 * * *', async () => {
  console.log('Cron job running: Checking for unpaid payments...');
  try {
    const unpaidPayments = await prisma.payment.findMany({
      where: { 
        paid: false 
      },
      include: {
        user: true,
        cycle: {
          include: { group: true },
        },
      },
    });

    // For each unpaid payment, if user has pushToken => send a reminder
    for (const payment of unpaidPayments) {
      if (payment.user.pushToken) {
        console.log(`Sending push to user ${payment.user.id} for payment ID ${payment.id}`);
        const groupName = payment.cycle.group.name;
        const msgTitle = 'Tontine Payment Reminder';
        const msgBody = `You owe ${payment.amount} for cycle #${payment.cycle.cycleIndex} in ${groupName}.`;
        
        await sendPushNotification(
          payment.user.pushToken, 
          msgTitle, 
          msgBody,
          {
            type: 'payment_reminder',
            cycleId: payment.cycle.id,
            groupId: payment.cycle.groupId,
            paymentId: payment.id
          }
        );
      } else {
        console.log(`User ${payment.user.id} has no push token. Skipping...`);
      }
    }
  } catch (error) {
    console.error('Error in cron job:', error);
  }
});

// End-of-cycle reminder job
cron.schedule('0 */12 * * *', async () => {
  console.log('Checking for cycles ending soon...');
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const endingSoonCycles = await prisma.cycle.findMany({
      where: {
        status: 'active',
        endDate: {
          gte: new Date(),
          lte: tomorrow
        }
      },
      include: {
        group: true
      }
    });
    
    for (const cycle of endingSoonCycles) {
      // Get all unpaid payments for this cycle
      const unpaidPayments = await prisma.payment.findMany({
        where: {
          cycleId: cycle.id,
          paid: false
        },
        include: {
          user: true
        }
      });
      
      // Send urgent reminders for each unpaid payment
      for (const payment of unpaidPayments) {
        if (payment.user.pushToken) {
          await sendPushNotification(
            payment.user.pushToken,
            'Urgent Payment Reminder',
            `Your payment for ${cycle.group.name} (Cycle #${cycle.cycleIndex}) is due within 24 hours.`,
            {
              type: 'urgent_payment_reminder',
              cycleId: cycle.id,
              groupName: cycle.group.name,
              amount: payment.amount
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error checking for cycles ending soon:', error);
  }
});