const mongoose = require('mongoose');
const uri = 'mongodb://Shakir064:Shakir064@ac-miebea6-shard-00-00.df9jmrv.mongodb.net:27017,ac-miebea6-shard-00-01.df9jmrv.mongodb.net:27017,ac-miebea6-shard-00-02.df9jmrv.mongodb.net:27017/?ssl=true&replicaSet=atlas-i8q6z3-shard-0&authSource=admin&appName=Uber-App';

async function addPlan() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.client.db('test');
    
    const user = await db.collection('users').findOne({ email: 'usershakir2023@gmail.com' });
    if (!user) {
      console.error('User not found!');
      process.exit(1);
    }
    console.log('Found user:', user.name, user.email, user._id);

    // 5000 Piano Plan: 500/day, 10000 total return, 20 days
    const newPlan = {
      userId: user._id,
      planId: 'gold',
      planName: '🎹 Piano Concerto',
      isVip: false,
      investedAmount: 5000,
      dailyEarn: 500,
      totalReturn: 10000,
      earnedSoFar: 0,
      daysCompleted: 0,
      totalDays: 20,
      startDate: new Date(),
      lastCreditDate: null,
      isComplete: false
    };

    const planRes = await db.collection('activeplans').insertOne(newPlan);
    console.log('Inserted active plan ID:', planRes.insertedId);

    // Check or create wallet
    let wallet = await db.collection('wallets').findOne({ userId: user._id });
    const tx = {
      type: 'debit',
      amount: 5000,
      description: 'Purchased 🎹 Piano Concerto Plan',
      date: new Date()
    };

    if (!wallet) {
      await db.collection('wallets').insertOne({
        userId: user._id,
        balance: 0,
        recharged: 5000,
        totalEarned: 0,
        withdrawableBalance: 0,
        totalWithdrawn: 0,
        transactions: [tx]
      });
      console.log('Created wallet with transaction');
    } else {
      await db.collection('wallets').updateOne(
        { userId: user._id },
        {
          $push: { transactions: tx }
        }
      );
      console.log('Updated wallet with transaction');
    }

    const allPlans = await db.collection('activeplans').find({ userId: user._id }).toArray();
    console.log('SUCCESS! Total active plans for Shakir Hussain:', allPlans.length);
    console.log('Plan details:', JSON.stringify(newPlan, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

addPlan();
