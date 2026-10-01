import 'dotenv/config';
import mongoose from 'mongoose';
// Local operator-only enrollment. Signup never grants an owner role based on email.
const [id,email]=process.argv.slice(2);
if(!/^[a-f0-9]{24}$/i.test(id||'')||!email){console.error('Usage: node scripts/set-owner.js <existing-account-id> <account-email>');process.exit(1);}
await mongoose.connect(process.env.MONGODB_URI);
try{
 const result=await mongoose.connection.collection('users').updateOne({_id:new mongoose.Types.ObjectId(id),email:email.toLowerCase().trim()},{$set:{role:'owner'}});
 if(!result.matchedCount)throw new Error('Account ID and email do not match. No access changed.');
 console.log('Owner access enabled. Sign in again and open Profile > Payment review.');
}finally{await mongoose.disconnect();}
