import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendPushNotification } from './notifications';

const prisma = new PrismaClient();

// Example: Run every day at 9 AM
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
        console.log(`Would send push to user ${payment.user.id} for payment ID ${payment.id}`);
        const groupName = payment.cycle.group.name;
        const msgTitle = 'Tontine Payment Reminder';
        const msgBody = `You owe ${payment.amount} for cycle #${payment.cycle.cycleIndex} in ${groupName}.`;
        await sendPushNotification(payment.user.pushToken, msgTitle, msgBody);
      } else {
        console.log(`User ${payment.user.id} has no push token. Skipping...`);
      }
    }
  } catch (error) {
    console.error('Error in cron job:', error);
  }
});
