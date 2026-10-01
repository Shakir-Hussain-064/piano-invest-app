import {transaction} from '../shared/domain.js';
export const REFERRAL_BONUS=25000;
export function prepareReferral(user,inviterId,now=Date.now()){
 if(String(user._id)===String(inviterId))throw new Error('You cannot refer yourself.');
 user.wallet+=REFERRAL_BONUS;
 transaction(user,'referral_bonus',REFERRAL_BONUS,'Welcome bonus · referral signup',now,`referral-welcome-${user._id}`);
 user.referralReward={inviterId:String(inviterId),amount:REFERRAL_BONUS,status:'pending'};
}
export function creditInviter(user,referredUser){
 const reward=referredUser.referralReward;
 if(!reward||reward.amount!==REFERRAL_BONUS||String(user._id)!==reward.inviterId||String(user._id)===String(referredUser._id))throw new Error('Invalid referral reward.');
 const id=`referral-invite-${referredUser._id}`;
 if(user.transactions.some(t=>t.id===id))return false;
 user.wallet+=REFERRAL_BONUS;
 transaction(user,'referral_bonus',REFERRAL_BONUS,'Referral bonus · successful signup',Date.now(),id);
 return true;
}
export function createReferralService({User,mutate}){
 async function complete(referredUser){
  if(referredUser.referralReward?.status!=='pending')return;
  await mutate(referredUser.referralReward.inviterId,u=>creditInviter(u,referredUser));
  // A crash here leaves a retryable record; the inviter ledger prevents a
  // duplicate credit. The new account and its welcome credit were saved together.
  await User.updateOne({_id:referredUser._id,'referralReward.status':'pending'},{$set:{'referralReward.status':'complete','referralReward.completedAt':new Date()}});
 }
 async function recover(){
  for await(const u of User.find({'referralReward.status':'pending'}).cursor()){
   try{await complete(u);}catch{console.error('Referral reward awaiting retry',u.id);}
  }
 }
 return {complete,recover};
}
