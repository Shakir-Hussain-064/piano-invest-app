import React,{useState,useEffect,useRef} from 'react';
import {ShieldCheck,LogOut,ArrowRight} from 'lucide-react';
import {POLICY_VERSION,policySections} from '../shared/policy';
import {api} from './api';
export function PolicyContent(){return <><p className="small muted">Version {POLICY_VERSION} · Updated 26 September 2026</p>{policySections.map(section=><section className="policy-section" key={section.title}><h2>{section.title}</h2>{section.paragraphs.map(p=><p key={p}>{p}</p>)}</section>)}</>;}
export default function PolicyNotice({onAccepted,onLogout,readOnly=false,onBack,popup=false}){
 const [checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const modalRef=useRef(null);
 useEffect(()=>{
  if(!popup)return;
  const modal=modalRef.current,previous=document.activeElement,overflow=document.body.style.overflow;
  modal.showModal();document.body.style.overflow='hidden';
  modal.querySelector('h1')?.focus({preventScroll:true});
  return()=>{modal.close();document.body.style.overflow=overflow;previous?.focus?.({preventScroll:true});};
 },[popup]);
 async function accept(e){e.preventDefault();setBusy(true);setError('');try{await api('/policy/acknowledge',{version:POLICY_VERSION,accepted:true});onAccepted();}catch(e){setError(e.message);}finally{setBusy(false);}}
 const content=<article className="policy-card"><span className="plan-icon"><ShieldCheck/></span><p className="eyebrow">PIANO WEALTH · BEFORE YOU CONTINUE</p><h1 id="policy-heading" tabIndex={-1}>Investment risk & privacy notice</h1><p className="policy-intro">Aap apni marzi aur samajh se invest karte hain. Invest ki hui rakam ka kuch hissa ya poori rakam lose ho sakti hai. Returns guaranteed nahi hain.</p><div className="policy-copy"><PolicyContent/></div>{readOnly?<button className="button" onClick={onBack}>Back to app<ArrowRight size={18}/></button>:<form className="policy-accept" onSubmit={accept}><label className="checkbox-label"><input type="checkbox" required checked={checked} onChange={e=>setChecked(e.target.checked)}/>I have read the risk and privacy notice. I understand the possibility of financial loss and make investment decisions voluntarily. My statutory rights remain unchanged.</label>{error&&<p className="error" role="alert">{error}</p>}<div className="flex"><button className="button" disabled={!checked||busy}>{busy?'Saving…':'Acknowledge and continue'}<ArrowRight size={18}/></button><button className="button outline" type="button" disabled={busy} onClick={onLogout}><LogOut size={18}/>Log out</button></div></form>}</article>;
 return popup?<dialog ref={modalRef} className="policy-modal" aria-labelledby="policy-heading" onCancel={e=>e.preventDefault()}>{content}</dialog>:<main className="policy-page">{content}</main>;
}
