let csrf='';
export async function api(route,body){
 const res=await fetch('/api'+route,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json','x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});
 let data;try{data=await res.json();}catch{throw new Error('Unable to reach the server. Please try again shortly.');}
 if(!res.ok)throw new Error(data.error||'Request failed.');if(data.csrf)csrf=data.csrf;return data;
}
