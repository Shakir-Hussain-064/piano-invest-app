import mongoose from 'mongoose';
import {transaction} from '../shared/domain.js';

export const qrPayment={image:'/payment-qr-clean.png',brand:'Piano Wealth',beneficiary:'SHAKIR HUSAIN',verification:'manual'};
const claimSchema=new mongoose.Schema({
  _id:String,userId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true,ref:'User'},
  amount:{type:Number,required:true,min:10000,max:10000000},
  utr:{type:String,required:true,unique:true,match:/^\d{12}$/},
  status:{type:String,enum:['pending','approving','approved','rejected'],default:'pending',index:true},
  reviewedBy:mongoose.Schema.Types.ObjectId,reviewedAt:Date,creditedAt:Date,reviewNote:String
},{timestamps:true});
export const Recharge=mongoose.model('Recharge',claimSchema);
export const publicClaim=c=>({id:c.id,amount:c.amount,utr:c.utr,status:c.status,createdAt:c.createdAt,reviewNote:c.status==='rejected'?c.reviewNote:undefined});
export function creditClaim(user,claim){
  if(claim.status!=='approving'||!claim.reviewedBy||!claim.reviewedAt)throw new Error('Payment has not been reviewed.');
  if(String(user._id)!==String(claim.userId))throw new Error('Payment account mismatch.');
  if(!Number.isSafeInteger(claim.amount)||claim.amount<10000||claim.amount>10000000)throw new Error('Invalid payment amount.');
  const id=`qr-${claim.id}`;
  if(user.transactions.some(t=>t.id===id))return false;
  user.wallet+=claim.amount;
  transaction(user,'recharge',claim.amount,`UPI recharge confirmed · UTR ${claim.utr}`,Date.now(),id);
  return true;
}
// The approval intent is persisted before wallet credit. The wallet ledger and
// balance share one optimistic-concurrency write; retries after a crash are safe.
export function createRechargeService({mutate}){
  async function complete(claim){
    await mutate(claim.userId,u=>creditClaim(u,claim));
    await Recharge.updateOne({_id:claim.id,status:'approving'},{$set:{status:'approved',creditedAt:new Date()}});
  }
  async function approve(id,reviewer,note){
    let claim=await Recharge.findOneAndUpdate({_id:id,status:'pending'},{$set:{status:'approving',reviewedBy:reviewer,reviewedAt:new Date(),reviewNote:note}},{new:true});
    if(!claim)claim=await Recharge.findById(id);
    if(!claim)throw new Error('Recharge not found.');
    if(claim.status==='rejected')throw new Error('This recharge was rejected.');
    if(claim.status==='approving')await complete(claim);
  }
  async function recover(){for await(const claim of Recharge.find({status:'approving'}).cursor())await complete(claim);}
  return {approve,recover};
}
